from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(Integer, primary_key=True, index=True)
    registration_number = Column(String(100), unique=True, index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # Statuses: AVAILABLE, ASSIGNED, EN_ROUTE, AT_SCENE, TRANSPORTING, UNAVAILABLE
    status = Column(String(50), default="AVAILABLE", nullable=False, index=True)

    last_updated = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    assignments = relationship("Assignment", back_populates="ambulance", cascade="all, delete-orphan")
    emergencies = relationship("Emergency", back_populates="assigned_ambulance")

