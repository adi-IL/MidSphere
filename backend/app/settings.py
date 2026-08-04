from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    datahub_gms_url: str = "http://localhost:8080"
    datahub_gms_token: str = ""
    datahub_tier: str = "oss"  # oss | cloud
    default_job_mode: str = "full"
    auto_trip: bool = True
    cors_origins: str = "http://localhost:5173,https://midsphere.vercel.app"
    require_mutations: bool = False
    host: str = "0.0.0.0"
    port: int = 8000


@lru_cache
def get_settings() -> Settings:
    return Settings()
