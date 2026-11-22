from datetime import datetime, timezone


def utc_now() -> datetime:
    """
    Returns current naive UTC datetime object.
    Compliant with Python 3.12+ (replacing deprecated datetime.utcnow())
    and compatible with standard SQLite datetime storage.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)

