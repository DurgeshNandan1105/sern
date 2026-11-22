from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.accident import Accident
from app.schemas.accident import (
    AccidentCreate,
    AccidentValidationRequest,
    AccidentResponse
)
from app.schemas.emergency import EmergencyResponse
from app.services.accident_service import AccidentService
from app.services.ml_service import ml_service, MLServiceError

router = APIRouter(prefix="/accidents", tags=["Accidents"])


def _to_accident_response(accident: Accident) -> AccidentResponse:
    emergency_id = accident.emergency.id if accident.emergency else None
    return AccidentResponse(
        id=accident.id,
        latitude=accident.latitude,
        longitude=accident.longitude,
        timestamp=accident.timestamp,
        vehicle_size=accident.vehicle_size,
        gyro_is_hd=accident.gyro_is_hd,
        accident_prediction=accident.accident_prediction,
        accident_probability=accident.accident_probability,
        model_threshold=accident.model_threshold,
        validation_status=accident.validation_status,
        validation_notes=accident.validation_notes,
        created_at=accident.created_at,
        emergency_id=emergency_id,
        sensor_data=accident.sensor_data
    )


@router.post("", response_model=AccidentResponse, status_code=status.HTTP_201_CREATED)
def register_accident(
    payload: AccidentCreate,
    db: Session = Depends(get_db)
):
    """
    Register vehicle sensor readings and coordinates.
    Invokes ML prediction model. A positive prediction requires explicit confirmation
    before emergency dispatch is triggered. Normal prediction will not trigger dispatch.
    """
    try:
        accident = AccidentService.register_accident(db=db, accident_in=payload, ml_svc=ml_service)
        return _to_accident_response(accident)
    except MLServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Machine Learning prediction failed: {str(exc)}"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to register accident: {str(exc)}"
        )


@router.get("", response_model=List[AccidentResponse])
def list_accidents(
    validation_status: Optional[str] = Query(None, description="Filter by validation status"),
    detected_only: Optional[bool] = Query(None, description="Filter only events where accident was predicted"),
    db: Session = Depends(get_db)
):
    """Retrieve accident candidates with optional filters."""
    query = db.query(Accident)
    if validation_status:
        query = query.filter(Accident.validation_status == validation_status.upper())
    if detected_only is not None:
        query = query.filter(Accident.accident_prediction == detected_only)
    accidents = query.order_by(Accident.id.desc()).all()
    return [_to_accident_response(acc) for acc in accidents]


@router.get("/{accident_id}", response_model=AccidentResponse)
def get_accident(accident_id: int, db: Session = Depends(get_db)):
    """Retrieve details for a specific accident by ID."""
    accident = db.query(Accident).filter(Accident.id == accident_id).first()
    if not accident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Accident with ID {accident_id} not found."
        )
    return _to_accident_response(accident)


@router.post("/{accident_id}/validate")
def validate_accident(
    accident_id: int,
    payload: AccidentValidationRequest,
    db: Session = Depends(get_db)
):
    """
    Explicit validation/confirmation endpoint for an accident candidate.
    - If confirmed: status becomes VALIDATED and an Emergency record is created.
      Duplicate emergency creation is strictly prevented.
    - If not confirmed: status becomes REJECTED.
    """
    try:
        accident, emergency = AccidentService.validate_accident(
            db=db,
            accident_id=accident_id,
            val_req=payload
        )
        return {
            "accident": _to_accident_response(accident),
            "emergency": EmergencyResponse.model_validate(emergency) if emergency else None,
            "message": "Accident validated and emergency created." if payload.confirmed else "Accident marked as rejected / false alarm."
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

