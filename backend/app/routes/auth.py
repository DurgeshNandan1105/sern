import base64
import hashlib
import hmac
import json
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.services.otp_service import OtpService

router = APIRouter(prefix="/auth", tags=["Authentication & Personnel Management"])

AUTH_SECRET = "sern-jwt-dispatch-secret-2026-key"


def hash_password(password: str) -> str:
    """Hashes password with application salt."""
    return hashlib.sha256(f"sern-salt-2026-{password}".encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plain password matches stored hash."""
    return hmac.compare_digest(hash_password(plain_password), hashed_password)


def create_access_token(payload: dict, expires_in_seconds: int = 86400) -> str:
    """Creates a signed, URL-safe JWT access token using HMAC-SHA256."""
    header = {"alg": "HS256", "typ": "JWT"}
    body = {**payload, "exp": int(time.time()) + expires_in_seconds, "iat": int(time.time())}
    h_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    b_b64 = base64.urlsafe_b64encode(json.dumps(body).encode()).decode().rstrip("=")
    signing_input = f"{h_b64}.{b_b64}".encode()
    signature = hmac.new(AUTH_SECRET.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{h_b64}.{b_b64}.{sig_b64}"


def decode_access_token(token: str) -> Optional[dict]:
    """Validates signature and expiration of JWT access token."""
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            return None
        h_b64, b_b64, sig_b64 = parts
        signing_input = f"{h_b64}.{b_b64}".encode()
        expected_sig = hmac.new(AUTH_SECRET.encode(), signing_input, hashlib.sha256).digest()
        pad = len(sig_b64) % 4
        sig_bytes = base64.urlsafe_b64decode(sig_b64 + ("=" * (4 - pad) if pad else ""))
        if not hmac.compare_digest(sig_bytes, expected_sig):
            return None
        pad_b = len(b_b64) % 4
        body_json = base64.urlsafe_b64decode(b_b64 + ("=" * (4 - pad_b) if pad_b else "")).decode()
        body = json.loads(body_json)
        if body.get("exp", 0) < time.time():
            return None
        return body
    except Exception:
        return None


def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Extracts and validates JWT Bearer token from request Authorization header.
    Returns decoded user payload, or None if no valid token provided.
    """
    if not authorization:
        return None
    parts = authorization.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return decode_access_token(parts[1])
    return None


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "Ambulance Staff"
    credential_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str
    role: Optional[str] = None


class SendOtpRequest(BaseModel):
    phone: str
    email: str
    purpose: Optional[str] = "LOGIN"


class VerifyOtpRequest(BaseModel):
    identifier: str
    otp: str
    role: Optional[str] = "Administrator"
    name: Optional[str] = None


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new personnel account with email and password.
    Persists user credentials in the database and returns an authenticated JWT session token.
    """
    clean_email = payload.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required."
        )

    if not payload.name or len(payload.name.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name is required (minimum 2 characters)."
        )

    if not payload.password or len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters."
        )

    # Check if user already exists
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account is already registered with this email. Please log in directly."
        )

    # Validate HQ Security Passcode for Administrator role
    role = payload.role or "Ambulance Staff"
    if role == "Administrator":
        expected_passcode = "ADMIN-HQ-2026"
        if payload.credential_id and payload.credential_id.strip() != expected_passcode:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid HQ Security Passcode for Administrator registration."
            )

    new_user = User(
        name=payload.name.strip(),
        email=clean_email,
        password_hash=hash_password(payload.password),
        role=role,
        credential_id=(payload.credential_id or "").strip()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": new_user.role,
        "name": new_user.name
    })

    return {
        "success": True,
        "message": "Account created successfully. You are now logged in.",
        "token": token,
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "role": new_user.role,
            "credential_id": new_user.credential_id,
            "isVerified": True
        }
    }


@router.post("/login")
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates user with email and password.
    Strictly verifies user has previously signed up. Unregistered users are instructed to register first.
    """
    clean_email = payload.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid email address is required."
        )

    if not payload.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required."
        )

    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email. Please sign up first to create your personnel account."
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please verify your credentials and try again."
        )

    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "name": user.name
    })

    return {
        "success": True,
        "message": "Login successful.",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "credential_id": user.credential_id,
            "isVerified": True
        }
    }


@router.post("/send-otp")
def send_two_factor_otp(payload: SendOtpRequest):
    """Legacy backward-compatible OTP endpoint."""
    cleaned_phone = payload.phone.replace(" ", "").replace("-", "") if payload.phone else "9876543210"
    return OtpService.generate_and_dispatch_otp(
        phone=cleaned_phone,
        email_addr=payload.email,
        purpose=payload.purpose or "LOGIN"
    )


@router.post("/verify-otp")
def verify_two_factor_otp(payload: VerifyOtpRequest):
    """Legacy backward-compatible OTP verification endpoint."""
    verification = OtpService.verify_otp(
        identifier=payload.identifier,
        entered_otp=payload.otp
    )
    if not verification.get("verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=verification.get("error", "Invalid or expired OTP.")
        )
    role = payload.role or "Administrator"
    token = create_access_token({
        "sub": payload.identifier,
        "identifier": payload.identifier,
        "role": role,
        "name": payload.name or ("System Admin" if role == "Administrator" else "Verified Personnel")
    })
    verification["token"] = token
    verification["user"] = {
        "identifier": payload.identifier,
        "role": role,
        "name": payload.name or ("System Admin" if role == "Administrator" else "Verified Personnel"),
        "isVerified": True
    }
    return verification
