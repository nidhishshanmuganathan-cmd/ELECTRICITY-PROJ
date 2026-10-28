"""Authentication helpers for hardware meter uploads."""

import hashlib
import hmac

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.device import Device
from app.models.user import User

optional_bearer = HTTPBearer(auto_error=False)


def hash_device_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
) -> dict | None:
    return get_current_user(credentials) if credentials is not None else None


def get_upload_device(
    device_id,
    current_user: dict | None = Depends(get_optional_current_user),
    device_token: str | None = Header(default=None, alias="X-Device-Token"),
    db: Session = Depends(get_db),
) -> Device:
    """Authorize an upload from either the owning Firebase user or that meter.

    Hardware tokens are bound to exactly one device. Their hashes are compared
    in constant time and no device details are exposed on authentication failure.
    """
    if device_token:
        device = db.query(Device).filter(Device.id == device_id).first()
        if (
            device is not None
            and device.user_id is not None
            and device.upload_token_hash is not None
            and hmac.compare_digest(device.upload_token_hash, hash_device_token(device_token))
        ):
            return device
        raise HTTPException(status_code=401, detail="Invalid device credentials")

    if current_user is not None:
        device = (
            db.query(Device)
            .join(User, Device.user_id == User.id)
            .filter(Device.id == device_id, User.firebase_uid == current_user["uid"])
            .first()
        )
        if device is not None:
            return device

    raise HTTPException(status_code=401, detail="Device authentication required")
