from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.deps import require_customer
from app.core.config import get_settings
from app.core.db import get_db
from app.core.exceptions import InvalidInputError, NotFoundError, TooManyAttemptsError
from app.models import Ticket, User
from app.models.enums import TicketStatus
from app.schemas.tickets import TicketCreated, TicketDetail, TicketList
from app.services import ticket_service, triage_service
from app.services.ticket_service import UploadedFile

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _read_uploads(uploads: list[UploadFile]) -> list[UploadedFile]:
    limit = get_settings().max_attachment_mb * 1024 * 1024
    files: list[UploadedFile] = []
    for upload in uploads:
        data = upload.file.read(limit + 1)
        if len(data) > limit:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"Attachments must be at most {get_settings().max_attachment_mb} MB each",
            )
        files.append(UploadedFile(filename=upload.filename or "file", data=data))
    return files


def _too_many() -> HTTPException:
    return HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests. Try again later.")


@router.post("", response_model=TicketCreated, status_code=status.HTTP_201_CREATED)
def submit_ticket(
    subject: Annotated[str, Form()],
    description: Annotated[str, Form()],
    background: BackgroundTasks,
    attachments: Annotated[list[UploadFile] | None, File()] = None,
    customer: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> Ticket:
    files = _read_uploads(attachments or [])
    try:
        ticket = ticket_service.create_ticket(db, customer, subject, description, files)
        background.add_task(triage_service.run_triage, ticket.id)
        return ticket
    except InvalidInputError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, e.message) from None
    except TooManyAttemptsError:
        raise _too_many() from None


@router.get("", response_model=TicketList)
def list_my_tickets(
    status_filter: Annotated[TicketStatus | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    customer: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> TicketList:
    return ticket_service.list_customer_tickets(db, customer, status_filter, limit, offset)


@router.get("/{ticket_id}", response_model=TicketDetail)
def get_my_ticket(
    ticket_id: int, customer: User = Depends(require_customer), db: Session = Depends(get_db)
) -> Ticket:
    try:
        return ticket_service.get_customer_ticket(db, customer, ticket_id)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found") from None


@router.post(
    "/{ticket_id}/messages", response_model=TicketDetail, status_code=status.HTTP_201_CREATED
)
def add_message(
    ticket_id: int,
    body: Annotated[str, Form()],
    attachments: Annotated[list[UploadFile] | None, File()] = None,
    customer: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> Ticket:
    files = _read_uploads(attachments or [])
    try:
        return ticket_service.add_customer_message(db, customer, ticket_id, body, files)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found") from None
    except InvalidInputError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, e.message) from None
    except TooManyAttemptsError:
        raise _too_many() from None
