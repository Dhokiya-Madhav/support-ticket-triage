from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"
    database_url: str
    secret_key: str
    frontend_origin: str = "http://localhost:3000"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"
    storage_path: str = "./storage"
    sla_first_response_hours: int = 4
    access_token_minutes: int = 60
    max_attachment_mb: int = 20
    triage_max_attempts: int = 3
    triage_sweep_seconds: int = 60
    manager_email: str = ""
    manager_password: str = ""


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.app_env == "production" and settings.secret_key in ("", "change-me"):
        raise RuntimeError("SECRET_KEY must be set to a strong value in production")
    return settings
