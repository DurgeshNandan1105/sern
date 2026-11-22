from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, field_validator, ConfigDict


class SensorDataInput(BaseModel):
    """Raw sensor readings matching the AccidentDetectionML input contract."""
    gsensor: List[List[float]] = Field(..., description="Accelerometer readings (X, Y, Z)")
    gyro: List[List[float]] = Field(..., description="Gyroscope readings (X, Y, Z)")
    gps_speed: List[float] = Field(..., description="GPS speed readings")
    vehiclesize: str = Field(default="car", description="Vehicle size category")
    gyro_is_hd: bool = Field(default=False, description="Gyroscope high-definition status")

    @field_validator("gsensor")
    @classmethod
    def validate_gsensor(cls, v: List[List[float]]) -> List[List[float]]:
        if not v:
            raise ValueError("Accelerometer readings cannot be empty.")
        for item in v:
            if len(item) != 3:
                raise ValueError("Each accelerometer reading must have 3 axes (X, Y, Z).")
        return v

    @field_validator("gyro")
    @classmethod
    def validate_gyro(cls, v: List[List[float]]) -> List[List[float]]:
        if not v:
            raise ValueError("Gyroscope readings cannot be empty.")
        for item in v:
            if len(item) != 3:
                raise ValueError("Each gyroscope reading must have 3 axes (X, Y, Z).")
        return v

    @field_validator("gps_speed")
    @classmethod
    def validate_gps_speed(cls, v: List[float]) -> List[float]:
        if not v:
            raise ValueError("GPS speed readings cannot be empty.")
        return v


class AccidentCreate(BaseModel):
    """Payload to register an accident candidate with sensor data and location."""
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude of the event")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude of the event")
    sensor_data: SensorDataInput = Field(..., description="Vehicle sensor readings")
    timestamp: Optional[datetime] = Field(default=None, description="Event timestamp (UTC)")


class AccidentValidationRequest(BaseModel):
    """Explicit confirmation / validation of a detected accident."""
    confirmed: bool = Field(..., description="Whether the accident is confirmed as a real emergency")
    validation_notes: Optional[str] = Field(None, description="Optional notes or confirmation context")
    auto_dispatch: Optional[bool] = Field(None, description="Override config to automatically dispatch nearest ambulance upon confirmation")


class AccidentResponse(BaseModel):
    id: int
    latitude: float
    longitude: float
    timestamp: datetime
    vehicle_size: Optional[str] = None
    gyro_is_hd: bool
    accident_prediction: bool
    accident_probability: float
    model_threshold: float
    validation_status: str
    validation_notes: Optional[str] = None
    created_at: datetime
    emergency_id: Optional[int] = None
    sensor_data: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

