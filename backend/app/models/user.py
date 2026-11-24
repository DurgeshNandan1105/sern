from sqlalchemy import Column, Integer, String, DateTime
from app.database.base import Base
from app.utils.datetime_utils import utc_now


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="Ambulance Staff")
    credential_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
