"""Keyword blocklist for the most egregious content.

Deliberately narrow: this is a hard floor against slurs and abuse-material terms, not a
general opinion filter — the wall exists for speech that is uncomfortable but lawful.
Rejected content is never logged, and nothing about the poster is recorded.
"""
import re

# Stored obfuscated-insensitively; matching is done on a normalised copy of the text.
BLOCKED_TERMS: set[str] = {
    # racial / ethnic slurs
    "nigger", "nigga", "chink", "spic", "kike", "gook", "wetback", "coon", "paki",
    # anti-LGBT slurs
    "faggot", "fag", "tranny", "dyke",
    # ableist slur
    "retard", "retarded",
    # child sexual abuse material terms
    "cp", "childporn", "childpornography", "pedo", "pedophile", "loli", "lolicon",
    "jailbait", "preteensex", "childsex", "cheesepizza",
}

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
