"""Public abuse reporting. No login, no IP stored — only a salted rotating hash for
throttling, exactly like the wall and thread endpoints."""

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from lib.db import db
from lib.rate_limit import allow, client_hash
from models.report import Report, ReportCreate

router = APIRouter(prefix="/reports", tags=["reports"])

ID_RE = re.compile(r"^[A-Za-z0-9_-]{4,200}$")


def _normalize_target(raw: str) -> str:
    """Accepts a bare id or a share URL; keeps only the id, never the key fragment."""
    value = raw.strip().split("#")[0].split("?")[0].rstrip("/")
    if "/" in value:
        value = value.rsplit("/", 1)[-1]
    return value


@router.post("", status_code=201, response_model=Report)
async def create_report(data: ReportCreate, request: Request):
    if not allow("reports", client_hash(request), limit=5, window_seconds=600):
        raise HTTPException(status_code=429, detail="Too many reports. Try again shortly.")

    target_id = _normalize_target(data.target_id)
    if not ID_RE.match(target_id):
        raise HTTPException(status_code=400, detail="That does not look like a valid link or id.")

    doc = {
        "id": str(uuid.uuid4()),
        "target_type": data.target_type,
        "target_id": target_id,
        "reason": data.reason,
        "note": data.note.strip(),
        "created_at": datetime.now(timezone.utc),
        "status": "pending",
        "resolved_at": None,
    }
    await db.reports.insert_one(dict(doc))
    return Report(**doc)
