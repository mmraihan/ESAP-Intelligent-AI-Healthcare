from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from core.audit import AuditMiddleware
from database import check_connection, create_tables
from routers import alerts, appointments, auth, decisions, patients, visits


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not check_connection():
        raise RuntimeError("Cannot reach SQL Server — check DB_HOST / credentials in .env")
    create_tables()
    print("[OK] Database connected, tables verified")
    yield


app = FastAPI(
    title="ESAP Healthcare API",
    description="ESAP Intelligent AI Healthcare Platform — Phase 1",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(visits.router)
app.include_router(decisions.router)
app.include_router(appointments.router)
app.include_router(alerts.router)


@app.get("/health", tags=["health"])
def health():
    ok = check_connection()
    return {"status": "ok" if ok else "db_unreachable", "db": ok}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)
