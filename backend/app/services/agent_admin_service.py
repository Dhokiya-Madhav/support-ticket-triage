from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ConflictError, InvalidInputError, NotFoundError
from app.core.search import like_pattern
from app.core.security import hash_password
from app.models import AgentSkill, AuditEvent, DraftReply, Ticket, User
from app.models.enums import Category, Role, TicketStatus
from app.schemas.manager import AgentCreate, AgentList, AgentOut, AgentUpdate


def _open_counts(db: Session, agent_ids: list[int]) -> dict[int, int]:
    if not agent_ids:
        return {}
    rows = db.execute(
        select(Ticket.assignee_id, func.count())
        .where(Ticket.assignee_id.in_(agent_ids), Ticket.status == TicketStatus.open)
        .group_by(Ticket.assignee_id)
    ).all()
    return {agent_id: n for agent_id, n in rows if agent_id is not None}


def _out(user: User, open_tickets: int) -> AgentOut:
    return AgentOut(
        id=user.id,
        name=user.name,
        email=user.email,
        is_active=user.is_active,
        max_open_tickets=user.max_open_tickets,
        skills=[s.category for s in user.skills],
        open_tickets=open_tickets,
        created_at=user.created_at,
    )


def _get_agent(db: Session, agent_id: int) -> User:
    agent = db.scalar(
        select(User)
        .where(User.id == agent_id, User.role == Role.agent)
        .options(selectinload(User.skills))
    )
    if agent is None:
        raise NotFoundError
    return agent


def list_agents(
    db: Session,
    search: str | None,
    skill: Category | None,
    status: Literal["active", "inactive"] | None,
    limit: int,
    offset: int,
) -> AgentList:
    where = [User.role == Role.agent]
    term = (search or "").strip()
    if term:
        pattern = like_pattern(term)
        where.append(
            or_(User.name.ilike(pattern, escape="\\"), User.email.ilike(pattern, escape="\\"))
        )
    if skill:
        where.append(User.skills.any(AgentSkill.category == skill))
    if status:
        where.append(User.is_active.is_(status == "active"))

    total = db.scalar(select(func.count()).select_from(User).where(*where)) or 0
    agents = db.scalars(
        select(User)
        .where(*where)
        .options(selectinload(User.skills))
        .order_by(User.name, User.id)
        .limit(limit)
        .offset(offset)
    ).all()
    counts = _open_counts(db, [a.id for a in agents])
    return AgentList(items=[_out(a, counts.get(a.id, 0)) for a in agents], total=total)


def get_agent(db: Session, agent_id: int) -> AgentOut:
    agent = _get_agent(db, agent_id)
    return _out(agent, _open_counts(db, [agent.id]).get(agent.id, 0))


def create_agent(db: Session, data: AgentCreate) -> AgentOut:
    if db.scalar(select(User.id).where(User.email == data.email)):
        raise ConflictError("Email is already registered")
    agent = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=Role.agent,
        max_open_tickets=data.max_open_tickets,
    )
    agent.skills = [AgentSkill(category=c) for c in data.skills]
    db.add(agent)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError("Email is already registered") from None
    return get_agent(db, agent.id)


def update_agent(db: Session, manager: User, agent_id: int, data: AgentUpdate) -> AgentOut:
    agent = _get_agent(db, agent_id)
    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise InvalidInputError("Name is required")
        agent.name = name
    if data.max_open_tickets is not None:
        agent.max_open_tickets = data.max_open_tickets
    if data.password is not None:
        agent.password_hash = hash_password(data.password)
    if data.skills is not None:
        wanted = set(data.skills)
        agent.skills = [s for s in agent.skills if s.category in wanted] + [
            AgentSkill(category=c)
            for c in data.skills
            if c not in {s.category for s in agent.skills}
        ]
    if data.is_active is not None and data.is_active != agent.is_active:
        agent.is_active = data.is_active
        if not data.is_active:
            _release_open_tickets(db, manager, agent)
    db.commit()
    return get_agent(db, agent_id)


def _release_open_tickets(db: Session, manager: User, agent: User) -> None:
    """A deactivated agent's open tickets go back to the queue for automatic reassignment."""
    ids = list(
        db.scalars(
            select(Ticket.id).where(
                Ticket.assignee_id == agent.id, Ticket.status == TicketStatus.open
            )
        )
    )
    if not ids:
        return
    db.execute(update(Ticket).where(Ticket.id.in_(ids)).values(assignee_id=None, assigned_at=None))
    for ticket_id in ids:
        db.add(
            AuditEvent(
                ticket_id=ticket_id,
                actor=manager.email,
                action="unassigned",
                detail={"reason": "agent_deactivated", "agent_id": agent.id},
            )
        )


def delete_agent(db: Session, manager: User, agent_id: int) -> None:
    """Permanently remove an agent and their skills.

    Their open tickets go back to the unassigned queue (and are reassigned by the sweep). Resolved
    tickets keep their history but no longer name an assignee. Drafts they edited keep the text.
    """
    agent = _get_agent(db, agent_id)
    open_ids = list(
        db.scalars(
            select(Ticket.id).where(
                Ticket.assignee_id == agent.id, Ticket.status == TicketStatus.open
            )
        )
    )
    db.execute(
        update(Ticket)
        .where(Ticket.assignee_id == agent.id, Ticket.status == TicketStatus.open)
        .values(assigned_at=None)
    )
    db.execute(update(Ticket).where(Ticket.assignee_id == agent.id).values(assignee_id=None))
    db.execute(update(DraftReply).where(DraftReply.edited_by == agent.id).values(edited_by=None))
    for ticket_id in open_ids:
        db.add(
            AuditEvent(
                ticket_id=ticket_id,
                actor=manager.email,
                action="unassigned",
                detail={"reason": "agent_deleted", "agent_id": agent.id},
            )
        )
    db.delete(agent)
    db.commit()


def assign_ticket(db: Session, manager: User, ticket_id: int, agent_id: int) -> None:
    """Manual (re)assignment. Managers may override the skill match and the workload cap."""
    ticket = db.scalar(select(Ticket).where(Ticket.id == ticket_id).with_for_update())
    if ticket is None:
        db.rollback()
        raise NotFoundError
    if ticket.status != TicketStatus.open:
        db.rollback()
        raise ConflictError("Ticket is resolved")
    agent = db.get(User, agent_id)
    if agent is None or agent.role != Role.agent:
        db.rollback()
        raise InvalidInputError("Agent not found")
    if not agent.is_active:
        db.rollback()
        raise InvalidInputError("Agent is deactivated")

    previous = ticket.assignee_id
    ticket.assignee_id = agent.id
    ticket.assigned_at = datetime.now(UTC)
    db.add(
        AuditEvent(
            ticket_id=ticket.id,
            actor=manager.email,
            action="reassigned" if previous else "assigned_by_manager",
            detail={"from_agent_id": previous, "to_agent_id": agent.id},
        )
    )
    db.commit()
