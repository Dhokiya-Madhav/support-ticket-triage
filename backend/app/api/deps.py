from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.exceptions import AuthenticationError
from app.core.security import decode_access_token
from app.models import User
from app.models.enums import Role
from app.services import auth_service

COOKIE_NAME = "access_token"


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get(COOKIE_NAME)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = _extract_token(request)
    if not token:
        raise unauthorized
    user_id = decode_access_token(token)
    if user_id is None:
        raise unauthorized
    try:
        return auth_service.get_active_user(db, user_id)
    except AuthenticationError:
        raise unauthorized from None


def require_roles(*roles: Role) -> Callable[[User], User]:
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return checker


require_customer = require_roles(Role.customer)
require_agent = require_roles(Role.agent, Role.manager)
require_manager = require_roles(Role.manager)
