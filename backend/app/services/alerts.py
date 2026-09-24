from datetime import datetime
from sqlalchemy.orm import Session
from app.models.device import Device
from app.models.usage import DailyUsage, MonthlyUsage
from app.models.user import User
from app.services.prediction import PredictionService

# Fraction of the monthly limit at which a warning is raised.
WARNING_THRESHOLD = 0.8

# Fallback when a user row has no usable limit (single source of truth
# is users.monthly_limit; this only guards NULL/zero data).
DEFAULT_MONTHLY_LIMIT = 500.0


class AlertService:
    @staticmethod
    def get_monthly_limit(db: Session, user_id) -> float:
        """Read the user's monthly limit (single source of truth)."""
        user = db.query(User).filter(User.id == user_id).first()
        if user is None or user.monthly_limit is None:
            return DEFAULT_MONTHLY_LIMIT
        try:
            limit = float(user.monthly_limit)
        except (TypeError, ValueError):
            return DEFAULT_MONTHLY_LIMIT
        return limit if limit > 0 else DEFAULT_MONTHLY_LIMIT

    @staticmethod
    def get_device_month_usage(db: Session, device_id, month: str) -> float:
        """Current-month consumption for one device.

        Prefers the MonthlyUsage rollup written by AggregationService;
        falls back to summing DailyUsage rows when the rollup is missing.
        """
        rollup = (
            db.query(MonthlyUsage)
            .filter(MonthlyUsage.device_id == device_id, MonthlyUsage.month == month)
            .first()
        )
        if rollup is not None and rollup.total_energy is not None:
            return float(rollup.total_energy)

        rows = (
            db.query(DailyUsage)
            .filter(
                DailyUsage.device_id == device_id,
                DailyUsage.date.startswith(month),
            )
            .all()
        )
        return round(sum(float(r.total_energy) for r in rows), 3)

    @staticmethod
    def status_for(value: float, limit: float) -> str:
        """Map a consumption value to ok | warning | exceeded."""
        if value >= limit:
            return "exceeded"
        if value >= WARNING_THRESHOLD * limit:
            return "warning"
        return "ok"

    @staticmethod
    def evaluate_user_alerts(db: Session, user_id) -> dict | None:
        """Evaluate alert state for a user across all their devices."""
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            return None

        limit = AlertService.get_monthly_limit(db, user_id)
        month = datetime.now().strftime("%Y-%m")

        devices = db.query(Device).filter(Device.user_id == user.id).all()

        device_entries = []
        current_usage = 0.0
        predicted_total = 0.0
        for device in devices:
            current = AlertService.get_device_month_usage(db, device.id, month)
            _, predicted = PredictionService.predict_usage(db, device.id, 7)
            predicted_sum = round(sum(predicted), 3)
            current_usage += current
            predicted_total += predicted_sum
            device_entries.append(
                {
                    "device_id": device.id,
                    "device_code": device.device_code,
                    "device_name": device.device_name,
                    "month": month,
                    "current_usage": round(current, 3),
                    "predicted_next_7d_total": predicted_sum,
                }
            )

        current_usage = round(current_usage, 3)
        predicted_total = round(predicted_total, 3)
        projected = round(current_usage + predicted_total, 3)

        return {
            "month": month,
            "monthly_limit": limit,
            "current_usage": current_usage,
            "usage_percent": round((current_usage / limit) * 100, 2) if limit > 0 else 0.0,
            "remaining": round(max(0.0, limit - current_usage), 3),
            "status": AlertService.status_for(current_usage, limit),
            "predicted_next_7d_total": predicted_total,
            "projected_month_total": projected,
            "predicted_will_exceed": projected >= limit,
            "predicted_status": AlertService.status_for(projected, limit),
            "devices": device_entries,
        }
