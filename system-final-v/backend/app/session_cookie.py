"""The HttpOnly session cookie (QA issue 13).

The web client used to keep its session token in localStorage, where any
script on the page can read it. Now every sign-in also sets the token as an
HttpOnly cookie the page cannot read, and the client stops storing it.

`_mint` (routers/auth.py) calls `remember()`; the middleware in main.py then
puts the cookie on that response. A per-request dict in a ContextVar carries it
across FastAPI's threadpool, which copies the context but shares the dict.
Bearer tokens keep working for API clients and tests.
"""

from __future__ import annotations

from contextvars import ContextVar

from starlette.requests import Request
from starlette.responses import Response

from .config import settings

_pending: ContextVar[dict | None] = ContextVar("esap_cookie_pending", default=None)


def begin() -> dict:
    box: dict = {}
    _pending.set(box)
    return box


def remember(token: str, max_age_s: int) -> None:
    box = _pending.get()
    if box is not None:
        box["token"], box["max_age"] = token, max_age_s


def forget() -> None:
    box = _pending.get()
    if box is not None:
        box["clear"] = True


def _secure(request: Request) -> bool:
    cfg = settings()
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    return cfg.cookie_secure or proto == "https"


def apply(box: dict, request: Request, response: Response) -> None:
    cfg = settings()
    secure = _secure(request)
    samesite = cfg.cookie_samesite or ("none" if secure else "lax")
    if samesite == "none" and not secure:
        samesite = "lax"  # browsers reject SameSite=None without Secure
    if box.get("token"):
        response.set_cookie(
            cfg.cookie_name, box["token"], max_age=box["max_age"], httponly=True,
            secure=secure, samesite=samesite, path="/api", domain=cfg.cookie_domain,
        )
    elif box.get("clear"):
        response.delete_cookie(cfg.cookie_name, path="/api", domain=cfg.cookie_domain,
                               secure=secure, httponly=True, samesite=samesite)
