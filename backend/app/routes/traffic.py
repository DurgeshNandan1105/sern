from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.emergency import Emergency
from app.models.accident import Accident
from app.models.ambulance import Ambulance
from app.services.traffic_service import TrafficService
from app.services.routing_adapter import RoutingAdapterService
from app.schemas.routing import RouteCreate, RouteResponse
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/traffic", tags=["Traffic & Smart Signal Prioritization"])


class PreemptionRequest(BaseModel):
    intersection_id: Optional[str] = None
    emergency_id: Optional[int] = None
    action: str = Field(default="TOGGLE", description="TOGGLE, ACTIVATE, CLEAR")


class CongestionUpdateRequest(BaseModel):
    intersection_id: str
    congestion_index: int = Field(..., ge=0, le=100)
    recalculate_active_routes: bool = True


@router.get("/intersections")
def get_intersections():
    """Retrieve real-time status, signals, countdowns, and congestion for all monitored intersections."""
    return TrafficService.get_all_intersections()


@router.get("/corridors")
def get_active_corridors():
    """Retrieve active emergency green corridors and prioritized signals."""
    return TrafficService.get_active_corridors()


@router.post("/preempt")
def manage_signal_preemption(payload: PreemptionRequest):
    """
    Manually or automatically prioritize traffic signals for emergency response.
    Locks signal to GREEN_PREEMPTION, clearing green corridors for ambulances.
    """
    if payload.emergency_id:
        if payload.action.upper() == "CLEAR":
            TrafficService.clear_green_corridor(payload.emergency_id)
            return {"status": "cleared", "emergency_id": payload.emergency_id}
        else:
            intersections = TrafficService.get_all_intersections()
            int_ids = [item["id"] for item in intersections[:4]]
            corridor = TrafficService.activate_green_corridor_for_emergency(payload.emergency_id, int_ids)
            return corridor
    elif payload.intersection_id:
        try:
            node = TrafficService.toggle_signal_preemption(payload.intersection_id)
            return node
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either intersection_id or emergency_id must be provided."
        )


@router.post("/congestion")
def update_traffic_congestion(payload: CongestionUpdateRequest, db: Session = Depends(get_db)):
    """
    Simulate or update congestion levels on road network corridors.
    When congestion increases, automatically evaluates and re-optimizes routes.
    """
    try:
        updated_node = TrafficService.update_congestion(payload.intersection_id, payload.congestion_index)

        # If recalculate requested, check active emergencies
        recalculated_routes = []
        if payload.recalculate_active_routes:
            active_emergencies = db.query(Emergency).filter(
                Emergency.status.in_(["DISPATCHED", "ASSIGNED", "EN_ROUTE"])
            ).all()

            for em in active_emergencies:
                acc = db.query(Accident).filter(Accident.id == em.accident_id).first()
                amb = db.query(Ambulance).filter(Ambulance.id == em.assigned_ambulance_id).first()
                if acc and amb:
                    calc = TrafficService.calculate_road_network_route(
                        origin_lat=amb.latitude,
                        origin_lon=amb.longitude,
                        dest_lat=acc.latitude,
                        dest_lon=acc.longitude,
                        emergency_id=em.id,
                        avoid_congestion=True
                    )
                    route_payload = RouteCreate(
                        emergency_id=em.id,
                        distance_km=calc["distance_km"],
                        estimated_duration_minutes=calc["estimated_duration_minutes"],
                        route_geometry=calc["route_geometry"],
                        source="SERN_DYNAMIC_REROUTING_ENGINE"
                    )
                    stored = RoutingAdapterService.store_route_info(db, route_payload)
                    resp = RouteResponse.model_validate(stored)
                    ws_manager.broadcast_sync("ROUTE_UPDATED", resp.model_dump())
                    recalculated_routes.append(resp.model_dump())

        return {
            "node": updated_node,
            "recalculated_routes_count": len(recalculated_routes),
            "recalculated_routes": recalculated_routes
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/recalculate/{emergency_id}", response_model=RouteResponse)
def recalculate_route(emergency_id: int, avoid_congestion: bool = True, db: Session = Depends(get_db)):
    """
    Recalculates road-network route for an active emergency considering current congestion.
    """
    em = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not em:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Emergency #{emergency_id} not found.")

    acc = db.query(Accident).filter(Accident.id == em.accident_id).first()
    amb = db.query(Ambulance).filter(Ambulance.id == em.assigned_ambulance_id).first()

    origin_lat, origin_lon = (amb.latitude, amb.longitude) if amb else (12.9750, 77.6050)
    dest_lat, dest_lon = (acc.latitude, acc.longitude) if acc else (12.9716, 77.5946)

    calc = TrafficService.calculate_road_network_route(
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        emergency_id=emergency_id,
        avoid_congestion=avoid_congestion
    )

    route_payload = RouteCreate(
        emergency_id=emergency_id,
        distance_km=calc["distance_km"],
        estimated_duration_minutes=calc["estimated_duration_minutes"],
        route_geometry=calc["route_geometry"],
        source="SERN_OSM_ROAD_NETWORK_ROUTER"
    )
    stored = RoutingAdapterService.store_route_info(db, route_payload)
    resp = RouteResponse.model_validate(stored)
    ws_manager.broadcast_sync("ROUTE_UPDATED", resp.model_dump())
    return resp


@router.post("/reset")
def reset_traffic_signals():
    """Resets all traffic signals to standard cycle and clears all green corridors."""
    for node in TrafficService.get_all_intersections():
        node["signal_state"] = "NORMAL_CYCLE"
        node["green_corridor_active"] = False
        node["preempted_for_emergency_id"] = None
        node["countdown_seconds"] = 30
    TrafficService._active_corridors.clear()
    ws_manager.broadcast_sync("TRAFFIC_SIGNAL_UPDATED", {
        "intersections": TrafficService.get_all_intersections(),
        "status": "ALL_SIGNALS_RESET"
    })
    return {"status": "success", "message": "All signals reset to normal cycles."}
