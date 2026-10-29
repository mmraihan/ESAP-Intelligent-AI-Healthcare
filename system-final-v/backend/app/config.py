"""Environment-driven configuration.

Read once at import. No secrets are defaulted to a real value: an unset
``ESAP_SECRET`` yields a per-process random one, so a forgotten .env fails by
invalidating tokens on restart rather than by shipping a known signing key.
"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent

# The three covariates that must never reach a feature builder (§6 guardrail 4).
# Captured on the request as a sibling of `features`, reported only on /fairness.
AUDIT_COVARIATE_NAMES = ("race", "insurance", "marital_status")


def _load_dotenv() -> None:
    """Populate os.environ from a sibling .env. Real env vars always win."""
    try:
        with open(BACKEND_ROOT / ".env", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key = key.strip()
                if key and key not in os.environ:
                    os.environ[key] = val.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass


_load_dotenv()


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    return default if raw is None else raw.strip().lower() in {"1", "true", "yes", "on"}


def _path(name: str, default: str) -> Path:
    raw = os.environ.get(name, default)
    p = Path(raw)
    return p if p.is_absolute() else BACKEND_ROOT / p


@dataclass(frozen=True)
class Settings:
    model_mode: str = os.environ.get("MODEL_MODE", "stub").strip().lower()
    exports_dir: Path | None = None
    db_path: Path = field(default_factory=lambda: _path("ESAP_DB_PATH", "esap.db"))
    seed_path: Path = field(default_factory=lambda: _path("ESAP_SEED_PATH", "seed/seed.json"))
    secret: str = field(default_factory=lambda: os.environ.get("ESAP_SECRET") or secrets.token_hex(32))
    allow_prefill: bool = field(default_factory=lambda: _bool("ESAP_ALLOW_PREFILL", False))
    # Demo-only: one platform account that holds every capability at full grade,
    # with no break-glass step. It bypasses the §4.8 controls by design, so it is
    # off unless explicitly switched on and must never be enabled in production.
    demo_all_access: bool = field(default_factory=lambda: _bool("ESAP_DEMO_ALL_ACCESS", False))
    superuser_email: str = field(default_factory=lambda: os.environ.get(
        "ESAP_SUPERUSER_EMAIL", "superadmin@esap.health").strip().lower())
    session_ttl_hours: int = 12

    # Deployment / tenancy seam (§5). SQLite is the default single-box store; a
    # multi-hospital deployment sets DATABASE_URL to a Postgres DSN and runs the
    # RLS policies in db_postgres_rls.sql so tenant isolation is enforced by the
    # database, not only by the app-layer `WHERE tenant_id=?`. See POSTGRES_RLS.md.
    #   DEPLOYMENT_MODE: single_tenant (default) | pool | silo
    deployment_mode: str = field(default_factory=lambda: os.environ.get(
        "DEPLOYMENT_MODE", "single_tenant").strip().lower())
    database_url: str | None = field(default_factory=lambda: os.environ.get("DATABASE_URL") or None)

    # Polar payments (routers/billing.py). POLAR_ENV picks the API host and the
    # product ids; the token and webhook secret are server-only and never
    # defaulted. Without a token, checkout answers 503 rather than half-working.
    polar_env: str = field(default_factory=lambda: os.environ.get("POLAR_ENV", "sandbox").strip().lower())
    polar_access_token: str | None = field(default_factory=lambda: os.environ.get("POLAR_ACCESS_TOKEN") or None)
    polar_webhook_secret: str | None = field(default_factory=lambda: os.environ.get("POLAR_WEBHOOK_SECRET") or None)
    #: Where the browser lands after checkout. Polar fills {CHECKOUT_ID}.
    billing_success_url: str = field(default_factory=lambda: os.environ.get(
        "BILLING_SUCCESS_URL", "https://care.esap.ai/billing/success?checkout_id={CHECKOUT_ID}"))
    billing_return_url: str = field(default_factory=lambda: os.environ.get(
        "BILLING_RETURN_URL", "https://care.esap.ai/pricing"))

    @property
    def uses_postgres(self) -> bool:
        return bool(self.database_url and self.database_url.startswith(("postgres://", "postgresql://")))

    @property
    def cors_origin_regex(self) -> str | None:
        """Extra origins by pattern. Defaults to any port on this machine.

        Vite moves to the next free port when 5175 is taken, and a front end on
        5176 that the API refuses looks exactly like a dead backend. Loopback
        origins only; set ESAP_CORS_ORIGIN_REGEX to an empty value to turn off.
        """
        raw = os.environ.get("ESAP_CORS_ORIGIN_REGEX", r"http://(localhost|127\.0\.0\.1)(:\d+)?")
        return raw.strip() or None

    @property
    def cors_origins(self) -> list[str]:
        raw = os.environ.get("ESAP_CORS_ORIGINS", "http://localhost:5175,http://127.0.0.1:5175")
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def trusted_proxies(self) -> frozenset[str]:
        """Addresses of the reverse proxies in front of the API.

        Only a request arriving from one of these may name its real client in
        X-Forwarded-For; from anyone else the header is ignored, because a
        client can write whatever it likes there. Empty (the default) means the
        API faces clients directly.
        """
        raw = os.environ.get("ESAP_TRUSTED_PROXIES", "")
        return frozenset(p.strip() for p in raw.split(",") if p.strip())


@lru_cache(maxsize=1)
def settings() -> Settings:
    raw_exports = os.environ.get("ESAP_EXPORTS_DIR")
    exports = None
    if raw_exports:
        p = Path(raw_exports)
        exports = p if p.is_absolute() else (BACKEND_ROOT / p).resolve()
    return Settings(exports_dir=exports)
