from unittest.mock import patch
from app.services.ml_service import MLService
from tests.conftest import MockPredictor
from tests.test_accidents import sample_sensor_payload


def setup_emergency_with_client(client, lat=12.9716, lon=77.5946):
    mock_svc = MLService(predictor_instance=MockPredictor(detected=True, probability=0.85))
    with patch("app.routes.accidents.ml_service", mock_svc):
        payload = sample_sensor_payload()
        payload["latitude"] = lat
        payload["longitude"] = lon
        acc_resp = client.post("/api/accidents", json=payload)
        acc_id = acc_resp.json()["id"]

        val_resp = client.post(f"/api/accidents/{acc_id}/validate", json={"confirmed": True})
        return val_resp.json()["emergency"]["id"]


def test_nearest_ambulance_selection(client):
    """
    Test nearest ambulance selection using Haversine calculation.
    Target: Bangalore MG Road (12.9716, 77.5946).
    Amb 1: Near (12.9750, 77.5980) ~ 0.5 km.
    Amb 2: Far (13.1000, 77.7000) ~ 18 km.
    Should select Amb 1.
    """
    em_id = setup_emergency_with_client(client, lat=12.9716, lon=77.5946)

    # Register Amb 1 (Near)
    amb1 = client.post("/api/ambulances", json={
        "registration_number": "KA-01-NEAR",
        "latitude": 12.9750,
        "longitude": 77.5980,
        "status": "AVAILABLE"
    }).json()

    # Register Amb 2 (Far)
    client.post("/api/ambulances", json={
        "registration_number": "KA-01-FAR",
        "latitude": 13.1000,
        "longitude": 77.7000,
        "status": "AVAILABLE"
    })

    # Dispatch
    dispatch_resp = client.post(f"/api/emergencies/{em_id}/dispatch")
    assert dispatch_resp.status_code == 200
    data = dispatch_resp.json()
    assert data["assigned_ambulance"]["id"] == amb1["id"]
    assert data["assigned_ambulance"]["status"] == "ASSIGNED"
    assert data["emergency"]["status"] == "DISPATCHED"
    assert data["assignment"]["status"] == "ACTIVE"


def test_no_available_ambulance_handling(client):
    """Test dispatch response when all ambulances are unavailable or none registered."""
    em_id = setup_emergency_with_client(client)

    # Try dispatching with zero available ambulances
    resp = client.post(f"/api/emergencies/{em_id}/dispatch")
    assert resp.status_code == 503
    assert "No available ambulances found" in resp.json()["detail"]

    # Verify emergency remains in PENDING status
    em = client.get(f"/api/emergencies/{em_id}").json()
    assert em["status"] == "PENDING"
    assert em["assigned_ambulance_id"] is None


def test_prevent_double_assignment(client):
    """Test that an ambulance cannot be assigned to two active emergencies simultaneously."""
    em1 = setup_emergency_with_client(client, lat=12.9716, lon=77.5946)
    em2 = setup_emergency_with_client(client, lat=12.9720, lon=77.5950)

    # Only one ambulance available
    amb = client.post("/api/ambulances", json={
        "registration_number": "KA-ONLY-ONE",
        "latitude": 12.9718,
        "longitude": 77.5948,
        "status": "AVAILABLE"
    }).json()

    # Dispatch to first emergency
    disp1 = client.post(f"/api/emergencies/{em1}/dispatch")
    assert disp1.status_code == 200
    assert disp1.json()["assigned_ambulance"]["id"] == amb["id"]

    # Dispatch to second emergency must fail because no available ambulances remain
    disp2 = client.post(f"/api/emergencies/{em2}/dispatch")
    assert disp2.status_code == 503

