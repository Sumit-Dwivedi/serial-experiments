import hashlib
import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


def pseudonym(thread_id: str, token: str) -> str:
    """Deterministic per-thread identity. The raw token never reaches storage."""
    return hashlib.sha256(f"{thread_id}{token}".encode()).hexdigest()[:8]


def _valid_uuid4(v: str) -> str:
    try:
        parsed = uuid.UUID(v)
    except ValueError as exc:
        raise ValueError("token must be a UUID") from exc
    if parsed.version != 4:
        raise ValueError("token must be a UUID v4")
    return str(parsed)


class ThreadCreate(BaseModel):
    title: str = Field(min_length=5, max_length=300)
    body: str = Field(default="", max_length=5000)
    owner_token: str
    expires_in_hours: int = Field(default=168, ge=1, le=168)
    challenge: str = Field(min_length=1, max_length=128)
    nonce: str = Field(min_length=1, max_length=64)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < 5:
            raise ValueError("title must be at least 5 characters")
        return stripped

    @field_validator("owner_token")
    @classmethod
    def _check_token(cls, v: str) -> str:
        return _valid_uuid4(v)


class ThreadSummary(BaseModel):
    id: str
    title: str
    owner_hash: str
    status: Literal["open", "closed"]
    reply_count: int
    created_at: datetime
    last_activity_at: datetime
    expires_at: datetime


class Reply(BaseModel):
    id: str
    thread_id: str
    parent_reply_id: Optional[str] = None
    participant_hash: str
    is_op: bool
    body: str
    created_at: datetime
    depth: int
    children: List["Reply"] = Field(default_factory=list)


class ThreadDetail(ThreadSummary):
    body: str = ""
    replies: List[Reply] = Field(default_factory=list)


class ReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=3000)
    participant_token: str
    parent_reply_id: Optional[str] = None
    challenge: str = Field(min_length=1, max_length=128)
    nonce: str = Field(min_length=1, max_length=64)

    @field_validator("participant_token")
    @classmethod
    def _check_token(cls, v: str) -> str:
        return _valid_uuid4(v)


class CloseThread(BaseModel):
    owner_token: str

    @field_validator("owner_token")
    @classmethod
    def _check_token(cls, v: str) -> str:
        return _valid_uuid4(v)
