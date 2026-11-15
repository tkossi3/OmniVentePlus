"""Authentication helpers for marketplace accounts."""
import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.marketplace_models import User

bearer = HTTPBearer(auto_error=False)


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310_000)
    return f"pbkdf2_sha256$310000${_b64encode(salt)}${_b64encode(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt, expected = encoded.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), _b64decode(salt), int(rounds)
        )
        return hmac.compare_digest(actual, _b64decode(expected))
    except (ValueError, TypeError):
        return False


def create_access_token(user: User) -> str:
    header = _b64encode(b'{"alg":"HS256","typ":"JWT"}')
    payload = _b64encode(json.dumps({
        "sub": user.id,
        "role": user.role,
        "exp": int(time.time()) + 86_400,
    }, separators=(",", ":")).encode("utf-8"))
    message = f"{header}.{payload}".encode("ascii")
    signature = hmac.new(settings.jwt_secret.encode("utf-8"), message, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64encode(signature)}"


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Connectez-vous pour continuer.", headers={"WWW-Authenticate": "Bearer"})
    try:
        header, payload, signature = credentials.credentials.split(".")
        signed = f"{header}.{payload}".encode("ascii")
        expected = hmac.new(settings.jwt_secret.encode("utf-8"), signed, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64decode(signature)):
            raise ValueError("invalid signature")
        claims = json.loads(_b64decode(payload))
        if int(claims["exp"]) <= int(time.time()):
            raise ValueError("expired token")
        user_id = int(claims["sub"])
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        raise HTTPException(401, "Session invalide ou expirée.", headers={"WWW-Authenticate": "Bearer"})
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(401, "Compte introuvable.", headers={"WWW-Authenticate": "Bearer"})
    return user


def require_seller(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("seller", "admin"):
        raise HTTPException(403, "Un compte vendeur est requis pour cette action.")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Accès réservé à l'administration.")
    return user
