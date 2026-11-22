import json
from pathlib import Path
from typing import List, Union
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

    # Database (anchored inside backend directory)
    DATABASE_URL: str = f"sqlite:///{(Path(__file__).resolve().parents[1] / 'sern.db').as_posix()}"

    # ML Module
    ML_MODEL_PATH: str = str(
        (Path(__file__).resolve().parents[2] / "AccidentDetectionML" / "models" / "accident_detection_final.pkl").resolve()
    )

    # Dispatch behavior
    AUTO_DISPATCH_ON_VALIDATION: bool = False

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

