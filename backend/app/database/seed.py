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
    {"registration_number": "KA-01-EM-1080", "latitude": 12.9750, "longitude": 77.6050, "status": "AVAILABLE"},
    {"registration_number": "KA-03-EM-2045", "latitude": 12.9780, "longitude": 77.6400, "status": "AVAILABLE"},
    {"registration_number": "KA-04-EM-3012", "latitude": 12.9698, "longitude": 77.7499, "status": "AVAILABLE"},
    {"registration_number": "KA-05-EM-4099", "latitude": 12.9352, "longitude": 77.6245, "status": "AVAILABLE"},
    {"registration_number": "KA-02-EM-5120", "latitude": 13.0031, "longitude": 77.5643, "status": "AVAILABLE"},
    {"registration_number": "KA-01-EM-6301", "latitude": 12.9250, "longitude": 77.5938, "status": "AVAILABLE"},
]

DEFAULT_HOSPITALS = [
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

    # Seed initial demo accidents/emergencies if none exist
    accident_count = db.query(Accident).count()
    if accident_count == 0:
        logger.info("Seeding sample emergency incidents for immediate dashboard demonstration...")
        # 1. Validated accident with dispatched ambulance and route
        amb1 = db.query(Ambulance).filter(Ambulance.registration_number == "KA-01-EM-1080").first()
        hosp1 = db.query(Hospital).first()

        sample_crash_sensor = {
            "gsensor": [[48.2, 38.5, 78.1], [58.9, 49.3, 89.2]],
            "gyro": [[4.8, 5.9, 6.7], [7.6, 8.8, 9.8]],
            "gps_speed": [85.0, 0.0],
            "vehiclesize": "car",
            "gyro_is_hd": True,
        }

        acc1 = Accident(
            latitude=12.9716,
            longitude=77.5946,
            timestamp=utc_now(),
            sensor_data=sample_crash_sensor,
            vehicle_size="car",
            gyro_is_hd=True,
            accident_prediction=True,
            accident_probability=0.8842,
            model_threshold=0.3356,
            validation_status="VALIDATED",
            validation_notes="Verified via CCTV junction feed and automated vehicle collision alert.",
        )
        db.add(acc1)
        db.commit()
        db.refresh(acc1)

        em1 = Emergency(
            accident_id=acc1.id,
            assigned_ambulance_id=amb1.id if amb1 else None,
            hospital_id=hosp1.id if hosp1 else None,
            status="DISPATCHED",
        )
        db.add(em1)
        db.commit()
        db.refresh(em1)

        if amb1:
            amb1.status = "ASSIGNED"
            db.add(Assignment(
                emergency_id=em1.id,
                ambulance_id=amb1.id,
                status="ACTIVE",
            ))

        db.add(RouteInfo(
            emergency_id=em1.id,
            distance_km=1.25,
            estimated_duration_minutes=3.8,
            route_geometry={
                "type": "LineString",
                "coordinates": [
                    [77.6050, 12.9750],
                    [77.6000, 12.9730],
                    [77.5946, 12.9716],
                ],
            },
            source="MEMBER_4_OSMNX_ROUTING",
        ))

        db.add(Notification(
            emergency_id=em1.id,
            recipient=f"Ambulance {amb1.registration_number}" if amb1 else "Ambulance Unit",
            notification_type="DISPATCH_NOTICE",
            message=f"Dispatched to emergency #{em1.id} at (12.9716, 77.5946).",
            delivery_status="SIMULATED_DELIVERED",
            is_simulated=True,
        ))

        # 2. A pending accident detected by AI waiting for human operator validation
        acc2 = Accident(
            latitude=12.9810,
            longitude=77.6320,
            timestamp=utc_now(),
            sensor_data=sample_crash_sensor,
            vehicle_size="car",
            gyro_is_hd=True,
            accident_prediction=True,
            accident_probability=0.7415,
            model_threshold=0.3356,
            validation_status="PENDING",
            validation_notes=None,
        )
        db.add(acc2)

        # 3. A normal driving log correctly classified as non-accident
        normal_sensor = {
            "gsensor": [[0.1, 0.2, 9.8], [0.2, 0.1, 9.7]],
            "gyro": [[0.01, 0.02, 0.03], [0.02, 0.01, 0.04]],
            "gps_speed": [42.0, 40.0],
            "vehiclesize": "car",
            "gyro_is_hd": True,
        }
        acc3 = Accident(
            latitude=12.9350,
            longitude=77.6140,
            timestamp=utc_now(),
            sensor_data=normal_sensor,
            vehicle_size="car",
            gyro_is_hd=True,
            accident_prediction=False,
            accident_probability=0.0421,
            model_threshold=0.3356,
            validation_status="NORMAL",
            validation_notes=None,
        )
        db.add(acc3)
        db.commit()
        logger.info("Database successfully seeded with demo entities.")
