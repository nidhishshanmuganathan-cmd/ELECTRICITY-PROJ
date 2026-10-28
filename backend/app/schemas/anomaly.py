from typing import Literal

from pydantic import BaseModel


class AnomalyOut(BaseModel):
    status: Literal["normal", "anomaly", "insufficient_data"]
    score: float
    sample_size: int
