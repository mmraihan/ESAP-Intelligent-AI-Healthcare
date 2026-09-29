"""The uniform error envelope of API_CONTRACT §5.

    {"error": {"code", "message", "detail", "request_id"}}

Registered on the app so a Pydantic 422, an HTTPException and an unhandled
exception all leave through the same shape — the client has one error branch.
"""

from __future__ import annotations

import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    503: "SERVICE_UNAVAILABLE",
}


class ApiError(Exception):
    """Raised by routers; carries the contract's code directly."""

    def __init__(self, status: int, message: str, *, code: str | None = None, detail=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code or CODES.get(status, "ERROR")
        self.detail = detail


def _envelope(request: Request, status: int, code: str, message: str, detail=None) -> JSONResponse:
    rid = getattr(request.state, "request_id", None) or str(uuid.uuid4())
    body = {"error": {"code": code, "message": message, "request_id": rid}}
    if detail is not None:
        body["error"]["detail"] = detail
    return JSONResponse(status_code=status, content=body)


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError):
        return _envelope(request, exc.status, exc.code, exc.message, exc.detail)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException):
        code = CODES.get(exc.status_code, "ERROR")
        return _envelope(request, exc.status_code, code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):
        # extra="forbid" violations, out-of-range vitals, malformed CCSR codes.
        return _envelope(
            request, 422, "VALIDATION_ERROR", "Request failed schema validation.",
            detail=[{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()],
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        # Message stays generic: an internal traceback is not a client payload.
        return _envelope(request, 500, "INTERNAL_ERROR", "Unexpected server error.")
