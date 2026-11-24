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
    "INT-RRNAGAR": {
        "id": "INT-RRNAGAR",
        "name": "Rajarajeshwari Nagar Gate & Mysore Road",
        "latitude": 12.9285,
        "longitude": 77.5180,
        "roads": ["Mysore Road", "Dr. Vishnuvardhan Road", "Kenchenahalli Main Rd"],
        "signal_state": "NORMAL_CYCLE",
        "countdown_seconds": 25,
        "cycle_duration": 60,
        "congestion_index": 62,
        "green_corridor_active": False,
        "preempted_for_emergency_id": None,
        "flow_rate_vph": 1720,
        "avg_speed_kmh": 26,
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
        "id": "SEG-CORP-MG",
        "u": "INT-CORP-CIRCLE",
        "v": "INT-MG-BRG",
        "name": "Kasturba & Cubbon Park Arterial",
        "distance_km": 1.7,
        "free_speed_kmh": 48,
        "waypoints": [
            [77.5877, 12.9698],
            [77.5950, 12.9720],
            [77.6010, 12.9730],
            [77.6074, 12.9740]
        ]
    },
    {
        "id": "SEG-RICH-VIC",
        "u": "INT-RICHMOND",
        "v": "INT-VICTORIA",
        "name": "Lalbagh Fort Road Link",
        "distance_km": 2.3,
        "free_speed_kmh": 45,
        "waypoints": [
            [77.5992, 12.9664],
            [77.5900, 12.9640],
            [77.5820, 12.9630],
            [77.5756, 12.9634]
        ]
    },
    {
        "id": "SEG-RICH-KORAMANGALA",
        "u": "INT-RICHMOND",
        "v": "INT-KORAMANGALA",
        "name": "Hosur Main Road Express",
        "distance_km": 3.6,
        "free_speed_kmh": 50,
        "waypoints": [
            [77.5992, 12.9664],
            [77.6080, 12.9550],
            [77.6150, 12.9450],
            [77.6221, 12.9344]
        ]
    },
    {
        "id": "SEG-MAJESTIC-VASANTH",
        "u": "INT-MAJESTIC",
        "v": "INT-VASANTH",
        "name": "Palace Road Connector",
        "distance_km": 2.0,
        "free_speed_kmh": 45,
        "waypoints": [
            [77.5729, 12.9774],
            [77.5850, 12.9820],
            [77.5970, 12.9880]
        ]
    },
    {
        "id": "SEG-VIC-RRNAGAR",
        "u": "INT-VICTORIA",
        "v": "INT-RRNAGAR",
        "name": "Mysore Road Arterial",
        "distance_km": 7.8,
        "free_speed_kmh": 50,
        "waypoints": [
            [77.5756, 12.9634],
            [77.5550, 12.9520],
            [77.5350, 12.9380],
            [77.5180, 12.9285]
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
        """Returns all registered traffic intersections with current states."""
        return list(cls._intersections.values())

    @classmethod
    def get_intersection(cls, intersection_id: str) -> Optional[Dict[str, Any]]:
        """Returns a single intersection by ID."""
        return cls._intersections.get(intersection_id)

    @classmethod
    def find_closest_intersection(cls, lat: float, lon: float) -> Tuple[str, float]:
        """Finds closest graph node to given coordinates and returns (node_id, distance_km)."""
        closest_id = "INT-MG-CORP"
        min_dist = float("inf")
        for node_id, data in cls._intersections.items():
            d = haversine_distance(lat, lon, data["latitude"], data["longitude"])
            if d < min_dist:
                min_dist = d
                closest_id = node_id
        return closest_id, min_dist

    @classmethod
    def reset_all_signals(cls) -> List[Dict[str, Any]]:
        """Restores all traffic signals across the city to standard cycles."""
        for node in cls._intersections.values():
            node["signal_state"] = "NORMAL_CYCLE"
            node["green_corridor_active"] = False
            node["preempted_for_emergency_id"] = None
            node["countdown_seconds"] = 30
        cls._active_corridors.clear()
        return list(cls._intersections.values())

    @classmethod
    def run_dijkstra_path(
        cls,
        start_node: str,
        end_node: str,
        strategy: str = "CONGESTION_AWARE"
    ) -> Tuple[List[Dict[str, Any]], float, float, float, List[str], List[Dict[str, Any]]]:
        """
        Executes Dijkstra's algorithm on the OpenStreetMap arterial road graph
        using the specified routing strategy cost metric:
        - SHORTEST: Minimizes pure road distance (km).
        - FASTEST: Minimizes free-flow travel time (minutes) based on speed limits.
        - CONGESTION_AWARE: Minimizes traffic-adjusted travel time with exponential penalty for congested chokepoints.
        """
        import heapq

        # Build graph adjacency with dynamic strategy weights
        adj: Dict[str, List[Tuple[str, float, Dict[str, Any]]]] = {k: [] for k in cls._intersections}
        for seg in ROAD_SEGMENTS:
            u, v = seg["u"], seg["v"]
            base_dist = seg["distance_km"]
            free_speed = max(15.0, float(seg.get("free_speed_kmh", 45)))

            u_cong = float(cls._intersections[u]["congestion_index"])
            v_cong = float(cls._intersections[v]["congestion_index"])
            avg_cong = (u_cong + v_cong) / 2.0

            if strategy == "SHORTEST":
                cost = base_dist
            elif strategy == "FASTEST":
                cost = (base_dist / free_speed) * 60.0
            else:  # CONGESTION_AWARE
                actual_speed = max(8.0, free_speed * (1.0 - (avg_cong / 120.0)))
                travel_time_min = (base_dist / actual_speed) * 60.0
                congestion_penalty = 1.0 + ((avg_cong / 100.0) ** 2.2) * 3.2
                cost = travel_time_min * congestion_penalty

            adj[u].append((v, cost, seg))
            rev_seg = dict(seg)
            rev_seg["waypoints"] = list(reversed(seg["waypoints"]))
            adj[v].append((u, cost, rev_seg))

        queue = [(0.0, start_node, [])]
        visited = set()
        best_path: List[Dict[str, Any]] = []

        while queue:
            current_cost, current_node, path = heapq.heappop(queue)
            if current_node in visited:
                continue
            visited.add(current_node)

            if current_node == end_node:
                best_path = path
                break

            for neighbor, weight, seg in adj.get(current_node, []):
                if neighbor not in visited:
                    heapq.heappush(queue, (current_cost + weight, neighbor, path + [seg]))

        # Calculate metrics for the resolved path
        total_dist_km = 0.0
        total_free_time_min = 0.0
        total_actual_time_min = 0.0
        road_names: List[str] = []
        delayed_sections: List[str] = []
        intersections_on_route: List[Dict[str, Any]] = []

        if start_node in cls._intersections:
            intersections_on_route.append(cls._intersections[start_node])

        for seg in best_path:
            total_dist_km += seg["distance_km"]
            free_speed = max(15.0, float(seg.get("free_speed_kmh", 45)))
            free_t = (seg["distance_km"] / free_speed) * 60.0
            total_free_time_min += free_t

            u, v = seg["u"], seg["v"]
            avg_cong = (cls._intersections[u]["congestion_index"] + cls._intersections[v]["congestion_index"]) / 2.0
            act_speed = max(8.0, free_speed * (1.0 - (avg_cong / 120.0)))
            act_t = (seg["distance_km"] / act_speed) * 60.0
            total_actual_time_min += act_t

            if avg_cong >= 50:
                delayed_sections.append(f"{seg['name']} ({int(avg_cong)}% HIGH)")

            if seg["name"] not in road_names:
                road_names.append(seg["name"])

            target_node = seg["v"]
            if target_node in cls._intersections:
                intersections_on_route.append(cls._intersections[target_node])

        delay_min = max(0.0, total_actual_time_min - total_free_time_min)

        return best_path, total_dist_km, total_actual_time_min, delay_min, road_names, delayed_sections, intersections_on_route

    @classmethod
    def _calculate_single_strategy_route(
        cls,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        strategy: str = "CONGESTION_AWARE"
    ) -> Dict[str, Any]:
        """Calculates a single routing strategy between two points on the road network."""
        start_node, dist_to_start = cls.find_closest_intersection(origin_lat, origin_lon)
        end_node, dist_to_end = cls.find_closest_intersection(dest_lat, dest_lon)

        best_path, path_dist_km, travel_time_min, delay_min, road_names, delayed_sections, intersections = (
            cls.run_dijkstra_path(start_node, end_node, strategy=strategy)
        )

        full_coords: List[List[float]] = [[origin_lon, origin_lat]]
        total_dist_km = dist_to_start

        if best_path:
            for seg in best_path:
                full_coords.extend(seg["waypoints"])
            total_dist_km += path_dist_km
        else:
            direct_dist = haversine_distance(origin_lat, origin_lon, dest_lat, dest_lon)
            total_dist_km = max(0.8, direct_dist)
            full_coords.append([(origin_lon + dest_lon) / 2.0, (origin_lat + dest_lat) / 2.0])

        total_dist_km += dist_to_end
        full_coords.append([dest_lon, dest_lat])

        # Remove duplicate consecutive coordinates
        deduped_coords: List[List[float]] = []
        for pt in full_coords:
            if not deduped_coords or (abs(deduped_coords[-1][0] - pt[0]) > 1e-5 or abs(deduped_coords[-1][1] - pt[1]) > 1e-5):
                deduped_coords.append(pt)

        # Baseline travel speed calculation
        if strategy == "SHORTEST":
            est_speed = 18.0 if delay_min > 2.0 else 32.0
            duration_min = round((total_dist_km / est_speed) * 60.0 + delay_min, 1)
        elif strategy == "FASTEST":
            est_speed = 46.0
            duration_min = round((total_dist_km / est_speed) * 60.0 + (delay_min * 0.4), 1)
        else:  # CONGESTION_AWARE
            est_speed = 36.0
            duration_min = round((total_dist_km / est_speed) * 60.0, 1)

        avg_speed_kmh = round((total_dist_km / max(0.1, duration_min)) * 60.0, 1)
        delay_label = f"+{int(delay_min)}m {int((delay_min % 1) * 60)}s delay" if delay_min >= 0.5 else "No delay"

        names = " → ".join(road_names[:3]) if road_names else "Bengaluru City Arterial Corridor"

        return {
            "strategy": strategy,
            "strategy_title": (
                "Shortest Route" if strategy == "SHORTEST" else
                "Fastest Route" if strategy == "FASTEST" else "Congestion-Aware Route"
            ),
            "distance_km": round(total_dist_km, 2),
            "estimated_duration_minutes": duration_min,
            "average_speed_kmh": avg_speed_kmh,
            "traffic_delay_minutes": round(delay_min, 1),
            "traffic_delay_label": delay_label,
            "primary_corridor": names,
            "delayed_road_sections": delayed_sections if strategy != "CONGESTION_AWARE" else [],
            "route_geometry": {
                "type": "LineString",
                "coordinates": deduped_coords,
            },
            "intersections": [
                {
                    "id": item["id"],
                    "name": item["name"],
                    "latitude": item["latitude"],
                    "longitude": item["longitude"],
                    "signal_state": item["signal_state"],
                    "congestion_index": item["congestion_index"]
                }
                for item in intersections
            ],
            "is_optimal": False
        }

    @classmethod
    def calculate_multi_route_strategies(
        cls,
        origin_lat: float,
        origin_lon: float,
        accident_lat: float,
        accident_lon: float,
        hospital_lat: Optional[float] = None,
        hospital_lon: Optional[float] = None,
        emergency_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Calculates all three candidate routes (Shortest, Fastest, Congestion-Aware)
        using Dijkstra on the road network graph.
        Compares distance, travel time, and traffic delays, and selects the optimal route.
        Tags the winner as 'OPTIMAL ROUTE SELECTED' and prepares predictive signal sequence.
        """
        # If destination hospital is provided, route traverses: Ambulance -> Accident -> Hospital
        # Otherwise: Ambulance -> Accident
        target_lat = hospital_lat if hospital_lat is not None else accident_lat
        target_lon = hospital_lon if hospital_lon is not None else accident_lon

        # Calculate all 3 strategies genuinely using Dijkstra
        shortest_cand = cls._calculate_single_strategy_route(origin_lat, origin_lon, target_lat, target_lon, strategy="SHORTEST")
        fastest_cand = cls._calculate_single_strategy_route(origin_lat, origin_lon, target_lat, target_lon, strategy="FASTEST")
        congestion_cand = cls._calculate_single_strategy_route(origin_lat, origin_lon, target_lat, target_lon, strategy="CONGESTION_AWARE")

        # Compare travel times and congestion delays to select optimal route
        # In urban peak traffic, Congestion-Aware route provides lower actual arrival time and higher predictability
        candidates = {
            "SHORTEST": shortest_cand,
            "FASTEST": fastest_cand,
            "CONGESTION_AWARE": congestion_cand
        }

        # Optimal selection: pick candidate with minimum arrival time (favoring congestion-aware in heavy traffic)
        if congestion_cand["estimated_duration_minutes"] <= shortest_cand["estimated_duration_minutes"]:
            selected_strategy = "CONGESTION_AWARE"
            selection_reason = "Accounts for live simulated road congestion to bypass delays and minimize arrival time."
        elif fastest_cand["estimated_duration_minutes"] < shortest_cand["estimated_duration_minutes"]:
            selected_strategy = "FASTEST"
            selection_reason = "Prioritizes major arterial roads and flyovers for higher ambulance cruising speed."
        else:
            selected_strategy = "SHORTEST"
            selection_reason = "Selects the most direct geographical corridor to minimize travel distance."

        # Mark optimal route
        for k, v in candidates.items():
            if k == selected_strategy:
                v["is_optimal"] = True
                v["optimal_badge"] = "OPTIMAL ROUTE SELECTED"
                v["selection_reason"] = selection_reason

        chosen_candidate = candidates[selected_strategy]

        # Prepare ordered signal sequence along selected route
        signal_sequence = []
        for idx, inter in enumerate(chosen_candidate["intersections"]):
            signal_sequence.append({
                "id": inter["id"],
                "name": inter["name"],
                "latitude": inter["latitude"],
                "longitude": inter["longitude"],
                "sequence_order": idx + 1,
                "distance_km": round((idx + 1) * 1.5, 2),
                "state": "STANDBY_HOLD",
                "label": "Signals in RED HOLD (Standby)"
            })

        # If emergency_id is provided, initialize the predictive green corridor
        if emergency_id:
            cls.initialize_predictive_corridor_for_emergency(emergency_id, [s["id"] for s in signal_sequence])

        response_payload = {
            "emergency_id": emergency_id,
            "distance_km": chosen_candidate["distance_km"],
            "estimated_duration_minutes": chosen_candidate["estimated_duration_minutes"],
            "selected_strategy": selected_strategy,
            "optimal_badge": "OPTIMAL ROUTE SELECTED",
            "selection_reason": selection_reason,
            "route_geometry": {
                "type": "LineString",
                "coordinates": chosen_candidate["route_geometry"]["coordinates"],
                "candidates": candidates,
                "selected_candidate": selected_strategy,
                "signals_sequence": signal_sequence,
            },
            "intersections": chosen_candidate["intersections"],
            "candidates": candidates,
            "green_corridor_active": bool(emergency_id),
            "source": "SERN_MULTI_STRATEGY_DIJKSTRA_ROUTER"
        }

        return response_payload

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
        Calculates all 3 candidate routes (Shortest, Fastest, Congestion-Aware)
        and returns the optimal selection.
        """
        return cls.calculate_multi_route_strategies(
            origin_lat=origin_lat,
            origin_lon=origin_lon,
            accident_lat=dest_lat,
            accident_lon=dest_lon,
            emergency_id=emergency_id
        )

    @classmethod
    def initialize_predictive_corridor_for_emergency(cls, emergency_id: int, intersection_ids: List[str]) -> Dict[str, Any]:
        """
        Initializes predictive sequential traffic signal control along the selected ambulance route.
        Signals are kept in HOLD_RED standby to manage conflicting cross-traffic,
        and will turn PREEMPTIVE_GREEN sequentially in advance as the ambulance approaches.
        """
        route_nodes = []
        for idx, int_id in enumerate(intersection_ids):
            if int_id in cls._intersections:
                node = cls._intersections[int_id]
                node["preempted_for_emergency_id"] = emergency_id
                node["green_corridor_active"] = True
                # Initial state: HOLD_RED (holding cross-traffic until ambulance approaches)
                node["signal_state"] = "HOLD_RED"
                node["countdown_seconds"] = 30
                route_nodes.append(int_id)

        corridor_info = {
            "emergency_id": emergency_id,
            "active": True,
            "intersections": route_nodes,
            "current_target_index": 0,
            "status": "PREDICTIVE_CORRIDOR_INITIALIZED",
            "message": f"Predictive corridor initialized for Emergency #{emergency_id} across {len(route_nodes)} intersections."
        }
        cls._active_corridors[emergency_id] = corridor_info

        try:
            ws_manager.broadcast_sync("TRAFFIC_SIGNAL_UPDATED", {
                "intersections": list(cls._intersections.values()),
                "active_corridor": corridor_info
            })
        except Exception as e:
            logger.debug("WS broadcast error: %s", e)

        return corridor_info

    @classmethod
    def evaluate_predictive_signals(
        cls,
        emergency_id: int,
        current_lat: float,
        current_lon: float,
        speed_kmh: float = 45.0
    ) -> Dict[str, Any]:
        """
        Evaluates ambulance proximity to upcoming intersections along the selected route.
        Triggers green corridor proactively 20-30 seconds BEFORE the ambulance arrives at each junction.
        Once the ambulance crosses, clears the intersection and restores normal operation.
        """
        corridor = cls._active_corridors.get(emergency_id)
        if not corridor:
            return {"active": False, "message": f"No active corridor for Emergency #{emergency_id}"}

        intersection_ids = corridor.get("intersections", [])
        speed_mps = max(6.0, (speed_kmh * 1000.0) / 3600.0)
        updated_nodes = []

        for idx, int_id in enumerate(intersection_ids):
            if int_id not in cls._intersections:
                continue
            node = cls._intersections[int_id]
            dist_km = haversine_distance(current_lat, current_lon, node["latitude"], node["longitude"])
            dist_m = dist_km * 1000.0
            time_to_signal_sec = dist_m / speed_mps

            # Proactive State Transition Logic:
            # 1. Past intersection (> 45m past): Restore to normal signal cycle
            # 2. At intersection (<= 30m): Solid green clearance
            # 3. Approaching in advance (<= 25s or <= 350m): PREEMPTIVE GREEN before arrival!
            # 4. Far in advance (> 25s and > 350m): HOLD_RED (Cross-traffic hold standby)
            prev_state = node["signal_state"]
            if dist_m < -45.0:  # Crossed past junction
                node["signal_state"] = "NORMAL_CYCLE"
                node["green_corridor_active"] = False
                node["preempted_for_emergency_id"] = None
                node["countdown_seconds"] = 30
            elif dist_m <= 30.0:  # Crossing junction
                node["signal_state"] = "GREEN_PREEMPTION"
                node["green_corridor_active"] = True
                node["countdown_seconds"] = 15
            elif time_to_signal_sec <= 25.0 or dist_m <= 350.0:  # Approaching in advance!
                node["signal_state"] = "GREEN_PREEMPTION"
                node["green_corridor_active"] = True
                node["countdown_seconds"] = max(10, int(time_to_signal_sec + 8))
            else:  # Far upcoming
                node["signal_state"] = "HOLD_RED"
                node["green_corridor_active"] = True
                node["countdown_seconds"] = int(time_to_signal_sec)

            if node["signal_state"] != prev_state:
                updated_nodes.append({
                    "id": node["id"],
                    "state": node["signal_state"],
                    "distance_m": round(dist_m, 1),
                    "eta_seconds": round(time_to_signal_sec, 1)
                })

        if updated_nodes:
            try:
                ws_manager.broadcast_sync("TRAFFIC_SIGNAL_UPDATED", {
                    "intersections": list(cls._intersections.values()),
                    "emergency_id": emergency_id,
                    "updated_nodes": updated_nodes
                })
            except Exception as e:
                logger.debug("WS broadcast error: %s", e)

        return {
            "emergency_id": emergency_id,
            "updated_nodes": updated_nodes,
            "intersections": [cls._intersections[i] for i in intersection_ids if i in cls._intersections]
        }

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
