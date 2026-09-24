import firebase_admin
from firebase_admin import credentials
from app.config import settings

cred = credentials.Certificate(settings.firebase_credentials_path)
firebase_admin.initialize_app(cred)