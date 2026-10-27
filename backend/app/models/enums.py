import enum


class Role(enum.StrEnum):
    customer = "customer"
    agent = "agent"
    manager = "manager"


class Category(enum.StrEnum):
    billing = "billing"
    login = "login"
    bug = "bug"
    general = "general"
    refund = "refund"
    account = "account"
    integration = "integration"
    feature_request = "feature_request"
    cancellation = "cancellation"


class Urgency(enum.StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class Sentiment(enum.StrEnum):
    calm = "calm"
    confused = "confused"
    angry = "angry"


class TicketStatus(enum.StrEnum):
    open = "open"
    resolved = "resolved"


class TriageStatus(enum.StrEnum):
    pending = "pending"
    done = "done"
    failed = "failed"


class Direction(enum.StrEnum):
    inbound = "inbound"
    outbound = "outbound"


class DraftStatus(enum.StrEnum):
    pending = "pending"
    sent = "sent"
    discarded = "discarded"
