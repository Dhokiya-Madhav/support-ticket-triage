from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.exceptions import NotFoundError
from app.models import User
from app.services import attachment_service

router = APIRouter(prefix="/attachments", tags=["attachments"])


@router.get("/{attachment_id}")
def download(
    attachment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> FileResponse:
    try:
        attachment, path = attachment_service.get_file(db, user, attachment_id)
    except NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found") from None
    return FileResponse(
        path,
        media_type=attachment.content_type,
        filename=attachment.filename,
        headers={"X-Content-Type-Options": "nosniff"},
    )
