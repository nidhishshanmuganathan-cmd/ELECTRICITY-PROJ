import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.device import Device
from app.schemas.device import DeviceCreate, DeviceOut, DeviceProvisioningTokenOut
from app.services.device_auth import hash_device_token
from app.services.demo_data import populate_demo_data
from datetime import datetime, timezone

router = APIRouter(prefix="/devices", tags=["devices"])


def get_user_from_token(current_user: dict, db: Session) -> User:
    firebase_uid = current_user["uid"]
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        # Self-healing: create user if missing
        user = User(
            firebase_uid=firebase_uid,
            full_name=current_user.get("name", "New User"),
            email=current_user.get("email"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.post("/", response_model=DeviceOut)
def add_device(
    device_data: DeviceCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_from_token(current_user, db)

    device = Device(
        user_id=user.id,
        device_code=device_data.device_code,
        device_name=device_data.device_name,
        firmware_version=device_data.firmware_version,
        location=device_data.location,
        wifi_ssid=device_data.wifi_ssid,
    )
    db.add(device)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That device code is already registered")
    db.refresh(device)
    return device


@router.get("/", response_model=list[DeviceOut])
def list_devices(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_from_token(current_user, db)
    return db.query(Device).filter(Device.user_id == user.id).all()


@router.post("/{device_id}/provision-token", response_model=DeviceProvisioningTokenOut)
def provision_upload_token(
    device_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or rotate the upload token for a meter owned by this user.

    The plaintext token is returned only in this response; store it securely
    on the meter and send it as X-Device-Token on future reading uploads.
    """
    user = get_user_from_token(current_user, db)
    device = db.query(Device).filter(Device.id == device_id, Device.user_id == user.id).first()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    token = secrets.token_urlsafe(32)
    device.upload_token_hash = hash_device_token(token)
    db.commit()
    return {"device_id": device.id, "device_token": token}


@router.post("/demo-data", response_model=DeviceOut)
def create_demo_data(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or refresh a complete sample meter dataset for this user."""
    user = get_user_from_token(current_user, db)
    device = (
        db.query(Device)
        .filter(Device.user_id == user.id, Device.device_code == f"DEMO-{user.id.hex[:8].upper()}")
        .first()
    )
    if device is None:
        device = Device(
            user_id=user.id,
            device_code=f"DEMO-{user.id.hex[:8].upper()}",
            device_name="Sample Home Meter",
            firmware_version="demo",
            location="Demo apartment",
            status="online",
            last_seen=datetime.now(timezone.utc),
        )
        db.add(device)
        db.commit()
        db.refresh(device)

    populate_demo_data(db, device)
    db.refresh(device)
    return device
