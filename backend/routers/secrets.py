"""Zero-metadata secret storage. We never read request headers, IPs or user agents."""
import secrets as pysecrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query

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
        max_reads=doc.get("max_reads", 1),
        reads_left=doc.get("reads_left", 1),
    )


CLAIM_GRACE_MINUTES = 5


@router.get("/secrets/{secret_id}", response_model=SecretPayload)
async def claim_secret(secret_id: str):
    """Hands over the ciphertext WITHOUT deleting it, so a refresh or a crash can't
    destroy an unread secret. Consumes one read and returns a burn token."""
    doc = await _load(secret_id)

    reads_left = doc.get("reads_left", 1)
    if reads_left <= 0:
        raise HTTPException(status_code=404, detail="This secret has already been claimed.")

    now = datetime.now(timezone.utc)
    burn_token = pysecrets.token_urlsafe(24)
    remaining = reads_left - 1
    # Once the last read is used the secret locks: no new viewer can reach it, and the
    # TTL index reaps it within 5 minutes even if the reader never clicks Destroy.
    auto_purge_at = (
        now + timedelta(minutes=CLAIM_GRACE_MINUTES) if remaining <= 0 else _aware(doc["purge_at"])
    )
    await db.secrets.update_one(
        {"id": secret_id},
        {
            "$set": {
                "reads_left": remaining,
                "claimed_at": doc.get("claimed_at") or now,
                "burn_token": burn_token,
                "purge_at": auto_purge_at,
            }
        },
    )

    await db.receipts.update_one(
        {"secret_id": secret_id, "opened_at": None}, {"$set": {"opened_at": now}}
    )

    return SecretPayload(
        id=doc["id"],
        cipher_text=doc["cipher_text"],
        iv=doc["iv"],
        salt=doc.get("salt"),
        has_passphrase=doc["has_passphrase"],
        burned=False,
        expires_at=_aware(doc["expires_at"]),
        attachments=[Attachment(**a) for a in doc.get("attachments", [])],
        burn_token=burn_token,
        reads_left=remaining,
        auto_purge_at=auto_purge_at,
    )


@router.delete("/secrets/{secret_id}", status_code=200)
async def burn_secret(secret_id: str, burn_token: str = Query(...)):
    """Explicit, user-confirmed destruction. Only the client holding the burn token
    from its own claim can trigger it."""
    doc = await db.secrets.find_one({"id": secret_id})
    if not doc:
        return {"burned": True, "detail": "Already destroyed."}
    if doc.get("burn_token") != burn_token:
        raise HTTPException(status_code=403, detail="Invalid burn token.")
    await db.secrets.find_one_and_delete({"id": secret_id, "burn_token": burn_token})
    return {"burned": True, "detail": "Destroyed."}


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
