"""Authentication router: Google OAuth verification and MongoDB user persistence."""
import os
import time
import logging
from typing import Optional, Dict, Any
import jwt
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.db.mongodb import get_database, get_is_connected

logger = logging.getLogger("robot.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
JWT_SECRET = os.getenv("JWT_SECRET", "robotic-arm-jwt-secret-key-2026")
JWT_ALGORITHM = "HS256"

# In-memory user cache fallback when MongoDB connection is not active
_MEMORY_USERS: Dict[str, Dict[str, Any]] = {}


class GoogleLoginRequest(BaseModel):
    credential: str  # Google ID Token received from Google Identity Services


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "operator"
    created_at: float
    last_login: float


class AuthResponse(BaseModel):
    success: bool
    token: str
    user: UserProfile
    storage: str  # "mongodb" or "in-memory"


def create_session_token(user_id: str, email: str) -> str:
    """Generate signed JWT token valid for 7 days."""
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + (7 * 24 * 3600)  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_session_token(token: str) -> Dict[str, Any]:
    """Verify and decode JWT token."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authorization token.")


@router.post("/google", response_model=AuthResponse)
async def google_auth_login(payload: GoogleLoginRequest):
    """Verify Google OAuth token and upsert user in MongoDB."""
    credential = payload.credential
    if not credential:
        raise HTTPException(status_code=400, detail="Missing Google credential token.")

    # 1. Verify Google ID token
    try:
        req = google_requests.Request()
        # If GOOGLE_CLIENT_ID is provided, verify against it; otherwise verify token structure
        id_info = id_token.verify_oauth2_token(
            credential,
            req,
            audience=GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID else None,
            clock_skew_in_seconds=10
        )
    except Exception as e:
        logger.error(f"Google token verification failed: {e}")
        raise HTTPException(status_code=401, detail=f"Google authentication failed: {str(e)}")

    google_id = id_info.get("sub")
    email = id_info.get("email")
    name = id_info.get("name") or email.split("@")[0]
    picture = id_info.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Google token does not contain an email address.")

    now = time.time()
    db = get_database()
    storage_type = "mongodb" if get_is_connected() and db is not None else "in-memory"

    # 2. Upsert in MongoDB
    if storage_type == "mongodb":
        try:
            user_doc = await db.users.find_one({"google_id": google_id})
            if user_doc:
                await db.users.update_one(
                    {"google_id": google_id},
                    {"$set": {
                        "name": name,
                        "picture": picture,
                        "last_login": now
                    }}
                )
                user_id = str(user_doc.get("_id", google_id))
                created_at = user_doc.get("created_at", now)
                role = user_doc.get("role", "operator")
            else:
                new_doc = {
                    "google_id": google_id,
                    "email": email,
                    "name": name,
                    "picture": picture,
                    "role": "operator",
                    "created_at": now,
                    "last_login": now
                }
                res = await db.users.insert_one(new_doc)
                user_id = str(res.inserted_id)
                created_at = now
                role = "operator"
            logger.info(f"MongoDB: User authenticated successfully ({email}).")
        except Exception as e:
            logger.error(f"MongoDB write failed, falling back to memory: {e}")
            storage_type = "in-memory"

    # Fallback to in-memory if MongoDB was unavailable
    if storage_type == "in-memory":
        user_id = google_id
        if google_id in _MEMORY_USERS:
            _MEMORY_USERS[google_id]["last_login"] = now
            created_at = _MEMORY_USERS[google_id]["created_at"]
            role = _MEMORY_USERS[google_id].get("role", "operator")
        else:
            _MEMORY_USERS[google_id] = {
                "id": google_id,
                "email": email,
                "name": name,
                "picture": picture,
                "role": "operator",
                "created_at": now,
                "last_login": now
            }
            created_at = now
            role = "operator"
        logger.info(f"In-Memory: User authenticated ({email}).")

    # 3. Create Session JWT
    session_token = create_session_token(user_id, email)

    return AuthResponse(
        success=True,
        token=session_token,
        storage=storage_type,
        user=UserProfile(
            id=user_id,
            email=email,
            name=name,
            picture=picture,
            role=role,
            created_at=created_at,
            last_login=now
        )
    )


@router.get("/me", response_model=UserProfile)
async def get_current_user(authorization: Optional[str] = Header(None)):
    """Fetch current user from MongoDB via JWT Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")

    token = authorization.split(" ")[1]
    payload = decode_session_token(token)
    email = payload.get("email")

    db = get_database()
    if get_is_connected() and db is not None:
        user_doc = await db.users.find_one({"email": email})
        if user_doc:
            return UserProfile(
                id=str(user_doc.get("_id", user_doc.get("google_id"))),
                email=user_doc["email"],
                name=user_doc.get("name", email.split("@")[0]),
                picture=user_doc.get("picture"),
                role=user_doc.get("role", "operator"),
                created_at=user_doc.get("created_at", time.time()),
                last_login=user_doc.get("last_login", time.time())
            )

    # In-memory lookup fallback
    for u in _MEMORY_USERS.values():
        if u.get("email") == email:
            return UserProfile(
                id=u["id"],
                email=u["email"],
                name=u["name"],
                picture=u.get("picture"),
                role=u.get("role", "operator"),
                created_at=u.get("created_at", time.time()),
                last_login=u.get("last_login", time.time())
            )

    raise HTTPException(status_code=404, detail="User record not found.")
