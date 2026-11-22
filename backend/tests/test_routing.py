from tests.test_dispatch import setup_emergency_with_client


def test_routing_information_storage_and_retrieval(client):
    """
    Test Member 4 routing boundary integration:
    - Accepts emergency ID and calculated route information
    - Stores distance, travel time, and geometry
    - Retrieves stored route
    """
    em_id = setup_emergency_with_client(client)

    route_payload = {
        "emergency_id": em_id,
        "distance_km": 6.8,
        "estimated_duration_minutes": 11.4,
        "route_geometry": {
            "type": "LineString",
            "coordinates": [[77.5946, 12.9716], [77.6200, 12.9800]]
        },
        "source": "MEMBER_4_OSMNX_ROUTING"
    }

    # Post route calculation from Member 4 module
    post_resp = client.post(f"/api/routing/{em_id}", json=route_payload)
    assert post_resp.status_code == 201
    route_data = post_resp.json()
    assert route_data["emergency_id"] == em_id
    assert route_data["distance_km"] == 6.8
    assert route_data["estimated_duration_minutes"] == 11.4
    assert route_data["source"] == "MEMBER_4_OSMNX_ROUTING"

    # Retrieve stored route
    get_resp = client.get(f"/api/routing/{em_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["distance_km"] == 6.8


def test_dev_mock_route_generation(client):
    """Test developer mock route endpoint for isolated testing."""
    em_id = setup_emergency_with_client(client)

    mock_resp = client.post(f"/api/routing/{em_id}/mock")
    assert mock_resp.status_code == 200
    mock_data = mock_resp.json()
    assert mock_data["emergency_id"] == em_id
    assert mock_data["source"] == "MEMBER_4_ROUTING_MOCK_DEV"

