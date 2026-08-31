import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SecretCreate(BaseModel):
    """Only ciphertext ever reaches the server. No key, no plaintext, no metadata."""
    cipher_text: str = Field(min_length=1, max_length=200_000)
    iv: str = Field(min_length=1, max_length=256)
    salt: Optional[str] = Field(default=None, max_length=256)
    has_passphrase: bool = False
    burn_after_read: bool = True
    expires_in_hours: int = Field(default=24, ge=1, le=168)


class SecretCreated(BaseModel):
    id: str
    expires_at: datetime
    burn_after_read: bool


class SecretMeta(BaseModel):
    """Non-destructive peek: tells the viewer what it will need, without the payload."""
    id: str
    has_passphrase: bool
    burn_after_read: bool
    expires_at: datetime


class SecretPayload(BaseModel):
    id: str
    cipher_text: str
    iv: str
    salt: Optional[str] = None
    has_passphrase: bool
    burned: bool
    expires_at: datetime


def new_secret_doc(data: SecretCreate) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "cipher_text": data.cipher_text,
        "iv": data.iv,
        "salt": data.salt,
        "has_passphrase": data.has_passphrase,
        "burn_after_read": data.burn_after_read,
        "created_at": _now(),
        "expires_at": _now() + timedelta(hours=data.expires_in_hours),
    }


class WallPostCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    tag: str = Field(default="thoughts", max_length=32)


class WallPost(BaseModel):
    id: str
    body: str
    tag: str
    ghost: str
    created_at: datetime
    echoes: int = 0
