def test_health_check_endpoint(client):
    """Verify health endpoint returns healthy status and ML model state."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in {"healthy", "degraded"}
    assert data["database"] == "connected"
    assert "ml_model_loaded" in data


def test_root_endpoint(client):
    """Verify root endpoint exposes documentation and service name."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "service" in data
    assert data["docs_url"] == "/docs"

