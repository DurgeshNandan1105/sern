import logging
import math
from typing import Dict, List, Any, Optional, Tuple
from app.utils.distance import haversine_distance
from app.services.websocket_manager import ws_manager

logger = logging.getLogger("sern.traffic")

# 12 Key Bengaluru Signalized Intersections based on OpenStreetMap Road Network
INITIAL_INTERSECTIONS: Dict[str, Dict[str, Any]] = {
    "INT-MG-BRG": {
        "id": "INT-MG-BRG",
        "name": "MG Road & Brigade Road Junction",
        "latitude": 12.9740,
        "longitude": 77.6074,
        "roads": ["MG Road", "Brigade Road", "Residency Road"],
        "signal_state": "NORMAL_CYCLE",  # GREEN_PREEMPTION, NORMAL_CYCLE, HOLD_RED, CAUTION_AMBER
        "countdown_seconds": 24,
        "cycle_duration": 60,
        "congestion_index": 28,  # %
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 1540,
        "avg_speed_kmh": 42,
    },
    "INT-TRINITY": {
        "id": "INT-TRINITY",
        "name": "Trinity Circle & Old Airport Road",
        "latitude": 12.9723,
        "longitude": 77.6200,
        "roads": ["MG Road", "Old Airport Road", "Victoria Road"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 35,
        "cycle_duration": 75,
        "congestion_index": 34,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 1780,
        "avg_speed_kmh": 36,
    },
    "INT-RICHMOND": {
        "id": "INT-RICHMOND",
        "name": "Richmond Circle & Double Road Flyover",
        "latitude": 12.9664,
        "longitude": 77.5992,
        "roads": ["Richmond Road", "Raja Ram Mohan Roy Rd", "Kengal Hanumanthaiah Rd"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 18,
        "cycle_duration": 60,
        "congestion_index": 22,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 1390,
        "avg_speed_kmh": 46,
    },
    "INT-CORP-CIRCLE": {
        "id": "INT-CORP-CIRCLE",
        "name": "Corporation Circle / Hudson Circle",
        "latitude": 12.9698,
        "longitude": 77.5877,
        "roads": ["Kasturba Road", "Nrupathunga Road", "Devanga Hostel Rd"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 12,
        "cycle_duration": 60,
        "congestion_index": 45,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 1820,
        "avg_speed_kmh": 32,
    },
    "INT-VICTORIA": {
        "id": "INT-VICTORIA",
        "name": "City Market / Victoria Hospital Gate",
        "latitude": 12.9634,
        "longitude": 77.5756,
        "roads": ["Fort Road", "KR Road", "Mysore Road"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 40,
        "cycle_duration": 60,
        "congestion_index": 52,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 1650,
        "avg_speed_kmh": 28,
    },
    "INT-MAJESTIC": {
        "id": "INT-MAJESTIC",
        "name": "Majestic Station / Subedar Chatram Rd",
        "latitude": 12.9774,
        "longitude": 77.5729,
        "roads": ["Gubbi Thotadappa Rd", "Subedar Chatram Rd", "Tank Bund Rd"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 29,
        "cycle_duration": 90,
        "congestion_index": 68,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 2100,
        "avg_speed_kmh": 24,
    },
    "INT-INDIRA-100FT": {
        "id": "INT-INDIRA-100FT",
        "name": "Indiranagar 100ft Rd & CMH Junction",
        "latitude": 12.9784,
        "longitude": 77.6408,
        "roads": ["100ft Road", "CMH Road", "Old Madras Road"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 22,
        "cycle_duration": 60,
        "congestion_index": 38,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 1450,
        "avg_speed_kmh": 38,
    },
    "INT-KORAMANGALA": {
        "id": "INT-KORAMANGALA",
        "name": "Koramangala Sony World Signal",
        "latitude": 12.9344,
        "longitude": 77.6221,
        "roads": ["80ft Road", "Intermediate Ring Road", "Sarjapur Main Rd"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 44,
        "cycle_duration": 90,
        "congestion_index": 55,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 1960,
        "avg_speed_kmh": 30,
    },
    "INT-SILKBOARD": {
        "id": "INT-SILKBOARD",
        "name": "Silk Board Junction Interchange",
        "latitude": 12.9176,
        "longitude": 77.6234,
        "roads": ["Hosur Road", "Outer Ring Road", "Marathahalli Expressway"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 58,
        "cycle_duration": 120,
        "congestion_index": 76,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 2480,
        "avg_speed_kmh": 18,
    },
    "INT-WHITEFIELD": {
        "id": "INT-WHITEFIELD",
        "name": "Whitefield ITPL Hope Farm Junction",
        "latitude": 12.9855,
        "longitude": 77.7345,
        "roads": ["Whitefield Main Road", "Channasandra Main Rd", "ITPL Road"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 30,
        "cycle_duration": 75,
        "congestion_index": 42,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 1620,
        "avg_speed_kmh": 34,
    },
    "INT-HEBBAL": {
        "id": "INT-HEBBAL",
        "name": "Hebbal Flyover & Outer Ring Road",
        "latitude": 13.0358,
        "longitude": 77.5970,
        "roads": ["Bellary Road (Airport Rd)", "Outer Ring Road"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 15,
        "cycle_duration": 90,
        "congestion_index": 35,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 2200,
        "avg_speed_kmh": 50,
    },
    "INT-VASANTH": {
        "id": "INT-VASANTH",
        "name": "Cunningham Road & Millers Road Junction",
        "latitude": 12.9880,
        "longitude": 77.5970,
        "roads": ["Cunningham Road", "Millers Road", "Palace Road"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 26,
        "cycle_duration": 60,
        "congestion_index": 20,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 1150,
        "avg_speed_kmh": 45,
    },
}

# Road Segments connecting intersections with OpenStreetMap geometry waypoints
ROAD_SEGMENTS: List[Dict[str, Any]] = [
    {
        "id": "SEG-CORP-RICH",
        "u": "INT-CORP-CIRCLE",
        "v": "INT-RICHMOND",
        "name": "Kasturba & Raja Ram Mohan Roy Road",
        "distance_km": 1.4,
        "free_speed_kmh": 50,
        "waypoints": [
            [77.5877, 12.9698],
            [77.5910, 12.9685],
            [77.5955, 12.9672],
            [77.5992, 12.9664]
        ]
    },
    {
        "id": "SEG-RICH-MG",
        "u": "INT-RICHMOND",
        "v": "INT-MG-BRG",
        "name": "Residency Road to MG Road Connector",
        "distance_km": 1.2,
        "free_speed_kmh": 45,
        "waypoints": [
            [77.5992, 12.9664],
            [77.6025, 12.9695],
            [77.6050, 12.9720],
            [77.6074, 12.9740]
        ]
    },
    {
        "id": "SEG-MG-TRINITY",
        "u": "INT-MG-BRG",
        "v": "INT-TRINITY",
        "name": "MG Road Central Arterial",
        "distance_km": 1.5,
        "free_speed_kmh": 50,
        "waypoints": [
            [77.6074, 12.9740],
            [77.6115, 12.9735],
            [77.6160, 12.9728],
            [77.6200, 12.9723]
        ]
    },
    {
        "id": "SEG-TRINITY-INDIRA",
        "u": "INT-TRINITY",
        "v": "INT-INDIRA-100FT",
        "name": "Old Airport & 100ft Road Link",
        "distance_km": 2.6,
        "free_speed_kmh": 50,
        "waypoints": [
            [77.6200, 12.9723],
            [77.6265, 12.9745],
            [77.6330, 12.9765],
            [77.6408, 12.9784]
        ]
    },
    {
        "id": "SEG-TRINITY-KORAMANGALA",
        "u": "INT-TRINITY",
        "v": "INT-KORAMANGALA",
        "name": "Intermediate Ring Road Expressway",
        "distance_km": 4.5,
        "free_speed_kmh": 55,
        "waypoints": [
            [77.6200, 12.9723],
            [77.6250, 12.9600],
            [77.6280, 12.9480],
            [77.6221, 12.9344]
        ]
    },
    {
        "id": "SEG-KORAMANGALA-SILK",
        "u": "INT-KORAMANGALA",
        "v": "INT-SILKBOARD",
        "name": "Hosur Road South Corridor",
        "distance_km": 2.2,
        "free_speed_kmh": 45,
        "waypoints": [
            [77.6221, 12.9344],
            [77.6230, 12.9260],
            [77.6234, 12.9176]
        ]
    },
    {
        "id": "SEG-CORP-VIC",
        "u": "INT-CORP-CIRCLE",
        "v": "INT-VICTORIA",
        "name": "Fort Road Trauma Access Link",
        "distance_km": 1.6,
        "free_speed_kmh": 40,
        "waypoints": [
            [77.5877, 12.9698],
            [77.5820, 12.9665],
            [77.5780, 12.9645],
            [77.5756, 12.9634]
        ]
    },
    {
        "id": "SEG-CORP-MAJESTIC",
        "u": "INT-CORP-CIRCLE",
        "v": "INT-MAJESTIC",
        "name": "Seshadri Road Central Transit",
        "distance_km": 1.8,
        "free_speed_kmh": 40,
        "waypoints": [
            [77.5877, 12.9698],
            [77.5815, 12.9735],
            [77.5755, 12.9760],
            [77.5729, 12.9774]
        ]
    },
    {
        "id": "SEG-MAJESTIC-VIC",
        "u": "INT-MAJESTIC",
        "v": "INT-VICTORIA",
        "name": "Tank Bund & City Market Bypass",
        "distance_km": 1.7,
        "free_speed_kmh": 35,
        "waypoints": [
            [77.5729, 12.9774],
            [77.5738, 12.9705],
            [77.5756, 12.9634]
        ]
    },
    {
        "id": "SEG-MG-VASANTH",
        "u": "INT-MG-BRG",
        "v": "INT-VASANTH",
        "name": "Cubbon Park & Cunningham Corridor",
        "distance_km": 1.9,
        "free_speed_kmh": 50,
        "waypoints": [
            [77.6074, 12.9740],
            [77.6030, 12.9810],
            [77.5970, 12.9880]
        ]
    },
    {
        "id": "SEG-VASANTH-HEBBAL",
        "u": "INT-VASANTH",
        "v": "INT-HEBBAL",
        "name": "Bellary Road Elevated Airport Express",
        "distance_km": 5.4,
        "free_speed_kmh": 65,
        "waypoints": [
            [77.5970, 12.9880],
            [77.5965, 13.0050],
            [77.5970, 13.0358]
        ]
    },
    {
        "id": "SEG-INDIRA-WHITEFIELD",
        "u": "INT-INDIRA-100FT",
        "v": "INT-WHITEFIELD",
        "name": "Old Madras & ITPL High-Tech Corridor",
        "distance_km": 10.5,
        "free_speed_kmh": 55,
        "waypoints": [
            [77.6408, 12.9784],
            [77.6700, 12.9800],
            [77.7050, 12.9820],
            [77.7345, 12.9855]
        ]
    }
]


class TrafficService:
    """
    Intelligent Road-Network Routing & Smart Traffic Signal Prioritisation Service.
    
    Provides:
    - OpenStreetMap graph network route calculation.
    - Congestion-aware route optimization with dynamic re-routing.
    - Intersections along ambulance route detection.
    - Automated Green-Corridor Traffic Signal Prioritization.
    - Real-time WebSocket broadcasting of traffic signals and routes.
    """
    _intersections: Dict[str, Dict[str, Any]] = {k: dict(v) for k, v in INITIAL_INTERSECTIONS.items()}
    _active_corridors: Dict[int, Dict[str, Any]] = {}  # emergency_id -> corridor details

    @classmethod
    def get_all_intersections(cls) -> List[Dict[str, Any]]:
        return list(cls._intersections.values())

    @classmethod
    def get_intersection(cls, int_id: str) -> Optional[Dict[str, Any]]:
        return cls._intersections.get(int_id)

    @classmethod
    def get_active_corridors(cls) -> Dict[int, Dict[str, Any]]:
        return cls._active_corridors

    @classmethod
    def find_closest_intersection(cls, lat: float, lon: float) -> Tuple[str, float]:
        """Find the nearest intersection node in the road network."""
        closest_id = "INT-MG-BRG"
        min_dist = float("inf")
        for int_id, data in cls._intersections.items():
            dist = haversine_distance(lat, lon, data["latitude"], data["longitude"])
            if dist < min_dist:
                min_dist = dist
                closest_id = int_id
        return closest_id, min_dist

    @classmethod
    def calculate_road_network_route(
        cls,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        emergency_id: Optional[int] = None,
        avoid_congestion: bool = True
    ) -> Dict[str, Any]:
        """
        Calculates optimized road-network route between origin and destination.
        Considers real-time traffic congestion weights on road segments.
        Identifies all intersections along the path and can activate green corridor.
        """
        start_node, _ = cls.find_closest_intersection(origin_lat, origin_lon)
        end_node, _ = cls.find_closest_intersection(dest_lat, dest_lon)

        # Build graph adjacency with dynamic congestion weights
        adj: Dict[str, List[Tuple[str, float, Dict[str, Any]]]] = {k: [] for k in cls._intersections}
        for seg in ROAD_SEGMENTS:
            u, v = seg["u"], seg["v"]
            base_dist = seg["distance_km"]
            # Congestion weight penalty: higher congestion increases effective travel time/cost
            u_cong = cls._intersections[u]["congestion_index"]
            v_cong = cls._intersections[v]["congestion_index"]
            avg_cong = (u_cong + v_cong) / 2.0
            
            # Congestion factor: if avoid_congestion, apply heavy multiplier to congested corridors
            cong_multiplier = (1.0 + (avg_cong / 100.0) * 2.2) if avoid_congestion else (1.0 + avg_cong / 100.0)
            cost = base_dist * cong_multiplier

            adj[u].append((v, cost, seg))
            # Undirected road link
            rev_seg = dict(seg)
            rev_seg["waypoints"] = list(reversed(seg["waypoints"]))
            adj[v].append((u, cost, rev_seg))

        # Dijkstra shortest path
        import heapq
        queue = [(0.0, start_node, [])]
        visited = set()
        best_path: List[Dict[str, Any]] = []
        found = False

        while queue:
            current_cost, current_node, path = heapq.heappop(queue)
            if current_node in visited:
                continue
            visited.add(current_node)

            if current_node == end_node:
                best_path = path
                found = True
                break

            for neighbor, weight, seg in adj.get(current_node, []):
                if neighbor not in visited:
                    heapq.heappush(queue, (current_cost + weight, neighbor, path + [seg]))

        # Assemble full route coordinates [lon, lat] for GeoJSON
        full_coords: List[List[float]] = [[origin_lon, origin_lat]]
        total_dist_km = haversine_distance(origin_lat, origin_lon, cls._intersections[start_node]["latitude"], cls._intersections[start_node]["longitude"])

        intersections_on_route: List[Dict[str, Any]] = []
        intersections_on_route.append({
            "id": start_node,
            "name": cls._intersections[start_node]["name"],
            "latitude": cls._intersections[start_node]["latitude"],
            "longitude": cls._intersections[start_node]["longitude"],
            "signal_state": cls._intersections[start_node]["signal_state"],
            "congestion_index": cls._intersections[start_node]["congestion_index"],
        })

        if found and best_path:
            for seg in best_path:
                full_coords.extend(seg["waypoints"])
                total_dist_km += seg["distance_km"]
                target_node = seg["v"]
                if target_node in cls._intersections:
                    target_info = cls._intersections[target_node]
                    intersections_on_route.append({
                        "id": target_node,
                        "name": target_info["name"],
                        "latitude": target_info["latitude"],
                        "longitude": target_info["longitude"],
                        "signal_state": target_info["signal_state"],
                        "congestion_index": target_info["congestion_index"],
                    })
        else:
            # Direct connector fallback if origin and dest map to same or isolated node
            direct_dist = haversine_distance(origin_lat, origin_lon, dest_lat, dest_lon)
            total_dist_km = max(0.8, direct_dist)
            full_coords.append([
                (origin_lon + dest_lon) / 2.0,
                (origin_lat + dest_lat) / 2.0
            ])

        full_coords.append([dest_lon, dest_lat])

        # Remove consecutive duplicate coordinates
        deduped_coords = []
        for pt in full_coords:
            if not deduped_coords or (abs(deduped_coords[-1][0] - pt[0]) > 1e-5 or abs(deduped_coords[-1][1] - pt[1]) > 1e-5):
                deduped_coords.append(pt)

        # Calculate durations:
        # Standard urban speed ~32 km/h without preemption, ~58 km/h with green corridor
        standard_duration_min = round((total_dist_km / 32.0) * 60.0, 1)
        green_corridor_duration_min = round((total_dist_km / 58.0) * 60.0, 1)
        time_saved_min = max(0.5, round(standard_duration_min - green_corridor_duration_min, 1))

        # Check if green corridor should be automatically engaged
        if emergency_id:
            cls.activate_green_corridor_for_emergency(emergency_id, [item["id"] for item in intersections_on_route])

        route_result = {
            "emergency_id": emergency_id,
            "distance_km": round(total_dist_km, 2),
            "estimated_duration_minutes": green_corridor_duration_min,
            "standard_duration_minutes": standard_duration_min,
            "time_saved_minutes": time_saved_min,
            "route_geometry": {
                "type": "LineString",
                "coordinates": deduped_coords,
            },
            "intersections": intersections_on_route,
            "green_corridor_active": bool(emergency_id),
            "source": "SERN_OSM_ROAD_NETWORK_ROUTER"
        }

        return route_result

    @classmethod
    def activate_green_corridor_for_emergency(cls, emergency_id: int, intersection_ids: List[str]) -> Dict[str, Any]:
        """
        Locks signals along the ambulance route to GREEN_PREEMPTION,
        holding conflicting cross-street traffic and notifying all clients in real time.
        """
        preempted_nodes = []
        for int_id in intersection_ids:
            if int_id in cls._intersections:
                node = cls._intersections[int_id]
                node["signal_state"] = "GREEN_PREEMPTION"
                node["green_corridor_active"] = True
                node["preempted_for_emergency_id"] = emergency_id
                node["countdown_seconds"] = 99  # Held green until unit clears
                preempted_nodes.append(int_id)

        corridor_info = {
            "emergency_id": emergency_id,
            "active": True,
            "intersections": preempted_nodes,
            "status": "GREEN_CORRIDOR_ACTIVE",
            "message": f"Green corridor locked for Emergency #{emergency_id} across {len(preempted_nodes)} intersections."
        }
        cls._active_corridors[emergency_id] = corridor_info

        # Broadcast real-time WebSocket updates
        try:
            ws_manager.broadcast_sync("TRAFFIC_SIGNAL_UPDATED", {
                "intersections": list(cls._intersections.values()),
                "active_corridor": corridor_info
            })
        except Exception as e:
            logger.debug("WS broadcast error: %s", e)

        return corridor_info

    @classmethod
    def clear_green_corridor(cls, emergency_id: int) -> None:
        """Restores normal signal cycles once ambulance has cleared or mission completes."""
        for node in cls._intersections.values():
            if node.get("preempted_for_emergency_id") == emergency_id:
                node["signal_state"] = "NORMAL_CYCLE"
                node["green_corridor_active"] = False
                node["preempted_for_emergency_id"] = None
                node["countdown_seconds"] = 30

        cls._active_corridors.pop(emergency_id, None)

        try:
            ws_manager.broadcast_sync("TRAFFIC_SIGNAL_UPDATED", {
                "intersections": list(cls._intersections.values()),
                "cleared_emergency_id": emergency_id
            })
        except Exception as e:
            logger.debug("WS broadcast error: %s", e)

    @classmethod
    def update_congestion(cls, intersection_id: str, congestion_index: int) -> Dict[str, Any]:
        """
        Dynamically updates congestion on an intersection or road segment.
        Triggers real-time notifications so routes can be recalculated.
        """
        if intersection_id in cls._intersections:
            cls._intersections[intersection_id]["congestion_index"] = max(0, min(100, congestion_index))
            node = cls._intersections[intersection_id]

            # Recalculate average speed & flow rate
            node["avg_speed_kmh"] = max(12, int(55 * (1.0 - node["congestion_index"] / 120.0)))
            node["flow_rate_vph"] = int(800 + node["congestion_index"] * 18)

            try:
                ws_manager.broadcast_sync("TRAFFIC_CONGESTION_UPDATED", {
                    "intersection_id": intersection_id,
                    "congestion_index": node["congestion_index"],
                    "intersections": list(cls._intersections.values())
                })
            except Exception as e:
                logger.debug("WS broadcast error: %s", e)

            return node
        raise ValueError(f"Intersection '{intersection_id}' not found.")

    @classmethod
    def toggle_signal_preemption(cls, intersection_id: str) -> Dict[str, Any]:
        """Manual toggle for traffic control operators."""
        if intersection_id not in cls._intersections:
            raise ValueError(f"Intersection '{intersection_id}' not found.")

        node = cls._intersections[intersection_id]
        if node["signal_state"] == "GREEN_PREEMPTION":
            node["signal_state"] = "NORMAL_CYCLE"
            node["green_corridor_active"] = False
            node["countdown_seconds"] = 30
            node["preempted_for_emergency_id"] = None
        else:
            node["signal_state"] = "GREEN_PREEMPTION"
            node["green_corridor_active"] = True
            node["countdown_seconds"] = 90

        try:
            ws_manager.broadcast_sync("TRAFFIC_SIGNAL_UPDATED", {
                "intersection_id": intersection_id,
                "node": node,
                "intersections": list(cls._intersections.values())
            })
        except Exception as e:
            logger.debug("WS broadcast error: %s", e)

        return node
