from typing import Protocol

from pydantic import BaseModel, field_validator

from app.models.enums import Category, Sentiment, Urgency

MAX_SUMMARY = 200


class TriageResult(BaseModel):
    category: Category
    urgency: Urgency
    sentiment: Sentiment
    summary: str
    draft_reply: str

    @field_validator("summary")
    @classmethod
    def _clean_summary(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("summary is empty")
        return value[:MAX_SUMMARY]

    @field_validator("draft_reply")
    @classmethod
    def _clean_reply(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("draft_reply is empty")
        return value


class TriageProvider(Protocol):
    """Anything that can classify a ticket and draft a reply. Gemini is the current one."""

    def analyze(self, customer_name: str, subject: str, conversation: str) -> TriageResult: ...
