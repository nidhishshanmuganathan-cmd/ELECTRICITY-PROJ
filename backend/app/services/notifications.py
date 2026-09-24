from sqlalchemy.orm import Session
from app.models.user import User
from app.services.alerts import AlertService
from app.services.fcm import FCMService

class NotificationService:
    """Orchestrates notifications based on alert status."""

    @staticmethod
    def check_and_notify_usage(db: Session, user_id) -> dict:
        """
        Evaluates the user's current energy usage and sends a
        push notification if they are in 'warning' or 'exceeded' state.
        """
        # 1. Evaluate the current alert state
        alert_result = AlertService.evaluate_user_alerts(db, user_id)

        if not alert_result:
            return {"success": False, "message": "Could not evaluate alerts for user."}

        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            return {"success": False, "message": "User not found."}

        status = alert_result.get("status")
        usage_pct = alert_result.get("usage_percent", 0)
        limit = alert_result.get("monthly_limit", 0)

        # Re-arm notifications once consumption is back below the warning
        # threshold, so a later threshold crossing can notify the user again.
        if status == "ok":
            if user.last_notification_status is not None:
                user.last_notification_status = None
                db.commit()
            return {
                "success": True,
                "message": "Usage is within normal limits. No notification needed.",
                "status": status,
            }

        if user.last_notification_status == status:
            return {
                "success": True,
                "message": f"{status.capitalize()} notification already sent.",
                "status": status,
                "deduplicated": True,
            }

        # 2. Determine if a notification is needed
        title = None
        body = None

        if status == "exceeded":
            title = "⚡ Limit Exceeded!"
            body = f"You have exceeded your monthly energy limit of {limit} kWh!"
        elif status == "warning":
            title = "⚠️ Energy Warning"
            body = f"You have used {usage_pct}% of your monthly energy limit. Keep an eye on your consumption!"

        # 3. Send the notification if a state was matched
        if title and body:
            message_id = FCMService.notify_user(
                db=db,
                user_id=user_id,
                title=title,
                body=body,
                data={"status": status, "usage_percent": str(usage_pct)}
            )

            if message_id:
                user.last_notification_status = status
                db.commit()
                return {
                    "success": True,
                    "message": f"Notification sent: {status}",
                    "message_id": message_id,
                    "status": status
                }
            else:
                return {
                    "success": False,
                    "message": "User has no registered FCM token.",
                    "status": status
                }

        return {"success": True, "message": "No notification was needed.", "status": status}
