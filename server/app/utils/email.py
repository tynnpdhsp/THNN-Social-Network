import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from prisma import Prisma
import redis.asyncio as aioredis

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)
settings = get_settings()

OTP_EMAIL_SUBJECTS = {
    "register": "Xác thực đăng ký tài khoản",
    "reset_password": "Xác thực đặt lại mật khẩu",
}

OTP_EMAIL_BODY = """
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; padding: 20px;">
  <h2>{subject}</h2>
  <p>Mã xác thực của bạn là:</p>
  <h1 style="color: #2563eb; font-size: 32px; letter-spacing: 5px;">{code}</h1>
  <p>Mã có hiệu lực trong <strong>{expire_minutes} phút</strong>.</p>
  <p style="color: #6b7280; font-size: 14px;">
    Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.
  </p>
</body>
</html>
"""


async def send_otp_email(to_email: str, code: str, purpose: str) -> None:
    subject = OTP_EMAIL_SUBJECTS.get(purpose, "Xác thực")
    body = OTP_EMAIL_BODY.format(
        subject=subject,
        code=code,
        expire_minutes=settings.OTP_EXPIRE_MINUTES,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[THNN] {subject}"
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(body, "html"))

    try:
        import aiosmtplib

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("OTP email sent to %s (purpose=%s)", to_email, purpose)
    except Exception:
        logger.exception("Failed to send OTP email to %s", to_email)
        raise


async def cache_otp(email: str, purpose: str, code: str) -> None:
    r = await get_redis()
    key = f"auth:otp:{email}:{purpose}"
    import json

    data = json.dumps({"code": code, "attempts": 0, "max_attempts": settings.OTP_MAX_ATTEMPTS})
    await r.set(key, data, ex=settings.OTP_EXPIRE_MINUTES * 60)


async def get_cached_otp(email: str, purpose: str) -> dict | None:
    r = await get_redis()
    key = f"auth:otp:{email}:{purpose}"
    import json

    raw = await r.get(key)
    if raw is None:
        return None
    return json.loads(raw)


async def increment_otp_attempts(email: str, purpose: str) -> int:
    r = await get_redis()
    key = f"auth:otp:{email}:{purpose}"
    import json

    raw = await r.get(key)
    if raw is None:
        return -1
    data = json.loads(raw)
    data["attempts"] = data.get("attempts", 0) + 1
    ttl = await r.ttl(key)
    await r.set(key, json.dumps(data), ex=max(ttl, 0))
    return data["attempts"]


async def delete_cached_otp(email: str, purpose: str) -> None:
    r = await get_redis()
    key = f"auth:otp:{email}:{purpose}"
    await r.delete(key)
