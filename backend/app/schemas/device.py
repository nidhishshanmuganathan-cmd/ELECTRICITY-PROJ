import uuid
from datetime import datetime
from pydantic import BaseModel


class DeviceBase(BaseModel):
    device_name: str
    location: str | None = None
    wifi_ssid: str | None = None


class DeviceCreate(DeviceBase):
    device_code: str
    firmware_version: str | None = None


class DeviceOut(DeviceBase):
    id: uuid.UUID
    user_id: uuid.UUID
    device_code: str
    status: str
    last_seen: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True