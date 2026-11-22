from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    emergency_id = Column(Integer, ForeignKey("emergencies.id"), nullable=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=True)
    recipient = Column(String(255), nullable=False)

    # e.g., HOSPITAL_ALERT, EMERGENCY_CONTACT, DISPATCH_NOTICE
    notification_type = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)

    # Delivery simulation
    delivery_status = Column(String(50), default="SIMULATED_DELIVERED", nullable=False)
    is_simulated = Column(Boolean, default=True, nullable=False)

    timestamp = Column(DateTime, default=utc_now, nullable=False)

    emergency = relationship("Emergency", back_populates="notifications")

