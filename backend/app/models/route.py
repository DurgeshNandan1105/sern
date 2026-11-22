from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class RouteInfo(Base):
    __tablename__ = "route_info"

    id = Column(Integer, primary_key=True, index=True)
    emergency_id = Column(Integer, ForeignKey("emergencies.id"), unique=True, nullable=False)

    distance_km = Column(Float, nullable=False)
    estimated_duration_minutes = Column(Float, nullable=False)
    route_geometry = Column(JSON, nullable=True)
    source = Column(String(100), default="MEMBER_4_ROUTING_MODULE", nullable=False)

    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    emergency = relationship("Emergency", back_populates="route")

