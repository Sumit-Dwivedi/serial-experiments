"""Anonymous HN-style threads. No accounts, no IPs, no raw tokens — only hashes."""
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request

from lib.content_filter import is_blocked
from lib.db import db
from lib.pow import issue_challenge, verify_and_consume
from lib.rate_limit import allow, client_hash
from models.threads import (
    CloseThread,
    Reply,
    ReplyCreate,
    ThreadCreate,
    ThreadDetail,
    ThreadSummary,
    pseudonym,
)

router = APIRouter()

MAX_DEPTH = 5
THREAD_DIFFICULTY = 16  # ~4s in-browser
REPLY_DIFFICULTY = 15  # ~2s in-browser


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _summary(doc: dict) -> ThreadSummary:
    return ThreadSummary(
        id=doc["id"],
        title=doc["title"],
        owner_hash=doc["owner_hash"],
        status=doc["status"],
        reply_count=doc.get("reply_count", 0),
        created_at=_aware(doc["created_at"]),
        last_activity_at=_aware(doc["last_activity_at"]),
        expires_at=_aware(doc["expires_at"]),
    )


@router.get("/threads/challenge")
async def thread_challenge(kind: str = Query("reply")):
    """Thread creation costs more work than a reply, so conversation stays fluid."""
    return await issue_challenge(
        THREAD_DIFFICULTY if kind == "thread" else REPLY_DIFFICULTY
    )


@router.get("/threads", response_model=List[ThreadSummary])
async def list_threads(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    q: str = Query("", max_length=120),
):
    now = datetime.now(timezone.utc)
    # Cascade: drop replies whose thread has expired before listing.
    async for dead in db.threads.find({"expires_at": {"$lte": now}}, {"id": 1}):
        await db.replies.delete_many({"thread_id": dead["id"]})
    await db.threads.delete_many({"expires_at": {"$lte": now}})

    # Title-only, case-insensitive substring match. Regex is escaped so a pasted "?" or
    # "(" can't turn into a pattern (or a ReDoS).
    query: dict = {}
    term = q.strip()
    if term:
        query["title"] = {"$regex": re.escape(term), "$options": "i"}

    docs = (
        await db.threads.find(query)
        .sort("last_activity_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
        .to_list(limit)
    )
    return [_summary(d) for d in docs]


@router.post("/threads", response_model=ThreadSummary, status_code=201)
async def create_thread(data: ThreadCreate, request: Request):
    if not allow("thread", client_hash(request), limit=3, window_seconds=600):
        raise HTTPException(status_code=429, detail="Too many threads. Try again shortly.")
    if not await verify_and_consume(data.challenge, data.nonce):
        raise HTTPException(status_code=400, detail="Invalid or expired proof of work.")
    if is_blocked(data.title) or (data.body and is_blocked(data.body)):
        raise HTTPException(status_code=400, detail="Post rejected.")

    now = datetime.now(timezone.utc)
    thread_id = str(uuid.uuid4())
    doc = {
        "id": thread_id,
        "title": data.title,
        "body": data.body.strip(),
        "owner_hash": pseudonym(thread_id, data.owner_token),
        "status": "open",
        "reply_count": 0,
        "created_at": now,
        "expires_at": now + timedelta(hours=data.expires_in_hours),
        "last_activity_at": now,
    }
    await db.threads.insert_one(dict(doc))
    return _summary(doc)


def _build_tree(docs: List[dict]) -> List[Reply]:
    nodes = {
        d["id"]: Reply(
            id=d["id"],
            thread_id=d["thread_id"],
            parent_reply_id=d.get("parent_reply_id"),
            participant_hash=d["participant_hash"],
            is_op=d.get("is_op", False),
            body=d["body"],
            created_at=_aware(d["created_at"]),
            depth=d.get("depth", 0),
        )
        for d in docs
    }
    roots: List[Reply] = []
    for d in docs:
        node = nodes[d["id"]]
        parent_id = d.get("parent_reply_id")
        if parent_id and parent_id in nodes:
            nodes[parent_id].children.append(node)
        else:
            roots.append(node)
    return roots


async def _load_thread(thread_id: str) -> dict:
    doc = await db.threads.find_one({"id": thread_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Thread not found.")
    if _aware(doc["expires_at"]) <= datetime.now(timezone.utc):
        await db.replies.delete_many({"thread_id": thread_id})
        await db.threads.delete_one({"id": thread_id})
        raise HTTPException(status_code=404, detail="This thread has expired.")
    return doc


@router.get("/threads/{thread_id}", response_model=ThreadDetail)
async def get_thread(thread_id: str):
    doc = await _load_thread(thread_id)
    replies = await db.replies.find({"thread_id": thread_id}).sort("created_at", 1).to_list(2000)
    return ThreadDetail(**_summary(doc).model_dump(), body=doc.get("body", ""), replies=_build_tree(replies))


@router.post("/threads/{thread_id}/replies", response_model=Reply, status_code=201)
async def create_reply(thread_id: str, data: ReplyCreate, request: Request):
    if not allow("reply", client_hash(request), limit=10, window_seconds=300):
        raise HTTPException(status_code=429, detail="Too many replies. Slow down a moment.")
    thread = await _load_thread(thread_id)
    if thread["status"] == "closed":
        raise HTTPException(status_code=400, detail="This thread is closed.")
    if not await verify_and_consume(data.challenge, data.nonce):
        raise HTTPException(status_code=400, detail="Invalid or expired proof of work.")
    if is_blocked(data.body):
        raise HTTPException(status_code=400, detail="Post rejected.")

    depth = 0
    parent_id: Optional[str] = data.parent_reply_id
    if parent_id:
        parent = await db.replies.find_one({"id": parent_id, "thread_id": thread_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent reply not found.")
        depth = parent.get("depth", 0) + 1
        if depth > MAX_DEPTH:
            raise HTTPException(status_code=400, detail="Maximum nesting depth reached.")

    participant_hash = pseudonym(thread_id, data.participant_token)
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "thread_id": thread_id,
        "parent_reply_id": parent_id,
        "participant_hash": participant_hash,
        "is_op": participant_hash == thread["owner_hash"],
        "body": data.body.strip(),
        "created_at": now,
        "depth": depth,
    }
    await db.replies.insert_one(dict(doc))
    await db.threads.update_one(
        {"id": thread_id},
        {"$inc": {"reply_count": 1}, "$set": {"last_activity_at": now}},
    )
    return Reply(**{k: v for k, v in doc.items()})


@router.patch("/threads/{thread_id}/close", response_model=ThreadSummary)
async def close_thread(thread_id: str, data: CloseThread):
    """Only the holder of the original owner token can close. We store just its hash."""
    thread = await _load_thread(thread_id)
    if pseudonym(thread_id, data.owner_token) != thread["owner_hash"]:
        raise HTTPException(status_code=403, detail="Only the thread creator can close it.")
    await db.threads.update_one({"id": thread_id}, {"$set": {"status": "closed"}})
    thread["status"] = "closed"
    return _summary(thread)
