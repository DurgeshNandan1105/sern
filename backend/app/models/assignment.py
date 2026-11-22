from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    emergency_id = Column(Integer, ForeignKey("emergencies.id"), nullable=False)
    ambulance_id = Column(Integer, ForeignKey("ambulances.id"), nullable=False)

    assignment_timestamp = Column(DateTime, default=utc_now, nullable=False)
    # Statuses: ACTIVE, COMPLETED, CANCELLED, REASSIGNED
    status = Column(String(50), default="ACTIVE", nullable=False)

    emergency = relationship("Emergency", back_populates="assignments")
    ambulance = relationship("Ambulance", back_populates="assignments")

