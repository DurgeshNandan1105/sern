import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.route import RouteInfo
from app.models.emergency import Emergency
from app.schemas.routing import RouteCreate

logger = logging.getLogger("sern.routing_adapter")


class RoutingAdapterService:
    """
    Integration boundary for Member 4's routing module.

    RESPONSIBILITY:
    - Stores and retrieves route calculations (distance, duration, geometry).
    - Exposes a clear contract for Member 4 to push road-network route results.
    - Provides mock data helpers for isolated backend development/testing.

    IMPORTANT:
    This service DOES NOT compute OSMnx routes, congestion scores, green corridors,
    or ambulance movement simulations. Those belong strictly to Member 4.
    """

    @staticmethod
    def store_route_info(db: Session, route_data: RouteCreate) -> RouteInfo:
        emergency = db.query(Emergency).filter(Emergency.id == route_data.emergency_id).first()
        if not emergency:
            raise ValueError(f"Emergency with ID {route_data.emergency_id} does not exist.")

        # Check if route info already exists for this emergency
        existing_route = db.query(RouteInfo).filter(RouteInfo.emergency_id == route_data.emergency_id).first()

        if existing_route:
            existing_route.distance_km = route_data.distance_km
            existing_route.estimated_duration_minutes = route_data.estimated_duration_minutes
            existing_route.route_geometry = route_data.route_geometry
            existing_route.source = route_data.source or "MEMBER_4_ROUTING_MODULE"
            route_record = existing_route
        else:
            route_record = RouteInfo(
                emergency_id=route_data.emergency_id,
                distance_km=route_data.distance_km,
                estimated_duration_minutes=route_data.estimated_duration_minutes,
                route_geometry=route_data.route_geometry,
                source=route_data.source or "MEMBER_4_ROUTING_MODULE"
            )
            db.add(route_record)

        db.commit()
        db.refresh(route_record)

        logger.info(
            "Stored route for Emergency #%s: Distance=%.2f km, Duration=%.2f min, Source=%s",
            route_record.emergency_id, route_record.distance_km, route_record.estimated_duration_minutes, route_record.source
        )
        return route_record

    @staticmethod
    def get_route_info(db: Session, emergency_id: int) -> Optional[RouteInfo]:
        return db.query(RouteInfo).filter(RouteInfo.emergency_id == emergency_id).first()

    @staticmethod
    def generate_dev_mock_route(
        db: Session,
        emergency_id: int,
        distance_km: float = 5.2,
        estimated_duration_minutes: float = 9.5
    ) -> RouteInfo:
        """
        Placeholder / mock route generator for isolated development testing.
        Clearly documented as simulated/mock data.
        """
        mock_payload = RouteCreate(
            emergency_id=emergency_id,
            distance_km=distance_km,
            estimated_duration_minutes=estimated_duration_minutes,
            route_geometry={
                "type": "LineString",
                "coordinates": [
                    [77.5946, 12.9716],
                    [77.6000, 12.9750],
                    [77.6100, 12.9800]
                ],
                "_comment": "Simulated mock route geometry for backend MVP testing"
            },
            source="MEMBER_4_ROUTING_MOCK_DEV"
        )
        return RoutingAdapterService.store_route_info(db, mock_payload)

