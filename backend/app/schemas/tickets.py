from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import Direction, TicketStatus


class TicketCreated(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject: str
    status: TicketStatus
    created_at: datetime


class TicketListItem(BaseModel):
    id: int
    subject: str
    status: TicketStatus
    created_at: datetime
    last_activity_at: datetime


class TicketList(BaseModel):
    items: list[TicketListItem]
    total: int


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    content_type: str
    size: int


class MessageOut(BaseModel):
    """Customer-facing message. The sender address is deliberately not exposed."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    direction: Direction
    body_text: str
    created_at: datetime
    attachments: list[AttachmentOut]


class TicketDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject: str
    status: TicketStatus
    created_at: datetime
    resolved_at: datetime | None
    messages: list[MessageOut]
