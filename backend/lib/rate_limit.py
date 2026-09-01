"""Sliding-window rate limiting keyed by a salted IP hash.

The raw IP is never stored. The salt rotates every 24h, so yesterday's hashes can't be
correlated with today's — the limiter can stop a flood but can't build a profile.
"""
import hashlib
import secrets
import time
from collections import defaultdict, deque

_SALT = secrets.token_hex(16)
_SALT_ROTATED_AT = time.time()
_SALT_TTL_SECONDS = 24 * 60 * 60

_HITS: dict[str, deque[float]] = defaultdict(deque)


def _current_salt() -> str:
    global _SALT, _SALT_ROTATED_AT
    if time.time() - _SALT_ROTATED_AT >= _SALT_TTL_SECONDS:
        _SALT = secrets.token_hex(16)
        _SALT_ROTATED_AT = time.time()
        _HITS.clear()
    return _SALT


def client_hash(request) -> str:
    """Salted, rotating hash of the client IP. Never logged, never persisted."""
    ip = request.client.host if request.client else "unknown"
    return hashlib.sha256(f"{ip}{_current_salt()}".encode()).hexdigest()[:16]


def allow(bucket: str, ident: str, limit: int, window_seconds: int) -> bool:
    """True when the action is within the sliding window allowance."""
    key = f"{bucket}:{ident}"
    now = time.time()
    hits = _HITS[key]
    while hits and now - hits[0] > window_seconds:
        hits.popleft()
    if len(hits) >= limit:
        return False
    hits.append(now)
    return True
