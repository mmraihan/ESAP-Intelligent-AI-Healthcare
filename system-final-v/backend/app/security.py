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

import base64
import hashlib
import hmac
import secrets
import struct
import time
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


# --- TOTP (RFC 6238) ---------------------------------------------------------
# Standard-library TOTP so multi-factor auth needs no extra dependency. The
# secret is base32 so any authenticator app (Google Authenticator, 1Password,
# Authy) can read the otpauth:// URI. A real deployment would keep the secret in
# a KMS; here it lives beside the password hash, which is the same trust level.

_TOTP_STEP = 30
_TOTP_DIGITS = 6


def new_totp_secret() -> str:
    """A fresh base32 TOTP secret (no padding), as authenticator apps expect."""
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def totp_uri(secret: str, account: str, issuer: str = "ESAP") -> str:
    """The otpauth:// URI an authenticator app enrolls from (rendered as a QR)."""
    from urllib.parse import quote
    label = quote(f"{issuer}:{account}")
    return (f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}"
            f"&algorithm=SHA1&digits={_TOTP_DIGITS}&period={_TOTP_STEP}")


def _totp_at(secret: str, counter: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    mac = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = mac[-1] & 0x0F
    code = (struct.unpack(">I", mac[offset:offset + 4])[0] & 0x7FFFFFFF) % (10 ** _TOTP_DIGITS)
    return str(code).zfill(_TOTP_DIGITS)


def verify_totp(secret: str, code: str, *, window: int = 1) -> bool:
    """True if `code` matches the secret within +/- `window` 30-second steps
    (tolerating small clock skew). Constant-time compared."""
    code = (code or "").strip().replace(" ", "")
    if not secret or not code.isdigit():
        return False
    counter = int(time.time()) // _TOTP_STEP
    return any(hmac.compare_digest(_totp_at(secret, counter + drift), code)
               for drift in range(-window, window + 1))


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def expiry(hours: float) -> datetime:
    return utcnow() + timedelta(hours=hours)
