from unittest.mock import patch
from app.services.ml_service import MLService
from tests.conftest import MockPredictor


def sample_sensor_payload():
    return {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "sensor_data": {
            "gsensor": [[0.1, 0.2, 9.8], [0.2, 0.1, 9.7]],
            "gyro": [[0.01, 0.02, 0.03], [0.02, 0.01, 0.04]],
            "gps_speed": [40.0, 38.0],
            "vehiclesize": "car",
            "gyro_is_hd": True
        }
    }


def test_accident_registration_positive_prediction(client):
    """Test accident registration when ML predicts an accident."""
    mock_svc = MLService(predictor_instance=MockPredictor(detected=True, probability=0.82))
    with patch("app.routes.accidents.ml_service", mock_svc):
        response = client.post("/api/accidents", json=sample_sensor_payload())
        assert response.status_code == 201
        data = response.json()
        assert data["id"] is not None
        assert data["accident_prediction"] is True
        assert data["accident_probability"] == 0.82
        assert data["validation_status"] == "PENDING"
        assert data["emergency_id"] is None


def test_normal_prediction_does_not_create_emergency(client):
    """Test that normal (no accident) prediction does NOT create an emergency."""
    mock_svc = MLService(predictor_instance=MockPredictor(detected=False, probability=0.10))
    with patch("app.routes.accidents.ml_service", mock_svc):
        response = client.post("/api/accidents", json=sample_sensor_payload())
        assert response.status_code == 201
        data = response.json()
        assert data["accident_prediction"] is False
        assert data["validation_status"] == "NORMAL"
        assert data["emergency_id"] is None

        # Confirm no emergency was created in the system
        emergencies_resp = client.get("/api/emergencies")
        assert len(emergencies_resp.json()) == 0


def test_accident_validation_creates_emergency(client):
    """Test validating an accident creates an emergency."""
    mock_svc = MLService(predictor_instance=MockPredictor(detected=True, probability=0.75))
    with patch("app.routes.accidents.ml_service", mock_svc):
        reg_resp = client.post("/api/accidents", json=sample_sensor_payload())
        accident_id = reg_resp.json()["id"]

        val_resp = client.post(
            f"/api/accidents/{accident_id}/validate",
            json={"confirmed": True, "validation_notes": "CCTV verified incident"}
        )
        assert val_resp.status_code == 200
        val_data = val_resp.json()
        assert val_data["accident"]["validation_status"] == "VALIDATED"
        assert val_data["emergency"] is not None
        assert val_data["emergency"]["accident_id"] == accident_id
        assert val_data["emergency"]["status"] == "PENDING"


def test_duplicate_emergency_prevention(client):
    """Test that validating the same accident multiple times does not create duplicate emergencies."""
    mock_svc = MLService(predictor_instance=MockPredictor(detected=True, probability=0.80))
    with patch("app.routes.accidents.ml_service", mock_svc):
        reg_resp = client.post("/api/accidents", json=sample_sensor_payload())
        accident_id = reg_resp.json()["id"]

        # First validation
        val_resp1 = client.post(
            f"/api/accidents/{accident_id}/validate",
            json={"confirmed": True}
        )
        assert val_resp1.status_code == 200
        em_id1 = val_resp1.json()["emergency"]["id"]

        # Second validation attempt
        val_resp2 = client.post(
            f"/api/accidents/{accident_id}/validate",
            json={"confirmed": True, "validation_notes": "Duplicate confirmation attempt"}
        )
        assert val_resp2.status_code == 200
        em_id2 = val_resp2.json()["emergency"]["id"]

        # Emergency ID must remain identical
        assert em_id1 == em_id2

        # Check total emergencies in database is exactly 1
        all_emergencies = client.get("/api/emergencies").json()
        assert len(all_emergencies) == 1


def test_accident_validation_rejection(client):
    """Test rejecting an accident candidate."""
    mock_svc = MLService(predictor_instance=MockPredictor(detected=True, probability=0.60))
    with patch("app.routes.accidents.ml_service", mock_svc):
        reg_resp = client.post("/api/accidents", json=sample_sensor_payload())
        accident_id = reg_resp.json()["id"]

        val_resp = client.post(
            f"/api/accidents/{accident_id}/validate",
            json={"confirmed": False, "validation_notes": "False alarm - speed bump"}
        )
        assert val_resp.status_code == 200
        val_data = val_resp.json()
        assert val_data["accident"]["validation_status"] == "REJECTED"
        assert val_data["emergency"] is None


def test_accident_validation_auto_dispatch(client):
    """
    Test auto-dispatch integration when validating an accident:
    - Mock predictor returns positive accident (probability = 0.82)
    - Initial registration creates NO emergency
    - Available ambulance is registered
    - Validating with auto_dispatch=True triggers dispatch
    - Verifies emergency, ambulance, assignment, and notification records
    """
    mock_svc = MLService(predictor_instance=MockPredictor(detected=True, probability=0.82))
    with patch("app.routes.accidents.ml_service", mock_svc):
        # 1. Register accident
        reg_resp = client.post("/api/accidents", json=sample_sensor_payload())
        assert reg_resp.status_code == 201
        acc_data = reg_resp.json()
        accident_id = acc_data["id"]
        assert acc_data["accident_prediction"] is True
        assert acc_data["accident_probability"] == 0.82

        # 2. Confirm no emergency exists prior to validation
        emergencies_before = client.get("/api/emergencies").json()
        assert len(emergencies_before) == 0

        # 3. Register available ambulance with illustrative coordinates
        amb_resp = client.post("/api/ambulances", json={
            "registration_number": "KA-01-AUTO-1",
            "latitude": 12.9720,
            "longitude": 77.5950,
            "status": "AVAILABLE"
        })
        assert amb_resp.status_code == 201
        amb_id = amb_resp.json()["id"]

        # 4. Validate with auto_dispatch = True
        val_resp = client.post(
            f"/api/accidents/{accident_id}/validate",
            json={
                "confirmed": True,
                "auto_dispatch": True,
                "validation_notes": "Confirmed crash requiring immediate dispatch"
            }
        )
        assert val_resp.status_code == 200
        val_data = val_resp.json()

        # 5. Verify exactly one Emergency exists and is DISPATCHED
        emergencies_after = client.get("/api/emergencies").json()
        assert len(emergencies_after) == 1
        emergency = emergencies_after[0]
        assert emergency["id"] == val_data["emergency"]["id"]
        assert emergency["status"] == "DISPATCHED"
        assert emergency["assigned_ambulance_id"] == amb_id

        # 6. Verify ambulance status is now ASSIGNED
        amb_current = client.get(f"/api/ambulances/{amb_id}").json()
        assert amb_current["status"] == "ASSIGNED"

        # 7. Verify exactly one active assignment exists
        assignments = emergency.get("assignments", [])
        assert len(assignments) == 1
        assert assignments[0]["ambulance_id"] == amb_id
        assert assignments[0]["status"] == "ACTIVE"

        # 8. Verify simulated dispatch notification is recorded
        notif_resp = client.get(f"/api/notifications?emergency_id={emergency['id']}")
        assert notif_resp.status_code == 200
        notifs = notif_resp.json()
        assert len(notifs) >= 1
        dispatch_notifs = [n for n in notifs if n["notification_type"] == "DISPATCH_NOTICE"]
        assert len(dispatch_notifs) == 1
        assert dispatch_notifs[0]["is_simulated"] is True
        assert dispatch_notifs[0]["delivery_status"] == "SIMULATED_DELIVERED"
        assert "KA-01-AUTO-1" in dispatch_notifs[0]["recipient"]


def test_accidents_query_filters(client):
    """Test accident list filtering by validation_status and detected_only."""
    mock_svc_pos = MLService(predictor_instance=MockPredictor(detected=True, probability=0.85))
    mock_svc_neg = MLService(predictor_instance=MockPredictor(detected=False, probability=0.10))

    # Accident 1: Positive detection, to be validated
    with patch("app.routes.accidents.ml_service", mock_svc_pos):
        acc1 = client.post("/api/accidents", json=sample_sensor_payload()).json()
        client.post(f"/api/accidents/{acc1['id']}/validate", json={"confirmed": True})

    # Accident 2: Positive detection, stays PENDING
    with patch("app.routes.accidents.ml_service", mock_svc_pos):
        acc2 = client.post("/api/accidents", json=sample_sensor_payload()).json()

    # Accident 3: Negative detection (NORMAL)
    with patch("app.routes.accidents.ml_service", mock_svc_neg):
        acc3 = client.post("/api/accidents", json=sample_sensor_payload()).json()

    # Test validation_status filter matching
    resp_validated = client.get("/api/accidents?validation_status=VALIDATED").json()
    assert len(resp_validated) == 1
    assert resp_validated[0]["id"] == acc1["id"]

    resp_pending = client.get("/api/accidents?validation_status=PENDING").json()
    assert len(resp_pending) == 1
    assert resp_pending[0]["id"] == acc2["id"]

    resp_normal = client.get("/api/accidents?validation_status=NORMAL").json()
    assert len(resp_normal) == 1
    assert resp_normal[0]["id"] == acc3["id"]

    # Test validation_status filter non-matching
    resp_rejected = client.get("/api/accidents?validation_status=REJECTED").json()
    assert len(resp_rejected) == 0

    # Test detected_only filter
    resp_detected = client.get("/api/accidents?detected_only=true").json()
    assert len(resp_detected) == 2
    assert all(a["accident_prediction"] is True for a in resp_detected)

    resp_not_detected = client.get("/api/accidents?detected_only=false").json()
    assert len(resp_not_detected) == 1
    assert resp_not_detected[0]["id"] == acc3["id"]
    assert resp_not_detected[0]["accident_prediction"] is False


def test_cannot_confirm_normal_prediction(client):
    """
    Issue 1 Regression Test:
    Verify that an accident with accident_prediction=False (validation_status=NORMAL)
    cannot be manually confirmed to create an Emergency record.
    """
    mock_svc = MLService(predictor_instance=MockPredictor(detected=False, probability=0.12))
    with patch("app.routes.accidents.ml_service", mock_svc):
        reg_resp = client.post("/api/accidents", json=sample_sensor_payload())
        assert reg_resp.status_code == 201
        acc_data = reg_resp.json()
        assert acc_data["accident_prediction"] is False
        assert acc_data["validation_status"] == "NORMAL"
        accident_id = acc_data["id"]

        # Attempt to confirm normal prediction
        val_resp = client.post(
            f"/api/accidents/{accident_id}/validate",
            json={"confirmed": True, "validation_notes": "Attempting invalid confirmation"}
        )
        assert val_resp.status_code == 400
        assert "no accident was detected" in val_resp.json()["detail"].lower()

        # Verify no Emergency was created
        emergencies = client.get("/api/emergencies").json()
        assert len(emergencies) == 0

        # Verify accident validation status remains NORMAL
        acc_check = client.get(f"/api/accidents/{accident_id}").json()
        assert acc_check["validation_status"] == "NORMAL"
        assert acc_check["emergency_id"] is None


def test_cannot_confirm_already_rejected_accident(client):
    """
    Issue 1 Regression Test:
    Verify that a previously rejected / false-alarm accident cannot subsequently be confirmed.
    """
    mock_svc = MLService(predictor_instance=MockPredictor(detected=True, probability=0.70))
    with patch("app.routes.accidents.ml_service", mock_svc):
        reg_resp = client.post("/api/accidents", json=sample_sensor_payload())
        accident_id = reg_resp.json()["id"]

        # Reject it first
        rej_resp = client.post(
            f"/api/accidents/{accident_id}/validate",
            json={"confirmed": False, "validation_notes": "Identified as pothole"}
        )
        assert rej_resp.status_code == 200
        assert rej_resp.json()["accident"]["validation_status"] == "REJECTED"

        # Attempt to confirm after rejection
        conf_resp = client.post(
            f"/api/accidents/{accident_id}/validate",
            json={"confirmed": True, "validation_notes": "Trying to confirm rejected incident"}
        )
        assert conf_resp.status_code == 400
        assert "REJECTED" in conf_resp.json()["detail"]

        # Verify no Emergency exists
        emergencies = client.get("/api/emergencies").json()
        assert len(emergencies) == 0

