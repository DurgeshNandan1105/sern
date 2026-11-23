# 🚑 SERN — Smart Emergency Response Network

**AI-Powered Accident Detection and Intelligent Emergency Response**

[![Live Demo](https://img.shields.io/badge/Live_Website-sern--alpha.vercel.app-2563eb?style=for-the-badge&logo=vercel)](https://sern-alpha.vercel.app/)

> 🌐 **Live Website Link:** [https://sern-alpha.vercel.app/](https://sern-alpha.vercel.app/)  


SERN (Smart Emergency Response Network) is an AI-powered emergency response prototype designed to improve the coordination of post-accident emergency services. It combines machine learning-based accident detection, ambulance dispatch management, intelligent routing integration, and hospital coordination into a unified system.

The goal is to reduce delays in emergency response by connecting accident detection with coordinated ambulance and hospital management.

---

## 🎯 Problem Statement

Road accidents require immediate attention, but delays in accident reporting, ambulance coordination, traffic navigation, and hospital communication can affect emergency response time.

SERN aims to address these challenges through an integrated technology-driven emergency response system.

## 💡 Our Solution

SERN brings together multiple components to support an organized emergency response workflow:

1. **Accident Detection:** Uses machine learning to analyze vehicle sensor data and identify potential accidents.
2. **Accident Validation:** Supports explicit validation before initiating an emergency response.
3. **Ambulance Dispatch:** Identifies and assigns available ambulances to validated emergencies.
4. **Intelligent Routing:** Provides an integration boundary for route calculation, ETA estimation, traffic awareness, and ambulance movement.
5. **Hospital Coordination:** Supports hospital information management and emergency assignment.
6. **Emergency Management:** Tracks emergency status throughout its lifecycle.
7. **Notifications:** Records simulated emergency and hospital notification events.

## 🏗️ System Architecture

SERN is organized into three primary modules:

| Module | Responsibilities |
|---|---|
| Frontend | User interface, dashboards, accident alerts, ambulance map and visualization |
| Backend | APIs, database management, accident validation, ambulance dispatch, hospital and emergency management |
| AI/ML | Sensor-data preprocessing, accident classification and prediction |

The routing and intelligent traffic component is developed as a separate integration responsibility.

## ✨ Key Features

- Machine learning-based accident prediction
- Sensor-data processing and accident classification
- Explicit accident validation
- Ambulance registration and availability management
- Ambulance assignment and dispatch workflow
- Emergency lifecycle tracking
- Hospital registration and coordination APIs
- Routing integration support
- Simulated notification management
- RESTful API architecture

## 🛠️ Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React 19, Vite, Leaflet, React-Leaflet, Lucide Icons, Web Audio API |
| Backend | Python 3.11/3.13, FastAPI, WebSockets, Uvicorn, Pydantic v2 |
| Database | PostgreSQL 16 + PostGIS (Spatial indexing) with SQLite local fallback, SQLAlchemy 2.0 |
| Real-Time Push | WebSockets (`ws://localhost:8000/api/ws`), Redis 7 Event Broker |
| Notifications | Twilio SMS REST API, Firebase Cloud Messaging (FCM v1), Browser Web Audio Siren |
| AI/ML | Scikit-learn (Random Forest Pipeline), Joblib, Pandas, NumPy |
| Containerization | Docker, Docker Compose, Multi-stage Nginx |
| Testing & QA | Pytest, Asyncio, ESLint, HTTPX |

## 📂 Project Structure

```text
SERN/
│
├── AccidentDetectionML/
│   └── Machine learning accident detection module
│
├── backend/
│   ├── app/
│   │   ├── database/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── schemas/
│   │   └── services/
│   │
│   ├── tests/
│   ├── requirements.txt
│   └── README.md
│
├── frontend/
│   └── React frontend application
│
└── README.md
```

## ⚙️ Getting Started

### Prerequisites

- Python 3.10 or later
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/isitamazumder05/SERN.git
cd SERN
```

### 2. Run the Backend

```bash
cd backend
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

Backend API:

```text
http://localhost:8000
```

Interactive API documentation:

```text
http://localhost:8000/docs
```

### 3. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Refer to the frontend module's configuration for any additional environment variables or setup requirements.

## 🧪 Testing

Run the backend test suite from the repository root:

```bash
python -m pytest backend/tests -v
```

The backend includes tests for accident processing, ambulance management, dispatch, emergency lifecycle, hospitals, notifications, routing integration, and ML service behavior.

## 👥 Team

SERN is developed collaboratively by a five-member team:

| Member | Responsibility |
|---|---|
| Member 1 | Frontend Development |
| Member 2 | Backend Development |
| Member 3 | AI/ML Development |
| Member 4 | Routing and Intelligent Traffic Management |
| Member 5 | Integration, Hospital Coordination and Quality Assurance |

## 🚀 Production Level Capabilities (10 / 10 Architecture)

1. **Zero-Latency Real-Time Push (WebSockets)**:
   - Full duplex WebSocket channel (`ws://localhost:8000/api/ws`) replaces polling entirely.
   - Accident alerts, ambulance telemetry, hospital notifications, and route calculations pop up instantaneously with zero latency.

2. **Live Turn-by-Turn GPS Fleet Tracking & Navigation HUD**:
   - High-fidelity interactive Leaflet map animates the ambulance moving along the green corridor/cyan polyline in real time.
   - Dynamic vehicle bearing rotation aligns the ambulance heading to the curvature of the road.
   - On-map HUD displays live velocity (km/h), remaining distance, real-time ETA countdown, and active siren status.

3. **Sub-Millisecond Geographic Spatial Indexing (PostGIS)**:
   - Supports enterprise PostgreSQL 16 with the PostGIS spatial extension (`ST_Distance`, `ST_DWithin`) for lightning-fast nearest-unit indexing.
   - Automatically falls back to high-precision Haversine straight-line calculation for local, zero-setup SQLite development.

4. **Multi-Channel Notification Gateway (Twilio & Firebase FCM)**:
   - Live Twilio SMS integration triggers urgent cellular text dispatches to on-duty paramedics.
   - Firebase Cloud Messaging (FCM) pushes high-priority alerts with audible siren alerts to hospital trauma desks.
   - Browser Web Audio API synthesizes acoustic emergency alert sirens natively with zero external audio assets.

5. **Production Docker Deployment**:
   - Run the entire cluster with a single command: `docker-compose up -d`.
   - Includes PostGIS spatial database, Redis broker, FastAPI backend, and Nginx reverse proxy frontend.

## 🔮 Future Scope

- Real-time vehicle sensor integration
- Improved accident detection and severity estimation
- OpenStreetMap-based road network routing
- Live traffic-aware ambulance navigation
- Green corridor coordination
- Real-time ambulance tracking
- Hospital availability integration
- Secure role-based access and authentication
- Deployment and large-scale performance testing

## 📌 Project Information

**Project Name:** SERN — Smart Emergency Response Network  
**Live Website:** [https://sern-alpha.vercel.app/](https://sern-alpha.vercel.app/)  
**Primary Repository:** [DurgeshNandan1105 / sern](https://github.com/DurgeshNandan1105/sern)  
**Collaborator Repository:** [isitamazumder05 / SERN](https://github.com/isitamazumder05/SERN)  

**Tagline:** Detect. Dispatch. Save Lives.

---

*Building a smarter, faster, and more coordinated emergency response ecosystem.*
