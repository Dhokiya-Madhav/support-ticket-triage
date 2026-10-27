from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import Role


def _lower(value: str) -> str:
    return value.strip().lower()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    _normalize_email = field_validator("email", mode="after")(_lower)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8)
    # Honeypot: hidden in the UI, so only bots fill it in.
    website: str = ""

    _normalize_email = field_validator("email", mode="after")(_lower)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value

    @field_validator("password")
    @classmethod
    def _bcrypt_limit(cls, value: str) -> str:
        if len(value.encode()) > 72:
            raise ValueError("Password must be at most 72 bytes")
        return value


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: Role


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
