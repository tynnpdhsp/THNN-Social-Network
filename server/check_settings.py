from app.core.config import get_settings
settings = get_settings()
print(f"MINIO_ACCESS_KEY: {settings.MINIO_ACCESS_KEY}")
print(f"MINIO_SECRET_KEY: {settings.MINIO_SECRET_KEY}")
print(f"MINIO_ENDPOINT: {settings.MINIO_ENDPOINT}")
