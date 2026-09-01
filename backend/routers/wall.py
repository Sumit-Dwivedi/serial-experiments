"""Anonymous public wall. No accounts, no IPs — identity is a random per-post ghost tag."""
import secrets as pysecrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, HTTPException, Request

from lib.db import db
from lib.content_filter import is_blocked
from lib.rate_limit import allow, client_hash
from lib.pow import issue_challenge, verify_and_consume
from models.vault import WallPost, WallPostCreate, WallReply, WallReplyCreate

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
        expires_at=_aware(doc["expires_at"]),
        echoes=doc.get("echoes", 0),
        replies=[
            WallReply(
                id=r["id"],
                body=r["body"],
                ghost=r["ghost"],
                created_at=_aware(r["created_at"]),
            )
            for r in doc.get("replies", [])
        ],
    )


@router.get("/wall", response_model=List[WallPost])
async def list_wall():
    now = datetime.now(timezone.utc)
    await db.wall_posts.delete_many({"expires_at": {"$lte": now}})
    docs = await db.wall_posts.find().sort("created_at", -1).to_list(100)
    return [_to_post(d) for d in docs]


@router.get("/wall/challenge")
async def wall_challenge():
    """Hand out a proof-of-work puzzle. Solving it costs the poster CPU, not privacy."""
    return await issue_challenge()


@router.post("/wall", response_model=WallPost, status_code=201)
async def create_wall_post(data: WallPostCreate, request: Request):
    if not allow("wall", client_hash(request), limit=5, window_seconds=600):
        raise HTTPException(status_code=429, detail="Too many posts. Try again shortly.")
    if not await verify_and_consume(data.challenge, data.nonce):
        raise HTTPException(status_code=400, detail="Invalid or expired proof of work.")
    if is_blocked(data.body):
        # Generic message on purpose: neither the content nor the poster is logged.
        raise HTTPException(status_code=400, detail="Post rejected.")

    tag = data.tag if data.tag in TAGS else "thoughts"
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "body": data.body.strip(),
        "tag": tag,
        "ghost": f"Ghost-{pysecrets.token_hex(2)}",
        "created_at": now,
        "expires_at": now + timedelta(hours=data.expires_in_hours),
        "echoes": 0,
        "replies": [],
    }
    await db.wall_posts.insert_one(dict(doc))
    return _to_post(doc)


@router.post("/wall/{post_id}/replies", response_model=WallPost, status_code=201)
async def reply_to_post(post_id: str, data: WallReplyCreate, request: Request):
    """Replies are anonymous too — a fresh ghost tag per reply, nothing linking them."""
    if not allow("wall_reply", client_hash(request), limit=15, window_seconds=300):
        raise HTTPException(status_code=429, detail="Too many replies. Slow down a moment.")
    if is_blocked(data.body):
        raise HTTPException(status_code=400, detail="Post rejected.")
    reply = {
        "id": str(uuid.uuid4()),
        "body": data.body.strip(),
        "ghost": f"Ghost-{pysecrets.token_hex(2)}",
        "created_at": datetime.now(timezone.utc),
    }
    doc = await db.wall_posts.find_one_and_update(
        {"id": post_id}, {"$push": {"replies": reply}}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    return _to_post(doc)


@router.post("/wall/{post_id}/echo", response_model=WallPost)
async def echo_post(post_id: str):
    doc = await db.wall_posts.find_one_and_update(
        {"id": post_id}, {"$inc": {"echoes": 1}}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    return _to_post(doc)
