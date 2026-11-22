from datetime import datetime
from typing import Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict


class RouteCreate(BaseModel):
    """
    Integration contract for Member 4's routing module.
    Member 4 posts route calculations (distance, duration, geometry) to this schema.
    """
    emergency_id: int = Field(..., description="Emergency ID this route corresponds to")
    distance_km: float = Field(..., ge=0.0, description="Calculated road network route distance in km")
    estimated_duration_minutes: float = Field(..., ge=0.0, description="Estimated travel time in minutes")
    route_geometry: Optional[Dict[str, Any]] = Field(None, description="GeoJSON, waypoints, or polyline representation")
    source: Optional[str] = Field(default="MEMBER_4_ROUTING_MODULE", description="Source module identifier")


class RouteResponse(BaseModel):
    id: int
    emergency_id: int
    distance_km: float
    estimated_duration_minutes: float
    route_geometry: Optional[Dict[str, Any]] = None
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

