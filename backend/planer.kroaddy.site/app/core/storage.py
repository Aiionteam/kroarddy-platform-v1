"""AWS S3 이미지 저장소 헬퍼."""
import uuid
import logging
import urllib.parse

import boto3  # pyright: ignore[reportMissingImports]
from botocore.exceptions import BotoCoreError, ClientError  # pyright: ignore[reportMissingImports]

from app.core.config import settings

logger = logging.getLogger(__name__)


def _s3_client():
    # endpoint_url을 명시해야 presigned URL에 리전이 포함되어 CORS 통과
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        endpoint_url=f"https://s3.{settings.aws_region}.amazonaws.com",
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


def _extract_s3_key(image_url: str) -> str | None:
    """
    공개 URL 또는 presigned URL에서 S3 오브젝트 키를 추출합니다.

    지원 포맷:
    - virtual-hosted: https://bucket.s3.region.amazonaws.com/key
    - path-style:     https://s3.region.amazonaws.com/bucket/key?X-Amz-...
    """
    try:
        parsed = urllib.parse.urlparse(image_url)
        path = urllib.parse.unquote(parsed.path or "")
        # e.g. /user-content/xxx.png or /bucket/user-content/xxx.png

        bucket_prefix = f"/{settings.s3_bucket_name}/"
        if path.startswith(bucket_prefix):
            # path-style URL
            return path[len(bucket_prefix) :].lstrip("/") or None
        if path.startswith("/") and len(path) > 1:
            # virtual-hosted style URL
            return path[1:].lstrip("/") or None
    except Exception:
        pass
    return None


def canonical_s3_image_url_for_storage(image_url: str | None) -> str | None:
    """DB 저장용: 우리 버킷이면 쿼리스트링 제거한 고정 객체 URL만 남김 (PUT presigned 오저장 방지)."""
    if not image_url or not str(image_url).strip():
        return None
    raw = str(image_url).strip()
    key = _extract_s3_key(raw)
    if not key:
        return raw
    if settings.s3_public_base_url:
        return f"{settings.s3_public_base_url.rstrip('/')}/{key}"
    return f"https://{settings.s3_bucket_name}.s3.{settings.aws_region}.amazonaws.com/{key}"


def generate_presigned_get_url(image_url: str | None, expires: int = 86400 * 7) -> str | None:
    """
    DB에 저장된 image_url(공개 URL 또는 잘못 저장된 presigned PUT URL)을
    유효한 presigned GET URL로 변환합니다.

    - expires: 기본 7일 (604800초)
    - 키 추출 실패: 외부 URL로 가정하고 원본 반환
    - presigned GET 생성 실패: PUT URL을 그대로 돌려주면 img GET 시 403이 나므로 None 반환
    """
    if not image_url:
        return None

    key = _extract_s3_key(image_url)
    if not key:
        return image_url.strip() or None

    client = _s3_client()
    try:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket_name, "Key": key},
            ExpiresIn=expires,
        )
    except (BotoCoreError, ClientError) as e:
        logger.error(
            "presigned GET URL 생성 실패 (img는 비움): key=%s err=%s",
            key,
            e,
        )
        return None


def _mime_to_ext(mime: str) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(mime.lower(), ".jpg")
