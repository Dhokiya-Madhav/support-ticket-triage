import re
import uuid
from pathlib import Path

from app.core.config import get_settings
from app.core.exceptions import NotFoundError


def _root() -> Path:
    root = Path(get_settings().storage_path).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_filename(name: str) -> str:
    base = re.split(r"[\\/]", name)[-1]
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", base).strip("._")
    return cleaned[:100] or "file"


def save(ticket_id: int, filename: str, data: bytes) -> str:
    key = f"{ticket_id}/{uuid.uuid4().hex}_{safe_filename(filename)}"
    path = _root() / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def resolve(key: str) -> Path:
    root = _root()
    path = (root / key).resolve()
    if root not in path.parents or not path.is_file():
        raise NotFoundError
    return path


def delete(key: str) -> None:
    try:
        resolve(key).unlink()
    except NotFoundError:
        pass
