from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.emergency import Emergency
from app.schemas.emergency import (
    EmergencyResponse,
    EmergencyStatusUpdate,
    EmergencyDispatchResponse,
    AssignmentResponse,
    EmergencyHospitalAssign,
)
from app.schemas.ambulance import AmbulanceResponse
from app.services.dispatch_service import DispatchService, NoAmbulanceAvailableError
from app.services.emergency_service import EmergencyService
from app.services.websocket_manager import ws_manager
from app.routes.auth import require_roles

router = APIRouter(prefix="/emergencies", tags=["Emergencies"])


@router.get("", response_model=List[EmergencyResponse])
def list_emergencies(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    db: Session = Depends(get_db)
):
    """List all emergency cases."""
    query = db.query(Emergency)
    if status_filter:
        query = query.filter(Emergency.status == status_filter.upper())
    return query.order_by(Emergency.id.desc()).all()


@router.get("/{emergency_id}", response_model=EmergencyResponse)
def get_emergency(emergency_id: int, db: Session = Depends(get_db)):
    """Retrieve an emergency by ID."""
    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Emergency with ID {emergency_id} not found."
        )
    return emergency


@router.patch("/{emergency_id}/status", response_model=EmergencyResponse)
def update_emergency_status(
    emergency_id: int,
    payload: EmergencyStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Explicitly update emergency status (e.g. EN_ROUTE, AT_SCENE, TRANSPORTING, COMPLETED, CANCELLED).
    Arrival-related statuses are updated only when explicit status updates are received.
    """
    try:
        updated = EmergencyService.update_status(
            db=db,
            emergency_id=emergency_id,
            new_status=payload.status,
            notes=payload.notes
        )
        resp = EmergencyResponse.model_validate(updated)
        ws_manager.broadcast_sync("EMERGENCY_STATUS_UPDATED", resp.model_dump())
        return resp
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{emergency_id}/route-preview")
def get_pre_dispatch_routes(emergency_id: int, db: Session = Depends(get_db)):
    """
    Calculates and compares candidate routes BEFORE dispatch:
    - Identifies accident location.
    - Identifies available ambulances and suitable hospitals.
    - Runs Dijkstra on road graph for Shortest, Fastest, and Congestion-Aware routes.
    - Returns comparison metrics with OPTIMAL ROUTE SELECTED identifier.
    """
    try:
        return DispatchService.calculate_pre_dispatch_routes(db, emergency_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{emergency_id}/dispatch", response_model=EmergencyDispatchResponse)
def dispatch_ambulance(
    emergency_id: int,
    db: Session = Depends(get_db),
    _auth: Optional[dict] = Depends(require_roles("Administrator", "Hospital Staff", "Ambulance Staff"))
):
    """
    Dispatches the nearest available ambulance to the emergency using Haversine calculation.
    Prevents assigning an already assigned ambulance.
    """
    try:
        emergency, ambulance, assignment, distance_km = DispatchService.dispatch_for_emergency(
            db=db,
            emergency_id=emergency_id
        )
        dispatch_resp = EmergencyDispatchResponse(
            emergency=EmergencyResponse.model_validate(emergency),
            assigned_ambulance=AmbulanceResponse.model_validate(ambulance),
            distance_km=distance_km,
            assignment=AssignmentResponse.model_validate(assignment),
            message=f"Ambulance {ambulance.registration_number} dispatched successfully."
        )
        ws_manager.broadcast_sync("AMBULANCE_DISPATCHED", dispatch_resp.model_dump())
        return dispatch_resp
    except NoAmbulanceAvailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc)
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


@router.post("/{emergency_id}/complete", response_model=EmergencyResponse)
def complete_emergency(emergency_id: int, db: Session = Depends(get_db)):
    """Mark an emergency as completed, freeing the assigned ambulance."""
    try:
        return EmergencyService.update_status(db, emergency_id, "COMPLETED")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{emergency_id}/cancel", response_model=EmergencyResponse)
def cancel_emergency(emergency_id: int, db: Session = Depends(get_db)):
    """Cancel an active emergency, resetting assigned ambulance availability."""
    try:
        return EmergencyService.update_status(db, emergency_id, "CANCELLED")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{emergency_id}/assign-hospital", response_model=EmergencyResponse)
def assign_hospital_to_emergency(
    emergency_id: int,
    payload: EmergencyHospitalAssign,
    db: Session = Depends(get_db)
):
    """Assign destination hospital to emergency."""
    try:
        updated = EmergencyService.assign_hospital(db, emergency_id, payload.hospital_id)
        resp = EmergencyResponse.model_validate(updated)
        ws_manager.broadcast_sync("HOSPITAL_ASSIGNED", resp.model_dump())
        return resp
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

