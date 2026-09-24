import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class ReadingCreate(BaseModel):
    voltage: Decimal
    current: Decimal
    power: Decimal
    energy: Decimal
    frequency: Decimal
    power_factor: Decimal
    recorded_at: datetime


class ReadingOut(ReadingCreate):
    id: uuid.UUID
    device_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True