"""Run with the rest of the suite against an isolated test database."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import SessionLocal, get_db
from app.models.user import User
from app.models.device import Device
from app.models.reading import MeterReading
from app.models.usage import DailyUsage
from main import app


@pytest.fixture
def sample_meter():
    db = SessionLocal()
    user = User(firebase_uid=f"limits-{uuid.uuid4()}", full_name="Limit test")
    db.add(user)
    db.flush()
    device = Device(user_id=user.id, device_code=f"LIM-{uuid.uuid4().hex[:8]}", device_name="Limit test")
    db.add(device)
    db.flush()
    start = datetime.now(timezone.utc) - timedelta(days=3)
    for index in range(3):
        db.add(MeterReading(device_id=device.id, voltage=230, current=1, power=230 + index,
                            energy=1, frequency=50, power_factor=1, recorded_at=start + timedelta(days=index)))
        db.add(DailyUsage(device_id=device.id, date=(start + timedelta(days=index)).strftime("%Y-%m-%d"),
                          total_energy=index + 1, peak_power=230 + index))
    db.commit()
    app.dependency_overrides[get_current_user] = lambda: {"uid": user.firebase_uid}
    app.dependency_overrides[get_db] = lambda: db
    try:
        yield TestClient(app), device.id
    finally:
        app.dependency_overrides.clear()
        db.query(MeterReading).filter_by(device_id=device.id).delete()
        db.query(DailyUsage).filter_by(device_id=device.id).delete()
        db.delete(device)
        db.delete(user)
        db.commit()
        db.close()


@pytest.mark.parametrize("suffix", ["/", "/daily"])
def test_limit_is_optional_and_returns_latest_rows(sample_meter, suffix):
    client, device_id = sample_meter
    path = f"/devices/{device_id}/readings{suffix}"
    original = client.get(path)
    limited = client.get(path, params={"limit": 1})
    assert original.status_code == limited.status_code == 200
    assert len(original.json()) == 3
    assert limited.json() == original.json()[:1]
    assert len(client.get(path).json()) == 3  # read-only limit, not deletion


@pytest.mark.parametrize("limit", [0, -1, 1001, "invalid"])
def test_limit_validation(sample_meter, limit):
    client, device_id = sample_meter
    for suffix in ("/", "/daily"):
        assert client.get(f"/devices/{device_id}/readings{suffix}", params={"limit": limit}).status_code == 422


def test_limit_does_not_bypass_ownership(sample_meter):
    client, device_id = sample_meter
    app.dependency_overrides[get_current_user] = lambda: {"uid": "another-user"}
    for suffix in ("/", "/daily"):
        assert client.get(f"/devices/{device_id}/readings{suffix}?limit=1").status_code == 404
