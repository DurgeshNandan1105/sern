from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.notification import Notification
from app.schemas.notification import (
    NotificationCreate,
    NotificationResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.post("", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
def create_notification(payload: NotificationCreate, db: Session = Depends(get_db)):
    """
    Record a simulated notification event.
    NOTE: All notifications are recorded as simulated for hospital/contact coordination.
    """
    notification = NotificationService.record_notification(
        db=db,
        recipient=payload.recipient,
        notification_type=payload.notification_type,
        message=payload.message,
        emergency_id=payload.emergency_id,
        hospital_id=payload.hospital_id
    )
    return notification


@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    emergency_id: Optional[int] = Query(None, description="Filter by associated emergency"),
    db: Session = Depends(get_db)
):
    """List notification events with optional emergency filter."""
    query = db.query(Notification)
    if emergency_id is not None:
        query = query.filter(Notification.emergency_id == emergency_id)
    return query.order_by(Notification.id.desc()).all()


@router.get("/{notification_id}", response_model=NotificationResponse)
def get_notification(notification_id: int, db: Session = Depends(get_db)):
    """Retrieve notification event details by ID."""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification with ID {notification_id} not found."
        )
    return notification

