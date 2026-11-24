import logging
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models.ambulance import Ambulance
from app.models.emergency import Emergency
from app.models.assignment import Assignment
from app.models.accident import Accident
from app.models.hospital import Hospital
from app.models.route import RouteInfo
from app.utils.distance import haversine_distance
from app.services.notification_service import NotificationService
from app.services.traffic_service import TrafficService
from app.services.websocket_manager import ws_manager
from app.utils.datetime_utils import utc_now

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

    CONCURRENCY & TRANSACTION NOTE:
    Selection and assignment use atomic SQL update checks (conditional WHERE criteria)
    to prevent double-assignment of ambulances or dual-dispatch of emergencies.
    Note that SQLite operates using file-level locks rather than fine-grained row-level
    locking; for high-concurrency production deployments, an RDBMS such as PostgreSQL
    or MySQL with SELECT FOR UPDATE should be configured.
    """

    @staticmethod
    def find_nearest_available_ambulance(
        db: Session,
        target_lat: float,
        target_lon: float
    ) -> Tuple[Optional[Ambulance], Optional[float]]:
        """
        Find the nearest ambulance with status == 'AVAILABLE'.
        Uses PostGIS sub-millisecond geographic indexing if PostgreSQL is active,
        with seamless fallback to high-precision Haversine distance.
        """
        from app.services.spatial_service import SpatialService
        return SpatialService.find_nearest_ambulance(db, target_lat, target_lon)

    @classmethod
    def calculate_pre_dispatch_routes(
        cls,
        db: Session,
        emergency_id: int
    ) -> Dict[str, Any]:
        """
        Calculates and compares candidate routes BEFORE dispatching:
        - Identifies accident location.
        - Identifies available ambulances and their current locations.
        - Identifies nearby hospitals and evaluates suitability.
        - Calculates Shortest, Fastest, and Congestion-Aware routes using Dijkstra.
        - Compares routes and selects optimal route.
        """
        emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            raise ValueError(f"Emergency with ID {emergency_id} does not exist.")

        accident = db.query(Accident).filter(Accident.id == emergency.accident_id).first()
        if not accident:
            raise ValueError(f"Accident reference {emergency.accident_id} not found.")

        # 1. Identify available ambulances and locations
        available_ambulances = db.query(Ambulance).filter(Ambulance.status == "AVAILABLE").all()
        nearest_amb, _ = cls.find_nearest_available_ambulance(db, accident.latitude, accident.longitude)

        # 2. Identify nearby hospitals and suitability
        hospitals = db.query(Hospital).all()
        selected_hosp = None
        if emergency.hospital_id:
            selected_hosp = db.query(Hospital).filter(Hospital.id == emergency.hospital_id).first()
        if not selected_hosp and hospitals:
            # Sort by proximity to accident scene
            selected_hosp = min(
                hospitals,
                key=lambda h: haversine_distance(accident.latitude, accident.longitude, h.latitude, h.longitude)
            )

        origin_lat = nearest_amb.latitude if nearest_amb else (accident.latitude + 0.015)
        origin_lon = nearest_amb.longitude if nearest_amb else (accident.longitude + 0.015)
        hosp_lat = selected_hosp.latitude if selected_hosp else (accident.latitude - 0.02)
        hosp_lon = selected_hosp.longitude if selected_hosp else (accident.longitude - 0.02)

        # 3. Calculate 3 routing strategies with Dijkstra
        multi_routes = TrafficService.calculate_multi_route_strategies(
            origin_lat=origin_lat,
            origin_lon=origin_lon,
            accident_lat=accident.latitude,
            accident_lon=accident.longitude,
            hospital_lat=hosp_lat,
            hospital_lon=hosp_lon,
            emergency_id=emergency_id
        )

        return {
            "emergency_id": emergency_id,
            "accident_location": {
                "latitude": accident.latitude,
                "longitude": accident.longitude,
                "vehicle_size": accident.vehicle_size
            },
            "selected_ambulance": {
                "id": nearest_amb.id if nearest_amb else None,
                "registration_number": nearest_amb.registration_number if nearest_amb else None,
                "latitude": origin_lat,
                "longitude": origin_lon
            } if nearest_amb else None,
            "selected_hospital": {
                "id": selected_hosp.id if selected_hosp else None,
                "name": selected_hosp.name if selected_hosp else None,
                "address": selected_hosp.address if selected_hosp else None,
                "latitude": hosp_lat,
                "longitude": hosp_lon
            } if selected_hosp else None,
            "routes": multi_routes["candidates"],
            "optimal_selection": {
                "strategy": multi_routes["selected_strategy"],
                "badge": multi_routes["optimal_badge"],
                "reason": multi_routes["selection_reason"],
                "distance_km": multi_routes["distance_km"],
                "estimated_duration_minutes": multi_routes["estimated_duration_minutes"]
            },
            "signals_sequence": multi_routes["route_geometry"].get("signals_sequence", [])
        }

    @classmethod
    def dispatch_for_emergency(
        cls,
        db: Session,
        emergency_id: int
    ) -> Tuple[Emergency, Ambulance, Assignment, float]:
        """
        Dispatches the optimal ambulance to an emergency:
        1. Identifies accident location.
        2. Identifies available ambulances.
        3. Identifies nearby hospitals and evaluates suitability.
        4. Calculates Shortest, Fastest, and Congestion-Aware routes using Dijkstra on road graph.
        5. Compares available routes and selects the optimal route.
        6. Assigns ambulance and destination hospital.
        7. Stores optimal route and initiates predictive green corridor.
        """
        emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
        if not emergency:
            raise ValueError(f"Emergency with ID {emergency_id} does not exist.")

        if emergency.status in {"COMPLETED", "CANCELLED"}:
            raise ValueError(f"Cannot dispatch for emergency with terminal status '{emergency.status}'.")

        if emergency.status != "PENDING" or emergency.assigned_ambulance_id is not None:
            raise ValueError(
                f"Emergency {emergency_id} is already dispatched or assigned to ambulance {emergency.assigned_ambulance_id}."
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

        # Find nearby suitable destination hospital
        hospitals = db.query(Hospital).all()
        selected_hosp = None
        if emergency.hospital_id:
            selected_hosp = db.query(Hospital).filter(Hospital.id == emergency.hospital_id).first()
        if not selected_hosp and hospitals:
            selected_hosp = min(
                hospitals,
                key=lambda h: haversine_distance(accident.latitude, accident.longitude, h.latitude, h.longitude)
            )

        hosp_lat = selected_hosp.latitude if selected_hosp else (accident.latitude - 0.02)
        hosp_lon = selected_hosp.longitude if selected_hosp else (accident.longitude - 0.02)

        # Pre-dispatch Route Optimization: Calculate all 3 strategies using Dijkstra
        multi_routes = TrafficService.calculate_multi_route_strategies(
            origin_lat=nearest_amb.latitude,
            origin_lon=nearest_amb.longitude,
            accident_lat=accident.latitude,
            accident_lon=accident.longitude,
            hospital_lat=hosp_lat,
            hospital_lon=hosp_lon,
            emergency_id=emergency.id
        )

        try:
            # Atomic update on ambulance to prevent concurrent double-assignment
            updated_amb_count = (
                db.query(Ambulance)
                .filter(Ambulance.id == nearest_amb.id, Ambulance.status == "AVAILABLE")
                .update({"status": "ASSIGNED", "last_updated": utc_now()}, synchronize_session="fetch")
            )
            if updated_amb_count == 0:
                raise NoAmbulanceAvailableError(
                    f"Ambulance {nearest_amb.registration_number} was concurrently assigned or is no longer available."
                )

            # Double check ambulance is not active in another assignment
            active_assignment = (
                db.query(Assignment)
                .filter(Assignment.ambulance_id == nearest_amb.id, Assignment.status == "ACTIVE")
                .first()
            )
            if active_assignment:
                db.rollback()
                raise ValueError(f"Ambulance {nearest_amb.registration_number} already has an active assignment.")

            # Atomic update on emergency to assign ambulance and hospital
            hospital_id_to_assign = selected_hosp.id if selected_hosp else None
            updated_em_count = (
                db.query(Emergency)
                .filter(
                    Emergency.id == emergency.id,
                    Emergency.assigned_ambulance_id.is_(None),
                    Emergency.status == "PENDING"
                )
                .update({
                    "assigned_ambulance_id": nearest_amb.id,
                    "hospital_id": hospital_id_to_assign or Emergency.hospital_id,
                    "status": "DISPATCHED",
                    "updated_at": utc_now()
                }, synchronize_session="fetch")
            )
            if updated_em_count == 0:
                db.rollback()
                raise ValueError(f"Emergency {emergency.id} is no longer eligible for dispatch.")

            assignment = Assignment(
                emergency_id=emergency.id,
                ambulance_id=nearest_amb.id,
                status="ACTIVE"
            )
            db.add(assignment)

            # Store selected optimal route against the dispatch record
            existing_route = db.query(RouteInfo).filter(RouteInfo.emergency_id == emergency.id).first()
            if existing_route:
                existing_route.distance_km = multi_routes["distance_km"]
                existing_route.estimated_duration_minutes = multi_routes["estimated_duration_minutes"]
                existing_route.route_geometry = multi_routes["route_geometry"]
                existing_route.source = "SERN_OPTIMAL_ROUTE_DISPATCH"
            else:
                new_route = RouteInfo(
                    emergency_id=emergency.id,
                    distance_km=multi_routes["distance_km"],
                    estimated_duration_minutes=multi_routes["estimated_duration_minutes"],
                    route_geometry=multi_routes["route_geometry"],
                    source="SERN_OPTIMAL_ROUTE_DISPATCH"
                )
                db.add(new_route)

            # Record simulated dispatch notification
            NotificationService.record_notification(
                db=db,
                recipient=f"Ambulance {nearest_amb.registration_number}",
                notification_type="DISPATCH_NOTICE",
                message=f"Dispatched via {multi_routes['optimal_badge']} ({multi_routes['selected_strategy']}) to emergency #{emergency.id}. Distance: {multi_routes['distance_km']} km, ETA: {multi_routes['estimated_duration_minutes']} min.",
                emergency_id=emergency.id
            )

            db.commit()
            db.refresh(emergency)
            db.refresh(nearest_amb)
            db.refresh(assignment)

            # Broadcast route update with all 3 candidates to all clients
            try:
                ws_manager.broadcast_sync("ROUTE_UPDATED", {
                    "emergency_id": emergency.id,
                    "distance_km": multi_routes["distance_km"],
                    "estimated_duration_minutes": multi_routes["estimated_duration_minutes"],
                    "route_geometry": multi_routes["route_geometry"],
                    "selected_strategy": multi_routes["selected_strategy"],
                    "optimal_badge": multi_routes["optimal_badge"],
                    "selection_reason": multi_routes["selection_reason"],
                    "candidates": multi_routes["candidates"]
                })
            except Exception as ws_err:
                logger.debug("WS route broadcast notice: %s", ws_err)

            logger.info(
                "Dispatched ambulance %s (ID %s) with %s to emergency %s (Distance: %.2f km)",
                nearest_amb.registration_number, nearest_amb.id, multi_routes["optimal_badge"], emergency.id, multi_routes["distance_km"]
            )

            return emergency, nearest_amb, assignment, multi_routes["distance_km"]
        except Exception:
            db.rollback()
            raise

