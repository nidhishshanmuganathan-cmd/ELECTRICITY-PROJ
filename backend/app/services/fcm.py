from firebase_admin import messaging
from sqlalchemy.orm import Session
from app import firebase  # noqa: F401  (just triggers Firebase Admin init)
from app.models.user import User
import logging
import uuid

logger = logging.getLogger(__name__)


class PushDeliveryError(Exception):
    """Safe error that never includes device tokens or provider credentials."""


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
        tag = str((data or {}).get('notification_tag') or uuid.uuid4())
        message = messaging.Message(
            token=token,
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            webpush=messaging.WebpushConfig(
                headers={"Urgency": "high", "TTL": "3600"},
                notification=messaging.WebpushNotification(
                    icon="/icon-192.png", tag=tag,
                ),
                fcm_options=messaging.WebpushFCMOptions(
                    link="https://electricity-proj.vercel.app/",
                ),
            ),
        )
        try:
            message_id = messaging.send(message)
        except messaging.UnregisteredError:
            logger.warning("push_rejected reason=unregistered")
            raise PushDeliveryError("Push registration expired. Enable notifications again on this device.") from None
        except Exception as error:
            logger.warning("push_rejected error_type=%s", type(error).__name__)
            raise PushDeliveryError("Firebase could not accept the notification. Check backend Firebase permissions and retry.") from None
        if not message_id:
            raise PushDeliveryError("Firebase did not confirm notification acceptance. Please retry.")
        logger.info("push_accepted message_id=%s", message_id)
        return message_id

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
