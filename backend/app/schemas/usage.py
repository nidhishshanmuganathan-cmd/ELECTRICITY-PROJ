from pydantic import BaseModel
from datetime import date
from typing import Optional
from decimal import Decimal

class DailyUsageOut(BaseModel):
    date: str
    total_energy: Decimal
    peak_power: Optional[Decimal]

    class Config:
        from_attributes = True

class MonthlyUsageOut(BaseModel):
    month: str
    total_energy: Decimal

    class Config:
        from_attributes = True
