from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import Base, engine
from app.config import settings
from app.routes import users, devices, readings
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
    conn.execute(text(
        "ALTER TABLE devices ADD COLUMN IF NOT EXISTS upload_token_hash VARCHAR(64)"
    ))
    conn.commit()

app = FastAPI(
    title="ElectricAI API",
    description="Smart Electricity Monitoring & AI Prediction Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(devices.router)
app.include_router(readings.router)
app.include_router(simulation.router)


@app.get("/")
async def root():
    return {
        "status": "success",
        "message": "ElectricAI Backend Running",
        "version": "1.0.0",
    }
