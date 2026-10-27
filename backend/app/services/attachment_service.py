from pathlib import Path

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models import Attachment, User
from app.models.enums import Role
from app.services import storage_service


def get_file(db: Session, user: User, attachment_id: int) -> tuple[Attachment, Path]:
    attachment = db.get(Attachment, attachment_id)
    if attachment is None:
        raise NotFoundError
    # Customers may only open files on their own tickets; report others as missing.
    if user.role == Role.customer and attachment.message.ticket.customer_id != user.id:
        raise NotFoundError
    return attachment, storage_service.resolve(attachment.storage_key)
