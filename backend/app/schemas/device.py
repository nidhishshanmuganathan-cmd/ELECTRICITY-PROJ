import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class DeviceBase(BaseModel):
    device_name: str = Field(min_length=1, max_length=100)
    location: str | None = Field(default=None, max_length=100)
    wifi_ssid: str | None = Field(default=None, max_length=100)


class DeviceCreate(DeviceBase):
    device_code: str = Field(min_length=3, max_length=20, pattern=r"^[A-Za-z0-9_-]+$")
    firmware_version: str | None = Field(default=None, max_length=20)


class DeviceOut(DeviceBase):
    id: uuid.UUID
    user_id: uuid.UUID
    device_code: str
    status: str
    last_seen: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeviceProvisioningTokenOut(BaseModel):
    device_id: uuid.UUID
    device_token: str
