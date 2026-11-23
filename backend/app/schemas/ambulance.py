from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict


VALID_AMBULANCE_STATUSES = {
    "AVAILABLE",
    "ASSIGNED",
    "EN_ROUTE",
    "AT_SCENE",
    "TRANSPORTING",
    "UNAVAILABLE"
}


class AmbulanceCreate(BaseModel):
    registration_number: str = Field(..., min_length=2, max_length=100, description="Unique registration number")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Current latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Current longitude")
    status: Optional[str] = Field(default="AVAILABLE", description="Initial availability status")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> str:
        if v is None:
            return "AVAILABLE"
        v_upper = v.upper()
        if v_upper not in VALID_AMBULANCE_STATUSES:
            raise ValueError(f"Invalid status '{v}'. Must be one of: {', '.join(sorted(VALID_AMBULANCE_STATUSES))}")
        return v_upper


class AmbulanceUpdate(BaseModel):
    registration_number: Optional[str] = Field(None, min_length=2, max_length=100)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v_upper = v.upper()
        if v_upper not in VALID_AMBULANCE_STATUSES:
            raise ValueError(f"Invalid status '{v}'. Must be one of: {', '.join(sorted(VALID_AMBULANCE_STATUSES))}")
        return v_upper


class AmbulanceLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Updated latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Updated longitude")


class AmbulanceTelemetry(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Live GPS latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Live GPS longitude")
    speed_kmh: Optional[float] = Field(45.0, ge=0.0, description="Current vehicle velocity in km/h")
    heading_deg: Optional[float] = Field(0.0, ge=0.0, le=360.0, description="Bearing angle in degrees")
    distance_remaining_km: Optional[float] = Field(None, ge=0.0, description="Distance remaining to target")
    eta_seconds: Optional[int] = Field(None, ge=0, description="Estimated time of arrival in seconds")
    status: Optional[str] = Field(None, description="Optional status transition e.g. EN_ROUTE, AT_SCENE")


class AmbulanceAvailabilityUpdate(BaseModel):
    status: str = Field(..., description="AVAILABLE or UNAVAILABLE")

    @field_validator("status")
    @classmethod
    def validate_availability(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in {"AVAILABLE", "UNAVAILABLE"}:
            raise ValueError("Availability status must be either 'AVAILABLE' or 'UNAVAILABLE'.")
        return v_upper


class AmbulanceResponse(BaseModel):
    id: int
    registration_number: str
    latitude: float
    longitude: float
    status: str
    last_updated: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

