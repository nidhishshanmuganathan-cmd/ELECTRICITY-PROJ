from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import Base, engine
from app.routes import users, devices, readings
from app.routes import fcm_test  # TEMPORARY DEV-ONLY - remove after verification
from app.routes import simulation

# This is also the module used by the test suite. Keep its bootstrap aligned
# with app/main.py so additive notification schema updates are applied in both
# supported startup paths.
Base.metadata.create_all(bind=engine)
with engine.connect() as conn:
    conn.execute(text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_limit NUMERIC(10,2) DEFAULT 500"
    ))
    conn.execute(text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(255)"
    ))
    conn.execute(text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_notification_status VARCHAR(20)"
    ))
    conn.commit()

app = FastAPI(
    title="ElectricAI API",
    description="Smart Electricity Monitoring & AI Prediction Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(devices.router)
app.include_router(readings.router)
app.include_router(fcm_test.router)  # TEMPORARY DEV-ONLY - remove after verification
app.include_router(simulation.router)


@app.get("/")
async def root():
    return {
        "status": "success",
        "message": "ElectricAI Backend Running",
        "version": "1.0.0",
    }
