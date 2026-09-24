import uuid
from sqlalchemy import Column, String, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid = Column(String(128), unique=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    phone = Column(String(20), unique=True, nullable=True)
    address = Column(String(255), nullable=True)
    profile_image = Column(String, nullable=True)
    timezone = Column(String(50), default="Asia/Kolkata")
    monthly_limit = Column(Numeric(10, 2), default=500)
    fcm_token = Column(String(255), nullable=True)
    # The most recent alert level that produced a push notification.  This
    # prevents a meter that reports every few seconds from sending the same
    # warning repeatedly while it remains over the threshold.
    last_notification_status = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
