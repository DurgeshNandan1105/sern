import pytest
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database.base import Base
from app.database.connection import get_db
from app.main import app
from app.services.ml_service import MLService, ml_service

# Isolated SQLite in-memory database for testing
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """Provides a fresh database session for each test function."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """TestClient that overrides the get_db dependency with isolated in-memory DB."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


class MockPredictor:
    """Mock predictor for controlled test scenarios without loading full model file."""
    def __init__(self, detected: bool = True, probability: float = 0.85, threshold: float = 0.3356):
        self.detected = detected
        self.probability = probability
        self.threshold = threshold

    def predict(self, sensor_data):
        return {
            "accident_detected": self.detected,
            "accident_probability": self.probability,
            "threshold": self.threshold
        }


@pytest.fixture
def mock_ml_service():
    """Provides an MLService backed by a mock positive predictor."""
    return MLService(predictor_instance=MockPredictor(detected=True, probability=0.88))


@pytest.fixture
def mock_ml_service_negative():
    """Provides an MLService backed by a mock negative predictor."""
    return MLService(predictor_instance=MockPredictor(detected=False, probability=0.08))

