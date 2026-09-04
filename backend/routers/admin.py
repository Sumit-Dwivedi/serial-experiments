"""Admin-only moderation routes. Gated purely by the ADMIN_TOKEN env var — if it is unset
or blank, every request here is rejected. Deliberately not surfaced in the UI."""

import os
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Header, HTTPException

from lib.db import db
from models.report import Report

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(token: str | None) -> None:
    expected = os.environ.get("ADMIN_TOKEN", "")
    if not expected or not token or token != expected:
        raise HTTPException(status_code=403, detail="Not authorized.")


@router.get("/reports", response_model=List[Report])
async def list_reports(x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    docs = (
        await db.reports.find({"status": "pending"}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    return [Report(**d) for d in docs]


@router.post("/reports/{report_id}/resolve", response_model=Report)
async def resolve_report(report_id: str, x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    doc = await db.reports.find_one_and_update(
        {"id": report_id},
        {"$set": {"status": "resolved", "resolved_at": datetime.now(timezone.utc)}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found.")
    return Report(**doc)


@router.delete("/wall/{post_id}")
async def delete_wall_post(post_id: str, x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    res = await db.wall_posts.delete_one({"id": post_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found.")
    return {"deleted": post_id}


@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str, x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    res = await db.threads.delete_one({"id": thread_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Thread not found.")
    await db.replies.delete_many({"thread_id": thread_id})
    return {"deleted": thread_id}
