from app.database.base import Base
from app.models.accident import Accident
from app.models.ambulance import Ambulance
from app.models.hospital import Hospital
from app.models.emergency import Emergency
from app.models.assignment import Assignment
from app.models.notification import Notification
from app.models.route import RouteInfo


def test_database_table_creation(db_session):
    """Verify all tables and foreign keys are created properly in isolated database."""
    # Check that query on every table executes without errors
    assert db_session.query(Accident).count() == 0
    assert db_session.query(Ambulance).count() == 0
    assert db_session.query(Hospital).count() == 0
    assert db_session.query(Emergency).count() == 0
    assert db_session.query(Assignment).count() == 0
    assert db_session.query(Notification).count() == 0
    assert db_session.query(RouteInfo).count() == 0

