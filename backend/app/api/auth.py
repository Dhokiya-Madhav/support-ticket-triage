from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import COOKIE_NAME, get_current_user
from app.core.config import get_settings
from app.core.db import get_db
from app.core.exceptions import (
    AuthenticationError,
    ConflictError,
    InvalidInputError,
    TooManyAttemptsError,
)
from app.models import User
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.access_token_minutes * 60,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
    )


@router.post("/login", response_model=LoginResponse)
def login(
    body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)
) -> LoginResponse:
    try:
        token, user = auth_service.login(db, body.email, body.password, _client_ip(request))
    except TooManyAttemptsError:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many login attempts. Try again later."
        ) from None
    except AuthenticationError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials") from None

    _set_session_cookie(response, token)
    return LoginResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)
) -> LoginResponse:
    try:
        token, user = auth_service.register_customer(
            db, body.name, body.email, body.password, body.website, _client_ip(request)
        )
    except TooManyAttemptsError:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many sign-ups. Try again later."
        ) from None
    except ConflictError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered") from None
    except InvalidInputError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, e.message) from None

    _set_session_cookie(response, token)
    return LoginResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
