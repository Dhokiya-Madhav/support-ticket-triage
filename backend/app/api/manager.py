from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import require_manager
from app.core.db import get_db
from app.core.exceptions import ConflictError, InvalidInputError, NotFoundError
from app.models import User
from app.models.enums import Category
from app.schemas.manager import (
    AgentCreate,
    AgentList,
    AgentOut,
    AgentUpdate,
    AssignBody,
    Dashboard,
)
from app.services import agent_admin_service as agents
from app.services import dashboard_service

router = APIRouter(prefix="/manager", tags=["manager"])


def _http(exc: Exception, not_found: str = "Not found") -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, not_found)
    if isinstance(exc, ConflictError):
        return HTTPException(status.HTTP_409_CONFLICT, exc.message)
    if isinstance(exc, InvalidInputError):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, exc.message)
    raise exc


@router.get("/agents", response_model=AgentList)
def list_agents(
    search: Annotated[str | None, Query(max_length=100)] = None,
    skill: Category | None = None,
    status_filter: Annotated[Literal["active", "inactive"] | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    _: User = Depends(require_manager),
    db: Session = Depends(get_db),
) -> AgentList:
    return agents.list_agents(db, search, skill, status_filter, limit, offset)


@router.post("/agents", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(
    body: AgentCreate, _: User = Depends(require_manager), db: Session = Depends(get_db)
) -> AgentOut:
    try:
        return agents.create_agent(db, body)
    except ConflictError as e:
        raise _http(e) from None


@router.get("/agents/{agent_id}", response_model=AgentOut)
def get_agent(
    agent_id: int, _: User = Depends(require_manager), db: Session = Depends(get_db)
) -> AgentOut:
    try:
        return agents.get_agent(db, agent_id)
    except NotFoundError as e:
        raise _http(e, "Agent not found") from None


@router.patch("/agents/{agent_id}", response_model=AgentOut)
def update_agent(
    agent_id: int,
    body: AgentUpdate,
    manager: User = Depends(require_manager),
    db: Session = Depends(get_db),
) -> AgentOut:
    try:
        return agents.update_agent(db, manager, agent_id, body)
    except (NotFoundError, InvalidInputError) as e:
        raise _http(e, "Agent not found") from None


@router.delete("/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(
    agent_id: int,
    manager: User = Depends(require_manager),
    db: Session = Depends(get_db),
) -> Response:
    try:
        agents.delete_agent(db, manager, agent_id)
    except NotFoundError as e:
        raise _http(e, "Agent not found") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/tickets/{ticket_id}/assign", status_code=status.HTTP_204_NO_CONTENT)
def assign_ticket(
    ticket_id: int,
    body: AssignBody,
    manager: User = Depends(require_manager),
    db: Session = Depends(get_db),
) -> Response:
    try:
        agents.assign_ticket(db, manager, ticket_id, body.agent_id)
    except (NotFoundError, ConflictError, InvalidInputError) as e:
        raise _http(e, "Ticket not found") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/dashboard", response_model=Dashboard)
def dashboard(
    days: Annotated[int, Query(ge=1, le=365)] = 30,
    _: User = Depends(require_manager),
    db: Session = Depends(get_db),
) -> Dashboard:
    return dashboard_service.build_dashboard(db, days)
