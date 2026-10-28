"""Daily energy-use anomaly detection."""

import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session

from app.models.usage import DailyUsage


class AnomalyService:
    MINIMUM_RECORDS = 7

    @staticmethod
    def analyze_device_usage(db: Session, device_id) -> dict:
        records = (
            db.query(DailyUsage)
            .filter(DailyUsage.device_id == device_id)
            .order_by(DailyUsage.date.asc())
            .all()
        )
        values = np.array([float(record.total_energy) for record in records], dtype=float)
        if len(values) < AnomalyService.MINIMUM_RECORDS:
            return {
                "status": "insufficient_data",
                "score": 0.0,
                "sample_size": len(values),
            }

        model = IsolationForest(n_estimators=100, contamination="auto", random_state=42)
        samples = values.reshape(-1, 1)
        labels = model.fit_predict(samples)
        raw_scores = -model.score_samples(samples)
        spread = float(raw_scores.max() - raw_scores.min())
        score = 0.5 if spread == 0 else float((raw_scores[-1] - raw_scores.min()) / spread)
        return {
            "status": "anomaly" if labels[-1] == -1 else "normal",
            "score": round(score, 4),
            "sample_size": len(values),
        }
