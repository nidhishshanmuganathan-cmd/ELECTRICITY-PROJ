"""Regression coverage for the authenticated usage simulation endpoint."""

import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import SessionLocal, get_db
from app.models.device import Device
from app.models.usage import MonthlyUsage
from app.models.user import User
from main import app


def test_simulation_uses_the_signed_in_users_device_without_a_seed_device():
    db = SessionLocal()
    uid = f"simulation-{uuid.uuid4().hex}"
    user = User(firebase_uid=uid, full_name="Simulation Tester", email=f"{uid}@example.com")
    db.add(user)
    db.flush()
    device = Device(user_id=user.id, device_code=f"SIM-{uuid.uuid4().hex[:8]}", device_name="Simulation Meter")
    db.add(device)
    db.commit()

    def authenticated_user():
        return {"uid": uid, "name": user.full_name, "email": user.email}

    def database():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_current_user] = authenticated_user
    app.dependency_overrides[get_db] = database
    try:
        with patch("app.routes.simulation.NotificationService.check_and_notify_usage", return_value={"sent": False}):
            response = TestClient(app).post(
                "/simulation/usage",
                json={"device_id": str(device.id), "energy_value": 42.5},
            )

        assert response.status_code == 200
        assert response.json()["current_usage"] == 42.5
    finally:
        app.dependency_overrides.clear()
        db.query(MonthlyUsage).filter(MonthlyUsage.device_id == device.id).delete(synchronize_session=False)
        db.query(Device).filter(Device.id == device.id).delete(synchronize_session=False)
        db.query(User).filter(User.id == user.id).delete(synchronize_session=False)
        db.commit()
        db.close()
