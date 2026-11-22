from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class HospitalCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Hospital name")
    address: str = Field(..., min_length=5, max_length=500, description="Physical address")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Hospital latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Hospital longitude")
    contact_information: str = Field(..., min_length=3, max_length=255, description="Phone, emergency hotline or email")
    is_active: bool = Field(default=True, description="Active status")


class HospitalUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    address: Optional[str] = Field(None, min_length=5, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    contact_information: Optional[str] = Field(None, min_length=3, max_length=255)
    is_active: Optional[bool] = None


class HospitalResponse(BaseModel):
    id: int
    name: str
    address: str
    latitude: float
    longitude: float
    contact_information: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

