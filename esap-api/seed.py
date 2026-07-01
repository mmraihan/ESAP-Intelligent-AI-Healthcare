"""
Run once to create the initial admin + doctor accounts.

    python seed.py

Safe to run multiple times — skips accounts that already exist.
"""
import sys

from database import SessionLocal, create_tables, check_connection
from models.user import User
from core.security import hash_password


SEED_USERS = [
    {
        "email": "admin@esap.health",
        "password": "Admin@Esap2026",
        "full_name": "ESAP Administrator",
        "role": "admin",
    },
    {
        "email": "doctor@esap.health",
        "password": "Doctor@Esap2026",
        "full_name": "Dr. Demo Doctor",
        "role": "doctor",
        "specialty": "General Medicine",
        "license_number": "ESAP-DOC-001",
    },
]


def main():
    if not check_connection():
        print("ERROR: Cannot connect to SQL Server. Check your .env / DB credentials.")
        sys.exit(1)

    create_tables()
    print("Tables verified.")

    db = SessionLocal()
    try:
        for data in SEED_USERS:
            existing = db.query(User).filter(User.email == data["email"]).first()
            if existing:
                print(f"  SKIP  {data['email']} (already exists)")
                continue

            user = User(
                email=data["email"],
                password_hash=hash_password(data["password"]),
                full_name=data["full_name"],
                role=data["role"],
                specialty=data.get("specialty"),
                license_number=data.get("license_number"),
                is_active=True,
            )
            db.add(user)
            db.commit()
            print(f"  CREATED  {data['email']}  [{data['role']}]")
    finally:
        db.close()

    print("\nSeed complete. Login credentials:")
    for u in SEED_USERS:
        print(f"  {u['role']:8s}  {u['email']}  /  {u['password']}")


if __name__ == "__main__":
    main()
