"""
Promote a registered user to the ADMIN role.

Usage (from the backend directory, or inside the backend container):

    python -m scripts.promote_admin user@example.com

The first registered account is the natural candidate when setting up a
fresh deployment: registration always creates regular users, and the
admin surfaces (GET /api/admin/users, the Monitoring "Users" tab) stay
hidden until someone holds the role.
"""

import sys
from datetime import UTC, datetime

from sqlalchemy import create_engine, text

from app.config import settings


def promote(email: str) -> int:
    engine = create_engine(settings.DATABASE_SYNC_URL)
    try:
        with engine.begin() as conn:
            result = conn.execute(
                text(
                    "UPDATE users SET role = 'admin', updated_at = :now "
                    "WHERE email = :email AND role <> 'admin'"
                ),
                {"email": email, "now": datetime.now(UTC)},
            )
            if result.rowcount == 0:
                already = conn.execute(
                    text("SELECT 1 FROM users WHERE email = :email AND role = 'admin'"),
                    {"email": email},
                ).scalar()
                if already:
                    print(f"{email} is already an admin")
                    return 0
                print(f"No user found with email {email!r}")
                return 1
        print(f"Promoted {email} to admin")
        return 0
    finally:
        engine.dispose()


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    return promote(sys.argv[1])


if __name__ == "__main__":
    sys.exit(main())
