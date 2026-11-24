import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_send_and_verify_otp_flow():
    # 1. Send OTP
    send_resp = client.post("/api/auth/send-otp", json={
        "phone": "9876543210",
        "email": "test@domain.com",
        "purpose": "TEST_LOGIN"
    })
    assert send_resp.status_code == 200
    data = send_resp.json()
    assert data["success"] is True
    assert "otp" in data
    assert len(data["otp"]) == 6
    otp_code = data["otp"]

    # 2. Verify with wrong OTP fails
    bad_verify = client.post("/api/auth/verify-otp", json={
        "identifier": "9876543210",
        "otp": "000000"
    })
    assert bad_verify.status_code == 400

    # 3. Verify with correct OTP succeeds
    good_verify = client.post("/api/auth/verify-otp", json={
        "identifier": "9876543210",
        "otp": otp_code
    })
    assert good_verify.status_code == 200
    assert good_verify.json()["verified"] is True


def test_dashboard_reset_to_zero():
    # 1. Create a sample accident
    sample_sensor = {
        "gsensor": [[10.0, 20.0, 30.0], [15.0, 25.0, 35.0]],
        "gyro": [[1.0, 2.0, 3.0], [1.5, 2.5, 3.5]],
        "gps_speed": [50.0, 10.0],
        "vehiclesize": "car",
        "gyro_is_hd": True
    }
    create_resp = client.post("/api/accidents", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "vehicle_size": "car",
        "gyro_is_hd": True,
        "sensor_data": sample_sensor
    })
    assert create_resp.status_code == 201

    # Verify accidents list is not empty
    accidents_list = client.get("/api/accidents").json()
    assert len(accidents_list) > 0

    # 2. Call reset endpoint
    reset_resp = client.post("/api/accidents/reset")
    assert reset_resp.status_code == 200
    assert reset_resp.json()["incidents_count"] == 0

    # 3. Verify accidents and emergencies are now 0
    clean_accidents = client.get("/api/accidents").json()
    assert len(clean_accidents) == 0

    clean_emergencies = client.get("/api/emergencies").json()
    assert len(clean_emergencies) == 0


def test_auth_token_issuance():
    # 1. Send OTP
    send_resp = client.post("/api/auth/send-otp", json={
        "phone": "9812345678",
        "email": "paramedic@sern.com",
        "purpose": "TEST_TOKEN"
    })
    otp_code = send_resp.json()["otp"]

    # 2. Verify OTP and receive JWT access token
    verify_resp = client.post("/api/auth/verify-otp", json={
        "identifier": "9812345678",
        "otp": otp_code,
        "role": "Ambulance Staff",
        "name": "Rajesh Kumar"
    })
    assert verify_resp.status_code == 200
    res_data = verify_resp.json()
    assert "token" in res_data
    assert len(res_data["token"].split(".")) == 3  # standard JWT
    assert res_data["user"]["role"] == "Ambulance Staff"


def test_ws_http_probe():
    # Verify GET /api/ws returns 200 OK without 400 Bad Request
    resp = client.get("/api/ws")
    assert resp.status_code == 200
    assert resp.json()["status"] == "online"


def test_dispatched_to_at_scene_transition():
    from unittest.mock import patch
    from app.services.ml_service import MLService
    from tests.conftest import MockPredictor

    # 1. Reset
    client.post("/api/accidents/reset")

    # 2. Create positive accident with mocked positive ML prediction
    mock_svc = MLService(predictor_instance=MockPredictor(detected=True, probability=0.89))
    with patch("app.routes.accidents.ml_service", mock_svc):
        acc_res = client.post("/api/accidents", json={
            "latitude": 12.9716,
            "longitude": 77.5946,
            "vehicle_size": "car",
            "gyro_is_hd": True,
            "sensor_data": {
                "gsensor": [[50.0, 60.0, 70.0]],
                "gyro": [[10.0, 20.0, 30.0]],
                "gps_speed": [90.0, 0.0],
                "vehiclesize": "car",
                "gyro_is_hd": True
            }
        }).json()

        val_res = client.post(f"/api/accidents/{acc_res['id']}/validate", json={
            "confirmed": True,
            "validation_notes": "Test crash",
            "auto_dispatch": True
        }).json()

    em_id = val_res["emergency"]["id"]
    assert val_res["emergency"]["status"] == "DISPATCHED"

    # 3. Transition directly from DISPATCHED to AT_SCENE (simulating GPS arrival)
    transition_res = client.patch(f"/api/emergencies/{em_id}/status", json={
        "status": "AT_SCENE"
    })
    assert transition_res.status_code == 200
    assert transition_res.json()["status"] == "AT_SCENE"


def test_user_register_and_login_flow():
    test_email = f"paramedic_{uuid.uuid4().hex[:8]}@sern.gov.in"
    test_password = "SecurePassword123!"

    # 1. Unregistered user attempting to login MUST be rejected and told to sign up
    unregistered_login = client.post("/api/auth/login", json={
        "email": test_email,
        "password": test_password
    })
    assert unregistered_login.status_code == 404
    assert "sign up first" in unregistered_login.json()["detail"].lower()

    # 2. Register user with email and password
    reg_resp = client.post("/api/auth/register", json={
        "name": "Dr. Ramesh Nair",
        "email": test_email,
        "password": test_password,
        "role": "Ambulance Staff",
        "credential_id": "KA-01-AMB-999"
    })
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert reg_data["success"] is True
    assert "token" in reg_data
    assert reg_data["user"]["email"] == test_email

    # 3. Duplicate registration is rejected with 409
    dup_resp = client.post("/api/auth/register", json={
        "name": "Dr. Ramesh Nair",
        "email": test_email,
        "password": test_password,
        "role": "Ambulance Staff"
    })
    assert dup_resp.status_code == 409

    # 4. Login with incorrect password is rejected with 401
    bad_pass_login = client.post("/api/auth/login", json={
        "email": test_email,
        "password": "WrongPassword!"
    })
    assert bad_pass_login.status_code == 401

    # 5. Login with correct email and password succeeds
    good_login = client.post("/api/auth/login", json={
        "email": test_email,
        "password": test_password
    })
    assert good_login.status_code == 200
    login_data = good_login.json()
    assert login_data["success"] is True
    assert "token" in login_data
    assert login_data["user"]["email"] == test_email


def test_role_based_authorization_citizen_forbidden():
    from app.routes.auth import create_access_token
    # Generate token for a Citizen Observer
    citizen_token = create_access_token({"sub": 999, "email": "citizen@test.com", "role": "Public Citizen"})
    headers = {"Authorization": f"Bearer {citizen_token}"}

    # Citizen trying to trigger traffic preemption must receive 403 Forbidden
    preempt_resp = client.post("/api/traffic/preempt", json={"intersection_id": "INT-01", "action": "TOGGLE"}, headers=headers)
    assert preempt_resp.status_code == 403
    assert "Access denied" in preempt_resp.json()["detail"]

    # Citizen trying to dispatch an ambulance must receive 403 Forbidden
    dispatch_resp = client.post("/api/emergencies/1/dispatch", headers=headers)
    assert dispatch_resp.status_code == 403
    assert "Access denied" in dispatch_resp.json()["detail"]
