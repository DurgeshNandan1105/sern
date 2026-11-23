from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.ambulance import Ambulance
from app.models.assignment import Assignment
from app.schemas.ambulance import (
    AmbulanceCreate,
    AmbulanceUpdate,
    AmbulanceLocationUpdate,
    AmbulanceAvailabilityUpdate,
    AmbulanceTelemetry,
    AmbulanceResponse,
)
from app.utils.datetime_utils import utc_now
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/ambulances", tags=["Ambulances"])


@router.post("", response_model=AmbulanceResponse, status_code=status.HTTP_201_CREATED)
def register_ambulance(payload: AmbulanceCreate, db: Session = Depends(get_db)):
    """Register a new ambulance unit."""
    existing = db.query(Ambulance).filter(Ambulance.registration_number == payload.registration_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ambulance with registration '{payload.registration_number}' already exists."
        )

    ambulance = Ambulance(
        registration_number=payload.registration_number,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status=payload.status or "AVAILABLE"
    )
    db.add(ambulance)
    db.commit()
    db.refresh(ambulance)
    return ambulance


@router.get("", response_model=List[AmbulanceResponse])
def list_ambulances(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by ambulance status"),
    db: Session = Depends(get_db)
):
    """Retrieve all ambulances, optionally filtered by status."""
    query = db.query(Ambulance)
    if status_filter:
        query = query.filter(Ambulance.status == status_filter.upper())
    return query.order_by(Ambulance.id.asc()).all()


@router.get("/{ambulance_id}", response_model=AmbulanceResponse)
def get_ambulance(ambulance_id: int, db: Session = Depends(get_db)):
    """Retrieve ambulance details by ID."""
    ambulance = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not ambulance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ambulance with ID {ambulance_id} not found."
        )
    return ambulance


def _has_active_assignment(db: Session, ambulance_id: int) -> bool:
    """Check if ambulance is currently linked to an ongoing active assignment."""
    return (
        db.query(Assignment)
        .filter(Assignment.ambulance_id == ambulance_id, Assignment.status == "ACTIVE")
        .first()
        is not None
    )


@router.patch("/{ambulance_id}", response_model=AmbulanceResponse)
def update_ambulance(
    ambulance_id: int,
    payload: AmbulanceUpdate,
    db: Session = Depends(get_db)
):
    """Update general ambulance attributes."""
    ambulance = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not ambulance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ambulance with ID {ambulance_id} not found."
        )

    if payload.registration_number is not None and payload.registration_number != ambulance.registration_number:
        existing = db.query(Ambulance).filter(Ambulance.registration_number == payload.registration_number).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ambulance with registration '{payload.registration_number}' already exists."
            )
        ambulance.registration_number = payload.registration_number

    if payload.latitude is not None:
        ambulance.latitude = payload.latitude
    if payload.longitude is not None:
        ambulance.longitude = payload.longitude
    if payload.status is not None and payload.status != ambulance.status:
        if _has_active_assignment(db, ambulance_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot change status for ambulance '{ambulance.registration_number}' while it has an active assignment."
            )
        ambulance.status = payload.status

    ambulance.last_updated = utc_now()
    db.commit()
    db.refresh(ambulance)
    return ambulance


@router.patch("/{ambulance_id}/location", response_model=AmbulanceResponse)
def update_ambulance_location(
    ambulance_id: int,
    payload: AmbulanceLocationUpdate,
    db: Session = Depends(get_db)
):
    """Update geographic coordinates for an ambulance."""
    ambulance = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not ambulance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ambulance with ID {ambulance_id} not found."
        )

    ambulance.latitude = payload.latitude
    ambulance.longitude = payload.longitude
    ambulance.last_updated = utc_now()
    db.commit()
    db.refresh(ambulance)
    resp = AmbulanceResponse.model_validate(ambulance)
    ws_manager.broadcast_sync("AMBULANCE_LOCATION_UPDATED", resp.model_dump())
    return resp


@router.patch("/{ambulance_id}/availability", response_model=AmbulanceResponse)
def update_ambulance_availability(
    ambulance_id: int,
    payload: AmbulanceAvailabilityUpdate,
    db: Session = Depends(get_db)
):
    """Set ambulance availability to AVAILABLE or UNAVAILABLE."""
    ambulance = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not ambulance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ambulance with ID {ambulance_id} not found."
        )

    if payload.status != ambulance.status:
        if _has_active_assignment(db, ambulance_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot change availability for ambulance '{ambulance.registration_number}' while it has an active assignment."
            )
        ambulance.status = payload.status

    ambulance.last_updated = utc_now()
    db.commit()
    db.refresh(ambulance)
    return ambulance


@router.post("/{ambulance_id}/telemetry", response_model=AmbulanceResponse)
def stream_ambulance_telemetry(
    ambulance_id: int,
    payload: AmbulanceTelemetry,
    db: Session = Depends(get_db)
):
    """
    Ingest live GPS telemetry stream from the on-board ambulance unit.
    Broadcasts real-time position, velocity, heading, and ETA countdown
    to all active dispatch monitors over WebSockets with zero latency.
    """
    ambulance = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not ambulance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ambulance with ID {ambulance_id} not found."
        )

    ambulance.latitude = payload.latitude
    ambulance.longitude = payload.longitude
    if payload.status and payload.status in {"AVAILABLE", "ASSIGNED", "EN_ROUTE", "AT_SCENE", "TRANSPORTING", "UNAVAILABLE"}:
        ambulance.status = payload.status
    ambulance.last_updated = utc_now()
    db.commit()
    db.refresh(ambulance)

    telemetry_data = {
        "id": ambulance.id,
        "registration_number": ambulance.registration_number,
        "latitude": ambulance.latitude,
        "longitude": ambulance.longitude,
        "status": ambulance.status,
        "speed_kmh": payload.speed_kmh,
        "heading_deg": payload.heading_deg,
        "distance_remaining_km": payload.distance_remaining_km,
        "eta_seconds": payload.eta_seconds,
        "timestamp": ambulance.last_updated.isoformat()
    }

    # Broadcast both telemetry and general location update
    ws_manager.broadcast_sync("AMBULANCE_TELEMETRY", telemetry_data)
    ws_manager.broadcast_sync("AMBULANCE_LOCATION_UPDATED", AmbulanceResponse.model_validate(ambulance).model_dump())

    return ambulance

