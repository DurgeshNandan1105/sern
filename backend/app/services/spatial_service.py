import logging
from typing import Optional, Tuple, List
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.config import settings
from app.models.ambulance import Ambulance
from app.models.hospital import Hospital
from app.utils.distance import haversine_distance

logger = logging.getLogger("sern.spatial")


class SpatialService:
    """
    High-performance spatial indexing service.
    Supports PostgreSQL with PostGIS extension for sub-millisecond geographic queries
    and automatically falls back to Haversine computation on SQLite.
    """

    @classmethod
    def is_postgis_available(cls, db: Session) -> bool:
        if settings.DATABASE_URL.startswith("sqlite"):
            return False
        try:
            res = db.execute(text("SELECT PostGIS_Version()")).scalar()
            return res is not None
        except Exception:
            return False

    @classmethod
    def find_nearest_ambulance(
        cls,
        db: Session,
        target_lat: float,
        target_lon: float
    ) -> Tuple[Optional[Ambulance], Optional[float]]:
        """
        Locates the closest available ambulance to the target incident location.
        Executes PostGIS ST_Distance if PostgreSQL is active, otherwise Haversine.
        """
        # Try PostGIS query if configured
        if not settings.DATABASE_URL.startswith("sqlite"):
            try:
                sql = text("""
                    SELECT id, 
                           ST_Distance(
                               ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                               ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                           ) / 1000.0 AS dist_km
                    FROM ambulances
                    WHERE status = 'AVAILABLE'
                    ORDER BY dist_km ASC
                    LIMIT 1;
                """)
                row = db.execute(sql, {"lon": target_lon, "lat": target_lat}).fetchone()
                if row:
                    amb_id, dist_km = row[0], float(row[1])
                    ambulance = db.query(Ambulance).filter(Ambulance.id == amb_id).first()
                    if ambulance:
                        logger.info(f"[PostGIS] Found nearest ambulance ID={amb_id} at {dist_km:.2f} km")
                        return ambulance, round(dist_km, 2)
            except Exception as exc:
                logger.warning(f"PostGIS spatial query failed, falling back to Haversine: {exc}")

        # Fallback: High-precision Haversine algorithm
        available_ambulances = db.query(Ambulance).filter(Ambulance.status == "AVAILABLE").all()
        if not available_ambulances:
            return None, None

        nearest_amb = None
        min_dist = float("inf")

        for amb in available_ambulances:
            dist = haversine_distance(target_lat, target_lon, amb.latitude, amb.longitude)
            if dist < min_dist:
                min_dist = dist
                nearest_amb = amb

        return nearest_amb, round(min_dist, 2) if nearest_amb else None

    @classmethod
    def find_nearest_hospitals(
        cls,
        db: Session,
        target_lat: float,
        target_lon: float,
        limit: int = 3
    ) -> List[Tuple[Hospital, float]]:
        """
        Locates the closest hospitals to the incident location.
        """
        if not settings.DATABASE_URL.startswith("sqlite"):
            try:
                sql = text("""
                    SELECT id, 
                           ST_Distance(
                               ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                               ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                           ) / 1000.0 AS dist_km
                    FROM hospitals
                    ORDER BY dist_km ASC
                    LIMIT :limit;
                """)
                rows = db.execute(sql, {"lon": target_lon, "lat": target_lat, "limit": limit}).fetchall()
                results = []
                for row in rows:
                    hosp = db.query(Hospital).filter(Hospital.id == row[0]).first()
                    if hosp:
                        results.append((hosp, round(float(row[1]), 2)))
                if results:
                    return results
            except Exception as exc:
                logger.warning(f"PostGIS hospital query failed, falling back to Haversine: {exc}")

        # Fallback Haversine
        hospitals = db.query(Hospital).all()
        scored = [
            (hosp, round(haversine_distance(target_lat, target_lon, hosp.latitude, hosp.longitude), 2))
            for hosp in hospitals
        ]
        scored.sort(key=lambda x: x[1])
        return scored[:limit]
