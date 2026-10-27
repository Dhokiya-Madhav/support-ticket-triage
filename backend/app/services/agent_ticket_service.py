from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import get_settings
from app.core.exceptions import (
    ConflictError,
    InvalidInputError,
    NotFoundError,
    PermissionDeniedError,
)
from app.core.search import like_pattern, ticket_number
from app.models import AuditEvent, DraftReply, Message, Ticket, User
from app.models.enums import (
    Category,
    Direction,
    DraftStatus,
    Role,
    TicketStatus,
    TriageStatus,
    Urgency,
)
from app.schemas.agent_tickets import (
    AgentTicketDetail,
    AgentTicketItem,
    AgentTicketList,
    DraftOut,
    PersonOut,
)

MAX_BODY = 10_000


def _sla() -> timedelta:
    return timedelta(hours=get_settings().sla_first_response_hours)


def _is_overdue(ticket: Ticket, now: datetime) -> bool:
    return (
        ticket.status == TicketStatus.open
        and ticket.first_response_at is None
        and now > ticket.created_at + _sla()
    )


def _item(ticket: Ticket, now: datetime) -> AgentTicketItem:
    return AgentTicketItem(
        id=ticket.id,
        subject=ticket.subject,
        customer_name=ticket.customer.name,
        status=ticket.status,
        category=ticket.category,
        urgency=ticket.urgency,
        sentiment=ticket.sentiment,
        summary=ticket.summary,
        triage_status=ticket.triage_status,
        assignee=PersonOut.model_validate(ticket.assignee) if ticket.assignee else None,
        created_at=ticket.created_at,
        first_response_at=ticket.first_response_at,
        due_at=ticket.created_at + _sla(),
        is_overdue=_is_overdue(ticket, now),
    )


def _detail(ticket: Ticket) -> AgentTicketDetail:
    now = datetime.now(UTC)
    draft = next(
        (d for d in sorted(ticket.drafts, key=lambda d: d.id, reverse=True)
         if d.status == DraftStatus.pending),
        None,
    )  # fmt: skip
    return AgentTicketDetail(
        **_item(ticket, now).model_dump(),
        customer=PersonOut.model_validate(ticket.customer),
        resolved_at=ticket.resolved_at,
        messages=ticket.messages,
        draft=DraftOut.model_validate(draft) if draft else None,
    )


def _can_view(user: User, ticket: Ticket) -> bool:
    if user.role == Role.manager:
        return True
    return ticket.assignee_id in (user.id, None)


def _priority_order() -> tuple[Any, ...]:
    """Most urgent first, then oldest."""
    rank = case({Urgency.high: 0, Urgency.medium: 1, Urgency.low: 2}, value=Ticket.urgency, else_=3)
    return rank, Ticket.created_at, Ticket.id


def list_tickets(
    db: Session,
    user: User,
    scope: str,
    status: TicketStatus | None,
    category: Category | None,
    urgency: Urgency | None,
    triage_status: TriageStatus | None,
    overdue: bool | None,
    search: str | None,
    limit: int,
    offset: int,
) -> AgentTicketList:
    where = []
    if scope == "mine":
        where.append(Ticket.assignee_id == user.id)
    elif scope == "unassigned":
        where += [Ticket.assignee_id.is_(None), Ticket.status == TicketStatus.open]
    elif scope == "all":
        if user.role != Role.manager:
            raise PermissionDeniedError
    else:
        raise InvalidInputError("scope must be mine, unassigned or all")

    if status:
        where.append(Ticket.status == status)
    if category:
        where.append(Ticket.category == category)
    if urgency:
        where.append(Ticket.urgency == urgency)
    if triage_status:
        where.append(Ticket.triage_status == triage_status)
    term = (search or "").strip()
    if term:
        pattern = like_pattern(term)
        matches = [
            Ticket.subject.ilike(pattern, escape="\\"),
            Ticket.customer.has(
                or_(User.name.ilike(pattern, escape="\\"), User.email.ilike(pattern, escape="\\"))
            ),
        ]
        number = ticket_number(term)
        if number is not None:
            matches.append(Ticket.id == number)
        where.append(or_(*matches))
    if overdue is not None:
        now = datetime.now(UTC)
        late = (
            (Ticket.status == TicketStatus.open)
            & Ticket.first_response_at.is_(None)
            & (Ticket.created_at < now - _sla())
        )
        where.append(late if overdue else ~late)

    total = db.scalar(select(func.count()).select_from(Ticket).where(*where)) or 0
    rows = db.scalars(
        select(Ticket)
        .where(*where)
        .order_by(*_priority_order())
        .options(joinedload(Ticket.customer), joinedload(Ticket.assignee))
        .limit(limit)
        .offset(offset)
    ).all()
    now = datetime.now(UTC)
    return AgentTicketList(items=[_item(t, now) for t in rows], total=total)


def _load_detail(db: Session, ticket_id: int) -> Ticket:
    ticket = db.scalar(
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            joinedload(Ticket.customer),
            joinedload(Ticket.assignee),
            selectinload(Ticket.messages).selectinload(Message.attachments),
            selectinload(Ticket.drafts),
        )
    )
    if ticket is None:
        raise NotFoundError
    return ticket


def get_ticket(db: Session, user: User, ticket_id: int) -> AgentTicketDetail:
    ticket = _load_detail(db, ticket_id)
    if not _can_view(user, ticket):
        raise NotFoundError
    return _detail(ticket)


def _lock_for_update(db: Session, user: User, ticket_id: int) -> Ticket:
    """Lock a ticket the user is allowed to change: their own, or any for a manager."""
    ticket = db.scalar(select(Ticket).where(Ticket.id == ticket_id).with_for_update())
    if ticket is None or not _can_view(user, ticket):
        db.rollback()
        raise NotFoundError
    if user.role == Role.agent and ticket.assignee_id is None:
        db.rollback()
        raise ConflictError("Claim this ticket first")
    return ticket


def _clean(body: str) -> str:
    body = body.strip()
    if not body:
        raise InvalidInputError("Message cannot be empty")
    if len(body) > MAX_BODY:
        raise InvalidInputError(f"Message must be at most {MAX_BODY} characters")
    return body


def _pending_drafts(db: Session, ticket_id: int) -> list[DraftReply]:
    return list(
        db.scalars(
            select(DraftReply)
            .where(DraftReply.ticket_id == ticket_id, DraftReply.status == DraftStatus.pending)
            .order_by(DraftReply.id.desc())
        )
    )


def claim(db: Session, user: User, ticket_id: int) -> AgentTicketDetail:
    if user.role != Role.agent:
        raise PermissionDeniedError
    ticket = db.scalar(select(Ticket).where(Ticket.id == ticket_id).with_for_update())
    if ticket is None:
        db.rollback()
        raise NotFoundError
    if ticket.assignee_id == user.id:
        db.rollback()
        return get_ticket(db, user, ticket_id)
    if ticket.assignee_id is not None:
        db.rollback()
        raise ConflictError("Ticket is already assigned")
    if ticket.status != TicketStatus.open:
        db.rollback()
        raise ConflictError("Ticket is resolved")
    ticket.assignee_id = user.id
    ticket.assigned_at = datetime.now(UTC)
    db.add(AuditEvent(ticket_id=ticket.id, actor=user.email, action="claimed", detail=None))
    db.commit()
    return get_ticket(db, user, ticket_id)


def save_draft(db: Session, user: User, ticket_id: int, body: str) -> AgentTicketDetail:
    body = _clean(body)
    ticket = _lock_for_update(db, user, ticket_id)
    if ticket.status == TicketStatus.resolved:
        db.rollback()
        raise ConflictError("Ticket is resolved")
    drafts = _pending_drafts(db, ticket.id)
    if drafts:
        drafts[0].body = body
        drafts[0].edited_by = user.id
    else:
        db.add(DraftReply(ticket_id=ticket.id, body=body, edited_by=user.id))
    db.commit()
    return get_ticket(db, user, ticket_id)


def send_reply(db: Session, user: User, ticket_id: int, body: str) -> AgentTicketDetail:
    """Record the agent's reply on the ticket. The customer sees it in their portal."""
    body = _clean(body)
    ticket = _lock_for_update(db, user, ticket_id)
    if ticket.status == TicketStatus.resolved:
        db.rollback()
        raise ConflictError("Ticket is resolved")

    now = datetime.now(UTC)
    db.add(
        Message(
            ticket_id=ticket.id,
            direction=Direction.outbound,
            sender=user.email,
            body_text=body,
            created_at=now,
        )
    )
    first = ticket.first_response_at is None
    if first:
        ticket.first_response_at = now
    for draft in _pending_drafts(db, ticket.id):
        draft.status = DraftStatus.sent
        draft.edited_by = user.id
    db.add(
        AuditEvent(
            ticket_id=ticket.id,
            actor=user.email,
            action="reply_sent",
            detail={"first_response": first},
        )
    )
    db.commit()
    return get_ticket(db, user, ticket_id)


def resolve(db: Session, user: User, ticket_id: int) -> AgentTicketDetail:
    ticket = _lock_for_update(db, user, ticket_id)
    if ticket.status == TicketStatus.resolved:
        db.rollback()
        raise ConflictError("Ticket is already resolved")
    ticket.status = TicketStatus.resolved
    ticket.resolved_at = datetime.now(UTC)
    db.add(AuditEvent(ticket_id=ticket.id, actor=user.email, action="resolved", detail=None))
    db.commit()
    return get_ticket(db, user, ticket_id)


def request_retriage(db: Session, user: User, ticket_id: int) -> int:
    """Reset triage so the background worker runs it again. Returns the ticket id."""
    ticket = _lock_for_update(db, user, ticket_id)
    if ticket.status == TicketStatus.resolved:
        db.rollback()
        raise ConflictError("Ticket is resolved")
    ticket.triage_status = TriageStatus.pending
    ticket.triage_attempts = 0
    ticket.triage_attempted_at = None
    db.add(
        AuditEvent(ticket_id=ticket.id, actor=user.email, action="retriage_requested", detail=None)
    )
    db.commit()
    return ticket.id
