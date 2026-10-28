from types import SimpleNamespace
from unittest.mock import MagicMock
from app.routes.users import remove_device_token
from app.schemas.user import DeviceTokenIn


def test_unsubscribe_removes_matching_token():
    db = MagicMock()
    user = SimpleNamespace(fcm_token='this-device')
    db.query.return_value.filter.return_value.first.return_value = user
    remove_device_token(DeviceTokenIn(fcm_token='this-device'), {'uid': 'owner'}, db)
    assert user.fcm_token is None
    db.commit.assert_called_once()


def test_unsubscribe_preserves_other_device():
    db = MagicMock()
    user = SimpleNamespace(fcm_token='other-device')
    db.query.return_value.filter.return_value.first.return_value = user
    remove_device_token(DeviceTokenIn(fcm_token='this-device'), {'uid': 'owner'}, db)
    assert user.fcm_token == 'other-device'
    db.commit.assert_not_called()
