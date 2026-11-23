from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.routing import RouteCreate, RouteResponse
from app.services.routing_adapter import RoutingAdapterService
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/routing", tags=["Routing Integration Boundary"])


@router.post("/{emergency_id}", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
def receive_route_from_member4(
    emergency_id: int,
    payload: RouteCreate,
    db: Session = Depends(get_db)
):
    """
    Integration endpoint for Member 4's road-network routing module.
    Accepts calculated route distance, duration, and geometry for an emergency.
    """
    if payload.emergency_id != emergency_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path emergency_id ({emergency_id}) does not match body emergency_id ({payload.emergency_id})."
        )
    try:
        route = RoutingAdapterService.store_route_info(db, payload)
        resp = RouteResponse.model_validate(route)
        ws_manager.broadcast_sync("ROUTE_UPDATED", resp.model_dump())
        return resp
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{emergency_id}", response_model=RouteResponse)
def get_route_for_emergency(emergency_id: int, db: Session = Depends(get_db)):
    """Retrieve stored road-network route information for an emergency (auto-generating mock route if none exists)."""
    route = RoutingAdapterService.get_route_info(db, emergency_id)
    if not route:
        try:
            route = RoutingAdapterService.generate_dev_mock_route(db, emergency_id)
            resp = RouteResponse.model_validate(route)
            ws_manager.broadcast_sync("ROUTE_UPDATED", resp.model_dump())
            return resp
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No route information found for Emergency #{emergency_id}."
            )
    return route


@router.post("/{emergency_id}/mock", response_model=RouteResponse)
def generate_mock_route_endpoint(emergency_id: int, db: Session = Depends(get_db)):
    """
    Development endpoint to store a simulated mock route for an emergency.
    Used for isolated backend tests and integration readiness verification.
    """
    try:
        route = RoutingAdapterService.generate_dev_mock_route(db, emergency_id)
        resp = RouteResponse.model_validate(route)
        ws_manager.broadcast_sync("ROUTE_UPDATED", resp.model_dump())
        return resp
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

