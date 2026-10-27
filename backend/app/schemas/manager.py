from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import Category


def _lower(value: str) -> str:
    return value.strip().lower()


def _check_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(value.encode()) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return value


def _dedupe(value: list[Category]) -> list[Category]:
    return list(dict.fromkeys(value))


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str
    skills: list[Category] = Field(min_length=1)
    max_open_tickets: int = Field(default=10, ge=1, le=100)

    _email = field_validator("email", mode="after")(_lower)
    _password = field_validator("password")(_check_password)
    _skills = field_validator("skills")(_dedupe)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    skills: list[Category] | None = None
    max_open_tickets: int | None = Field(default=None, ge=1, le=100)
    is_active: bool | None = None
    password: str | None = None

    _skills = field_validator("skills")(lambda v: None if v is None else _dedupe(v))
    _password = field_validator("password")(lambda v: None if v is None else _check_password(v))


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    is_active: bool
    max_open_tickets: int
    skills: list[Category]
    open_tickets: int
    created_at: datetime


class AgentList(BaseModel):
    items: list[AgentOut]
    total: int


class AssignBody(BaseModel):
    agent_id: int


class CategoryCount(BaseModel):
    category: str
    count: int


class AgentWorkload(BaseModel):
    agent_id: int
    name: str
    is_active: bool
    max_open_tickets: int
    open_tickets: int
    overdue_tickets: int
    resolved_in_period: int


class Dashboard(BaseModel):
    period_days: int
    sla_hours: int
    open_tickets: int
    unassigned_open: int
    overdue_open: int
    triage_failed_open: int
    created_in_period: int
    resolved_in_period: int
    avg_first_response_hours: float | None
    median_first_response_hours: float | None
    sla_compliance_pct: float | None
    by_category: list[CategoryCount]
    by_urgency: list[CategoryCount]
    agents: list[AgentWorkload]
