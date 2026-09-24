"""TEMPORARY DEV-ONLY test route for FCM delivery verification.

REMOVE AFTER VERIFICATION: delete this file, drop its import +
include_router lines in main.py and app/main.py, and delete
tests/test_fcm_test_route.py.

Calls the existing FCMService.notify_user() for the currently
authenticated user. Does not evaluate alerts, send automatically,
or change any existing logic.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.services.fcm import FCMService

# TEMPORARY DEV-ONLY router - remove after verification.
router = APIRouter(prefix="/test", tags=["temp-fcm-test"])


class TestNotifyIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=1000)
    data: dict | None = None


class TestNotifyOut(BaseModel):
    sent: bool
    message_id: str | None = None


# TEMPORARY DEV-ONLY endpoint - remove after verification.
@router.post("/notify-me", response_model=TestNotifyOut)
def test_notify_me(
    payload: TestNotifyIn,
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

    message_id = FCMService.notify_user(
        db, user.id, payload.title, payload.body, payload.data
    )
    return {"sent": message_id is not None, "message_id": message_id}
