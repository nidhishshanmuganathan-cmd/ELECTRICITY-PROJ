from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.schemas.alerts import AlertsOut
from app.schemas.user import DeviceTokenIn, DeviceTokenOut, UserOut
from app.services.alerts import AlertService

router = APIRouter(prefix="/users", tags=["users"])


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
    full_name: str | None = None
    phone: str | None = None
    address: str | None = None
    monthly_limit: float | None = None


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
            full_name=user_data.full_name,
            email=current_user.get("email"),
            phone=user_data.phone,
            address=user_data.address,
        )
        db.add(user)
    else:
        if user_data.full_name is not None:
            user.full_name = user_data.full_name
        if user_data.phone is not None:
            user.phone = user_data.phone
        if user_data.address is not None:
            user.address = user_data.address
        if user_data.monthly_limit is not None:
            user.monthly_limit = user_data.monthly_limit

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
        "timezone": user.timezone,
        "monthly_limit": float(user.monthly_limit),
        "created_at": user.created_at,
    }