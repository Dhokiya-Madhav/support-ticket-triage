from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    AuthenticationError,
    ConflictError,
    InvalidInputError,
    TooManyAttemptsError,
)
from app.core.ratelimit import RateLimiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.models.enums import Role

login_limiter = RateLimiter(max_attempts=5, window_seconds=300)
register_limiter = RateLimiter(max_attempts=5, window_seconds=3600)

# Checked when the email is unknown so response timing stays similar.
_DUMMY_HASH = hash_password("timing-equalizer")


def login(db: Session, email: str, password: str, ip: str) -> tuple[str, User]:
    keys = (f"ip:{ip}", f"email:{email}")
    if any(login_limiter.is_blocked(k) for k in keys):
        raise TooManyAttemptsError

    user = db.scalar(select(User).where(User.email == email))
    password_ok = verify_password(password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not password_ok or not user.is_active:
        for k in keys:
            login_limiter.record(k)
        raise AuthenticationError

    for k in keys:
        login_limiter.reset(k)
    return create_access_token(user.id, user.role.value), user


def register_customer(
    db: Session, name: str, email: str, password: str, honeypot: str, ip: str
) -> tuple[str, User]:
    key = f"ip:{ip}"
    if register_limiter.is_blocked(key):
        raise TooManyAttemptsError
    register_limiter.record(key)

    if honeypot:
        raise InvalidInputError("Invalid request")
    if db.scalar(select(User.id).where(User.email == email)):
        raise ConflictError

    user = User(name=name, email=email, password_hash=hash_password(password), role=Role.customer)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError from None
    return create_access_token(user.id, user.role.value), user


def get_active_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise AuthenticationError
    return user
