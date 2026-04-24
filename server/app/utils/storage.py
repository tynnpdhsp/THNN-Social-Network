import io
import uuid
from typing import Optional

from minio import Minio
from minio.error import S3Error

from app.core.config import get_settings

settings = get_settings()

_client: Optional[Minio] = None


def get_minio_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
    return _client


async def upload_file(content: bytes, filename: str, prefix: str) -> str:
    client = get_minio_client()

    if not client.bucket_exists(settings.MINIO_BUCKET):
        client.make_bucket(settings.MINIO_BUCKET)

    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    object_name = f"{prefix}/{uuid.uuid4().hex}.{ext}"

    client.put_object(
        settings.MINIO_BUCKET,
        object_name,
        io.BytesIO(content),
        length=len(content),
        content_type=_guess_content_type(ext),
    )

    return f"/{settings.MINIO_BUCKET}/{object_name}"


def _guess_content_type(ext: str) -> str:
    types = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
        "pdf": "application/pdf",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    return types.get(ext.lower(), "application/octet-stream")
