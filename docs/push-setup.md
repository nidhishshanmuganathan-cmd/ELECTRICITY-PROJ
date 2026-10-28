# Phone push notifications

SMS delivery has been removed. Phone numbers are profile information; FCM registration tokens route notifications to the subscribed device. Currently each account stores one token, so enabling on another device replaces the previous subscription.

Deploy frontend and API over HTTPS. Set VITE_API_BASE_URL to the deployed API, VITE_FIREBASE_VAPID_KEY to this Firebase project's public Web Push key, CORS_ORIGINS to the deployed frontend URL, and add that URL to Firebase Authentication authorized domains. Firebase Admin credentials remain server-only.

Android: use Chrome's Install app / Add to Home Screen option. iPhone: iOS 16.4 or later, Share → Add to Home Screen, then open that icon. Sign in, save the phone number, and tap Enable notifications. Permission must be requested by a user tap.

Meter uploads trigger backend aggregation and threshold alerts without the frontend running. FCM automatically displays notification payloads in the background. Delivery needs connectivity and OS permission and can be delayed by device settings; it is not a guaranteed immediate alarm.

Device acceptance test (still required): close the installed app, upload readings crossing 80% and then 100%, confirm one warning and one exceeded notification, tap to reopen, disable notifications, confirm no further delivery. Repeat on Android and iPhone. Automated tests cannot establish actual handset delivery.

References: https://firebase.google.com/docs/cloud-messaging/web/receive-messages and https://webkit.org/blog/13878/
