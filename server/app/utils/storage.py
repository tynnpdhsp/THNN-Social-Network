import io
import uuid
from typing import Optional

import asyncio
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
        # Set policy to public read
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetBucketLocation", "s3:ListBucket"],
                    "Resource": [f"arn:aws:s3:::{settings.MINIO_BUCKET}"],
                },
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{settings.MINIO_BUCKET}/*"],
                },
            ],
        }
        import json
        client.set_bucket_policy(settings.MINIO_BUCKET, json.dumps(policy))

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


async def upload_files(files: list[tuple[bytes, str]], prefix: str) -> list[str]:
    """Upload multiple files to MinIO storage"""
    client = get_minio_client()

    def _sync_upload_multiple():
        if not client.bucket_exists(settings.MINIO_BUCKET):
            client.make_bucket(settings.MINIO_BUCKET)
            # Set policy to public read
            policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {"AWS": ["*"]},
                        "Action": ["s3:GetBucketLocation", "s3:ListBucket"],
                        "Resource": [f"arn:aws:s3:::{settings.MINIO_BUCKET}"],
                    },
                    {
                        "Effect": "Allow",
                        "Principal": {"AWS": ["*"]},
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{settings.MINIO_BUCKET}/*"],
                    },
                ],
            }
            import json
            client.set_bucket_policy(settings.MINIO_BUCKET, json.dumps(policy))

        urls = []
        for content, filename in files:
            ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
            object_name = f"{prefix}/{uuid.uuid4().hex}.{ext}"

            client.put_object(
                settings.MINIO_BUCKET,
                object_name,
                io.BytesIO(content),
                length=len(content),
                content_type=_guess_content_type(ext),
            )
            urls.append(f"/{settings.MINIO_BUCKET}/{object_name}")
        
        return urls

    # Run synchronous MinIO operations in thread pool
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync_upload_multiple)

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
