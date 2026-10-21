"""Create a platform super-admin account from the command line.

The ops console can seat further super admins, but somebody has to be first —
on a real deployment there are no demo accounts to sign in with. Run on the
server, against the database the API uses (ESAP_DB_PATH, as for the API):

    python tools/create_super_admin.py --email ops@example.com --name "A. Operator"

The password is prompted for (at least 12 characters) and never echoed or
taken from argv, where it would end up in shell history.
"""

from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import db  # noqa: E402
from app.routers.ops_people import PLATFORM_TENANT  # noqa: E402
from app.security import hash_password, iso, utcnow  # noqa: E402
from app.seed import ensure_seeded  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()

    email = args.email.strip().lower()
    password = getpass.getpass("Password (min 12 chars): ")
    if len(password) < 12:
        print("Password must be at least 12 characters.", file=sys.stderr)
        return 1
    if getpass.getpass("Repeat password: ") != password:
        print("Passwords do not match.", file=sys.stderr)
        return 1

    ensure_seeded()
    conn = db.connect()
    if conn.execute("SELECT 1 FROM credentials WHERE email=?", (email,)).fetchone():
        print(f"An account with {email} already exists.", file=sys.stderr)
        return 1

    import uuid

    user_id = f"plat_{uuid.uuid4().hex[:12]}"
    home_tenant = db.document("active_tenant_id") or PLATFORM_TENANT
    conn.execute(
        "INSERT INTO credentials (user_id, email, password_hash, role, tenant_id) VALUES (?,?,?,?,?)",
        (user_id, email, hash_password(password), "super_admin", home_tenant),
    )
    doc = {
        "id": user_id, "tenantId": PLATFORM_TENANT, "name": args.name.strip(), "email": email,
        "roles": ["super_admin"], "scope": "Platform", "unitIds": [], "status": "active",
        "mfa": "none", "sso": False, "lastActive": None, "createdAt": iso(utcnow()),
        "localTitle": "ESAP Platform Operations", "createdBy": "tools/create_super_admin.py",
    }
    db.insert_doc("users", doc, {"tenant_id": PLATFORM_TENANT, "email": email, "name": doc["name"],
                                 "role": "super_admin", "status": "active"})
    print(f"Created super admin {email}. Sign in at /login; the ops console is /ops/fleet.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
