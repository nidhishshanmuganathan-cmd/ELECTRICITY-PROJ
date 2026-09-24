import uuid
from sqlalchemy import Column, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class MeterReading(Base):
    __tablename__ = "meter_readings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    voltage = Column(Numeric(6, 2), nullable=False)
    current = Column(Numeric(8, 3), nullable=False)
    power = Column(Numeric(10, 2), nullable=False)
    energy = Column(Numeric(12, 3), nullable=False)
    frequency = Column(Numeric(5, 2), nullable=False)
    power_factor = Column(Numeric(4, 2), nullable=False)
    recorded_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())