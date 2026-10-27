import mimetypes
from dataclasses import dataclass
from pathlib import PurePath

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import InvalidInputError, NotFoundError, TooManyAttemptsError
from app.core.ratelimit import RateLimiter
from app.models import Attachment, AuditEvent, Message, Ticket, User
from app.models.enums import Direction, TicketStatus
from app.schemas.tickets import TicketList, TicketListItem
from app.services import storage_service

MAX_FILES = 5
MAX_SUBJECT = 200
MAX_DESCRIPTION = 10_000
ALLOWED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".txt", ".csv", ".log", ".docx", ".xlsx",
}  # fmt: skip

# Per-customer cap on new tickets and follow-ups, keyed by user id.
submit_limiter = RateLimiter(max_attempts=20, window_seconds=3600)


@dataclass
class UploadedFile:
    filename: str
    data: bytes


def validate_files(files: list[UploadedFile]) -> None:
    if len(files) > MAX_FILES:
        raise InvalidInputError(f"At most {MAX_FILES} attachments are allowed")
    for f in files:
        if PurePath(f.filename).suffix.lower() not in ALLOWED_EXTENSIONS:
            raise InvalidInputError(
                f"File type not allowed: {storage_service.safe_filename(f.filename)}"
            )


def _clean_body(body: str) -> str:
    body = body.strip()
    if not body:
        raise InvalidInputError("Message cannot be empty")
    if len(body) > MAX_DESCRIPTION:
        raise InvalidInputError(f"Message must be at most {MAX_DESCRIPTION} characters")
    return body


def _check_rate(customer: User) -> None:
    key = f"user:{customer.id}"
    if submit_limiter.is_blocked(key):
        raise TooManyAttemptsError
    submit_limiter.record(key)


def _add_message(
    db: Session,
    ticket: Ticket,
    sender: User,
    direction: Direction,
    body: str,
    files: list[UploadedFile],
    saved_keys: list[str],
) -> None:
    message = Message(ticket_id=ticket.id, direction=direction, sender=sender.email, body_text=body)
    db.add(message)
    db.flush()
    for f in files:
        key = storage_service.save(ticket.id, f.filename, f.data)
        saved_keys.append(key)
        db.add(
            Attachment(
                message_id=message.id,
                filename=storage_service.safe_filename(f.filename),
                content_type=mimetypes.guess_type(f.filename)[0] or "application/octet-stream",
                size=len(f.data),
                storage_key=key,
            )
        )


def create_ticket(
    db: Session, customer: User, subject: str, description: str, files: list[UploadedFile]
) -> Ticket:
    subject = subject.strip()
    if not subject:
        raise InvalidInputError("Subject is required")
    if len(subject) > MAX_SUBJECT:
        raise InvalidInputError(f"Subject must be at most {MAX_SUBJECT} characters")
    description = _clean_body(description)
    validate_files(files)
    _check_rate(customer)

    saved_keys: list[str] = []
    try:
        ticket = Ticket(customer_id=customer.id, subject=subject)
        db.add(ticket)
        db.flush()
        _add_message(db, ticket, customer, Direction.inbound, description, files, saved_keys)
        db.add(
            AuditEvent(
                ticket_id=ticket.id,
                actor=customer.email,
                action="ticket_created",
                detail={"attachments": len(files)},
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        for key in saved_keys:
            storage_service.delete(key)
        raise
    return ticket


def list_customer_tickets(
    db: Session,
    customer: User,
    status: TicketStatus | None,
    limit: int,
    offset: int,
) -> TicketList:
    where = [Ticket.customer_id == customer.id]
    if status:
        where.append(Ticket.status == status)

    total = db.scalar(select(func.count()).select_from(Ticket).where(*where)) or 0
    last_activity = func.max(Message.created_at).label("last_activity_at")
    rows = db.execute(
        select(Ticket, last_activity)
        .join(Message, Message.ticket_id == Ticket.id)
        .where(*where)
        .group_by(Ticket.id)
        .order_by(last_activity.desc(), Ticket.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    items = [
        TicketListItem(
            id=t.id,
            subject=t.subject,
            status=t.status,
            created_at=t.created_at,
            last_activity_at=activity,
        )
        for t, activity in rows
    ]
    return TicketList(items=items, total=total)


def get_customer_ticket(db: Session, customer: User, ticket_id: int) -> Ticket:
    ticket = db.scalar(
        select(Ticket)
        .where(Ticket.id == ticket_id, Ticket.customer_id == customer.id)
        .options(selectinload(Ticket.messages).selectinload(Message.attachments))
    )
    if ticket is None:
        raise NotFoundError
    return ticket


def add_customer_message(
    db: Session, customer: User, ticket_id: int, body: str, files: list[UploadedFile]
) -> Ticket:
    ticket = get_customer_ticket(db, customer, ticket_id)
    body = _clean_body(body)
    validate_files(files)
    _check_rate(customer)

    saved_keys: list[str] = []
    try:
        reopened = ticket.status == TicketStatus.resolved
        if reopened:
            ticket.status = TicketStatus.open
            ticket.resolved_at = None
        _add_message(db, ticket, customer, Direction.inbound, body, files, saved_keys)
        db.add(
            AuditEvent(
                ticket_id=ticket.id,
                actor=customer.email,
                action="customer_reply",
                detail={"attachments": len(files), "reopened": reopened},
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        for key in saved_keys:
            storage_service.delete(key)
        raise
    db.refresh(ticket)
    return ticket
