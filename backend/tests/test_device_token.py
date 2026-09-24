"""Tests for POST /users/me/device-token (FCM device-token plumbing).

Covers token registration for the authenticated user only, token update
(overwrite), persistence, and that unauthenticated requests are rejected.
No notification sending is involved.

Run from the backend/ directory:
    .\\venv\\Scripts\\python.exe -m pytest tests/test_device_token.py -v
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import SessionLocal, get_db
from app.models.user import User
from main import app


def _uid(prefix="test-token"):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _email():
    return f"{uuid.uuid4().hex[:12]}@example.com"


def make_user(db, uid=None):
    user = User(
        firebase_uid=uid or _uid(),
        full_name="Token Tester",
        email=_email(),
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
        return {"uid": uid, "name": "Token Tester", "email": "token@example.com"}

    def _override_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db
    return TestClient(app)


def test_register_token_persists_for_current_user(db):
    uid = _uid()
    user = make_user(db, uid=uid)
    db.commit()
    try:
        client = _client_for(uid)
        try:
            response = client.post(
                "/users/me/device-token", json={"fcm_token": "fake-token-abc123"}
            )
            assert response.status_code == 200
            assert response.json() == {"fcm_token": "fake-token-abc123"}

            db.expire_all()
            stored = db.query(User).filter(User.id == user.id).first()
            assert stored.fcm_token == "fake-token-abc123"
        finally:
            app.dependency_overrides.clear()
    finally:
        drop_user(db, user)


def test_update_token_overwrites(db):
    uid = _uid()
    user = make_user(db, uid=uid)
    db.commit()
    try:
        client = _client_for(uid)
        try:
            assert (
                client.post(
                    "/users/me/device-token", json={"fcm_token": "token-one"}
                ).status_code
                == 200
            )
            response = client.post(
                "/users/me/device-token", json={"fcm_token": "token-two"}
            )
            assert response.status_code == 200
            assert response.json() == {"fcm_token": "token-two"}

            db.expire_all()
            stored = db.query(User).filter(User.id == user.id).first()
            assert stored.fcm_token == "token-two"
        finally:
            app.dependency_overrides.clear()
    finally:
        drop_user(db, user)


def test_token_isolated_to_current_user(db):
    uid_a = _uid("test-token-a")
    uid_b = _uid("test-token-b")
    user_a = make_user(db, uid=uid_a)
    user_b = make_user(db, uid=uid_b)
    db.commit()
    try:
        client = _client_for(uid_a)
        try:
            response = client.post(
                "/users/me/device-token", json={"fcm_token": "token-for-a"}
            )
            assert response.status_code == 200

            db.expire_all()
            stored_b = db.query(User).filter(User.id == user_b.id).first()
            assert stored_b.fcm_token is None
        finally:
            app.dependency_overrides.clear()
    finally:
        drop_user(db, user_a)
        drop_user(db, user_b)


def test_rejects_empty_token(db):
    uid = _uid()
    try:
        client = _client_for(uid)
        try:
            response = client.post("/users/me/device-token", json={"fcm_token": ""})
            assert response.status_code == 422
        finally:
            app.dependency_overrides.clear()
    finally:
        leftover = db.query(User).filter(User.firebase_uid == uid).first()
        if leftover is not None:
            drop_user(db, leftover)


def test_requires_authentication():
    app.dependency_overrides.clear()
    client = TestClient(app)
    response = client.post(
        "/users/me/device-token", json={"fcm_token": "fake-token-abc123"}
    )
    assert response.status_code in (401, 403)
