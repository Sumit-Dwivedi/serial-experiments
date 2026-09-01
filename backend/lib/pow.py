"""Hashcash-style proof of work. Costs a poster a few seconds of CPU per post, which
throttles spam floods without cookies, accounts, IPs or any other identifying signal."""
import hashlib
import secrets as pysecrets
from datetime import datetime, timedelta, timezone

from lib.db import db

# Leading zero BITS required. Expected hashes ~= 2^DIFFICULTY.
# Measured in-browser via Web Crypto: 16 bits lands around 3-4s on average hardware.
DIFFICULTY = 16
CHALLENGE_TTL_MINUTES = 10


def _leading_zero_bits(digest: bytes) -> int:
    bits = 0
    for byte in digest:
        if byte == 0:
            bits += 8
            continue
        for shift in range(7, -1, -1):
            if byte >> shift:
                return bits + (7 - shift)
    return bits


async def issue_challenge(difficulty: int = DIFFICULTY) -> dict:
    challenge = pysecrets.token_hex(16)
    now = datetime.now(timezone.utc)
    await db.pow_challenges.insert_one(
        {
            "challenge": challenge,
            "difficulty": difficulty,
            "used": False,
            "created_at": now,
            "expires_at": now + timedelta(minutes=CHALLENGE_TTL_MINUTES),
        }
    )
    return {"challenge": challenge, "difficulty": difficulty}


async def verify_and_consume(challenge: str, nonce: str) -> bool:
    """Single-use: the challenge is atomically marked used, so a solution can't be replayed."""
    doc = await db.pow_challenges.find_one_and_update(
        {"challenge": challenge, "used": False}, {"$set": {"used": True}}
    )
    if not doc:
        return False
    if _aware(doc["expires_at"]) <= datetime.now(timezone.utc):
        return False
    digest = hashlib.sha256(f"{challenge}{nonce}".encode()).digest()
    return _leading_zero_bits(digest) >= doc["difficulty"]


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
