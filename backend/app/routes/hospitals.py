from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.hospital import Hospital
from app.schemas.hospital import (
    HospitalCreate,
    HospitalUpdate,
    HospitalResponse,
)

router = APIRouter(prefix="/hospitals", tags=["Hospitals"])


@router.post("", response_model=HospitalResponse, status_code=status.HTTP_201_CREATED)
def register_hospital(payload: HospitalCreate, db: Session = Depends(get_db)):
    """Register hospital information."""
    hospital = Hospital(
        name=payload.name,
        address=payload.address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        contact_information=payload.contact_information,
        is_active=payload.is_active
    )
    db.add(hospital)
    db.commit()
    db.refresh(hospital)
    return hospital


@router.get("", response_model=List[HospitalResponse])
def list_hospitals(
    active_only: bool = Query(True, description="Filter only active hospitals"),
    db: Session = Depends(get_db)
):
    """List registered hospitals."""
    query = db.query(Hospital)
    if active_only:
        query = query.filter(Hospital.is_active == True)
    return query.order_by(Hospital.id.asc()).all()


@router.get("/{hospital_id}", response_model=HospitalResponse)
def get_hospital(hospital_id: int, db: Session = Depends(get_db)):
    """Retrieve hospital details by ID."""
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Hospital with ID {hospital_id} not found."
        )
    return hospital


@router.patch("/{hospital_id}", response_model=HospitalResponse)
def update_hospital(
    hospital_id: int,
    payload: HospitalUpdate,
    db: Session = Depends(get_db)
):
    """Update hospital information."""
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Hospital with ID {hospital_id} not found."
        )

    if payload.name is not None:
        hospital.name = payload.name
    if payload.address is not None:
        hospital.address = payload.address
    if payload.latitude is not None:
        hospital.latitude = payload.latitude
    if payload.longitude is not None:
        hospital.longitude = payload.longitude
    if payload.contact_information is not None:
        hospital.contact_information = payload.contact_information
    if payload.is_active is not None:
        hospital.is_active = payload.is_active

    db.commit()
    db.refresh(hospital)
    return hospital

