from sqlalchemy.orm import Session
from app.models.user import User
from app.services.alerts import AlertService
from app.services.fcm import FCMService, PushDeliveryError

class NotificationService:
    """Orchestrates notifications based on alert status."""

    @staticmethod
    def check_and_notify_usage(db: Session, user_id) -> dict:
        """
        Evaluates usage and sends opted-in app push alerts.
        """
        # Serialize concurrent meter uploads before evaluating/sending an alert.
        user = db.query(User).filter(User.id == user_id).populate_existing().with_for_update().first()
        if user is None:
            db.commit()
            return {"success": False, "message": "User not found."}
        # 1. Evaluate the current alert state
        alert_result = AlertService.evaluate_user_alerts(db, user_id)

        if not alert_result:
            db.commit()
            return {"success": False, "message": "Could not evaluate alerts for user."}

        status = alert_result.get("status")
        usage_pct = alert_result.get("usage_percent", 0)
        limit = alert_result.get("monthly_limit", 0)
        alert_key = f"{alert_result['month']}:{status}"

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

        if user.last_notification_status == alert_key:
            db.commit()
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

        # Delivery is triggered by meter uploads, even when the app is closed.
        if title and body:
            try:
                message_id = FCMService.notify_user(
                    db=db, user_id=user_id, title=title, body=body,
                    data={"status": status, "usage_percent": str(usage_pct),
                          "notification_tag": f"energy:{user_id}:{alert_key}"}
                )
            except PushDeliveryError as error:
                db.commit()
                return {"success": False, "message": str(error), "status": status}

            if message_id:
                user.last_notification_status = alert_key
                db.commit()
                return {
                    "success": True,
                    "message": f"Alert accepted by FCM: {status}",
                    "message_id": message_id,
                    "status": status
                }
            else:
                db.commit()
                return {
                    "success": False,
                    "message": "No push token is registered.",
                    "status": status
                }

        db.commit()
        return {"success": True, "message": "No notification was needed.", "status": status}
