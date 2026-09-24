import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    monthly_limit: float = 500


class UserCreate(UserBase):
    firebase_uid: str


class UserOut(UserBase):
    id: uuid.UUID
    profile_image: str | None = None
    timezone: str
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceTokenIn(BaseModel):
    fcm_token: str = Field(min_length=1, max_length=255)


class DeviceTokenOut(BaseModel):
    fcm_token: str | None = None

    class Config:
        from_attributes = True