from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict
from app.schemas.ambulance import AmbulanceResponse
from app.schemas.hospital import HospitalResponse


VALID_EMERGENCY_STATUSES = {
    "PENDING",
    "DISPATCHED",
    "EN_ROUTE",
    "AT_SCENE",
    "TRANSPORTING",
    "COMPLETED",
    "CANCELLED"
}


class EmergencyStatusUpdate(BaseModel):
    status: str = Field(..., description="Target emergency status")
    notes: Optional[str] = Field(None, description="Optional transition notes")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_EMERGENCY_STATUSES:
            raise ValueError(f"Invalid emergency status '{v}'. Allowed: {', '.join(sorted(VALID_EMERGENCY_STATUSES))}")
        return v_upper


class EmergencyHospitalAssign(BaseModel):
    hospital_id: int = Field(..., description="ID of hospital to assign")


class AssignmentResponse(BaseModel):
    id: int
    emergency_id: int
    ambulance_id: int
    assignment_timestamp: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


class EmergencyResponse(BaseModel):
    id: int
    accident_id: int
    assigned_ambulance_id: Optional[int] = None
    hospital_id: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: datetime
    completion_timestamp: Optional[datetime] = None

    assigned_ambulance: Optional[AmbulanceResponse] = None
    hospital: Optional[HospitalResponse] = None
    assignments: List[AssignmentResponse] = []

    model_config = ConfigDict(from_attributes=True)


class EmergencyDispatchResponse(BaseModel):
    emergency: EmergencyResponse
    assigned_ambulance: AmbulanceResponse
    distance_km: float
    assignment: AssignmentResponse
    message: str

