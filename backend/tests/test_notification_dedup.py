import uuid
from unittest.mock import patch

from app.database import SessionLocal
from app.models.user import User
from app.services.notifications import NotificationService
from app.services.fcm import PushDeliveryError


def test_alert_dedup_escalation_month_rollover_and_retry():
    db = SessionLocal()
    user = User(firebase_uid=str(uuid.uuid4()), email=f'{uuid.uuid4()}@example.com', full_name='Push test', fcm_token='test-token')
    db.add(user)
    db.commit()
    state = {'month': '2026-10', 'status': 'warning', 'usage_percent': 85, 'monthly_limit': 500}
    try:
        with patch('app.services.notifications.AlertService.evaluate_user_alerts', side_effect=lambda *args: dict(state)), patch(
            'app.services.notifications.FCMService.notify_user', return_value='accepted'
        ) as send:
            assert NotificationService.check_and_notify_usage(db, user.id)['message_id'] == 'accepted'
            assert NotificationService.check_and_notify_usage(db, user.id)['deduplicated']
            assert send.call_count == 1
            state['status'] = 'exceeded'
            NotificationService.check_and_notify_usage(db, user.id)
            assert send.call_count == 2
            state['month'] = '2026-11'
            send.side_effect = PushDeliveryError('Temporary failure')
            assert not NotificationService.check_and_notify_usage(db, user.id)['success']
            assert user.last_notification_status == '2026-10:exceeded'
            send.side_effect = None
            NotificationService.check_and_notify_usage(db, user.id)
            assert user.last_notification_status == '2026-11:exceeded'
            assert NotificationService.check_and_notify_usage(db, user.id)['deduplicated']
            state['status'] = 'ok'
            NotificationService.check_and_notify_usage(db, user.id)
            assert user.last_notification_status is None
    finally:
        db.rollback()
        db.delete(user)
        db.commit()
        db.close()


def test_concurrent_uploads_send_only_one_alert():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    db = SessionLocal()
    user = User(firebase_uid=str(uuid.uuid4()), email=f'{uuid.uuid4()}@example.com', full_name='Concurrent test', fcm_token='test-token')
    db.add(user)
    db.commit()
    user_id = user.id
    barrier = Barrier(2)

    def notify():
        session = SessionLocal()
        try:
            barrier.wait(timeout=10)
            return NotificationService.check_and_notify_usage(session, user_id)
        finally:
            session.close()

    try:
        state = {'month': '2026-10', 'status': 'exceeded', 'usage_percent': 110, 'monthly_limit': 500}
        with patch('app.services.notifications.AlertService.evaluate_user_alerts', return_value=state), patch(
            'app.services.notifications.FCMService.notify_user', return_value='accepted'
        ) as send, ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: notify(), range(2)))
        assert send.call_count == 1
        assert sum(bool(result.get('deduplicated')) for result in results) == 1
    finally:
        db.delete(user)
        db.commit()
        db.close()
