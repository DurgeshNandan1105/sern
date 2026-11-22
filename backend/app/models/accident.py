from datetime import datetime
from sqlalchemy import Column, Integer, Float, Boolean, DateTime, String, JSON, Text
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class Accident(Base):
    __tablename__ = "accidents"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=utc_now, nullable=False)
    sensor_data = Column(JSON, nullable=False)
    vehicle_size = Column(String(50), nullable=True, default="Unknown")
    gyro_is_hd = Column(Boolean, default=False, nullable=False)

    accident_prediction = Column(Boolean, nullable=False)
    accident_probability = Column(Float, nullable=False)
    model_threshold = Column(Float, nullable=False)

    # Statuses: PENDING, VALIDATED, REJECTED, FALSE_ALARM, NORMAL
    validation_status = Column(String(50), nullable=False, default="PENDING")
    validation_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=utc_now, nullable=False)

    # 1:1 relationship with Emergency
    emergency = relationship("Emergency", back_populates="accident", uselist=False)

