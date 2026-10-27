from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.agent_tickets import router as agent_tickets_router
from app.api.attachments import router as attachments_router
from app.api.auth import router as auth_router
from app.api.manager import router as manager_router
from app.api.tickets import router as tickets_router
from app.core.background import lifespan
from app.core.config import get_settings
from app.core.db import get_db
from app.core.logging import setup_logging

settings = get_settings()
setup_logging(settings.log_level)

app = FastAPI(title="Support Ticket Triage", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(tickets_router)
app.include_router(agent_tickets_router)
app.include_router(manager_router)
app.include_router(attachments_router)


@app.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
