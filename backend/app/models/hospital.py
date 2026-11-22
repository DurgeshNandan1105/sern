from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    address = Column(String(500), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    contact_information = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    emergencies = relationship("Emergency", back_populates="hospital")

