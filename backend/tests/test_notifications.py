def test_notification_event_recording(client):
    """Test simulated notification recording and retrieval."""
    payload = {
        "recipient": "Victoria Hospital Trauma Center",
        "notification_type": "HOSPITAL_ALERT",
        "message": "Simulated alert: Inbound critical patient with ETA 7 minutes."
    }
    create_resp = client.post("/api/notifications", json=payload)
    assert create_resp.status_code == 201
    data = create_resp.json()
    assert data["id"] is not None
    assert data["is_simulated"] is True
    assert data["delivery_status"] == "SIMULATED_DELIVERED"
    assert data["notification_type"] == "HOSPITAL_ALERT"

    # Retrieve by ID
    get_resp = client.get(f"/api/notifications/{data['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["message"] == payload["message"]

