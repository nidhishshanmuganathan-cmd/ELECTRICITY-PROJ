from sqlalchemy import func
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.device import Device
from app.models.user import User
from app.models.reading import MeterReading
from app.models.usage import DailyUsage, MonthlyUsage
from app.schemas.reading import ReadingCreate, ReadingOut
from app.schemas.usage import DailyUsageOut, MonthlyUsageOut
from app.services.aggregation import AggregationService
from app.services.prediction import PredictionService
from app.services.notifications import NotificationService
import logging
import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/devices/{device_id}/readings", tags=["readings"])
logger = logging.getLogger(__name__)


def get_owned_device(device_id: uuid.UUID, current_user: dict, db: Session) -> Device:
    """Return a device only when it belongs to the authenticated Firebase user.

    A 404 is deliberately returned for both missing and unowned devices so an
    authenticated user cannot enumerate another user's device IDs.
    """
    device = (
        db.query(Device)
        .join(User, Device.user_id == User.id)
        .filter(Device.id == device_id, User.firebase_uid == current_user["uid"])
        .first()
    )
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.get("/summary", tags=["readings"])
def get_usage_summary(
    device_id: uuid.UUID,
    range: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_device(device_id, current_user, db)

    # Map range to number of days
    range_map = {
        "24H": 1,
        "7D": 7,
        "30D": 30,
        "90D": 90
    }
    days = range_map.get(range, 30)

    # Sum total_energy from DailyUsage for the last N days
    total = db.query(func.sum(DailyUsage.total_energy)).filter(
        DailyUsage.device_id == device_id
    ).scalar() or 0

    # Note: For a truly accurate "last N days", we should filter by date.
    # Since we have the DailyUsage table, we can filter by the last N records
    # if we assume one record per day.

    # Better approach: get the last N records and sum them.
    records = db.query(DailyUsage).filter(
        DailyUsage.device_id == device_id
    ).order_by(DailyUsage.date.desc()).limit(days).all()

    actual_total = sum(float(r.total_energy) for r in records)

    return {"total_energy": actual_total, "range": range}

@router.get("/predictions", tags=["readings"])
def get_predictions(
    device_id: uuid.UUID,
    range: str = "7D",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_device(device_id, current_user, db)

    # Map range string to number of days
    range_map = {
        "24H": 1,
        "7D": 7,
        "30D": 30,
        "90D": 90
    }
    days = range_map.get(range, 7)

    actual, predicted = PredictionService.predict_usage(db, device_id, days)
    return {
        "actual": actual,
        "predicted": predicted
    }

@router.get("/daily", response_model=list[DailyUsageOut], tags=["readings"])
def get_daily_usage(
    device_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_device(device_id, current_user, db)

    return db.query(DailyUsage).filter(DailyUsage.device_id == device_id).order_by(DailyUsage.date.desc()).all()

@router.get("/monthly", response_model=list[MonthlyUsageOut], tags=["readings"])
def get_monthly_usage(
    device_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_device(device_id, current_user, db)

    return db.query(MonthlyUsage).filter(MonthlyUsage.device_id == device_id).order_by(MonthlyUsage.month.desc()).all()

@router.post("/aggregate", tags=["readings"])
def aggregate_readings(
    device_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    device = get_owned_device(device_id, current_user, db)

    try:
        AggregationService.aggregate_device_data(db, device_id)
        notification = NotificationService.check_and_notify_usage(db, device.user_id)
        return {
            "status": "success",
            "message": "Data aggregated successfully",
            "notification": notification,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=ReadingOut)
def add_reading(
    device_id: uuid.UUID,
    reading_data: ReadingCreate,
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    reading = MeterReading(device_id=device_id, **reading_data.model_dump())
    db.add(reading)
    device.status = "online"
    device.last_seen = datetime.now(timezone.utc)
    db.commit()
    db.refresh(reading)

    # Meter uploads are the normal trigger for usage alerts.  Notification
    # failures must never reject a valid device reading, so retain the reading
    # and log the failed secondary work for server-side investigation.
    try:
        AggregationService.aggregate_device_data(db, device_id)
        NotificationService.check_and_notify_usage(db, device.user_id)
    except Exception:
        logger.exception("Could not aggregate readings or send usage notification")
    return reading


@router.get("/", response_model=list[ReadingOut])
def get_readings(
    device_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_owned_device(device_id, current_user, db)
    return (
        db.query(MeterReading)
        .filter(MeterReading.device_id == device_id)
        .order_by(MeterReading.recorded_at.desc())
        .all()
    )
