from pydantic import BaseModel, ConfigDict
from datetime import date
from typing import Optional
from decimal import Decimal

class DailyUsageOut(BaseModel):
    date: str
    total_energy: Decimal
    peak_power: Optional[Decimal]

    model_config = ConfigDict(from_attributes=True)

class MonthlyUsageOut(BaseModel):
    month: str
    total_energy: Decimal

    model_config = ConfigDict(from_attributes=True)
