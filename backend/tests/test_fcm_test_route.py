"""Tests for the TEMPORARY DEV-ONLY POST /test/notify-me route.

FCMService.notify_user is mocked: these tests verify auth gating, request
validation, and response mapping without sending anything.

REMOVE AFTER VERIFICATION along with app/routes/fcm_test.py.

Run from the backend/ directory:
    .\\venv\\Scripts\\python.exe -m pytest tests/test_fcm_test_route.py -v
"""
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import SessionLocal, get_db
from app.models.user import User
from main import app


def _uid(prefix="test-fcm-route"):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def make_user(db, uid=None):
    user = User(
        firebase_uid=uid or _uid(),
        full_name="FCM Route Tester",
        email=f"{uuid.uuid4().hex[:12]}@example.com",
        fcm_token="route-token-abc",
    )
    db.add(user)
    db.flush()
    return user


def drop_user(db, user):
    db.query(User).filter(User.id == user.id).delete(synchronize_session=False)
    db.commit()


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _client_for(uid):
    def _override_user():
        return {"uid": uid, "name": "FCM Route Tester", "email": "r@example.com"}

    def _override_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db
    return TestClient(app)


def test_notify_me_returns_sent_on_success(db):
    uid = _uid()
    user = make_user(db, uid=uid)
    db.commit()
    try:
        client = _client_for(uid)
        try:
            with patch(
                "app.routes.fcm_test.FCMService.notify_user",
                return_value="mock-msg-id",
            ) as mock_notify:
                response = client.post(
                    "/test/notify-me",
                    json={"title": "Hello", "body": "Test push"},
                )

            assert response.status_code == 200
            assert response.json() == {"sent": True, "message_id": "mock-msg-id"}
            assert mock_notify.call_count == 1
            _, called_user_id, title, body, data = mock_notify.call_args[0]
            assert called_user_id == user.id
            assert (title, body) == ("Hello", "Test push")
        finally:
            app.dependency_overrides.clear()
    finally:
        drop_user(db, user)


def test_notify_me_reports_unsent_when_no_token(db):
    uid = _uid()
    user = make_user(db, uid=uid)
    db.commit()
    try:
        client = _client_for(uid)
        try:
            with patch(
                "app.routes.fcm_test.FCMService.notify_user", return_value=None
            ):
                response = client.post(
                    "/test/notify-me",
                    json={"title": "Hello", "body": "Test push"},
                )

            assert response.status_code == 200
            assert response.json() == {"sent": False, "message_id": None}
        finally:
            app.dependency_overrides.clear()
    finally:
        drop_user(db, user)


def test_notify_me_validates_payload(db):
    uid = _uid()
    try:
        client = _client_for(uid)
        try:
            response = client.post("/test/notify-me", json={"body": "No title"})
            assert response.status_code == 422
        finally:
            app.dependency_overrides.clear()
    finally:
        leftover = db.query(User).filter(User.firebase_uid == uid).first()
        if leftover is not None:
            drop_user(db, leftover)


def test_notify_me_requires_authentication():
    app.dependency_overrides.clear()
    client = TestClient(app)
    response = client.post(
        "/test/notify-me", json={"title": "Hello", "body": "Test push"}
    )
    assert response.status_code in (401, 403)
