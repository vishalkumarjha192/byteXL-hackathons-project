"""Create the first admin account (admins cannot self-register).

    python -m app.create_admin --email you@company.com          (prompts for a password)
    python -m app.create_admin --email you@company.com --password 'a-long-password'
"""
import argparse
import getpass
import sys

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Role, User
from app.repositories import user_repo
from app.utils.security import hash_password


def create_admin(db: Session, email: str, password: str) -> User:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if user_repo.get_by_email(db, email):
        raise ValueError(f"{email} already exists")
    user = User(email=email.lower(), password_hash=hash_password(password), role=Role.ADMIN, is_verified=True)
    db.add(user)
    db.commit()
    return user


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an admin account")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password")
    args = parser.parse_args()
    password = args.password or getpass.getpass("Password (min 8 characters): ")
    try:
        with SessionLocal() as db:
            create_admin(db, args.email, password)
    except ValueError as e:
        sys.exit(f"Error: {e}")
    print(f"Admin account created for {args.email}")


if __name__ == "__main__":
    main()
