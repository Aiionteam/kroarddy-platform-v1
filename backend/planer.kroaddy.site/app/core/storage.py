"""AWS S3 이미지 저장소 헬퍼."""
import uuid
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


def generate_presigned_upload_url(content_type: str) -> tuple[str, str]:
    """
    S3 presigned PUT URL을 생성합니다.

    Returns:
        (upload_url, image_url)
        - upload_url: 프론트엔드가 PUT으로 이미지를 직접 업로드할 URL
        - image_url:  업로드 완료 후 DB에 저장할 공개 접근 URL
    """
    if not settings.s3_bucket_name:
        raise RuntimeError("S3_BUCKET_NAME 환경변수가 설정되지 않았습니다.")

    ext = _mime_to_ext(content_type)
    key = f"user-content/{uuid.uuid4().hex}{ext}"

    client = _s3_client()
    try:
        upload_url = client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.s3_bucket_name,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=settings.s3_presigned_expires,
        )
    except (BotoCoreError, ClientError) as e:
        logger.exception("presigned URL 생성 실패: %s", e)
        raise RuntimeError(f"S3 presigned URL 생성 실패: {e}") from e

    # 공개 URL
    if settings.s3_public_base_url:
        image_url = f"{settings.s3_public_base_url.rstrip('/')}/{key}"
    else:
        image_url = (
            f"https://{settings.s3_bucket_name}.s3.{settings.aws_region}.amazonaws.com/{key}"
        )

    logger.info("presigned URL 생성: key=%s", key)
    return upload_url, image_url


def _mime_to_ext(mime: str) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(mime.lower(), ".jpg")
