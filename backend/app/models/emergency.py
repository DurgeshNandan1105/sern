from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class Emergency(Base):
    __tablename__ = "emergencies"

    id = Column(Integer, primary_key=True, index=True)
    accident_id = Column(Integer, ForeignKey("accidents.id"), unique=True, nullable=False)
    assigned_ambulance_id = Column(Integer, ForeignKey("ambulances.id"), nullable=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=True)

    # Statuses: PENDING, DISPATCHED, EN_ROUTE, AT_SCENE, TRANSPORTING, COMPLETED, CANCELLED
    status = Column(String(50), default="PENDING", nullable=False, index=True)

    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    completion_timestamp = Column(DateTime, nullable=True)

    # Relationships
    accident = relationship("Accident", back_populates="emergency")
    assigned_ambulance = relationship("Ambulance", back_populates="emergencies")
    hospital = relationship("Hospital", back_populates="emergencies")
    assignments = relationship("Assignment", back_populates="emergency", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="emergency", cascade="all, delete-orphan")
    route = relationship("RouteInfo", back_populates="emergency", uselist=False, cascade="all, delete-orphan")

