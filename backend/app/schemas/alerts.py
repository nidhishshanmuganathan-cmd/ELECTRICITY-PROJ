import uuid
from typing import Literal
from pydantic import BaseModel


AlertStatus = Literal["ok", "warning", "exceeded"]


class DeviceAlertOut(BaseModel):
    device_id: uuid.UUID
    device_code: str | None = None
    device_name: str | None = None
    month: str
    current_usage: float
    predicted_next_7d_total: float

    class Config:
        from_attributes = True


class AlertsOut(BaseModel):
    month: str
    monthly_limit: float
    current_usage: float
    usage_percent: float
    remaining: float
    status: AlertStatus
    predicted_next_7d_total: float
    projected_month_total: float
    predicted_will_exceed: bool
    predicted_status: AlertStatus
    devices: list[DeviceAlertOut]

    class Config:
        from_attributes = True
