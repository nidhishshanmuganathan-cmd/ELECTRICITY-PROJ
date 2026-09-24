from firebase_admin import messaging
from sqlalchemy.orm import Session
from app import firebase  # noqa: F401  (just triggers Firebase Admin init)
from app.models.user import User


class FCMService:
    """Sends Firebase Cloud Messaging notifications.

    Delivery-only helper: it reads the recipient's already-stored
    users.fcm_token and sends a single message. It never evaluates
    alert conditions and never touches usage data (see AlertService).
    """

    @staticmethod
    def send_to_token(
        token: str, title: str, body: str, data: dict | None = None
    ) -> str | None:
        """Send one FCM notification. Returns the FCM message ID."""
        # NOTE: the pinned firebase_admin SDK deprecates Message(token=...),
        # but `token` remains the correct v1-API field for the web
        # registration tokens stored in users.fcm_token, so it is kept.
        message = messaging.Message(
            token=token,
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
        )
        return messaging.send(message)

    @staticmethod
    def notify_user(
        db: Session, user_id, title: str, body: str, data: dict | None = None
    ) -> str | None:
        """Send to a user's stored fcm_token.

        Returns the FCM message ID, or None when the user is unknown
        or has no token registered (nothing is sent in that case).
        """
        user = db.query(User).filter(User.id == user_id).first()
        if user is None or not user.fcm_token:
            return None
        return FCMService.send_to_token(user.fcm_token, title, body, data)
