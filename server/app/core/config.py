from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "THNN Social Network"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000", 
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    ]

    # MongoDB
    MONGO_DATABASE_URL: str = "mongodb://localhost:27017/thnn_social_network"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # OTP
    OTP_EXPIRE_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 3
    OTP_LENGTH: int = 6

    # Email (SMTP Gmail)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = ""

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = ""
    MINIO_SECRET_KEY: str = ""
    MINIO_BUCKET: str = "thnn"
    MINIO_SECURE: bool = False

    # Rate Limiting
    LOGIN_RATE_LIMIT_IP: int = 10
    LOGIN_RATE_LIMIT_EMAIL: int = 5
    LOGIN_RATE_LIMIT_IP_WINDOW_SECONDS: int = 900
    LOGIN_RATE_LIMIT_EMAIL_WINDOW_SECONDS: int = 1800

    # Upload
    MAX_AVATAR_SIZE_MB: int = 5
    MAX_COVER_SIZE_MB: int = 10
    MAX_BIO_LENGTH: int = 500

    VNPAY_URL: str = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
    VNPAY_TMN_CODE: str = ""
    VNPAY_RETURN_URL: str = "" # url của fe - vnpay redirect sau khi thanh toán xong (đã thanh toán, hủy thanh toán)
    VNPAY_HASH_SECRET: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    @model_validator(mode="after")
    def validate_security(self):
        if not self.DEBUG and self.JWT_SECRET_KEY == "change-me-in-production":
            raise ValueError(
                "JWT_SECRET_KEY must be set to a secure value in production. "
                "Set it in .env or set DEBUG=true for development."
            )
        return self


@lru_cache()
def get_settings() -> Settings:
    return Settings()
