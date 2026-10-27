from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_agent, require_manager
from app.core.db import get_db
from app.core.exceptions import (
    ConflictError,
    InvalidInputError,
    NotFoundError,
    PermissionDeniedError,
)
from app.models import User
from app.models.enums import Category, TicketStatus, TriageStatus, Urgency
from app.schemas.agent_tickets import (
    AgentTicketDetail,
    AgentTicketList,
    DraftBody,
    ReplyBody,
)
from app.services import agent_ticket_service as service
from app.services import triage_service

router = APIRouter(prefix="/agent/tickets", tags=["agent tickets"])


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found")
    if isinstance(exc, PermissionDeniedError):
        return HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    if isinstance(exc, ConflictError):
        return HTTPException(status.HTTP_409_CONFLICT, exc.message)
    if isinstance(exc, InvalidInputError):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, exc.message)
    raise exc


@router.get("", response_model=AgentTicketList)
def list_tickets(
    scope: Annotated[str, Query(pattern="^(mine|unassigned|all)$")] = "mine",
    status_filter: Annotated[TicketStatus | None, Query(alias="status")] = None,
    category: Category | None = None,
    urgency: Urgency | None = None,
    triage_status: TriageStatus | None = None,
    overdue: bool | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: User = Depends(require_agent),
    db: Session = Depends(get_db),
) -> AgentTicketList:
    try:
        return service.list_tickets(
            db,
            user,
            scope,
            status_filter,
            category,
            urgency,
            triage_status,
            overdue,
            search,
            limit,
            offset,
        )
    except (PermissionDeniedError, InvalidInputError) as e:
        raise _http(e) from None


@router.get("/{ticket_id}", response_model=AgentTicketDetail)
def get_ticket(
    ticket_id: int, user: User = Depends(require_agent), db: Session = Depends(get_db)
) -> AgentTicketDetail:
    try:
        return service.get_ticket(db, user, ticket_id)
    except NotFoundError as e:
        raise _http(e) from None


@router.post("/{ticket_id}/claim", response_model=AgentTicketDetail)
def claim_ticket(
    ticket_id: int, user: User = Depends(require_agent), db: Session = Depends(get_db)
) -> AgentTicketDetail:
    try:
        return service.claim(db, user, ticket_id)
    except (NotFoundError, PermissionDeniedError, ConflictError) as e:
        raise _http(e) from None


@router.put("/{ticket_id}/draft", response_model=AgentTicketDetail)
def save_draft(
    ticket_id: int,
    body: DraftBody,
    user: User = Depends(require_agent),
    db: Session = Depends(get_db),
) -> AgentTicketDetail:
    try:
        return service.save_draft(db, user, ticket_id, body.body)
    except (NotFoundError, ConflictError, InvalidInputError) as e:
        raise _http(e) from None


@router.post("/{ticket_id}/reply", response_model=AgentTicketDetail)
def send_reply(
    ticket_id: int,
    body: ReplyBody,
    user: User = Depends(require_agent),
    db: Session = Depends(get_db),
) -> AgentTicketDetail:
    try:
        return service.send_reply(db, user, ticket_id, body.body)
    except (NotFoundError, ConflictError, InvalidInputError) as e:
        raise _http(e) from None


@router.post("/{ticket_id}/resolve", response_model=AgentTicketDetail)
def resolve_ticket(
    ticket_id: int, user: User = Depends(require_agent), db: Session = Depends(get_db)
) -> AgentTicketDetail:
    try:
        return service.resolve(db, user, ticket_id)
    except (NotFoundError, ConflictError) as e:
        raise _http(e) from None


@router.post(
    "/{ticket_id}/retriage",
    response_model=AgentTicketDetail,
    status_code=status.HTTP_202_ACCEPTED,
)
def retriage_ticket(
    ticket_id: int,
    background: BackgroundTasks,
    user: User = Depends(require_manager),
    db: Session = Depends(get_db),
) -> AgentTicketDetail:
    try:
        service.request_retriage(db, user, ticket_id)
        detail = service.get_ticket(db, user, ticket_id)
    except (NotFoundError, ConflictError) as e:
        raise _http(e) from None
    background.add_task(triage_service.run_triage, ticket_id)
    return detail
