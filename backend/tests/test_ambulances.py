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

