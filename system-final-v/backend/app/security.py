"""Password hashing and session tokens.

PBKDF2-HMAC-SHA256 from the standard library rather than bcrypt/argon2: it
keeps the dependency list at four packages, and the demo credentials it
protects are synthetic. A real deployment swaps `hash_password` / `verify_password`
for argon2id — nothing else in the codebase reads the hash format.

Tokens are opaque random strings stored server-side in `sessions`, not JWTs:
revocation (sign-out, break-glass expiry, suspension) has to be immediate, and
a stateless token cannot be withdrawn before its own expiry.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

PBKDF2_ROUNDS = 120_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, rounds, salt_hex, want = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(dk.hex(), want)


# Verified against when the email is unknown, so a miss costs the same PBKDF2
# work as a wrong password and response time does not reveal who has an account.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def verify_or_burn(password: str, stored: str | None) -> bool:
    """`verify_password`, but spends the same time when there is no account."""
    if stored is None:
        verify_password(password, _DUMMY_HASH)
        return False
    return verify_password(password, stored)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def expiry(hours: float) -> datetime:
    return utcnow() + timedelta(hours=hours)
