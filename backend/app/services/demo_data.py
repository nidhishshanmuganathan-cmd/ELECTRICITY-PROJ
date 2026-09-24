"""Deterministic demo data for a signed-in user's dashboard."""

from datetime import datetime, timedelta
from random import Random

from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.reading import MeterReading
from app.models.usage import DailyUsage, MonthlyUsage
from app.services.aggregation import AggregationService

READINGS_PER_DAY = 96
DEMO_DAYS = 35


def populate_demo_data(db: Session, device: Device) -> None:
    """Replace this demo device's sample history and rebuild its rollups."""
    db.query(MeterReading).filter(MeterReading.device_id == device.id).delete(
        synchronize_session=False
    )
    db.query(DailyUsage).filter(DailyUsage.device_id == device.id).delete(
        synchronize_session=False
    )
    db.query(MonthlyUsage).filter(MonthlyUsage.device_id == device.id).delete(
        synchronize_session=False
    )

    rng = Random(42)
    start = datetime.now().astimezone() - timedelta(days=DEMO_DAYS)
    readings = []
    for index in range(DEMO_DAYS * READINGS_PER_DAY):
        recorded_at = start + timedelta(minutes=15 * index)
        hour = recorded_at.hour
        evening_load = 0.55 + 0.45 * (1.0 - min(abs(hour - 19), 12) / 12.0)
        day_index = index // READINGS_PER_DAY
        growth = 0.038 * day_index / max(DEMO_DAYS - 1, 1)
        energy = max(0.0, 0.072 * evening_load + growth + rng.uniform(-0.008, 0.009))
        power = max(5.0, energy * 4 * 1000)  # 15-minute interval -> watts

        readings.append(
            MeterReading(
                device_id=device.id,
                voltage=round(rng.uniform(225, 242), 2),
                current=round(power / 230, 3),
                power=round(power, 2),
                energy=round(energy, 3),
                frequency=round(rng.uniform(49.7, 50.3), 2),
                power_factor=round(rng.uniform(0.85, 0.99), 2),
                recorded_at=recorded_at,
            )
        )

    db.add_all(readings)
    db.commit()
    AggregationService.aggregate_device_data(db, device.id)
