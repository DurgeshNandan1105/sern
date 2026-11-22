def test_hospital_registration_and_retrieval(client):
    """Test creating, reading, and updating hospital records."""
    hospital_payload = {
        "name": "Manipal Emergency Care",
        "address": "98 HAL Old Airport Rd, Bengaluru",
        "latitude": 12.9592,
        "longitude": 77.6534,
        "contact_information": "+91-80-2502-4444",
        "is_active": True
    }
    create_resp = client.post("/api/hospitals", json=hospital_payload)
    assert create_resp.status_code == 201
    hosp_data = create_resp.json()
    assert hosp_data["id"] is not None
    assert hosp_data["name"] == "Manipal Emergency Care"

    # Retrieve by ID
    get_resp = client.get(f"/api/hospitals/{hosp_data['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["contact_information"] == "+91-80-2502-4444"

    # Update hospital
    patch_resp = client.patch(
        f"/api/hospitals/{hosp_data['id']}",
        json={"contact_information": "+91-80-9999-0000"}
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["contact_information"] == "+91-80-9999-0000"

    # List hospitals
    all_hospitals = client.get("/api/hospitals").json()
    assert len(all_hospitals) >= 1

