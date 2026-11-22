# SERN — Backend MVP (Smart Emergency Response Network)

The backend service for **SERN (Smart Emergency Response Network)** coordinates real-time vehicle accident detection, explicit incident validation, nearest-ambulance dispatch using geographical distance, emergency lifecycle management, simulated hospital notifications, and integration boundaries for route optimization.

---

## 1. Prerequisites

- **Python**: 3.10, 3.11, 3.12, or 3.13
- **Pip**: Latest version recommended
- **Operating System**: Linux, macOS, or Windows

---

## 2. Installation Instructions

1. Clone or navigate to the repository:
   ```bash
   cd SERN
   ```

2. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

3. (Optional but recommended) Create and activate a virtual environment:
   ```bash
   python -m venv .venv

   # On Windows (PowerShell):
   .\.venv\Scripts\Activate.ps1

   # On Linux/macOS:
   source .venv/bin/activate
   ```

4. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

## 3. Environment Configuration

Copy the example configuration file:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

### Configuration Parameters

| Variable | Default Value | Description |
|---|---|---|
| `APP_NAME` | `SERN - Smart Emergency Response Network` | Human-readable service name |
| `APP_ENV` | `development` | Environment mode (`development`, `production`) |
| `DEBUG` | `True` | FastAPI debug mode |
| `LOG_LEVEL` | `INFO` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8000` | Server listening port |
| `CORS_ORIGINS` | `["*"]` | Allowed CORS origins (JSON array or comma-separated) |
| `DATABASE_URL` | `sqlite:///./sern.db` | SQLAlchemy connection string (SQLite for MVP, MySQL in production) |
| `ML_MODEL_PATH` | `../AccidentDetectionML/models/accident_detection_final.pkl` | Path to trained model package |
| `AUTO_DISPATCH_ON_VALIDATION` | `False` | Whether to automatically dispatch nearest ambulance when an accident is validated |

---

## 4. Database Setup

The database layer is built with **SQLAlchemy 2.0** and is fully modular:

- **Default (MVP)**: SQLite file stored automatically inside the backend directory (`sern.db`).
- **Production MySQL**:
  Update `DATABASE_URL` in `.env`:
  ```ini
  DATABASE_URL=mysql+pymysql://<user>:<password>@<host>:3306/<db_name>
  ```
- **Automatic Migration/Creation**: Database tables are initialized automatically on application startup via FastAPI lifespan events (`Base.metadata.create_all`).

---

## 5. Server Startup Command

From the `backend/` directory:
```bash
uvicorn app.main:app --reload --port 8000
```

Alternatively, from the repository root:
```bash
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

Interactive API documentation will be available at:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

## 6. Architecture & Directory Structure

```text
backend/
├── app/
│   ├── main.py                  # FastAPI initialization, middleware, lifespan, router registry
│   ├── config.py                # Environment configuration using Pydantic Settings
│   ├── database/
│   │   ├── base.py              # Declarative Base for models
│   │   └── connection.py        # Database engine, sessionmaker, and get_db dependency
│   ├── models/                  # SQLAlchemy ORM Models
│   │   ├── accident.py          # Accident candidate records & sensor readings
│   │   ├── ambulance.py         # Ambulance telemetry, status & location
│   │   ├── hospital.py          # Hospital registries & contact info
│   │   ├── emergency.py         # Emergency lifecycle management & associations
│   │   ├── assignment.py        # Ambulance-emergency assignment history
│   │   ├── notification.py      # Simulated delivery logs for hospital & contacts
│   │   └── route.py             # Route information integration boundary (Member 4)
│   ├── schemas/                 # Pydantic v2 validation models
│   │   ├── accident.py
│   │   ├── ambulance.py
│   │   ├── hospital.py
│   │   ├── emergency.py
│   │   ├── notification.py
│   │   └── routing.py
│   ├── routes/                  # FastAPI API route controllers
│   │   ├── health.py
│   │   ├── accidents.py
│   │   ├── ambulances.py
│   │   ├── emergencies.py
│   │   ├── hospitals.py
│   │   ├── notifications.py
│   │   └── routing.py
│   ├── services/                # Business logic services
│   │   ├── ml_service.py        # Adapter for AccidentDetectionML predictor
│   │   ├── accident_service.py  # Ingestion & explicit validation workflows
│   │   ├── dispatch_service.py  # Haversine nearest-ambulance selection & assignment
│   │   ├── emergency_service.py # Lifecycle transitions & sync
│   │   ├── notification_service.py # Simulated notification recording
│   │   └── routing_adapter.py   # Integration adapter for Member 4's routing module
│   └── utils/
│       ├── distance.py          # Haversine great-circle distance calculation
│       └── datetime_utils.py    # Timezone-aware naive UTC timestamp helpers
├── tests/                       # Comprehensive Pytest suite (isolated in-memory SQLite)
│   ├── conftest.py
│   ├── test_accidents.py
│   ├── test_ambulances.py
│   ├── test_database.py
│   ├── test_dispatch.py
│   ├── test_emergencies.py
│   ├── test_health.py
│   ├── test_hospitals.py
│   ├── test_ml_service.py
│   ├── test_notifications.py
│   └── test_routing.py
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

---

## 7. Machine Learning Integration

The backend integrates with the existing `AccidentDetectionML` module located at the repository root.

### Integration Contract
The adapter `app/services/ml_service.py` invokes `ml_module.predictor.AccidentPredictor`:
- **Input parameters**:
  - `gsensor`: List of accelerometer triples `[[x, y, z], ...]`
  - `gyro`: List of gyroscope triples `[[x, y, z], ...]`
  - `gps_speed`: List of float speed measurements `[v1, v2, ...]`
  - `vehiclesize`: String (`"car"`, `"van"`, `"bus"`, `"truck"`)
  - `gyro_is_hd`: Boolean
- **Output contract**:
  - `accident_detected`: Boolean
  - `accident_probability`: Float between 0.0 and 1.0
  - `threshold`: Float decision threshold (e.g. `0.33567...`)

### Important Safeguards:
1. **Binary Classification Only**: The ML model detects accident presence vs. no accident. It **does not** perform injury severity estimation. The backend does not fabricate or claim severity prediction.
2. **Controlled Error Handling**: If model loading or feature extraction fails, the backend logs the error and raises a controlled `500 Internal Server Error`. Events are **never** silently assumed to be accidents.
3. **No Automatic Dispatch on Normal Driving**: If `accident_detected` is `False`, the event status is marked `NORMAL`, and no emergency is created.
4. **Explicit Validation Requirement**: If `accident_detected` is `True`, the record is marked `PENDING`. An emergency is created only after explicit confirmation via `/api/accidents/{id}/validate`.

---

## 8. Ambulance Dispatch & Routing Boundaries

### Nearest-Ambulance Selection (Member 2 Responsibility)
- Handled by `DispatchService` (`app/services/dispatch_service.py`).
- Filters all ambulances with `status == "AVAILABLE"`.
- Calculates straight-line spherical distance to the accident location using the **Haversine formula**.
- Selects the closest unit, marks its status as `ASSIGNED`, creates an active `Assignment` record, transitions the emergency to `DISPATCHED`, and prevents double-assignment.
- Gracefully handles cases where no ambulances are available (`503 Service Unavailable`).

### Road-Network Routing Boundary (Member 4 Responsibility)
- Road-network calculations, OSMnx graphs, traffic congestion scores, green corridor logic, and traffic signal preemption belong exclusively to **Member 4**.
- The backend provides a standardized boundary (`app/routes/routing.py` and `app/services/routing_adapter.py`) to receive and store Member 4's calculated route:
  - `POST /api/routing/{emergency_id}`: Member 4 sends `distance_km`, `estimated_duration_minutes`, and GeoJSON/polyline `route_geometry`.
  - `GET /api/routing/{emergency_id}`: Retrieves stored route information.
  - `POST /api/routing/{emergency_id}/mock`: Developer placeholder for local testing without the routing service running.

---

## 9. API Reference & Examples

### A. Health Check
```http
GET /api/health
```
**Response (200 OK)**:
```json
{
  "status": "healthy",
  "service": "SERN Backend MVP",
  "database": "connected",
  "ml_model_loaded": true
}
```

---

### B. Register Accident Candidate
```http
POST /api/accidents
Content-Type: application/json
```
**Request Body**:
```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "sensor_data": {
    "gsensor": [[50.0, 40.0, 80.0], [60.0, 50.0, 90.0]],
    "gyro": [[5.0, 6.0, 7.0], [8.0, 9.0, 10.0]],
    "gps_speed": [90.0, 0.0],
    "vehiclesize": "car",
    "gyro_is_hd": true
  }
}
```
**Response (201 Created)**:
```json
{
  "id": 1,
  "latitude": 12.9716,
  "longitude": 77.5946,
  "timestamp": "2026-11-22T15:30:00",
  "vehicle_size": "car",
  "gyro_is_hd": true,
  "accident_prediction": true,
  "accident_probability": 0.4221,
  "model_threshold": 0.3356,
  "validation_status": "PENDING",
  "validation_notes": null,
  "created_at": "2026-11-22T15:30:00",
  "emergency_id": null
}
```

---

### C. Validate Accident (Creates Emergency)
```http
POST /api/accidents/1/validate
Content-Type: application/json
```
**Request Body**:
```json
{
  "confirmed": true,
  "validation_notes": "Emergency caller and traffic camera confirmed collision"
}
```
**Response (200 OK)**:
```json
{
  "accident": {
    "id": 1,
    "validation_status": "VALIDATED",
    "validation_notes": "Emergency caller and traffic camera confirmed collision",
    "emergency_id": 1
  },
  "emergency": {
    "id": 1,
    "accident_id": 1,
    "assigned_ambulance_id": null,
    "hospital_id": null,
    "status": "PENDING",
    "created_at": "2026-11-22T15:31:00",
    "updated_at": "2026-11-22T15:31:00",
    "completion_timestamp": null
  },
  "message": "Accident validated and emergency created."
}
```

---

### D. Register Ambulance
```http
POST /api/ambulances
Content-Type: application/json
```
**Request Body**:
```json
{
  "registration_number": "KA-01-EM-1080",
  "latitude": 12.9740,
  "longitude": 77.5960,
  "status": "AVAILABLE"
}
```
**Response (201 Created)**:
```json
{
  "id": 1,
  "registration_number": "KA-01-EM-1080",
  "latitude": 12.974,
  "longitude": 77.596,
  "status": "AVAILABLE",
  "last_updated": "2026-11-22T15:31:00",
  "created_at": "2026-11-22T15:31:00"
}
```

---

### E. Dispatch Nearest Ambulance
```http
POST /api/emergencies/1/dispatch
```
**Response (200 OK)**:
```json
{
  "emergency": {
    "id": 1,
    "accident_id": 1,
    "assigned_ambulance_id": 1,
    "status": "DISPATCHED"
  },
  "assigned_ambulance": {
    "id": 1,
    "registration_number": "KA-01-EM-1080",
    "status": "ASSIGNED"
  },
  "distance_km": 0.31,
  "assignment": {
    "id": 1,
    "emergency_id": 1,
    "ambulance_id": 1,
    "status": "ACTIVE"
  },
  "message": "Ambulance KA-01-EM-1080 dispatched successfully."
}
```

---

### F. Update Emergency Operational Status
```http
PATCH /api/emergencies/1/status
Content-Type: application/json
```
**Request Body**:
```json
{
  "status": "EN_ROUTE",
  "notes": "Ambulance dispatched and en route to scene"
}
```
*(Available statuses: `PENDING`, `DISPATCHED`, `EN_ROUTE`, `AT_SCENE`, `TRANSPORTING`, `COMPLETED`, `CANCELLED`)*

---

### G. Member 4 Routing Integration (Post Calculated Route)
```http
POST /api/routing/1
Content-Type: application/json
```
**Request Body**:
```json
{
  "emergency_id": 1,
  "distance_km": 4.8,
  "estimated_duration_minutes": 7.5,
  "route_geometry": {
    "type": "LineString",
    "coordinates": [[77.5946, 12.9716], [77.6000, 12.9750], [77.6100, 12.9800]]
  },
  "source": "MEMBER_4_OSMNX_ROUTING"
}
```
**Response (201 Created)**:
```json
{
  "id": 1,
  "emergency_id": 1,
  "distance_km": 4.8,
  "estimated_duration_minutes": 7.5,
  "source": "MEMBER_4_OSMNX_ROUTING",
  "created_at": "2026-11-22T15:32:00"
}
```

---

### H. Notifications (Simulated Event Recording)
```http
POST /api/notifications
Content-Type: application/json
```
**Request Body**:
```json
{
  "emergency_id": 1,
  "recipient": "Victoria Hospital Emergency Department",
  "notification_type": "HOSPITAL_ALERT",
  "message": "Inbound critical patient ETA 7 minutes."
}
```
**Response (201 Created)**:
```json
{
  "id": 1,
  "emergency_id": 1,
  "recipient": "Victoria Hospital Emergency Department",
  "notification_type": "HOSPITAL_ALERT",
  "message": "Inbound critical patient ETA 7 minutes.",
  "delivery_status": "SIMULATED_DELIVERED",
  "is_simulated": true,
  "timestamp": "2026-11-22T15:33:00"
}
```

---

## 10. Automated Tests

The test suite runs against an isolated SQLite in-memory database (`sqlite:///:memory:`). No development or production data is modified.

To execute all tests:
```bash
python -m pytest backend/tests -v
```

### Coverage Summary:
- Health & root endpoints (`test_health.py`)
- Database tables and relations creation (`test_database.py`)
- Sensor data ingestion & ML prediction handling (`test_accidents.py`)
- Normal prediction non-dispatch safeguard (`test_accidents.py`)
- Accident confirmation & emergency creation (`test_accidents.py`)
- Duplicate emergency prevention (`test_accidents.py`)
- Ambulance registration & telemetry updates (`test_ambulances.py`)
- Haversine nearest ambulance selection (`test_dispatch.py`)
- No available ambulance handling (`test_dispatch.py`)
- Double assignment prevention (`test_dispatch.py`)
- Emergency status progression, completion, cancellation (`test_emergencies.py`)
- Hospital registry & updates (`test_hospitals.py`)
- Simulated notification event logging (`test_notifications.py`)
- Routing integration boundary storage & retrieval (`test_routing.py`)
- ML service adapter, contract validation, and real model execution (`test_ml_service.py`)

---

## 11. Current Limitations & Teammate Boundaries

1. **Member 3 (ML Enhancements)**:
   - The current ML model is a binary classifier trained on the VZCrash dataset. It **does not** output injury severity (e.g., minor, severe, fatal).
   - False positives and false negatives are possible; explicit confirmation (`/validate`) remains mandatory.

2. **Member 4 (Route Optimization & Green Corridors)**:
   - The backend MVP uses straight-line Haversine distance for ambulance selection.
   - Road network pathfinding, OSMnx graph generation, congestion scoring, and traffic light preemption belong to Member 4's module, which connects via `POST /api/routing/{emergency_id}`.

3. **Member 5 (Hospital Dashboard & Alerts)**:
   - All notifications in this MVP are simulated events recorded with `is_simulated: true`.
   - Cellular carrier SMS, push notifications, and the live hospital UI belong to Member 5, utilizing `GET /api/notifications` and `POST /api/emergencies/{id}/assign-hospital`.

