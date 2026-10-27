import logging
from datetime import UTC, datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models import AgentSkill, AuditEvent, Ticket, User
from app.models.enums import Role, TicketStatus, TriageStatus, Urgency

logger = logging.getLogger(__name__)

SWEEP_BATCH = 100


def _pick_agent(db: Session, ticket: Ticket) -> tuple[User, int] | None:
    """Least-loaded active agent with the ticket's skill who is under their open-ticket cap.

    Candidate rows are locked, so concurrent assignments queue up and each one counts
    workload after the previous one has committed. That keeps agents from exceeding the cap.
    """
    candidates = db.scalars(
        select(User)
        .join(AgentSkill, AgentSkill.user_id == User.id)
        .where(
            User.role == Role.agent,
            User.is_active.is_(True),
            AgentSkill.category == ticket.category,
        )
        .order_by(User.id)
        .with_for_update(of=User)
    ).all()
    if not candidates:
        return None

    ids = [u.id for u in candidates]
    stats = {
        agent_id: (open_count, last_assigned)
        for agent_id, open_count, last_assigned in db.execute(
            select(
                Ticket.assignee_id,
                func.count().filter(Ticket.status == TicketStatus.open),
                func.max(Ticket.assigned_at),
            )
            .where(Ticket.assignee_id.in_(ids))
            .group_by(Ticket.assignee_id)
        )
    }
    epoch = datetime.min.replace(tzinfo=UTC)

    def load(user: User) -> tuple[int, datetime, int]:
        open_count, last_assigned = stats.get(user.id, (0, None))
        # Fewest open tickets first; ties go to whoever was assigned least recently.
        return open_count, last_assigned or epoch, user.id

    available = [u for u in candidates if stats.get(u.id, (0, None))[0] < u.max_open_tickets]
    if not available:
        return None
    best = min(available, key=load)
    return best, load(best)[0]


def assign_ticket(db: Session, ticket_id: int) -> User | None:
    """Assign one triaged, open, unassigned ticket. Returns the agent, or None if none fits."""
    ticket = db.scalar(
        select(Ticket)
        .where(
            Ticket.id == ticket_id,
            Ticket.status == TicketStatus.open,
            Ticket.triage_status == TriageStatus.done,
            Ticket.category.is_not(None),
            Ticket.assignee_id.is_(None),
        )
        .with_for_update(skip_locked=True)
    )
    if ticket is None:
        return None

    picked = _pick_agent(db, ticket)
    if picked is None:
        db.rollback()
        return None
    agent, open_before = picked

    ticket.assignee_id = agent.id
    ticket.assigned_at = datetime.now(UTC)
    db.add(
        AuditEvent(
            ticket_id=ticket.id,
            actor="system",
            action="assigned",
            detail={"agent_id": agent.id, "open_tickets_before": open_before},
        )
    )
    db.commit()
    return agent


def assign_waiting(db: Session) -> int:
    """Assign triaged tickets still waiting for an agent, most urgent and oldest first."""
    urgency_rank = case(
        {Urgency.high: 0, Urgency.medium: 1, Urgency.low: 2}, value=Ticket.urgency, else_=3
    )
    ids = db.scalars(
        select(Ticket.id)
        .where(
            Ticket.status == TicketStatus.open,
            Ticket.triage_status == TriageStatus.done,
            Ticket.assignee_id.is_(None),
        )
        .order_by(urgency_rank, Ticket.created_at, Ticket.id)
        .limit(SWEEP_BATCH)
    ).all()
    return sum(1 for ticket_id in ids if assign_ticket(db, ticket_id) is not None)


def run_assignment(ticket_id: int) -> None:
    """Entry point for background tasks: owns its own session and never raises."""
    with SessionLocal() as db:
        try:
            agent = assign_ticket(db, ticket_id)
            if agent is None:
                logger.info("Ticket %s left unassigned (no available agent)", ticket_id)
        except Exception:
            db.rollback()
            logger.exception("Unexpected error assigning ticket %s", ticket_id)


def run_sweep() -> int:
    with SessionLocal() as db:
        return assign_waiting(db)
