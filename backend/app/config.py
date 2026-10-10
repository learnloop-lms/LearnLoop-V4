import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load environment variables from backend/.env or root .env
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(BASE_DIR, "backend", ".env"))
load_dotenv(os.path.join(BASE_DIR, ".env"))

class Settings(BaseSettings):
    PROJECT_NAME: str = "Learn Loop - Adaptive Gamified LMS"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "learn_loop_super_secret_jwt_key_2026_scholar_research")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Default to PostgreSQL
    BASE_DIR: str = BASE_DIR
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./learn_loop.db"
    )
    SERVER_IP: str = os.getenv("SERVER_IP", "10.147.20.160")
    DOMAIN: str = os.getenv("DOMAIN", "")
    MODELS_DIR: str = os.path.join(BASE_DIR, "models")
    ASSETS_DIR: str = os.path.join(BASE_DIR, "assets")

    class Config:
        case_sensitive = True

settings = Settings()
