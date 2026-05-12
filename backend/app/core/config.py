from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str = "change-me"
    ENVIRONMENT: str = "local"
    CORS_ORIGINS: str = "http://localhost:5173"

settings = Settings()