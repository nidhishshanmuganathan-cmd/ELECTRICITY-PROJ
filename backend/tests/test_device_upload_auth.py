"""Tests for owner-provisioned meter upload credentials."""

import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import SessionLocal, get_db
from app.models.device import Device
from app.models.reading import MeterReading
from app.models.user import User
from app.services.device_auth import get_optional_current_user
from main import app


def make_user(db, uid):
    user = User(firebase_uid=uid, full_name="Meter Owner", email=f"{uid}@example.com")
    db.add(user)
    db.flush()
    return user


def make_device(db, user):
    device = Device(
        user_id=user.id,
        device_code=f"METER-{uuid.uuid4().hex[:8]}",
        device_name="Test Meter",
    )
    db.add(device)
    db.commit()
    return device


def cleanup(db, *users):
    device_ids = [
        device.id
        for user in users
        for device in db.query(Device).filter(Device.user_id == user.id).all()
    ]
    if device_ids:
        db.query(MeterReading).filter(MeterReading.device_id.in_(device_ids)).delete(synchronize_session=False)
        db.query(Device).filter(Device.id.in_(device_ids)).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_([user.id for user in users])).delete(synchronize_session=False)
    db.commit()


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def client_for(uid):
    def current_user():
        return {"uid": uid, "name": "Meter Owner", "email": f"{uid}@example.com"}

    def database():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_optional_current_user] = current_user
    app.dependency_overrides[get_current_user] = current_user
    app.dependency_overrides[get_db] = database
    return TestClient(app)


def reading_payload():
    return {
        "voltage": 230.0, "current": 1.2, "power": 276.0,
        "energy": 0.069, "frequency": 50.0, "power_factor": 0.95,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }


def test_owner_can_provision_and_only_that_meter_token_uploads(db):
    owner = make_user(db, f"owner-{uuid.uuid4().hex}")
    other = make_user(db, f"other-{uuid.uuid4().hex}")
    device = make_device(db, owner)
    other_device = make_device(db, other)
    client = client_for(owner.firebase_uid)
    try:
        provision = client.post(f"/devices/{device.id}/provision-token")
        assert provision.status_code == 200
        token = provision.json()["device_token"]

        db.expire_all()
        assert db.get(Device, device.id).upload_token_hash != token

        with patch("app.routes.readings.AggregationService.aggregate_device_data"), patch(
            "app.routes.readings.NotificationService.check_and_notify_usage"
        ):
            upload = client.post(
                f"/devices/{device.id}/readings/",
                json=reading_payload(),
                headers={"X-Device-Token": token},
            )
            assert upload.status_code == 200

            wrong_device = client.post(
                f"/devices/{other_device.id}/readings/",
                json=reading_payload(),
                headers={"X-Device-Token": token},
            )
            assert wrong_device.status_code == 401
    finally:
        app.dependency_overrides.clear()
        cleanup(db, owner, other)


def test_non_owner_cannot_provision_or_upload_for_another_device(db):
    owner = make_user(db, f"owner-{uuid.uuid4().hex}")
    intruder = make_user(db, f"intruder-{uuid.uuid4().hex}")
    device = make_device(db, owner)
    client = client_for(intruder.firebase_uid)
    try:
        assert client.post(f"/devices/{device.id}/provision-token").status_code == 404
        assert client.post(f"/devices/{device.id}/readings/", json=reading_payload()).status_code == 401
    finally:
        app.dependency_overrides.clear()
        cleanup(db, owner, intruder)


def test_rotating_token_revokes_the_previous_token(db):
    owner = make_user(db, f"owner-{uuid.uuid4().hex}")
    device = make_device(db, owner)
    client = client_for(owner.firebase_uid)
    try:
        first = client.post(f"/devices/{device.id}/provision-token").json()["device_token"]
        second = client.post(f"/devices/{device.id}/provision-token").json()["device_token"]
        assert first != second
        assert client.post(
            f"/devices/{device.id}/readings/", json=reading_payload(), headers={"X-Device-Token": first}
        ).status_code == 401
    finally:
        app.dependency_overrides.clear()
        cleanup(db, owner)
