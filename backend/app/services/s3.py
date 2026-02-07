import uuid
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import get_settings

settings = get_settings()


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=Config(signature_version="s3v4"),
    )


def generate_s3_key(mission_id: uuid.UUID, filename: str) -> str:
    """Generate a unique S3 key for a contribution file."""
    file_uuid = uuid.uuid4().hex[:12]
    safe_filename = filename.replace(" ", "_")
    return f"missions/{mission_id}/contributions/{file_uuid}_{safe_filename}"


def generate_presigned_upload_url(
    s3_key: str,
    content_type: str = "application/octet-stream",
    expires_in: int = 3600,
) -> str:
    """Generate a presigned PUT URL for direct browser upload."""
    client = get_s3_client()
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": s3_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return url


def generate_presigned_download_url(
    s3_key: str,
    expires_in: int = 3600,
) -> str:
    """Generate a presigned GET URL to download/view a file."""
    client = get_s3_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": s3_key,
        },
        ExpiresIn=expires_in,
    )
    return url


def delete_s3_object(s3_key: str) -> bool:
    """Delete an object from S3. Returns True on success."""
    try:
        client = get_s3_client()
        client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        return True
    except ClientError:
        return False
