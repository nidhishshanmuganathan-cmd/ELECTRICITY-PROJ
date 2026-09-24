import uuid
from sqlalchemy import Column, Numeric, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class DailyUsage(Base):
    __tablename__ = "daily_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    date = Column(String, nullable=False) # Format: YYYY-MM-DD
    total_energy = Column(Numeric(12, 3), nullable=False)
    peak_power = Column(Numeric(10, 2), nullable=True)
    
    __table_args__ = (UniqueConstraint('device_id', 'date', name='_device_date_uc'),)

class MonthlyUsage(Base):
    __tablename__ = "monthly_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    month = Column(String, nullable=False) # Format: YYYY-MM
    total_energy = Column(Numeric(12, 3), nullable=False)
    
    __table_args__ = (UniqueConstraint('device_id', 'month', name='_device_month_uc'),)
