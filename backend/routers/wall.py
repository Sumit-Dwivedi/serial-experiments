"""Anonymous public wall. No accounts, no IPs — identity is a random per-post ghost tag."""
import secrets as pysecrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, HTTPException

from lib.db import db
from models.vault import WallPost, WallPostCreate

router = APIRouter()

TAGS = {"thoughts", "confessions", "leaks", "whistleblows"}


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _to_post(doc: dict) -> WallPost:
    return WallPost(
        id=doc["id"],
        body=doc["body"],
        tag=doc["tag"],
        ghost=doc["ghost"],
        created_at=_aware(doc["created_at"]),
        echoes=doc.get("echoes", 0),
    )


@router.get("/wall", response_model=List[WallPost])
async def list_wall():
    now = datetime.now(timezone.utc)
    await db.wall_posts.delete_many({"expires_at": {"$lte": now}})
    docs = await db.wall_posts.find().sort("created_at", -1).to_list(100)
    return [_to_post(d) for d in docs]


@router.post("/wall", response_model=WallPost, status_code=201)
async def create_wall_post(data: WallPostCreate):
    tag = data.tag if data.tag in TAGS else "thoughts"
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "body": data.body.strip(),
        "tag": tag,
        "ghost": f"Ghost-{pysecrets.token_hex(2)}",
        "created_at": now,
        "expires_at": now + timedelta(days=7),
        "echoes": 0,
    }
    await db.wall_posts.insert_one(dict(doc))
    return _to_post(doc)


@router.post("/wall/{post_id}/echo", response_model=WallPost)
async def echo_post(post_id: str):
    doc = await db.wall_posts.find_one_and_update(
        {"id": post_id}, {"$inc": {"echoes": 1}}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    return _to_post(doc)
