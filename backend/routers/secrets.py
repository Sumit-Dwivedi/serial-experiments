"""Zero-metadata secret storage. We never read request headers, IPs or user agents."""
import secrets as pysecrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from lib.db import db
from models.vault import (
    Attachment,
    SecretCreate,
    SecretCreated,
    SecretMeta,
    SecretPayload,
    SecretReceipt,
    new_secret_doc,
)

router = APIRouter()


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _load(secret_id: str) -> dict:
    doc = await db.secrets.find_one({"id": secret_id})
    if not doc:
        raise HTTPException(status_code=404, detail="This secret no longer exists.")
    if _aware(doc["expires_at"]) <= datetime.now(timezone.utc):
        await db.secrets.delete_one({"id": secret_id})
        raise HTTPException(status_code=404, detail="This secret has expired.")
    return doc


@router.post("/secrets", response_model=SecretCreated, status_code=201)
async def create_secret(data: SecretCreate):
    doc = new_secret_doc(data)
    await db.secrets.insert_one(dict(doc))
    token = pysecrets.token_urlsafe(16)
    await db.receipts.insert_one(
        {
            "token": token,
            "secret_id": doc["id"],
            "created_at": doc["created_at"],
            "opened_at": None,
            "expires_at": doc["expires_at"],
        }
    )
    return SecretCreated(
        id=doc["id"],
        expires_at=doc["expires_at"],
        burn_after_read=doc["burn_after_read"],
        receipt_token=token,
    )


@router.get("/secrets/{secret_id}/meta", response_model=SecretMeta)
async def secret_meta(secret_id: str):
    """Non-destructive: crawlers and link previews never burn a note."""
    doc = await _load(secret_id)
    return SecretMeta(
        id=doc["id"],
        has_passphrase=doc["has_passphrase"],
        burn_after_read=doc["burn_after_read"],
        expires_at=_aware(doc["expires_at"]),
        attachment_count=len(doc.get("attachments", [])),
    )


@router.post("/secrets/{secret_id}/open", response_model=SecretPayload)
async def open_secret(secret_id: str):
    """Explicit user action. Burns atomically when burn_after_read is set."""
    doc = await _load(secret_id)
    burned = False
    if doc["burn_after_read"]:
        removed = await db.secrets.find_one_and_delete({"id": secret_id})
        if not removed:
            raise HTTPException(status_code=404, detail="This secret was already destroyed.")
        burned = True

    # Read receipt: timestamp only. Nothing identifying the reader is recorded.
    await db.receipts.update_one(
        {"secret_id": secret_id, "opened_at": None},
        {"$set": {"opened_at": datetime.now(timezone.utc)}},
    )

    return SecretPayload(
        id=doc["id"],
        cipher_text=doc["cipher_text"],
        iv=doc["iv"],
        salt=doc.get("salt"),
        has_passphrase=doc["has_passphrase"],
        burned=burned,
        expires_at=_aware(doc["expires_at"]),
        attachments=[Attachment(**a) for a in doc.get("attachments", [])],
    )


@router.get("/receipts/{token}", response_model=SecretReceipt)
async def read_receipt(token: str):
    """Sender-only status. Says WHEN it was opened, never by whom."""
    doc = await db.receipts.find_one({"token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Unknown receipt.")
    opened = doc.get("opened_at")
    return SecretReceipt(
        opened=opened is not None,
        opened_at=_aware(opened) if opened else None,
        created_at=_aware(doc["created_at"]),
        expires_at=_aware(doc["expires_at"]),
    )
