import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.notification import Notification

logger = logging.getLogger("sern.notifications")


class NotificationService:
    """
    Service for recording and tracking simulated notification events.

    NOTE: All notifications generated in this MVP are simulated events.
    No actual SMS, push, or cellular emergency calls are transmitted.
    This provides an interface for Member 5's hospital dashboard and
    emergency coordination workflows.
    """

    @staticmethod
    def record_notification(
        db: Session,
        recipient: str,
        notification_type: str,
        message: str,
        emergency_id: Optional[int] = None,
        hospital_id: Optional[int] = None
    ) -> Notification:
        notification = Notification(
            emergency_id=emergency_id,
            hospital_id=hospital_id,
            recipient=recipient,
            notification_type=notification_type,
            message=message,
            delivery_status="SIMULATED_DELIVERED",
            is_simulated=True
        )
        db.add(notification)

        logger.info(
            "[SIMULATED NOTIFICATION] Type: %s | Recipient: %s | Emergency: %s | Message: %s",
            notification_type, recipient, emergency_id, message
        )
        return notification

    @staticmethod
    def get_notifications_for_emergency(db: Session, emergency_id: int) -> List[Notification]:
        return db.query(Notification).filter(Notification.emergency_id == emergency_id).all()

