import json
from pathlib import Path
from typing import List, Union, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment or .env file."""

    APP_NAME: str = "SERN - Smart Emergency Response Network"
    APP_ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS configuration
    CORS_ORIGINS: Union[str, List[str]] = ["*"]

    # Database configuration (PostgreSQL with PostGIS support or local SQLite fallback)
    DB_ENGINE: str = "sqlite"
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "sern_db"
    DATABASE_URL: Optional[str] = None

    # Twilio Live SMS Notification Credentials
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None

    # Fast2SMS Alternative Indian SMS Gateway
    FAST2SMS_API_KEY: Optional[str] = None

    # SMTP Real Email Dispatch Credentials
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None

    # Firebase Cloud Messaging (FCM) Credentials
    FCM_SERVER_KEY: Optional[str] = None
    FCM_PROJECT_ID: Optional[str] = None

    # ML Module
    ML_MODEL_PATH: str = str(
        (Path(__file__).resolve().parents[2] / "AccidentDetectionML" / "models" / "accident_detection_final.pkl").resolve()
    )

    # Dispatch behavior
    AUTO_DISPATCH_ON_VALIDATION: bool = False

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: Optional[str], info) -> str:
        if v:
            return v
        # Check if environment specifies postgresql
        user = info.data.get("POSTGRES_USER")
        password = info.data.get("POSTGRES_PASSWORD")
        host = info.data.get("POSTGRES_HOST", "localhost")
        port = info.data.get("POSTGRES_PORT", 5432)
        db_name = info.data.get("POSTGRES_DB", "sern_db")

        if user and password:
            return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db_name}"
        # Default local SQLite path
        return f"sqlite:///{(Path(__file__).resolve().parents[1] / 'sern.db').as_posix()}"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

