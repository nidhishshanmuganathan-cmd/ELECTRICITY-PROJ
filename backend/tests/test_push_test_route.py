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
        with patch("app.routes.users.FCMService.notify_user", return_value="message-id"):
            response = TestClient(app).post("/users/me/push-test")
        assert response.status_code == 200
        assert response.json() == {"success": True}
    finally:
        app.dependency_overrides.clear()
        db.delete(user)
        db.commit()
