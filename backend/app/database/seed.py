import logging
from sqlalchemy.orm import Session
from app.models.ambulance import Ambulance
from app.models.hospital import Hospital
from app.models.accident import Accident
from app.models.emergency import Emergency
from app.models.assignment import Assignment
from app.models.notification import Notification
from app.models.route import RouteInfo
from app.utils.datetime_utils import utc_now

logger = logging.getLogger("sern.seed")

DEFAULT_AMBULANCES = [
    {"registration_number": "KA-05-EM-7720", "latitude": 12.8990, "longitude": 77.5210, "status": "AVAILABLE"},
    {"registration_number": "KA-01-EM-1080", "latitude": 12.9750, "longitude": 77.6050, "status": "AVAILABLE"},
    {"registration_number": "KA-03-EM-2045", "latitude": 12.9780, "longitude": 77.6400, "status": "AVAILABLE"},
    {"registration_number": "KA-04-EM-3012", "latitude": 12.9698, "longitude": 77.7499, "status": "AVAILABLE"},
    {"registration_number": "KA-05-EM-4099", "latitude": 12.9352, "longitude": 77.6245, "status": "AVAILABLE"},
    {"registration_number": "KA-02-EM-5120", "latitude": 13.0031, "longitude": 77.5643, "status": "AVAILABLE"},
    {"registration_number": "KA-01-EM-6301", "latitude": 12.9250, "longitude": 77.5938, "status": "AVAILABLE"},
]

DEFAULT_HOSPITALS = [
    {
        "name": "SPARSH Hospital RR Nagar",
        "address": "Ideal Homes Township, Rajarajeshwari Nagar, Bengaluru, Karnataka 560098",
        "latitude": 12.9355,
        "longitude": 77.5175,
        "contact_information": "+91-80-61222000",
        "is_active": True,
    },
    {
        "name": "Victoria Hospital & Trauma Care",
        "address": "Fort Road, near City Market, Bengaluru, Karnataka 560002",
        "latitude": 12.9629,
        "longitude": 77.5753,
        "contact_information": "+91-80-26701150",
        "is_active": True,
    },
    {
        "name": "Apollo Hospitals Bannerghatta",
        "address": "154/11, Bannerghatta Main Rd, Krishnaraju Layout, Bengaluru, Karnataka 560076",
        "latitude": 12.8948,
        "longitude": 77.5976,
        "contact_information": "+91-80-26304050",
        "is_active": True,
    },
    {
        "name": "Manipal Hospital Whitefield",
        "address": "#143, 212-215, EPIP Zone, Whitefield, Bengaluru, Karnataka 560066",
        "latitude": 12.9830,
        "longitude": 77.7289,
        "contact_information": "+91-80-25024444",
        "is_active": True,
    },
    {
        "name": "Bowring & Lady Curzon Hospital",
        "address": "Lady Curzon Rd, Tasker Town, Shivaji Nagar, Bengaluru, Karnataka 560001",
        "latitude": 12.9822,
        "longitude": 77.6046,
        "contact_information": "+91-80-25591325",
        "is_active": True,
    },
    {
        "name": "Fortis Hospital Cunningham",
        "address": "14, Cunningham Rd, Vasanth Nagar, Bengaluru, Karnataka 560052",
        "latitude": 12.9880,
        "longitude": 77.5970,
        "contact_information": "+91-80-41994444",
        "is_active": True,
    },
]


def seed_database_if_empty(db: Session) -> None:
    """Populate default ambulances, hospitals, and an initial demo incident if database is clean."""
    ambulance_count = db.query(Ambulance).count()
    hospital_count = db.query(Hospital).count()

    if ambulance_count == 0:
        logger.info("Seeding initial fleet of ambulances...")
        for amb in DEFAULT_AMBULANCES:
            db.add(Ambulance(**amb))
        db.commit()

    if hospital_count == 0:
        logger.info("Seeding partner hospitals...")
        for hosp in DEFAULT_HOSPITALS:
            db.add(Hospital(**hosp))
        db.commit()

    # Note: Incidents and emergencies start cleanly at ZERO for every new dashboard session.
    # Operators generate incidents via the AI Simulator or live sensor telemetry.
    logger.info("Database initialized with ready fleet and partner hospitals. Incidents start at 0.")
