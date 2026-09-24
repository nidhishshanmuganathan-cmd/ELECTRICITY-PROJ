"""Tests for the WattWatcher backend alert engine.

Covers AlertService state mapping (ok / warning / exceeded), the
users.monthly_limit single source of truth, the MonthlyUsage-first /
DailyUsage-fallback consumption calculation, and the ML-prediction
evaluation. API tests exercise GET /users/me/alerts with stubbed auth.

Run from the backend/ directory:
    .\\venv\\Scripts\\python.exe -m pytest tests/ -v
"""
import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import SessionLocal, get_db
from app.models.device import Device
from app.models.reading import MeterReading
from app.models.usage import DailyUsage, MonthlyUsage
from app.models.user import User
from app.services.alerts import AlertService
from main import app


def _uid(prefix="test-alert"):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _email():
    return f"{uuid.uuid4().hex[:12]}@example.com"


def make_user(db, monthly_limit=500.0, uid=None):
    user = User(
        firebase_uid=uid or _uid(),
        full_name="Alert Tester",
        email=_email(),
        monthly_limit=monthly_limit,
    )
    db.add(user)
    db.flush()
    return user


def make_device(db, user, code=None):
    device = Device(
        user_id=user.id,
        device_code=code or f"TA-{uuid.uuid4().hex[:8].upper()}",
        device_name="Test Meter",
    )
    db.add(device)
    db.flush()
    return device


def add_daily(db, device, date_str, total):
    db.add(
        DailyUsage(
            device_id=device.id,
            date=date_str,
            total_energy=total,
            peak_power=total,
        )
    )


def set_monthly(db, device, month, total):
    db.add(MonthlyUsage(device_id=device.id, month=month, total_energy=total))


def drop_fixture(db, user):
    device_ids = [
        d.id for d in db.query(Device).filter(Device.user_id == user.id).all()
    ]
    db.expunge_all()
    if device_ids:
        db.query(MeterReading).filter(MeterReading.device_id.in_(device_ids)).delete(
            synchronize_session=False
        )
        db.query(DailyUsage).filter(DailyUsage.device_id.in_(device_ids)).delete(
            synchronize_session=False
        )
        db.query(MonthlyUsage).filter(MonthlyUsage.device_id.in_(device_ids)).delete(
            synchronize_session=False
        )
        db.query(Device).filter(Device.id.in_(device_ids)).delete(
            synchronize_session=False
        )
    db.query(User).filter(User.id == user.id).delete(synchronize_session=False)
    db.commit()


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def current_month():
    return datetime.now().strftime("%Y-%m")


# ---------------------------------------------------------------------------
# State mapping (no DB needed)
# ---------------------------------------------------------------------------


def test_status_boundaries():
    assert AlertService.status_for(79.9, 100.0) == "ok"
    assert AlertService.status_for(80.0, 100.0) == "warning"
    assert AlertService.status_for(99.9, 100.0) == "warning"
    assert AlertService.status_for(100.0, 100.0) == "exceeded"
    assert AlertService.status_for(150.0, 100.0) == "exceeded"


# ---------------------------------------------------------------------------
# Service-level alert conditions
# ---------------------------------------------------------------------------


def test_ok_state(db):
    user = make_user(db, monthly_limit=500.0)
    try:
        device = make_device(db, user)
        set_monthly(db, device, current_month(), 200.0)
        db.commit()

        result = AlertService.evaluate_user_alerts(db, user.id)

        assert result["month"] == current_month()
        assert result["monthly_limit"] == 500.0
        assert result["current_usage"] == 200.0
        assert result["usage_percent"] == 40.0
        assert result["remaining"] == 300.0
        assert result["status"] == "ok"
        assert result["predicted_will_exceed"] is False
        assert result["predicted_status"] == "ok"
        assert len(result["devices"]) == 1
    finally:
        drop_fixture(db, user)


def test_limit_is_single_source_of_truth(db):
    """Lowering users.monthly_limit alone must flip the alert state."""
    user = make_user(db, monthly_limit=500.0)
    try:
        device = make_device(db, user)
        set_monthly(db, device, current_month(), 200.0)
        db.commit()

        assert AlertService.evaluate_user_alerts(db, user.id)["status"] == "ok"

        user.monthly_limit = 250.0
        db.commit()

        result = AlertService.evaluate_user_alerts(db, user.id)
        assert result["monthly_limit"] == 250.0
        assert result["usage_percent"] == 80.0
        assert result["status"] == "warning"
    finally:
        drop_fixture(db, user)


def test_warning_state(db):
    user = make_user(db, monthly_limit=500.0)
    try:
        device = make_device(db, user)
        set_monthly(db, device, current_month(), 450.0)
        db.commit()

        result = AlertService.evaluate_user_alerts(db, user.id)

        assert result["status"] == "warning"
        assert result["usage_percent"] == 90.0
        assert result["remaining"] == 50.0
    finally:
        drop_fixture(db, user)


def test_exceeded_state(db):
    user = make_user(db, monthly_limit=500.0)
    try:
        device = make_device(db, user)
        set_monthly(db, device, current_month(), 600.0)
        db.commit()

        result = AlertService.evaluate_user_alerts(db, user.id)

        assert result["status"] == "exceeded"
        assert result["usage_percent"] == 120.0
        assert result["remaining"] == 0.0
    finally:
        drop_fixture(db, user)


def test_missing_rollup_falls_back_to_daily(db):
    """Without a MonthlyUsage row, current-month DailyUsage rows are summed."""
    user = make_user(db, monthly_limit=500.0)
    try:
        device = make_device(db, user)
        month_start = datetime.now().replace(day=1)
        totals = [10.0, 20.0, 30.0]
        for i, total in enumerate(totals):
            add_daily(
                db,
                device,
                (month_start + timedelta(days=i)).strftime("%Y-%m-%d"),
                total,
            )
        db.commit()

        result = AlertService.evaluate_user_alerts(db, user.id)

        assert result["current_usage"] == 60.0
        assert result["status"] == "ok"
        # Regression on [10, 20, 30] predicts 40..100 -> sum 490.
        assert result["predicted_next_7d_total"] == 490.0
        assert result["projected_month_total"] == 550.0
        assert result["predicted_will_exceed"] is True
    finally:
        drop_fixture(db, user)


def test_prediction_triggers_forecast_alert_while_current_is_ok(db):
    """Current usage below the limit, but the ML forecast pushes past it."""
    user = make_user(db, monthly_limit=500.0)
    try:
        device = make_device(db, user)
        set_monthly(db, device, current_month(), 300.0)
        # 14 ascending days 20, 22, ..., 46 -> slope 2, predicted 48..60.
        today = datetime.now().date()
        for i in range(14):
            add_daily(
                db,
                device,
                (today - timedelta(days=13 - i)).strftime("%Y-%m-%d"),
                20.0 + 2.0 * i,
            )
        db.commit()

        result = AlertService.evaluate_user_alerts(db, user.id)

        assert result["current_usage"] == 300.0
        assert result["status"] == "ok"
        assert result["predicted_next_7d_total"] == 378.0
        assert result["projected_month_total"] == 678.0
        assert result["predicted_will_exceed"] is True
        assert result["predicted_status"] == "exceeded"
    finally:
        drop_fixture(db, user)


def test_default_limit_when_null(db):
    user = make_user(db, monthly_limit=None)
    try:
        device = make_device(db, user)
        set_monthly(db, device, current_month(), 100.0)
        db.commit()

        result = AlertService.evaluate_user_alerts(db, user.id)

        assert result["monthly_limit"] == 500.0
        assert result["status"] == "ok"
    finally:
        drop_fixture(db, user)


def test_multi_device_aggregation(db):
    user = make_user(db, monthly_limit=1000.0)
    try:
        first = make_device(db, user)
        second = make_device(db, user)
        set_monthly(db, first, current_month(), 500.0)
        set_monthly(db, second, current_month(), 400.0)
        db.commit()

        result = AlertService.evaluate_user_alerts(db, user.id)

        assert result["current_usage"] == 900.0
        assert result["usage_percent"] == 90.0
        assert result["status"] == "warning"
        assert len(result["devices"]) == 2
    finally:
        drop_fixture(db, user)


# ---------------------------------------------------------------------------
# API-level tests (auth stubbed, real service + DB)
# ---------------------------------------------------------------------------


def test_alerts_endpoint_uses_persisted_limit(db):
    uid = _uid()
    user = make_user(db, monthly_limit=650.0, uid=uid)
    device = make_device(db, user)
    set_monthly(db, device, current_month(), 100.0)
    db.commit()

    def _override_user():
        return {"uid": uid, "name": "Alert Tester", "email": "alert@test.local"}

    def _override_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db
    try:
        client = TestClient(app)

        response = client.get("/users/me/alerts")
        assert response.status_code == 200
        body = response.json()
        assert body["monthly_limit"] == 650.0
        assert body["current_usage"] == 100.0
        assert body["status"] == "ok"
        assert body["month"] == current_month()

        # Change the persisted limit via the profile endpoint; alerts follow.
        update = client.put("/users/me", json={"monthly_limit": 110.0})
        assert update.status_code == 200
        assert update.json()["monthly_limit"] == 110.0

        again = client.get("/users/me/alerts")
        assert again.status_code == 200
        assert again.json()["monthly_limit"] == 110.0
        assert again.json()["status"] == "warning"
    finally:
        app.dependency_overrides.clear()
        drop_fixture(db, user)


def test_alerts_endpoint_no_devices(db):
    uid = _uid()
    user = make_user(db, monthly_limit=500.0, uid=uid)
    db.commit()

    def _override_user():
        return {"uid": uid, "name": "Alert Tester", "email": "alert@test.local"}

    def _override_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db
    try:
        client = TestClient(app)
        response = client.get("/users/me/alerts")
        assert response.status_code == 200
        body = response.json()
        assert body["current_usage"] == 0.0
        assert body["status"] == "ok"
        assert body["devices"] == []
    finally:
        app.dependency_overrides.clear()
        drop_fixture(db, user)
