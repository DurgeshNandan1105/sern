import pytest
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


def test_dispatch_contention_preventing_reassignment(client):
    """
    Issue 2 Regression Test:
    Verify that when multiple emergencies sequentially contend for the same single available ambulance,
    the dispatch guard assigns the ambulance to the first eligible emergency and rejects the subsequent
    emergency with 503 (preventing double-assignment and leaving the database in a consistent state).
    Note: Tests sequential assignment rejection and state consistency; does not simulate simultaneous thread concurrency.
    """
    em1 = setup_emergency_with_client(client, lat=12.9716, lon=77.5946)
    em2 = setup_emergency_with_client(client, lat=12.9718, lon=77.5948)

    # Register only one available ambulance
    amb = client.post("/api/ambulances", json={
        "registration_number": "KA-01-ATOMIC-1",
        "latitude": 12.9717,
        "longitude": 77.5947,
        "status": "AVAILABLE"
    }).json()

    # First dispatch wins the ambulance
    disp1 = client.post(f"/api/emergencies/{em1}/dispatch")
    assert disp1.status_code == 200
    assert disp1.json()["assigned_ambulance"]["id"] == amb["id"]
    assert disp1.json()["emergency"]["status"] == "DISPATCHED"

    # Second dispatch must be rejected with 503
    disp2 = client.post(f"/api/emergencies/{em2}/dispatch")
    assert disp2.status_code == 503
    assert "No available ambulances found" in disp2.json()["detail"]

    # Re-dispatching on em1 must be rejected (already dispatched)
    disp1_retry = client.post(f"/api/emergencies/{em1}/dispatch")
    assert disp1_retry.status_code == 400
    assert "already dispatched" in disp1_retry.json()["detail"].lower()

    # Verify em2 remains in PENDING status
    em2_data = client.get(f"/api/emergencies/{em2}").json()
    assert em2_data["status"] == "PENDING"
    assert em2_data["assigned_ambulance_id"] is None

    # Verify ambulance has exactly one active assignment
    all_emergencies = client.get("/api/emergencies").json()
    assigned_count = sum(1 for e in all_emergencies if e.get("assigned_ambulance_id") == amb["id"])
    assert assigned_count == 1


def test_dispatch_notification_transaction_boundary(client, db_session):
    """
    Verify transaction boundary:
    1. A notification recorded during dispatch is persisted after a successful dispatch.
    2. A failed dispatch does not leave behind a partially committed notification.
    """
    from app.models.notification import Notification
    from app.models.assignment import Assignment

    em_id = setup_emergency_with_client(client, lat=12.9716, lon=77.5946)

    # Register an available ambulance
    amb = client.post("/api/ambulances", json={
        "registration_number": "KA-01-TX-TEST",
        "latitude": 12.9720,
        "longitude": 77.5950,
        "status": "AVAILABLE"
    }).json()

    # Case 1: Failure during dispatch transaction rolls back the notification
    # Simulate an error occurring right at commit time
    with pytest.raises(RuntimeError):
        with patch.object(db_session, "commit", side_effect=RuntimeError("Simulated database failure during commit")):
            client.post(f"/api/emergencies/{em_id}/dispatch")

    # Verify NO notification was committed for this emergency
    notifications = db_session.query(Notification).filter(Notification.emergency_id == em_id).all()
    assert len(notifications) == 0

    # Verify NO assignment was committed
    assignments = db_session.query(Assignment).filter(Assignment.emergency_id == em_id).all()
    assert len(assignments) == 0

    # Verify ambulance status remained/rolled back to AVAILABLE
    amb_check = client.get(f"/api/ambulances/{amb['id']}").json()
    assert amb_check["status"] == "AVAILABLE"

    # Case 2: Successful dispatch commits the notification along with the transaction
    success_resp = client.post(f"/api/emergencies/{em_id}/dispatch")
    assert success_resp.status_code == 200
    assert success_resp.json()["emergency"]["status"] == "DISPATCHED"

    # Verify notification IS now persisted in the database
    committed_notifs = db_session.query(Notification).filter(Notification.emergency_id == em_id).all()
    assert len(committed_notifs) == 1
    assert committed_notifs[0].notification_type == "DISPATCH_NOTICE"
    assert committed_notifs[0].is_simulated is True
    assert "KA-01-TX-TEST" in committed_notifs[0].recipient

