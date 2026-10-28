"""Profile persistence regressions. Run only against an isolated test database."""
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import SessionLocal, get_db
from app.models.user import User
from sqlalchemy.exc import OperationalError
from main import app


@pytest.fixture
def profiles():
    db = SessionLocal()
    users = [User(firebase_uid=f"phone-{uuid.uuid4()}", full_name="Phone test",
                  email=f"{uuid.uuid4()}@example.com", fcm_token="test-only-fcm") for _ in range(2)]
    db.add_all(users)
    db.commit()
    identity = {"uid": users[0].firebase_uid, "email": users[0].email}
    app.dependency_overrides[get_current_user] = lambda: identity
    app.dependency_overrides[get_db] = lambda: db
    try:
        yield TestClient(app, raise_server_exceptions=False), db, users, identity
    finally:
        app.dependency_overrides.clear()
        db.rollback()
        for user in users:
            db.delete(user)
        db.commit()
        db.close()


def test_save_reload_update_and_clear(profiles):
    client, db, users, identity = profiles
    for value, expected in [("6000000000", "+916000000000"),
                            ("+91 (70000) 00000", "+917000000000"),
                            (None, None), ("", None)]:
        saved = client.put("/users/me", json={"phone": value})
        assert saved.status_code == 200
        assert saved.json()["phone"] == expected
        # A fresh ORM read, just as a later sign-in calls GET /users/me.
        db.expire_all()
        assert client.get("/users/me").json()["phone"] == expected
        assert db.get(User, users[0].id).phone == expected
        assert db.get(User, users[0].id).fcm_token == "test-only-fcm"


@pytest.mark.parametrize("phone", ["1234567890", "+16000000000", "600000000", "60000000000",
                                  "+916000000000x", "++916000000000", "6" * 31, 6000000000])
def test_invalid_phone_does_not_change_profile(profiles, phone):
    client, db, users, _ = profiles
    users[0].phone = "+916000000000"
    db.commit()
    assert client.put("/users/me", json={"phone": phone}).status_code == 422
    db.expire_all()
    assert users[0].phone == "+916000000000"


def test_formatted_phone_is_normalized_before_database_storage(profiles):
    client, _, _, _ = profiles
    response = client.put("/users/me", json={"phone": "+91 (6 0 0 0 0) 0 0 0 0 0"})
    assert response.status_code == 200
    assert response.json()["phone"] == "+916000000000"


def test_duplicate_phone_returns_safe_conflict_and_rolls_back(profiles, caplog):
    client, db, users, _ = profiles
    users[1].phone = "+916000000000"
    db.commit()
    response = client.put("/users/me", json={"phone": "+916000000000", "full_name": "Unsaved"})
    assert response.status_code == 409
    assert response.json()["detail"] == "This phone number cannot be used for this account."
    assert "+916000000000" not in caplog.text
    # The transaction remains usable and no partial profile edit was persisted.
    assert client.get("/users/me").json()["full_name"] == "Phone test"
    assert client.get("/users/me").json()["phone"] is None


def test_profile_update_only_targets_authenticated_uid(profiles):
    client, db, users, identity = profiles
    response = client.put("/users/me", json={"phone": "+916000000000",
                                            "firebase_uid": users[1].firebase_uid,
                                            "id": str(users[1].id)})
    assert response.status_code == 200
    assert response.json()["id"] == str(users[0].id)
    db.expire_all()
    assert users[1].phone is None
    identity.update(uid=users[1].firebase_uid, email=users[1].email)
    assert client.get("/users/me").json()["phone"] is None


def test_omitted_phone_preserves_existing_value(profiles):
    client, db, users, _ = profiles
    users[0].phone = "+916000000000"
    db.commit()
    assert client.put("/users/me", json={"full_name": "Updated"}).json()["phone"] == "+916000000000"


def test_phone_requires_verified_firebase_token(profiles):
    client, _, users, _ = profiles
    del app.dependency_overrides[get_current_user]
    assert client.put("/users/me", json={"phone": "+916000000000"}).status_code in (401, 403)
    with patch("app.auth.firebase_auth.verify_id_token", side_effect=ValueError("Test rejection")):
        assert client.put("/users/me", headers={"Authorization": "Bearer test-only-invalid"},
                          json={"phone": "+916000000000"}).status_code == 401
    with patch("app.auth.firebase_auth.verify_id_token", return_value={"uid": users[0].firebase_uid}) as verify:
        assert client.put("/users/me", headers={"Authorization": "Bearer test-only-valid"},
                          json={"phone": "+916000000000"}).status_code == 200
        verify.assert_called_once_with("test-only-valid")


def test_first_save_creates_profile_for_authenticated_user(profiles):
    client, db, users, identity = profiles
    identity.update(uid=f"new-phone-{uuid.uuid4()}", email=f"{uuid.uuid4()}@example.com")
    response = client.put("/users/me", json={"phone": "6000000000"})
    created = db.query(User).filter_by(firebase_uid=identity["uid"]).one()
    users.append(created)
    assert response.status_code == 200
    assert created.phone == "+916000000000"
    assert created.fcm_token is None
    assert client.get("/users/me").json()["phone"] == "+916000000000"


def test_database_failure_does_not_report_success_or_log_phone(profiles, caplog):
    client, db, users, _ = profiles
    with patch.object(db, "commit", side_effect=OperationalError("test-only", {}, Exception("unavailable"))):
        response = client.put("/users/me", json={"phone": "+916000000000"})
    assert response.status_code == 503
    assert response.json()["detail"] == "Could not save your profile. Please try again."
    assert "+916000000000" not in caplog.text
    assert client.get("/users/me").json()["phone"] is None
