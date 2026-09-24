"""
ElectricAI - Sample Data Seeder

Seeds the PostgreSQL database with a demo user, one device, ~35 days of raw
meter readings (one every 15 minutes), then runs the REAL services so that
every endpoint the frontend calls returns data right away:

  * AggregationService.aggregate_device_data  -> DailyUsage + MonthlyUsage
  * PredictionService.predict_usage           -> 7-day forecast

Usage (from the backend/ directory):

    python seed.py [--firebase-uid <uid>]

Without --firebase-uid, a fixed demo UID is used for the device's owner so the
app works out of the box. If the signed-in Firebase user has a different UID,
pass it so the device shows up in their dashboard. Idempotent: re-running reuses
the same user/device and rebuilds the raw readings before re-aggregating.
"""
import argparse
import uuid
from datetime import datetime, timedelta
from random import Random

from app.database import SessionLocal, engine, Base
from sqlalchemy import text
from app.models.user import User
from app.models.device import Device
from app.models.reading import MeterReading
from app.models.usage import DailyUsage, MonthlyUsage
from app.services.aggregation import AggregationService
from app.services.prediction import PredictionService

DEMO_UID = "demo-user-electricai-0000"
DEVICE_CODE = "SEED-DEV-001"

# Sample-data profile knobs (energy is in kWh per 15-minute slot).
BASE_ENERGY_WH = 72.0            # ~288W average x 15min
DAILY_GROWTH_WH = 38.0           # gentle upward trend so predictions are meaningful
READINGS_PER_DAY = 96            # 96 x 15min = 24h
SEED_DAYS = 35                   # 35 days of history -> the forecast has real signal


def make_readings(rng: Random, device_id: uuid.UUID, days: int = SEED_DAYS):
    """One reading every 15 minutes for days days."""
    start = datetime.now() - timedelta(days=days)
    readings = []
    for i in range(days * READINGS_PER_DAY):
        recorded_at = start + timedelta(minutes=15 * i)
        hour = recorded_at.hour
        # Day/night load profile: heavier in the evening (~19:00).
        load = 0.55 + 0.45 * (1.0 - min(abs(hour - 19), 12) / 12.0)
        day_index = i // READINGS_PER_DAY
        drift = DAILY_GROWTH_WH * day_index / max(days - 1, 1) / 1000.0  # Wh -> kWh
        energy = max(
            0.0,
            BASE_ENERGY_WH / 1000.0 * load
            + drift
            + rng.uniform(-0.008, 0.009),
        )
        power = max(5.0, energy * 3600.0 / 900.0)  # watts (15-min window)
        current = max(0.5, power / 230.0)
        readings.append(
            MeterReading(
                device_id=device_id,
                voltage=round(rng.uniform(225, 242), 2),
                current=round(current, 3),
                power=round(power, 2),
                energy=round(energy, 3),
                frequency=round(rng.uniform(49.7, 50.3), 2),
                power_factor=round(rng.uniform(0.85, 0.99), 2),
                recorded_at=recorded_at,
            )
        )
    return readings


def main():
    parser = argparse.ArgumentParser(description="Seed ElectricAI with sample data")
    parser.add_argument(
        "--firebase-uid",
        default=DEMO_UID,
        help="Firebase UID to bind the demo device to",
    )
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)

    # Ensure monthly_limit column exists on existing users table (idempotent)
    with engine.connect() as _conn:
        _conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_limit NUMERIC(10,2) DEFAULT 500"
        ))
        _conn.commit()

    with SessionLocal() as db:
        # 1. Demo user (self-healing, mirrors the /users/me upsert logic).
        user = db.query(User).filter(User.firebase_uid == args.firebase_uid).first()
        if not user:
            user = User(
                firebase_uid=args.firebase_uid,
                full_name="Demo Homeowner",
                email="demo@electricai.app",
                timezone="Asia/Kolkata",
            )
            db.add(user)
            db.flush()

        # 2. Demo device.
        device = db.query(Device).filter(Device.device_code == DEVICE_CODE).first()
        if not device:
            device = Device(
                user_id=user.id,
                device_code=DEVICE_CODE,
                device_name="Home Main Meter",
                firmware_version="1.0.0",
                location="Apartment, Living Room",
                wifi_ssid="HomeWiFi",
            )
            db.add(device)
            db.flush()

        # 3. Rebuild the raw readings for this device so re-runs stay clean.
        db.query(MeterReading).filter(
            MeterReading.device_id == device.id
        ).delete(synchronize_session=False)

        rng = Random(42)  # deterministic
        readings = make_readings(rng, device.id)
        db.add_all(readings)
        db.commit()

        # 4. Run the REAL aggregation service -> DailyUsage + MonthlyUsage.
        AggregationService.aggregate_device_data(db, device.id)

        # 5. Run the REAL prediction service -> 7-day forecast.
        actual, predicted = PredictionService.predict_usage(db, device.id, range_days=7)

        n_readings = db.query(MeterReading).filter(
            MeterReading.device_id == device.id
        ).count()
        n_daily = db.query(DailyUsage).filter(
            DailyUsage.device_id == device.id
        ).count()
        n_monthly = db.query(MonthlyUsage).filter(
            MonthlyUsage.device_id == device.id
        ).count()

        print("=" * 60)
        print("ElectricAI seed complete")
        print("=" * 60)
        print(f"  Firebase UID   : {args.firebase_uid}")
        print(f"  Device         : {device.device_code} / {device.device_name}")
        print(f"  Meter readings : {n_readings} (15-min, {SEED_DAYS} days)")
        print(f"  DailyUsage     : {n_daily} rows")
        print(f"  MonthlyUsage   : {n_monthly} rows")
        print(f"  Actual 7d (kWh): {[round(v, 3) for v in actual[-7:]]}")
        print(f"  Predicted 7d   : {[round(v, 3) for v in predicted]}")
        print("=" * 60)


if __name__ == "__main__":
    main()