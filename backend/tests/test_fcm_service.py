"""Tests for FCMService (FCM delivery only, Firebase call mocked).

No real network traffic: firebase_admin.messaging.send is patched, so these
tests verify token lookup, message construction, and the no-token/unknown-user
no-send paths without touching Firebase.

Run from the backend/ directory:
    .\\venv\\Scripts\\python.exe -m pytest tests/test_fcm_service.py -v
"""
import uuid
from unittest.mock import patch

import pytest

from app.database import SessionLocal
from app.models.user import User
from app.services.fcm import FCMService


def _uid(prefix="test-fcm"):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def make_user(db, uid=None, fcm_token=None):
    user = User(
        firebase_uid=uid or _uid(),
        full_name="FCM Tester",
        email=f"{uuid.uuid4().hex[:12]}@example.com",
        fcm_token=fcm_token,
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


def test_sends_to_stored_token(db):
    user = make_user(db, fcm_token="device-token-xyz")
    db.commit()
    try:
        with patch(
            "app.services.fcm.messaging.send", return_value="mock-msg-id"
        ) as mock_send:
            result = FCMService.notify_user(
                db, user.id, "Limit warning", "Usage at 85%",
                data={"status": "warning"},
            )

        assert result == "mock-msg-id"
        assert mock_send.call_count == 1
        message = mock_send.call_args[0][0]
        assert message.token == "device-token-xyz"
        assert message.notification.title == "Limit warning"
        assert message.notification.body == "Usage at 85%"
        assert message.data == {"status": "warning"}
    finally:
        drop_user(db, user)


def test_no_token_sends_nothing(db):
    user = make_user(db, fcm_token=None)
    db.commit()
    try:
        with patch("app.services.fcm.messaging.send") as mock_send:
            assert FCMService.notify_user(db, user.id, "Hi", "Hello") is None
        mock_send.assert_not_called()
    finally:
        drop_user(db, user)


def test_unknown_user_sends_nothing(db):
    with patch("app.services.fcm.messaging.send") as mock_send:
        assert (
            FCMService.notify_user(db, uuid.uuid4(), "Hi", "Hello") is None
        )
    mock_send.assert_not_called()


def test_send_to_token_coerces_data_to_strings():
    with patch(
        "app.services.fcm.messaging.send", return_value="mock-msg-id"
    ) as mock_send:
        assert (
            FCMService.send_to_token(
                "tok", "T", "B", data={"usage": 129.913, "ok": True}
            )
            == "mock-msg-id"
        )
    message = mock_send.call_args[0][0]
    assert message.data == {"usage": "129.913", "ok": "True"}
