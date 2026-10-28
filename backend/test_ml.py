from app.database import SessionLocal
from app.models.usage import DailyUsage
from app.services.ml_model import ElectricityMLModel
from sklearn.metrics import mean_absolute_error, mean_squared_error
import numpy as np


db = SessionLocal()

records = (
    db.query(DailyUsage)
    .order_by(DailyUsage.date.asc())
    .all()
)

values = [float(r.total_energy) for r in records]

print("Total daily records:", len(values))

if len(values) < 30:
    print("Need at least 30 daily records for validation.")
    exit()

actual = []
predicted = []

for i in range(21, len(values) - 7, 7):
    train = values[:i]
    test = values[i:i+7]

    model = ElectricityMLModel()
    model.train(train)

    pred = model.predict_next_7_days(train)

    actual.extend(test)
    predicted.extend(pred)

mae = mean_absolute_error(actual, predicted)
rmse = np.sqrt(mean_squared_error(actual, predicted))

print(f"MAE  : {mae:.2f} kWh")
print(f"RMSE : {rmse:.2f} kWh")