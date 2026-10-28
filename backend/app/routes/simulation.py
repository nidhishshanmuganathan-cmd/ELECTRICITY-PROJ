import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.auth import get_current_user
from app.models.device import Device
from app.models.usage import MonthlyUsage
from app.services.notifications import NotificationService
from pydantic import BaseModel

router = APIRouter(prefix="/simulation", tags=["simulation"])

class UsageSimIn(BaseModel):
    device_id: uuid.UUID
    energy_value: float

@router.post("/usage")
def simulate_usage(
    data: UsageSimIn,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify that the signed-in user owns the target meter.  The previous
    # implementation queried a hard-coded DEV-001 record before this check;
    # that made simulation fail on databases without that sample device.
    from app.models.user import User
    user = db.query(User).filter(User.firebase_uid == current_user["uid"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    device = db.query(Device).filter(Device.id == data.device_id, Device.user_id == user.id).first()
    if not device:
        raise HTTPException(status_code=403, detail="Device not found or not owned by user")

    # 2. Update or create MonthlyUsage record for the current month
    month = datetime.now().strftime("%Y-%m")
    usage = db.query(MonthlyUsage).filter(
        MonthlyUsage.device_id == data.device_id,
        MonthlyUsage.month == month
    ).first()

    if usage:
        usage.total_energy = data.energy_value
    else:
        usage = MonthlyUsage(
            device_id=data.device_id,
            month=month,
            total_energy=data.energy_value
        )
        db.add(usage)

    db.commit()
    db.refresh(usage)

    # Simulated values should exercise the same alert path as live readings.
    notification = NotificationService.check_and_notify_usage(db, user.id)

    return {
        "success": True,
        "message": f"Usage simulated: {data.energy_value} kWh for {month}",
        "current_usage": usage.total_energy,
        "notification": notification,
    }
