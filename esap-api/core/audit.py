from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from core.security import decode_token
from database import SessionLocal
from models.security import AuditLog

AUDITED_PREFIXES = ("/api/patients", "/api/visits", "/api/decisions")

ACTION_BY_METHOD = {
    "POST": "CREATE",
    "PUT": "UPDATE",
    "PATCH": "UPDATE",
    "DELETE": "DELETE",
}


def _current_user_id(request: Request) -> str | None:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    payload = decode_token(auth_header[7:])
    return payload.get("sub") if payload.get("type") == "access" else None


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if request.url.path.startswith(AUDITED_PREFIXES):
            db = SessionLocal()
            try:
                db.add(AuditLog(
                    user_id=_current_user_id(request),
                    action=ACTION_BY_METHOD.get(request.method, "READ"),
                    resource=request.url.path,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                ))
                db.commit()
            finally:
                db.close()

        return response
