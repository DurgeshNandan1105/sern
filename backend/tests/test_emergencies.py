from tests.test_dispatch import setup_emergency_with_client


def test_emergency_status_transitions_and_completion(client):
    """Test emergency status lifecycle: PENDING -> DISPATCHED -> EN_ROUTE -> AT_SCENE -> COMPLETED."""
    em_id = setup_emergency_with_client(client)

    # Register an ambulance and dispatch
    amb = client.post("/api/ambulances", json={
        "registration_number": "KA-05-LIFE",
        "latitude": 12.9700,
        "longitude": 77.5900,
        "status": "AVAILABLE"
    }).json()

    client.post(f"/api/emergencies/{em_id}/dispatch")

    # Update to EN_ROUTE
    en_route_resp = client.patch(
        f"/api/emergencies/{em_id}/status",
        json={"status": "EN_ROUTE", "notes": "Ambulance rolling out"}
    )
    assert en_route_resp.status_code == 200
    assert en_route_resp.json()["status"] == "EN_ROUTE"
    assert client.get(f"/api/ambulances/{amb['id']}").json()["status"] == "EN_ROUTE"

    # Update to AT_SCENE
    scene_resp = client.patch(
        f"/api/emergencies/{em_id}/status",
        json={"status": "AT_SCENE"}
    )
    assert scene_resp.status_code == 200
    assert scene_resp.json()["status"] == "AT_SCENE"
    assert client.get(f"/api/ambulances/{amb['id']}").json()["status"] == "AT_SCENE"

    # Complete emergency
    complete_resp = client.post(f"/api/emergencies/{em_id}/complete")
    assert complete_resp.status_code == 200
    assert complete_resp.json()["status"] == "COMPLETED"
    assert complete_resp.json()["completion_timestamp"] is not None

    # Verify ambulance is now AVAILABLE again
    amb_after = client.get(f"/api/ambulances/{amb['id']}").json()
    assert amb_after["status"] == "AVAILABLE"


def test_emergency_cancellation(client):
    """Test cancelling an emergency frees the assigned ambulance."""
    em_id = setup_emergency_with_client(client)

    amb = client.post("/api/ambulances", json={
        "registration_number": "KA-06-CANCEL",
        "latitude": 12.9700,
        "longitude": 77.5900,
        "status": "AVAILABLE"
    }).json()

    client.post(f"/api/emergencies/{em_id}/dispatch")

    # Cancel emergency
    cancel_resp = client.post(f"/api/emergencies/{em_id}/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "CANCELLED"

    # Verify ambulance freed
    assert client.get(f"/api/ambulances/{amb['id']}").json()["status"] == "AVAILABLE"


def test_emergency_hospital_assignment(client):
    """
    Test hospital assignment to an emergency:
    - Verifies hospital reference is set on the emergency
    - Verifies simulated HOSPITAL_ALERT notification is created
    - Verifies non-existent hospital assignment returns 400 Bad Request
    """
    em_id = setup_emergency_with_client(client)

    # Register hospital
    hosp_resp = client.post("/api/hospitals", json={
        "name": "Apollo Emergency Center",
        "address": "154/11 Bannerghatta Main Rd, Bengaluru",
        "latitude": 12.8950,
        "longitude": 77.5980,
        "contact_information": "+91-80-2630-4050",
        "is_active": True
    })
    assert hosp_resp.status_code == 201
    hosp_id = hosp_resp.json()["id"]

    # Assign hospital to emergency
    assign_resp = client.post(
        f"/api/emergencies/{em_id}/assign-hospital",
        json={"hospital_id": hosp_id}
    )
    assert assign_resp.status_code == 200
    em_data = assign_resp.json()
    assert em_data["hospital_id"] == hosp_id
    assert em_data["hospital"] is not None
    assert em_data["hospital"]["id"] == hosp_id
    assert em_data["hospital"]["name"] == "Apollo Emergency Center"

    # Verify notification recorded
    notif_resp = client.get(f"/api/notifications?emergency_id={em_id}")
    assert notif_resp.status_code == 200
    notifs = notif_resp.json()
    hosp_notifs = [n for n in notifs if n["notification_type"] == "HOSPITAL_ALERT"]
    assert len(hosp_notifs) == 1
    assert hosp_notifs[0]["hospital_id"] == hosp_id
    assert hosp_notifs[0]["recipient"] == "Apollo Emergency Center"
    assert hosp_notifs[0]["is_simulated"] is True
    assert hosp_notifs[0]["delivery_status"] == "SIMULATED_DELIVERED"

    # Verify assigning non-existent hospital returns 400
    invalid_assign = client.post(
        f"/api/emergencies/{em_id}/assign-hospital",
        json={"hospital_id": 99999}
    )
    assert invalid_assign.status_code == 400
    assert "not found" in invalid_assign.json()["detail"].lower()


def test_emergencies_query_filter_by_status(client):
    """Test emergency list filtering by status."""
    # Emergency 1
    em1_id = setup_emergency_with_client(client, lat=12.9716, lon=77.5946)
    # Register ambulance and dispatch to Emergency 1
    amb = client.post("/api/ambulances", json={
        "registration_number": "KA-FILTER-1",
        "latitude": 12.9720,
        "longitude": 77.5950,
        "status": "AVAILABLE"
    }).json()
    client.post(f"/api/emergencies/{em1_id}/dispatch")
    client.patch(f"/api/emergencies/{em1_id}/status", json={"status": "EN_ROUTE"})

    # Emergency 2 stays PENDING
    em2_id = setup_emergency_with_client(client, lat=12.9800, lon=77.6000)

    # Filter matching EN_ROUTE
    en_route_list = client.get("/api/emergencies?status=EN_ROUTE").json()
    assert len(en_route_list) == 1
    assert en_route_list[0]["id"] == em1_id
    assert en_route_list[0]["status"] == "EN_ROUTE"

    # Filter matching PENDING
    pending_list = client.get("/api/emergencies?status=PENDING").json()
    assert len(pending_list) == 1
    assert pending_list[0]["id"] == em2_id
    assert pending_list[0]["status"] == "PENDING"

    # Filter non-matching COMPLETED
    completed_list = client.get("/api/emergencies?status=COMPLETED").json()
    assert len(completed_list) == 0

