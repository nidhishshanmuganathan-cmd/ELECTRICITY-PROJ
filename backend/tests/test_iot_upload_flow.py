"""Integration coverage for a provisioned meter upload through usage alerts."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import SessionLocal, get_db
from app.models.device import Device
from app.models.reading import MeterReading
from app.models.usage import DailyUsage, MonthlyUsage
from app.models.user import User
from app.services.device_auth import get_optional_current_user
from main import app


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_provisioned_meter_uploads_roll_up_and_trigger_alert(db):
    uid = f"iot-flow-{uuid.uuid4().hex}"
    user = User(firebase_uid=uid, full_name="IoT Flow", email=f"{uid}@example.com", monthly_limit=2)
    db.add(user)
    db.flush()
    device = Device(user_id=user.id, device_code=f"IOT-{uuid.uuid4().hex[:8]}", device_name="IoT Meter")
    db.add(device)
    db.commit()

    def authenticated_user():
        return {"uid": uid, "name": "IoT Flow", "email": user.email}

    def database():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_current_user] = authenticated_user
    app.dependency_overrides[get_optional_current_user] = authenticated_user
    app.dependency_overrides[get_db] = database
    client = TestClient(app)
    try:
        provision = client.post(f"/devices/{device.id}/provision-token")
        assert provision.status_code == 200
        token = provision.json()["device_token"]

        recorded_at = datetime.now(timezone.utc)
        for energy in (1.0, 1.2):
            response = client.post(
                f"/devices/{device.id}/readings/",
                headers={"X-Device-Token": token},
                json={
                    "voltage": 230.0, "current": 5.0, "power": 1150.0,
                    "energy": energy, "frequency": 50.0, "power_factor": 0.95,
                    "recorded_at": recorded_at.isoformat(),
                },
            )
            assert response.status_code == 200
            recorded_at += timedelta(minutes=15)

        month = datetime.now().strftime("%Y-%m")
        day = datetime.now().strftime("%Y-%m-%d")
        daily = db.query(DailyUsage).filter_by(device_id=device.id, date=day).one()
        monthly = db.query(MonthlyUsage).filter_by(device_id=device.id, month=month).one()
        assert float(daily.total_energy) == 2.2
        assert float(monthly.total_energy) == 2.2

        alerts = client.get("/users/me/alerts")
        assert alerts.status_code == 200
        assert alerts.json()["current_usage"] == 2.2
        assert alerts.json()["usage_percent"] == 110.0
        assert alerts.json()["status"] == "exceeded"
    finally:
        app.dependency_overrides.clear()
        db.query(MeterReading).filter_by(device_id=device.id).delete(synchronize_session=False)
        db.query(DailyUsage).filter_by(device_id=device.id).delete(synchronize_session=False)
        db.query(MonthlyUsage).filter_by(device_id=device.id).delete(synchronize_session=False)
        db.query(Device).filter_by(id=device.id).delete(synchronize_session=False)
        db.query(User).filter_by(id=user.id).delete(synchronize_session=False)
        db.commit()
