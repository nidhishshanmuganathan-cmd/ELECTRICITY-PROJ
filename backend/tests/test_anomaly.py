"""Focused tests for the daily-usage Isolation Forest endpoint."""

import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import SessionLocal, get_db
from app.models.device import Device
from app.models.usage import DailyUsage
from app.models.user import User
from app.services.anomaly import AnomalyService
from main import app


def make_fixture(values):
    db = SessionLocal()
    uid = f"anomaly-{uuid.uuid4().hex}"
    user = User(firebase_uid=uid, full_name="Anomaly Tester", email=f"{uid}@example.com")
    db.add(user)
    db.flush()
    device = Device(user_id=user.id, device_code=f"AN-{uuid.uuid4().hex[:8]}", device_name="Test Meter")
    db.add(device)
    db.flush()
    start = date.today() - timedelta(days=len(values) - 1)
    for index, value in enumerate(values):
        db.add(DailyUsage(device_id=device.id, date=(start + timedelta(days=index)).isoformat(), total_energy=value, peak_power=value))
    db.commit()
    return db, user, device, uid


def cleanup(db, user, device):
    db.query(DailyUsage).filter_by(device_id=device.id).delete(synchronize_session=False)
    db.query(Device).filter_by(id=device.id).delete(synchronize_session=False)
    db.query(User).filter_by(id=user.id).delete(synchronize_session=False)
    db.commit()
    db.close()


def test_insufficient_daily_history_returns_explicit_status():
    db, user, device, _ = make_fixture([10, 11, 9])
    try:
        assert AnomalyService.analyze_device_usage(db, device.id) == {
            "status": "insufficient_data", "score": 0.0, "sample_size": 3,
        }
    finally:
        cleanup(db, user, device)


def test_anomaly_endpoint_flags_latest_outlier():
    db, user, device, uid = make_fixture([10, 11, 9, 10, 10, 11, 9, 10, 75])

    def current_user():
        return {"uid": uid, "name": "Anomaly Tester", "email": user.email}

    def database():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_current_user] = current_user
    app.dependency_overrides[get_db] = database
    try:
        response = TestClient(app).get(f"/devices/{device.id}/readings/anomaly")
        assert response.status_code == 200
        assert response.json()["status"] == "anomaly"
        assert response.json()["score"] >= 0.9
        assert response.json()["sample_size"] == 9
    finally:
        app.dependency_overrides.clear()
        cleanup(db, user, device)
