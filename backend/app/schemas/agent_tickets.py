from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    Category,
    Direction,
    Sentiment,
    TicketStatus,
    TriageStatus,
    Urgency,
)
from app.schemas.tickets import AttachmentOut


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class AgentTicketItem(BaseModel):
    id: int
    subject: str
    customer_name: str
    status: TicketStatus
    category: Category | None
    urgency: Urgency | None
    sentiment: Sentiment | None
    summary: str | None
    triage_status: TriageStatus
    assignee: PersonOut | None
    created_at: datetime
    first_response_at: datetime | None
    due_at: datetime
    is_overdue: bool


class AgentTicketList(BaseModel):
    items: list[AgentTicketItem]
    total: int


class DraftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    body: str
    created_at: datetime


class AgentMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    direction: Direction
    sender: str
    body_text: str
    created_at: datetime
    attachments: list[AttachmentOut]


class AgentTicketDetail(AgentTicketItem):
    customer: PersonOut
    resolved_at: datetime | None
    messages: list[AgentMessageOut]
    draft: DraftOut | None


class ReplyBody(BaseModel):
    body: str = Field(min_length=1, max_length=10_000)


class DraftBody(BaseModel):
    body: str = Field(min_length=1, max_length=10_000)
