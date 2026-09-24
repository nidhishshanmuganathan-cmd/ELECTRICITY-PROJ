from sqlalchemy.orm import Session
from app.models.usage import DailyUsage
from typing import List, Tuple

class PredictionService:
    @staticmethod
    def predict_usage(db: Session, device_id: str, range_days: int = 7) -> Tuple[List[float], List[float]]:
        """
        Predicts the next 7 days of energy usage based on historical daily usage.
        Returns a tuple of (actual_last_n_days, predicted_next_7_days).
        """
        # Fetch enough data for both the actuals and the regression (at least 14 days or 2x range)
        fetch_limit = max(14, range_days * 2)
        records = db.query(DailyUsage).filter(
            DailyUsage.device_id == device_id
        ).order_by(DailyUsage.date.desc()).limit(fetch_limit).all()

        if not records:
            return [], [0.0] * 7

        # Convert to sorted list of values (oldest to newest)
        values = [float(r.total_energy) for r in reversed(records)]
        n = len(values)

        # actuals are the last 'range_days'
        actuals = values[-range_days:] if n >= range_days else values

        if n < 3:
            # Insufficient data for regression, use simple average
            avg = sum(values) / n
            return actuals, [avg] * 7

        # Simple Linear Regression: y = mx + c
        x = list(range(n))
        y = values

        sum_x = sum(x)
        sum_y = sum(y)
        sum_xx = sum(xi * xi for xi in x)
        sum_xy = sum(xi * yi for xi, yi in zip(x, y))

        denominator = (n * sum_xx) - (sum_x ** 2)

        if denominator == 0:
            avg = sum(y) / n
            return actuals, [avg] * 7

        slope = (n * sum_xy - sum_x * sum_y) / denominator
        intercept = (sum_y - slope * sum_x) / n

        # Predict next 7 days (x from n to n+6)
        predictions = []
        for i in range(n, n + 7):
            pred = slope * i + intercept
            predictions.append(max(0.0, pred))

        return actuals, predictions
