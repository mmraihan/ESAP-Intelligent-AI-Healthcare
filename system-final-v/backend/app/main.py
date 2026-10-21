"""ESAP backend — the API behind system-final-v/frontend.

    uvicorn app.main:app --reload --port 8000

Four surfaces on one deployable, which is a development convenience and not the
production topology: §11.1 requires three separate bundles (a guest-reachable
clinical app, a tenant-walled admin console, and an ops console that is not on
public DNS). The routers are already split along those lines, so splitting the
deployable is a build-config change. Until then the tenant wall is enforced in
`deps.tenant_scope` and `rbac.require`, not by network separation.
"""

from __future__ import annotations

import uuid

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from . import db, errors, predictors
from .deps import Actor, current_actor
from .config import settings
from .routers import (
    admin, admin_config, auth, bootstrap, catalog, chat, clinical, clinical_ops,
    exports, ops, ops_incidents, ops_people, patient, patient_ops, requests, settings as settings_router,
    support, waitlist, workspace,
)
from .seed import ensure_seeded

app = FastAPI(
    title="ESAP Intelligent AI Healthcare — API",
    version="1.0.0",
    description=(
        "Clinical decision support at hospital intake. Every feature is cut at "
        "t0 = admission; audit covariates are captured for fairness reporting and "
        "are never model inputs. Decision support only — not autonomous diagnosis."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings().cors_origins,
    allow_origin_regex=settings().cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

errors.install(app)


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    """One id per request, echoed on the error envelope and the audit row."""
    request.state.request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["x-request-id"] = request.state.request_id
    return response


@app.on_event("startup")
def startup() -> None:
    ensure_seeded()


API = "/api/v1"
for router in (auth.router, bootstrap.router, clinical.router, clinical_ops.router,
               catalog.router, chat.router, admin.router, admin_config.router, ops.router,
               ops_incidents.router, patient.router, patient_ops.router,
               exports.router, settings_router.router, requests.router, workspace.router,
               ops_people.router, support.router, waitlist.router):
    app.include_router(router, prefix=API)


@app.get("/healthz", tags=["health"])
def healthz():
    """Liveness. No model load, no DB read — it must answer while degraded."""
    return {"status": "ok"}


@app.get("/readyz", tags=["health"])
def readyz():
    """Readiness: can this process actually serve a request?

    In stub mode that means the database is seeded. In real mode it also means
    every required artifact loaded and its recorded library versions match the
    running interpreter — a version drift silently moves probabilities, so it
    has to fail closed with a 503 rather than serve quietly wrong numbers.
    """
    problems: list[str] = []
    try:
        db.init_schema()
        if not db.is_seeded():
            problems.append("database is not seeded (run: python -m app.seed)")
    except Exception as exc:  # noqa: BLE001
        problems.append(f"database unavailable: {type(exc).__name__}")

    mode = predictors.mode()
    if mode == "real":
        ok, reasons = predictors.backend().ready()
        if not ok:
            problems.extend(reasons)

    body = {"status": "ok" if not problems else "unavailable", "model_mode": mode,
            "problems": problems}
    if problems:
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=503, content=body)
    return body


@app.get("/api/v1/meta", tags=["health"])
def meta(actor: Actor = Depends(current_actor)):
    """What this deployment is, for the client's boot handshake.

    Authenticated, like every other `/v1` route (API_CONTRACT §1). It is only
    metadata, but it names the serving mode and the caller's tenant — an
    unauthenticated probe should not learn which tenant a host serves, or that
    it is running stub predictors. `/healthz` and `/readyz` stay open; those
    are for load balancers and carry nothing about the deployment's contents.
    """
    return {
        "schema_version": "1.0",
        "model_mode": predictors.mode(),
        "disclaimer": "Decision support only — assistive and calibrated, not autonomous diagnosis.",
        "guarantees": {
            "features_cut_at_t0": True,
            "audit_covariates_are_model_inputs": False,
            "patient_sees_raw_scores": False,
            "safety_features_gated_by_plan": False,
        },
        "now": db.document("now"),
        "active_tenant_id": actor.tenant_id,
    }
