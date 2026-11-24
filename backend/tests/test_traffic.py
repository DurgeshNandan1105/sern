def test_traffic_intersections_endpoint(client):
    """Test retrieving traffic intersections and signal statuses."""
    resp = client.get("/api/traffic/intersections")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 8
    first = data[0]
    assert "id" in first
    assert "signal_state" in first
    assert "congestion_index" in first
    assert "roads" in first


def test_traffic_signal_preemption_toggle(client):
    """Test manual signal preemption for emergency priority."""
    resp = client.post("/api/traffic/preempt", json={
        "intersection_id": "INT-MG-BRG",
        "action": "TOGGLE"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "INT-MG-BRG"
    assert data["signal_state"] in ["GREEN_PREEMPTION", "NORMAL_CYCLE"]


def test_traffic_congestion_update(client):
    """Test updating congestion index on road network."""
    resp = client.post("/api/traffic/congestion", json={
        "intersection_id": "INT-RICHMOND",
        "congestion_index": 75,
        "recalculate_active_routes": False
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["node"]["congestion_index"] == 75


def test_traffic_reset_signals(client):
    """Test resetting all signals to normal urban cycle."""
    resp = client.post("/api/traffic/reset")
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
