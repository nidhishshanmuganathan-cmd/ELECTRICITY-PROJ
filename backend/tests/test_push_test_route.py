from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import SessionLocal, get_db
from app.models.user import User
from main import app


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_push_test_sends_only_to_current_user(db):
    user = User(firebase_uid="push-test-user", full_name="Push Tester", email="push@test.local", fcm_token="token")
    db.add(user)
    db.commit()

    def current_user():
        return {"uid": user.firebase_uid}

    app.dependency_overrides[get_current_user] = current_user
    app.dependency_overrides[get_db] = lambda: db
    try:
        with patch("app.routes.users.FCMService.notify_user", return_value="message-id") as send:
            response = TestClient(app).post("/users/me/push-test")
        assert response.status_code == 200
        assert response.json() == {"success": True, "status": "accepted_by_fcm", "message_id": "message-id"}
        assert send.call_args.args[1] == user.id
        from app.services.fcm import PushDeliveryError
        with patch("app.routes.users.FCMService.notify_user", side_effect=PushDeliveryError("Registration expired")):
            response = TestClient(app).post("/users/me/push-test")
        assert response.status_code == 502
        assert response.json()['detail'] == 'Registration expired'
        with patch("app.routes.users.FCMService.notify_user", return_value=None):
            assert TestClient(app).post("/users/me/push-test").status_code == 502
        user.fcm_token = None
        db.commit()
        with patch("app.routes.users.FCMService.notify_user") as send:
            assert TestClient(app).post("/users/me/push-test").status_code == 409
            send.assert_not_called()
    finally:
        app.dependency_overrides.clear()
        db.delete(user)
        db.commit()
