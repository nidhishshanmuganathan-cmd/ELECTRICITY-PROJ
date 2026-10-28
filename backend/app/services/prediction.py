from sqlalchemy.orm import Session
from app.models.usage import DailyUsage
from app.services.ml_model import ElectricityMLModel
from typing import List, Tuple


class PredictionService:

    @staticmethod
    def predict_usage(
        db: Session,
        device_id: str,
        range_days: int = 7
    ) -> Tuple[List[float], List[float]]:

        records = (
            db.query(DailyUsage)
            .filter(DailyUsage.device_id == device_id)
            .order_by(DailyUsage.date.desc())
            .limit(60)
            .all()
        )

        if not records:
            return [], [0.0] * 7

        values = [float(r.total_energy) for r in reversed(records)]

        actuals = values[-range_days:]

        # The ML model needs at least 15 daily records to create one training
        # example. Preserve the observed trend until enough history exists.
        if len(values) < 15:
            count = len(values)
            mean_x = (count - 1) / 2
            mean_y = sum(values) / count
            denominator = sum((index - mean_x) ** 2 for index in range(count))
            slope = (
                sum((index - mean_x) * (value - mean_y) for index, value in enumerate(values))
                / denominator
                if denominator
                else 0.0
            )
            return actuals, [round(max(0.0, values[-1] + slope * day), 2) for day in range(1, 8)]

        model = ElectricityMLModel()
        model.train(values)

        predictions = model.predict_next_7_days(values, range_days)

        return actuals, [round(x, 2) for x in predictions]
