from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.device import Device
from app.schemas.device import DeviceCreate, DeviceOut
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
    db.commit()
    db.refresh(device)
    return device


@router.get("/", response_model=list[DeviceOut])
def list_devices(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_from_token(current_user, db)
    return db.query(Device).filter(Device.user_id == user.id).all()


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
