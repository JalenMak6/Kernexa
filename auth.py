"""
auth.py
JWT creation/validation, password hashing, and FastAPI dependency injection.

Dependencies (add to requirements.txt):
    bcrypt>=4.0.0
    python-jose[cryptography]>=3.3.0
"""

import os
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── Config ────────────────────────────────────────────────────────────────────

JWT_SECRET      = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM   = "HS256"
ACCESS_EXPIRE   = int(os.environ.get("JWT_ACCESS_EXPIRE_MINUTES", 15))
REFRESH_EXPIRE  = int(os.environ.get("JWT_REFRESH_EXPIRE_DAYS",   7))

if not JWT_SECRET:
    import warnings
    warnings.warn(
        "JWT_SECRET environment variable is not set. "
        "Token creation and validation will fail. "
        "Generate one with: openssl rand -hex 32",
        RuntimeWarning,
        stacklevel=2,
    )

# ── Roles ─────────────────────────────────────────────────────────────────────

ROLES = ("admin", "operator", "reader")

ROLE_HIERARCHY = {
    "admin":    3,
    "operator": 2,
    "reader":   1,
}

# ── Password hashing ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


# ── Token creation ────────────────────────────────────────────────────────────

def create_access_token(user_id: int, username: str, role: str) -> str:
    """Create a short-lived JWT access token."""
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not set — cannot create tokens")
    now     = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=ACCESS_EXPIRE)
    payload = {
        "sub":      str(user_id),
        "username": username,
        "role":     role,
        "type":     "access",
        "iat":      now,
        "exp":      expires,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: int, username: str, role: str) -> str:
    """Create a long-lived JWT refresh token."""
    now     = datetime.now(timezone.utc)
    expires = now + timedelta(days=REFRESH_EXPIRE)
    payload = {
        "sub":      str(user_id),
        "username": username,
        "role":     role,
        "type":     "refresh",
        "iat":      now,
        "exp":      expires,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ── Token validation ──────────────────────────────────────────────────────────

def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.
    Raises HTTPException 401 on any failure.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── FastAPI dependency injection ──────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=False)


def _extract_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """
    Extract and validate Bearer token from Authorization header.
    Returns the decoded JWT payload.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated — provide a Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type — use access token",
        )
    return payload


def get_current_user(payload: dict = Depends(_extract_token)) -> dict:
    """Dependency: returns current user info from token."""
    return {
        "id":       int(payload["sub"]),
        "username": payload["username"],
        "role":     payload["role"],
    }


def require_role(*allowed_roles: str):
    """
    Dependency factory — requires the current user to have one of the allowed roles.

    Usage:
        @app.get("/api/users", dependencies=[Depends(require_role("admin"))])
        @app.post("/api/scans/trigger", dependencies=[Depends(require_role("admin", "operator"))])
        @app.get("/api/scans/latest", dependencies=[Depends(require_role("admin", "operator", "reader"))])
    """
    def _check(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user['role']}' is not permitted for this action. "
                       f"Required: {' or '.join(allowed_roles)}",
            )
        return user
    return _check


# ── Convenience role dependencies ─────────────────────────────────────────────
# Use these directly in route definitions for clarity

any_role      = require_role("admin", "operator", "reader")  # authenticated, any role
operator_up   = require_role("admin", "operator")            # operator or admin
admin_only    = require_role("admin")                        # admin only