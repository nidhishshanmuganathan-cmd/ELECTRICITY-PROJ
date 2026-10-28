import numpy as np
from sklearn.ensemble import RandomForestRegressor


class ElectricityMLModel:

    def __init__(self):
        self.model = RandomForestRegressor(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=2,
            random_state=42
        )

    def _features(self, values):
        values = list(values)

        last7 = values[-7:]
        last14 = values[-14:] if len(values) >= 14 else values

        return [
            np.mean(last7),
            np.mean(last14),
            np.median(last7),
            np.std(last7),
            last7[-1],
            last7[-1] - last7[0],
        ]

    def train(self, usage_values):
        if len(usage_values) < 15:
            raise ValueError("At least 15 usage records are required.")

        # Remove extreme outliers using percentile clipping
        values = np.array(usage_values, dtype=float)

        low = np.percentile(values, 5)
        high = np.percentile(values, 95)
        values = np.clip(values, low, high)

        X = []
        y = []

        for i in range(14, len(values)):
            X.append(self._features(values[:i]))
            y.append(values[i])

        self.model.fit(np.array(X), np.array(y))

    def predict_next_7_days(self, usage_values, days=7):
        if len(usage_values) < 14:
            raise ValueError("At least 14 usage records are required.")

        history = list(map(float, usage_values))
        predictions = []

        for _ in range(days):
            features = np.array(
                self._features(history)
            ).reshape(1, -1)

            prediction = float(self.model.predict(features)[0])
            prediction = max(0.0, prediction)

            predictions.append(prediction)
            history.append(prediction)

        return predictions