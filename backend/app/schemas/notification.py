from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class NotificationCreate(BaseModel):
    emergency_id: Optional[int] = Field(None, description="Optional associated emergency ID")
    hospital_id: Optional[int] = Field(None, description="Optional associated hospital ID")
    recipient: str = Field(..., min_length=2, max_length=255, description="Recipient identifier (e.g., Hospital A, Police, Contact)")
    notification_type: str = Field(..., min_length=2, max_length=100, description="Type: HOSPITAL_ALERT, EMERGENCY_CONTACT, DISPATCH_NOTICE")
    message: str = Field(..., min_length=1, description="Notification message content")


class NotificationResponse(BaseModel):
    id: int
    emergency_id: Optional[int] = None
    hospital_id: Optional[int] = None
    recipient: str
    notification_type: str
    message: str
    delivery_status: str
    is_simulated: bool
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

