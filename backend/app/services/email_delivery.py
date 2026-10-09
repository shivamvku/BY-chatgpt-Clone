"""Bounded server-side Resend adapter; never log email links or provider responses."""

import httpx

from app.core.config import get_settings


def configured() -> bool:
    settings = get_settings()
    return bool(settings.resend_api_key and settings.email_from)


def send_link(email: str, purpose: str, token: str) -> bool:
    settings = get_settings()
    if not configured():
        return False
    action = {
        "verify": "Verify your email",
        "reset": "Reset your password",
        "transfer": "Confirm your new sign-in",
        "invite": "Accept your subscription invitation",
    }[purpose]
    link = f"{settings.public_url.rstrip('/')}/#account/{purpose}/{token}"
    try:
        with httpx.Client(timeout=httpx.Timeout(10, connect=5), follow_redirects=False) as client:
            response = client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Idempotency-Key": f"account-{purpose}-{token}",
                },
                json={
                    "from": settings.email_from,
                    "to": [email],
                    "subject": f"YounderChat: {action}",
                    "text": f"{action}:\n{link}\n\n"
                    "This link expires shortly and can only be used once. "
                    "If you did not request this, ignore this email.",
                },
            )
        return response.is_success
    except httpx.HTTPError:
        return False
