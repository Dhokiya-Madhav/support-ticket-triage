import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.integrations.triage import TriageProvider
from app.models import AuditEvent, DraftReply, Message, Ticket
from app.models.enums import Direction, DraftStatus, TriageStatus
from app.services import assignment_service

logger = logging.getLogger(__name__)

MAX_CONVERSATION_CHARS = 8000
SWEEP_BATCH = 50
_TRIAGEABLE = (TriageStatus.pending, TriageStatus.failed)


def get_provider() -> TriageProvider | None:
    settings = get_settings()
    if not settings.gemini_api_key:
        return None
    from app.integrations.gemini import GeminiTriageProvider

    return GeminiTriageProvider(settings.gemini_api_key, settings.gemini_model)


def _conversation(db: Session, ticket_id: int) -> str:
    bodies = db.scalars(
        select(Message.body_text)
        .where(Message.ticket_id == ticket_id, Message.direction == Direction.inbound)
        .order_by(Message.created_at, Message.id)
    ).all()
    return "\n\n---\n\n".join(bodies)[:MAX_CONVERSATION_CHARS]


def triage_ticket(db: Session, ticket_id: int, provider: TriageProvider) -> bool:
    """Classify one ticket and store a draft reply. Returns True if the ticket was triaged.

    The row lock makes concurrent runs (request task and sweep) skip a ticket in progress.
    """
    ticket = db.scalar(
        select(Ticket)
        .where(
            Ticket.id == ticket_id,
            Ticket.triage_status.in_(_TRIAGEABLE),
            Ticket.triage_attempts < get_settings().triage_max_attempts,
        )
        .with_for_update(skip_locked=True)
    )
    if ticket is None:
        return False

    now = datetime.now(UTC)
    try:
        result = provider.analyze(
            ticket.customer.name, ticket.subject, _conversation(db, ticket.id)
        )
    except Exception as exc:
        ticket.triage_attempts += 1
        ticket.triage_attempted_at = now
        ticket.triage_status = TriageStatus.failed
        db.add(
            AuditEvent(
                ticket_id=ticket.id,
                actor="system",
                action="triage_failed",
                detail={"attempt": ticket.triage_attempts, "error": type(exc).__name__},
            )
        )
        db.commit()
        logger.warning(
            "Triage failed for ticket %s (attempt %s): %s",
            ticket_id,
            ticket.triage_attempts,
            type(exc).__name__,
        )
        return False

    ticket.category = result.category
    ticket.urgency = result.urgency
    ticket.sentiment = result.sentiment
    ticket.summary = result.summary
    ticket.triage_status = TriageStatus.done
    ticket.triage_attempts += 1
    ticket.triage_attempted_at = now
    for old in db.scalars(
        select(DraftReply).where(
            DraftReply.ticket_id == ticket.id, DraftReply.status == DraftStatus.pending
        )
    ):
        old.status = DraftStatus.discarded
    db.add(DraftReply(ticket_id=ticket.id, body=result.draft_reply))
    db.add(
        AuditEvent(
            ticket_id=ticket.id,
            actor="system",
            action="triaged",
            detail={
                "category": result.category.value,
                "urgency": result.urgency.value,
                "sentiment": result.sentiment.value,
            },
        )
    )
    db.commit()
    return True


def find_due_ticket_ids(db: Session) -> list[int]:
    """Tickets waiting for triage whose retry back-off (1, 2, 4... minutes) has elapsed."""
    now = datetime.now(UTC)
    rows = db.execute(
        select(Ticket.id, Ticket.triage_attempts, Ticket.triage_attempted_at)
        .where(
            Ticket.triage_status.in_(_TRIAGEABLE),
            Ticket.triage_attempts < get_settings().triage_max_attempts,
        )
        .order_by(Ticket.id)
        .limit(SWEEP_BATCH)
    ).all()
    due: list[int] = []
    for ticket_id, attempts, attempted_at in rows:
        if attempted_at is None or now - attempted_at >= timedelta(minutes=2 ** (attempts - 1)):
            due.append(ticket_id)
    return due


def run_triage(ticket_id: int) -> None:
    """Entry point for background tasks: owns its own session."""
    provider = get_provider()
    if provider is None:
        logger.warning("GEMINI_API_KEY is not set; ticket %s stays pending", ticket_id)
        return
    triaged = False
    with SessionLocal() as db:
        try:
            triaged = triage_ticket(db, ticket_id, provider)
        except Exception:
            db.rollback()
            logger.exception("Unexpected error triaging ticket %s", ticket_id)
    if triaged:
        assignment_service.run_assignment(ticket_id)


def run_sweep() -> int:
    """Pick up tickets left pending (e.g. after a restart) or failed and due for a retry."""
    if get_provider() is None:
        return 0
    with SessionLocal() as db:
        ids = find_due_ticket_ids(db)
    for ticket_id in ids:
        run_triage(ticket_id)
    return len(ids)
