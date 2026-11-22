from datetime import datetime
import logging
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.accident import Accident
from app.models.emergency import Emergency
from app.schemas.accident import AccidentCreate, AccidentValidationRequest
from app.services.ml_service import MLService, MLServiceError
from app.services.dispatch_service import DispatchService
from app.config import settings
from app.utils.datetime_utils import utc_now

logger = logging.getLogger("sern.accidents")


class AccidentService:
    """Service handling accident ingestion, ML prediction evaluation, and validation."""

    @staticmethod
    def register_accident(
        db: Session,
        accident_in: AccidentCreate,
        ml_svc: MLService
    ) -> Accident:
        sensor_dict = {
            "gsensor": accident_in.sensor_data.gsensor,
            "gyro": accident_in.sensor_data.gyro,
            "gps_speed": accident_in.sensor_data.gps_speed,
            "vehiclesize": accident_in.sensor_data.vehiclesize,
            "gyro_is_hd": accident_in.sensor_data.gyro_is_hd
        }

        # Invoke ML model adapter
        prediction_result = ml_svc.predict(sensor_dict)

        accident_detected = prediction_result["accident_detected"]
        accident_probability = prediction_result["accident_probability"]
        threshold = prediction_result["threshold"]

        # Initial validation status:
        # If model predicted accident -> PENDING (requires explicit confirmation)
        # If model predicted no accident -> NORMAL (no emergency created)
        validation_status = "PENDING" if accident_detected else "NORMAL"

        accident = Accident(
            latitude=accident_in.latitude,
            longitude=accident_in.longitude,
            timestamp=accident_in.timestamp or utc_now(),
            sensor_data=sensor_dict,
            vehicle_size=accident_in.sensor_data.vehiclesize,
            gyro_is_hd=accident_in.sensor_data.gyro_is_hd,
            accident_prediction=accident_detected,
            accident_probability=accident_probability,
            model_threshold=threshold,
            validation_status=validation_status
        )

        db.add(accident)
        db.commit()
        db.refresh(accident)

        logger.info(
            "Registered accident candidate ID %s. Detected: %s (Prob: %.4f, Thresh: %.4f, Status: %s)",
            accident.id, accident_detected, accident_probability, threshold, validation_status
        )

        return accident

    @staticmethod
    def validate_accident(
        db: Session,
        accident_id: int,
        val_req: AccidentValidationRequest
    ) -> Tuple[Accident, Optional[Emergency]]:
        """
        Explicit confirmation/validation mechanism.
        Safeguard: A normal prediction does not trigger emergency creation.
        A validated accident creates an Emergency, strictly preventing duplicates.
        """
        accident = db.query(Accident).filter(Accident.id == accident_id).first()
        if not accident:
            raise ValueError(f"Accident with ID {accident_id} not found.")

        emergency = None

        if val_req.confirmed:
            accident.validation_status = "VALIDATED"
            accident.validation_notes = val_req.validation_notes

            # Check if emergency already exists for this accident
            emergency = db.query(Emergency).filter(Emergency.accident_id == accident.id).first()
            if not emergency:
                emergency = Emergency(
                    accident_id=accident.id,
                    status="PENDING"
                )
                db.add(emergency)
                db.commit()
                db.refresh(emergency)
                logger.info("Created new Emergency #%s for validated accident #%s", emergency.id, accident.id)
            else:
                logger.info("Emergency #%s already exists for accident #%s (duplicate prevented)", emergency.id, accident.id)

            # Auto dispatch if configured or requested
            should_dispatch = val_req.auto_dispatch if val_req.auto_dispatch is not None else settings.AUTO_DISPATCH_ON_VALIDATION
            if should_dispatch and emergency and emergency.status == "PENDING":
                try:
                    DispatchService.dispatch_for_emergency(db, emergency.id)
                    db.refresh(emergency)
                except Exception as exc:
                    logger.warning("Auto-dispatch on validation failed: %s", exc)

        else:
            accident.validation_status = "REJECTED"
            accident.validation_notes = val_req.validation_notes or "Marked as false alarm / rejected."

            # If an existing emergency was pending, cancel it
            existing_emergency = db.query(Emergency).filter(Emergency.accident_id == accident.id).first()
            if existing_emergency and existing_emergency.status == "PENDING":
                existing_emergency.status = "CANCELLED"
                db.add(existing_emergency)

        db.commit()
        db.refresh(accident)
        if emergency:
            db.refresh(emergency)

        return accident, emergency

