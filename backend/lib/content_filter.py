"""Keyword blocklist for the most egregious content.

Deliberately narrow: this is a hard floor against slurs and abuse-material terms, not a
general opinion filter — the wall exists for speech that is uncomfortable but lawful.
Rejected content is never logged, and nothing about the poster is recorded.

The actual term list lives only in the CONTENT_BLOCKLIST env var (comma-separated), never
in source, so a public repo doesn't hand anyone the exact bypass list.
"""
import logging
import os
import re

logger = logging.getLogger(__name__)


def _load_blocked_terms() -> set[str]:
    raw = os.environ.get("CONTENT_BLOCKLIST", "")
    terms = {t.strip().lower() for t in raw.split(",") if t.strip()}
    if not terms:
        logger.warning(
            "CONTENT_BLOCKLIST is not set — the wall/thread content filter is disabled."
        )
    return terms


# Stored obfuscated-insensitively; matching is done on a normalised copy of the text.
BLOCKED_TERMS: set[str] = _load_blocked_terms()

# Collapse leetspeak and separators so "n1-g_g3r" still matches.
_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})


def _normalise(text: str) -> str:
    lowered = text.lower().translate(_LEET)
    return re.sub(r"[^a-z]", "", lowered)


def is_blocked(text: str) -> bool:
    """True when the text contains a blocked term. Never logs or returns the match."""
    squashed = _normalise(text)
    words = set(re.findall(r"[a-z]+", text.lower().translate(_LEET)))
    for term in BLOCKED_TERMS:
        # Short terms need an exact word match to avoid gutting innocent words.
        if len(term) <= 3:
            if term in words:
                return True
        elif term in squashed:
            return True
    return False
