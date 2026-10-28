from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    firebase_credentials_path: str
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
