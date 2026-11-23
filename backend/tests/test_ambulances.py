def test_ambulance_registration_and_retrieval(client):
    """Test registering an ambulance and retrieving it by ID and list."""
    payload = {
        "registration_number": "KA-01-EA-1234",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "status": "AVAILABLE"
    }
    create_resp = client.post("/api/ambulances", json=payload)
    assert create_resp.status_code == 201
    amb_data = create_resp.json()
    assert amb_data["id"] is not None
    assert amb_data["registration_number"] == "KA-01-EA-1234"
    assert amb_data["status"] == "AVAILABLE"

    # Duplicate registration prevention
    dup_resp = client.post("/api/ambulances", json=payload)
    assert dup_resp.status_code == 409

    # Retrieve by ID
    get_resp = client.get(f"/api/ambulances/{amb_data['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["registration_number"] == "KA-01-EA-1234"


def test_ambulance_location_and_availability_updates(client):
    """Test updating ambulance coordinates and availability."""
    amb = client.post("/api/ambulances", json={
        "registration_number": "KA-02-ZZ-9999",
        "latitude": 12.9000,
        "longitude": 77.5000,
        "status": "AVAILABLE"
    }).json()

    # Update location
    loc_resp = client.patch(
        f"/api/ambulances/{amb['id']}/location",
        json={"latitude": 12.9500, "longitude": 77.5500}
    )
    assert loc_resp.status_code == 200
    assert loc_resp.json()["latitude"] == 12.9500
    assert loc_resp.json()["longitude"] == 77.5500

    # Update availability
    avail_resp = client.patch(
        f"/api/ambulances/{amb['id']}/availability",
        json={"status": "UNAVAILABLE"}
    )
    assert avail_resp.status_code == 200
    assert avail_resp.json()["status"] == "UNAVAILABLE"

    # Filter by status
    list_avail = client.get("/api/ambulances?status=AVAILABLE").json()
    assert all(a["status"] == "AVAILABLE" for a in list_avail)


def test_cannot_change_availability_during_active_assignment(client):
    """
    Issue 4 Regression Test:
    Verify that an ambulance with an active assignment cannot be manually marked AVAILABLE or UNAVAILABLE,
    and that completion/cancellation properly restores availability.
    """
    from tests.test_dispatch import setup_emergency_with_client

    em_id = setup_emergency_with_client(client)

    # Register an available ambulance
    amb = client.post("/api/ambulances", json={
        "registration_number": "KA-01-ASSIGN-LOCK",
        "latitude": 12.9720,
        "longitude": 77.5950,
        "status": "AVAILABLE"
    }).json()
    amb_id = amb["id"]

    # Dispatch ambulance to the emergency
    disp = client.post(f"/api/emergencies/{em_id}/dispatch")
    assert disp.status_code == 200
    assert client.get(f"/api/ambulances/{amb_id}").json()["status"] == "ASSIGNED"

    # 1. Attempt to manually set availability to AVAILABLE while assigned -> 409 Conflict
    patch_avail = client.patch(
        f"/api/ambulances/{amb_id}/availability",
        json={"status": "AVAILABLE"}
    )
    assert patch_avail.status_code == 409
    assert "active assignment" in patch_avail.json()["detail"].lower()

    # 2. Attempt to manually set availability to UNAVAILABLE while assigned -> 409 Conflict
    patch_unavail = client.patch(
        f"/api/ambulances/{amb_id}/availability",
        json={"status": "UNAVAILABLE"}
    )
    assert patch_unavail.status_code == 409
    assert "active assignment" in patch_unavail.json()["detail"].lower()

    # 3. Attempt general PATCH with status change -> 409 Conflict
    patch_general = client.patch(
        f"/api/ambulances/{amb_id}",
        json={"status": "AVAILABLE"}
    )
    assert patch_general.status_code == 409
    assert "active assignment" in patch_general.json()["detail"].lower()

    # Ambulance status must still be ASSIGNED
    assert client.get(f"/api/ambulances/{amb_id}").json()["status"] == "ASSIGNED"

    # 4. Location update during active assignment SHOULD be permitted (telemetry continues)
    loc_update = client.patch(
        f"/api/ambulances/{amb_id}/location",
        json={"latitude": 12.9730, "longitude": 77.5960}
    )
    assert loc_update.status_code == 200
    assert loc_update.json()["latitude"] == 12.9730

    # 5. Complete emergency lifecycle -> releases ambulance back to AVAILABLE
    client.patch(f"/api/emergencies/{em_id}/status", json={"status": "EN_ROUTE"})
    client.patch(f"/api/emergencies/{em_id}/status", json={"status": "AT_SCENE"})
    comp = client.post(f"/api/emergencies/{em_id}/complete")
    assert comp.status_code == 200

    # Verify ambulance is now AVAILABLE
    freed_amb = client.get(f"/api/ambulances/{amb_id}").json()
    assert freed_amb["status"] == "AVAILABLE"

    # 6. Now that the ambulance is unassigned, manual availability change IS permitted
    unavail_resp = client.patch(
        f"/api/ambulances/{amb_id}/availability",
        json={"status": "UNAVAILABLE"}
    )
    assert unavail_resp.status_code == 200
    assert unavail_resp.json()["status"] == "UNAVAILABLE"

    avail_resp = client.patch(
        f"/api/ambulances/{amb_id}/availability",
        json={"status": "AVAILABLE"}
    )
    assert avail_resp.status_code == 200
    assert avail_resp.json()["status"] == "AVAILABLE"


def test_ambulance_telemetry_streaming(client):
    """
    Test real-time GPS telemetry ingestion endpoint.
    Verifies that latitude, longitude, velocity, heading, and ETA can be updated.
    """
    amb = client.post("/api/ambulances", json={
        "registration_number": "KA-04-TELEMETRY",
        "latitude": 12.9100,
        "longitude": 77.5800,
        "status": "AVAILABLE"
    }).json()

    amb_id = amb["id"]

    telem_payload = {
        "latitude": 12.9250,
        "longitude": 77.5950,
        "speed_kmh": 62.5,
        "heading_deg": 145.0,
        "distance_remaining_km": 2.4,
        "eta_seconds": 138,
        "status": "EN_ROUTE"
    }

    resp = client.post(f"/api/ambulances/{amb_id}/telemetry", json=telem_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["latitude"] == 12.9250
    assert data["longitude"] == 77.5950
    assert data["status"] == "EN_ROUTE"


def test_websocket_stream_connection(client):
    """
    Test live WebSocket push connection handshake and ping/pong exchange.
    """
    with client.websocket_connect("/api/ws") as websocket:
        initial = websocket.receive_json()
        assert initial["type"] == "CONNECTION_ESTABLISHED"
        websocket.send_text("ping")
        pong = websocket.receive_json()
        assert pong["type"] == "pong"

