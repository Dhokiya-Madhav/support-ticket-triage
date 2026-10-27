from datetime import UTC, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import (
    Category,
    Direction,
    DraftStatus,
    Role,
    Sentiment,
    TicketStatus,
    TriageStatus,
    Urgency,
)


def utcnow() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[Role] = mapped_column(Enum(Role, name="role"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    max_open_tickets: Mapped[int] = mapped_column(Integer, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    skills: Mapped[list["AgentSkill"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class AgentSkill(Base):
    __tablename__ = "agent_skills"
    __table_args__ = (UniqueConstraint("user_id", "category"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category: Mapped[Category] = mapped_column(Enum(Category, name="category"))

    user: Mapped[User] = relationship(back_populates="skills")


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        Index("ix_tickets_status_assignee", "status", "assignee_id"),
        Index("ix_tickets_overdue", "status", "first_response_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    subject: Mapped[str] = mapped_column(String(200))
    category: Mapped[Category | None] = mapped_column(Enum(Category, name="category"))
    urgency: Mapped[Urgency | None] = mapped_column(Enum(Urgency, name="urgency"))
    sentiment: Mapped[Sentiment | None] = mapped_column(Enum(Sentiment, name="sentiment"))
    summary: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status"), default=TicketStatus.open
    )
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    triage_status: Mapped[TriageStatus] = mapped_column(
        Enum(TriageStatus, name="triage_status"), default=TriageStatus.pending, index=True
    )
    triage_attempts: Mapped[int] = mapped_column(Integer, default=0)
    triage_attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    customer: Mapped[User] = relationship(foreign_keys=[customer_id])
    assignee: Mapped[User | None] = relationship(foreign_keys=[assignee_id])
    messages: Mapped[list["Message"]] = relationship(
        back_populates="ticket", order_by="Message.created_at"
    )
    drafts: Mapped[list["DraftReply"]] = relationship(back_populates="ticket")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    direction: Mapped[Direction] = mapped_column(Enum(Direction, name="direction"))
    sender: Mapped[str] = mapped_column(String(320))
    body_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    ticket: Mapped[Ticket] = relationship(back_populates="messages")
    attachments: Mapped[list["Attachment"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class DraftReply(Base):
    __tablename__ = "draft_replies"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[DraftStatus] = mapped_column(
        Enum(DraftStatus, name="draft_status"), default=DraftStatus.pending
    )
    edited_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    ticket: Mapped[Ticket] = relationship(back_populates="drafts")


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(200))
    size: Mapped[int] = mapped_column(BigInteger)
    storage_key: Mapped[str] = mapped_column(String(500))

    message: Mapped[Message] = relationship(back_populates="attachments")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    actor: Mapped[str] = mapped_column(String(320))
    action: Mapped[str] = mapped_column(String(100))
    detail: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
