# 🚑 SERN — Smart Emergency Response Network

**AI-Powered Accident Detection and Intelligent Emergency Response**

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
| Frontend | React, JavaScript, CSS |
| Backend | Python, FastAPI |
| Database | SQLAlchemy, SQLite |
| AI/ML | Python, Scikit-learn, Random Forest |
| API Documentation | Swagger / OpenAPI |
| Testing | Pytest, HTTPX |
| Version Control | Git, GitHub |

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

## 🚧 Current Development Status

SERN is under active development as a prototype.

Current implementation includes the backend core, accident detection ML module, and frontend foundation. Further integration and validation of routing, traffic management, and end-to-end emergency workflows are ongoing.

**Note:** Ambulance dispatch and notification workflows currently operate as prototype functionality. The system does not perform real-world emergency dispatch or guarantee live hospital or emergency-service connectivity.

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

**Repository:** [GitHub – SERN](https://github.com/isitamazumder05/SERN)

**Tagline:** Detect. Dispatch. Save Lives.

---

*Building a smarter, faster, and more coordinated emergency response ecosystem.*
