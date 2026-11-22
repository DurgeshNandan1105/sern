from datetime import datetime
import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.emergency import Emergency
from app.models.ambulance import Ambulance
from app.models.assignment import Assignment
from app.models.hospital import Hospital
from app.services.notification_service import NotificationService
from app.utils.datetime_utils import utc_now

logger = logging.getLogger("sern.emergencies")

# Valid lifecycle state transitions for an emergency
PERMITTED_EMERGENCY_TRANSITIONS = {
    "PENDING": {"DISPATCHED", "CANCELLED"},
    "DISPATCHED": {"EN_ROUTE", "CANCELLED"},
    "EN_ROUTE": {"AT_SCENE", "CANCELLED"},
    "AT_SCENE": {"TRANSPORTING", "COMPLETED", "CANCELLED"},
    "TRANSPORTING": {"COMPLETED", "CANCELLED"},
    "COMPLETED": set(),
    "CANCELLED": set()
}


class EmergencyService:
    """Service managing emergency lifecycles and assignment synchronization."""

    @staticmethod
    def update_status(
        db: Session,
        emergency_id: int,
        new_status: str,
        notes: Optional[str] = None
    ) -> Emergency:
        emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            raise ValueError(f"Emergency with ID {emergency_id} does not exist.")

        new_status_upper = new_status.upper()
        old_status = emergency.status

        # Validate lifecycle transition rules if status is changing
        if new_status_upper != old_status:
            allowed = PERMITTED_EMERGENCY_TRANSITIONS.get(old_status, set())
            if new_status_upper not in allowed:
                raise ValueError(
                    f"Invalid emergency status transition from '{old_status}' to '{new_status_upper}'."
                )

        emergency.status = new_status_upper
        emergency.updated_at = utc_now()

        # Synchronize ambulance and assignment statuses
        if new_status_upper == "COMPLETED":
            emergency.completion_timestamp = utc_now()
            # Mark active assignments as COMPLETED
            for assignment in emergency.assignments:
                if assignment.status == "ACTIVE":
                    assignment.status = "COMPLETED"

            # Free assigned ambulance back to AVAILABLE
            if emergency.assigned_ambulance:
                emergency.assigned_ambulance.status = "AVAILABLE"
                emergency.assigned_ambulance.last_updated = utc_now()

        elif new_status_upper == "CANCELLED":
            emergency.completion_timestamp = utc_now()
            for assignment in emergency.assignments:
                if assignment.status == "ACTIVE":
                    assignment.status = "CANCELLED"

            if emergency.assigned_ambulance:
                emergency.assigned_ambulance.status = "AVAILABLE"
                emergency.assigned_ambulance.last_updated = utc_now()

        elif new_status_upper in {"EN_ROUTE", "AT_SCENE", "TRANSPORTING"}:
            # Reflect operational stage on assigned ambulance
            if emergency.assigned_ambulance:
                emergency.assigned_ambulance.status = new_status_upper
                emergency.assigned_ambulance.last_updated = utc_now()

        db.commit()
        db.refresh(emergency)

        logger.info(
            "Emergency #%s transitioned from %s to %s. Notes: %s",
            emergency.id, old_status, new_status_upper, notes
        )
        return emergency

    @staticmethod
    def assign_hospital(db: Session, emergency_id: int, hospital_id: int) -> Emergency:
        emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            raise ValueError(f"Emergency #{emergency_id} not found.")

        hospital = db.query(Hospital).filter(Hospital.id == hospital_id, Hospital.is_active == True).first()
        if not hospital:
            raise ValueError(f"Active hospital #{hospital_id} not found.")

        emergency.hospital_id = hospital.id
        emergency.updated_at = utc_now()

        # Send simulated notification to hospital
        NotificationService.record_notification(
            db=db,
            recipient=hospital.name,
            hospital_id=hospital.id,
            emergency_id=emergency.id,
            notification_type="HOSPITAL_ALERT",
            message=f"Incoming patient assigned for Emergency #{emergency.id}. Hospital: {hospital.name}."
        )

        db.commit()
        db.refresh(emergency)
        return emergency

