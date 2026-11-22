import logging
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.ambulance import Ambulance
from app.models.emergency import Emergency
from app.models.assignment import Assignment
from app.models.accident import Accident
from app.utils.distance import haversine_distance
from app.services.notification_service import NotificationService

logger = logging.getLogger("sern.dispatch")


class NoAmbulanceAvailableError(Exception):
    """Raised when no eligible available ambulance can be found."""
    pass


class DispatchService:
    """
    Ambulance dispatch service implementing geographic nearest-ambulance selection.

    IMPORTANT:
    This service performs straight-line geographic Haversine distance selection.
    Road-network route optimization, OSMnx calculations, congestion, and green corridor
    simulations belong exclusively to Member 4's module.
    """

    @staticmethod
    def find_nearest_available_ambulance(
        db: Session,
        target_lat: float,
        target_lon: float
    ) -> Tuple[Optional[Ambulance], Optional[float]]:
        """
        Find the nearest ambulance with status == 'AVAILABLE'.
        Uses Haversine distance formula.
        """
        available_ambulances = (
            db.query(Ambulance)
            .filter(Ambulance.status == "AVAILABLE")
            .all()
        )

        if not available_ambulances:
            return None, None

        nearest_amb = None
        min_dist = float("inf")

        for amb in available_ambulances:
            dist = haversine_distance(target_lat, target_lon, amb.latitude, amb.longitude)
            if dist < min_dist:
                min_dist = dist
                nearest_amb = amb

        return nearest_amb, min_dist

    @classmethod
    def dispatch_for_emergency(
        cls,
        db: Session,
        emergency_id: int
    ) -> Tuple[Emergency, Ambulance, Assignment, float]:
        """
        Dispatches the nearest available ambulance to an emergency.

        Guarantees:
        - Prevents double-assignment (checks availability status and active assignments).
        - Handles no available ambulance gracefully.
        - Records assignment and dispatches simulated notification.
        """
        emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            raise ValueError(f"Emergency with ID {emergency_id} does not exist.")

        if emergency.status in {"COMPLETED", "CANCELLED"}:
            raise ValueError(f"Cannot dispatch for emergency with terminal status '{emergency.status}'.")

        if emergency.assigned_ambulance_id is not None:
            raise ValueError(
                f"Emergency {emergency_id} already has assigned ambulance {emergency.assigned_ambulance_id}."
            )

        accident = db.query(Accident).filter(Accident.id == emergency.accident_id).first()
        if not accident:
            raise ValueError(f"Accident reference {emergency.accident_id} not found.")

        # Find nearest available ambulance
        nearest_amb, distance_km = cls.find_nearest_available_ambulance(
            db, accident.latitude, accident.longitude
        )

        if nearest_amb is None:
            logger.warning("No available ambulance found for emergency %s", emergency_id)
            raise NoAmbulanceAvailableError("No available ambulances found in the network.")

        # Double check ambulance is not active in another assignment
        active_assignment = (
            db.query(Assignment)
            .filter(Assignment.ambulance_id == nearest_amb.id, Assignment.status == "ACTIVE")
            .first()
        )
        if active_assignment:
            raise ValueError(f"Ambulance {nearest_amb.registration_number} already has an active assignment.")

        # Perform atomic assignment
        nearest_amb.status = "ASSIGNED"
        emergency.assigned_ambulance_id = nearest_amb.id
        emergency.status = "DISPATCHED"

        assignment = Assignment(
            emergency_id=emergency.id,
            ambulance_id=nearest_amb.id,
            status="ACTIVE"
        )
        db.add(assignment)

        # Record simulated dispatch notification
        NotificationService.record_notification(
            db=db,
            recipient=f"Ambulance {nearest_amb.registration_number}",
            notification_type="DISPATCH_NOTICE",
            message=f"Dispatched to emergency #{emergency.id} at ({accident.latitude:.5f}, {accident.longitude:.5f}). Distance: {distance_km:.2f} km.",
            emergency_id=emergency.id
        )

        db.commit()
        db.refresh(emergency)
        db.refresh(nearest_amb)
        db.refresh(assignment)

        logger.info(
            "Dispatched ambulance %s (ID %s) to emergency %s (Distance: %.2f km)",
            nearest_amb.registration_number, nearest_amb.id, emergency.id, distance_km
        )

        return emergency, nearest_amb, assignment, distance_km

