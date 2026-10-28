from fastapi import APIRouter, Depends, HTTPException
import re
from pydantic import BaseModel, Field, field_validator
from typing import Literal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.schemas.alerts import AlertsOut
from app.schemas.user import DeviceTokenIn, DeviceTokenOut, UserOut
from app.services.alerts import AlertService
from app.services.fcm import FCMService, PushDeliveryError

router = APIRouter(prefix="/users", tags=["users"])


@router.delete("/me/device-token")
def remove_device_token(
    token_data: DeviceTokenIn,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.firebase_uid == current_user["uid"]).first()
    if user and user.fcm_token == token_data.fcm_token:
        user.fcm_token = None
        db.commit()
    return {"success": True}


@router.get("/me", response_model=UserOut)
def get_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    firebase_uid = current_user["uid"]

    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    if not user:
        user = User(
            firebase_uid=firebase_uid,
            full_name=current_user.get("name", "New User"),
            email=current_user.get("email"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return {
        "id": user.id,
        "firebase_uid": user.firebase_uid,
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "address": user.address,
        "profile_image": user.profile_image,
        "timezone": user.timezone or "Asia/Kolkata",
        "monthly_limit": float(user.monthly_limit),
        "created_at": user.created_at,
    }


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=255)
    monthly_limit: float | None = Field(default=None, gt=0, le=100_000)

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        if not re.fullmatch(r"[+0-9 ()-]+", value):
            raise ValueError("Enter a valid Indian mobile number, with or without +91.")
        compact = re.sub(r"[ ()-]", "", value)
        match = re.fullmatch(r"(?:\+?91)?([6-9][0-9]{9})", compact)
        if not match:
            raise ValueError("Enter a valid Indian mobile number, with or without +91.")
        return "+91" + match.group(1)


@router.get("/me/alerts", response_model=AlertsOut)
def get_my_alerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    firebase_uid = current_user["uid"]

    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    if not user:
        user = User(
            firebase_uid=firebase_uid,
            full_name=current_user.get("name", "New User"),
            email=current_user.get("email"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    result = AlertService.evaluate_user_alerts(db, user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="User not found")
    return result


@router.post("/me/device-token", response_model=DeviceTokenOut)
def register_device_token(
    token_data: DeviceTokenIn,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    firebase_uid = current_user["uid"]

    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    if not user:
        user = User(
            firebase_uid=firebase_uid,
            full_name=current_user.get("name", "New User"),
            email=current_user.get("email"),
        )
        db.add(user)

    user.fcm_token = token_data.fcm_token
    db.commit()
    db.refresh(user)

    return {"fcm_token": user.fcm_token}


@router.post("/me/test-notification")
def test_notification(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    firebase_uid = current_user["uid"]
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.services.notifications import NotificationService
    result = NotificationService.check_and_notify_usage(db, user.id)
    return result


class PushTestOut(BaseModel):
    success: bool
    status: Literal["accepted_by_fcm"]
    message_id: str


@router.post("/me/push-test", response_model=PushTestOut)
def send_push_test(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a user-initiated delivery check to the current device."""
    user = db.query(User).filter(User.firebase_uid == current_user["uid"]).first()
    if user is None or not user.fcm_token:
        raise HTTPException(status_code=409, detail="Enable notifications on this device first")

    try:
        message_id = FCMService.notify_user(
            db, user.id, "WattWatcher test alert", "Your energy alerts can appear here, even when WattWatcher is in the background."
        )
    except PushDeliveryError as error:
        raise HTTPException(status_code=502, detail=str(error)) from None
    if not message_id:
        raise HTTPException(status_code=502, detail="Firebase did not accept the notification")
    return {"success": True, "status": "accepted_by_fcm", "message_id": message_id}


@router.put("/me", response_model=UserOut)
def update_me(
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    firebase_uid = current_user["uid"]

    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    if not user:
        user = User(
            firebase_uid=firebase_uid,
            full_name=user_data.full_name or current_user.get('name', 'New User'),
            email=current_user.get("email"),
            phone=user_data.phone,
            address=user_data.address,
        )
        db.add(user)
    else:
        if user_data.full_name is not None:
            user.full_name = user_data.full_name
        # An explicit null clears the phone; omission preserves existing data.
        if "phone" in user_data.model_fields_set:
            user.phone = user_data.phone
        if user_data.address is not None:
            user.address = user_data.address
        if user_data.monthly_limit is not None:
            user.monthly_limit = user_data.monthly_limit

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as error:
        db.rollback()
        # Never include database exception text: it can contain phone numbers.
        constraint = getattr(getattr(error.orig, "diag", None), "constraint_name", "") or ""
        detail = ("This phone number cannot be used for this account."
                  if "phone" in constraint else "Profile details conflict with an existing account.")
        raise HTTPException(status_code=409, detail=detail) from None
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not save your profile. Please try again.") from None

    return {
        "id": user.id,
        "firebase_uid": user.firebase_uid,
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "address": user.address,
        "profile_image": user.profile_image,
        "timezone": user.timezone,
        "monthly_limit": float(user.monthly_limit),
        "created_at": user.created_at,
    }
