import os
import requests
from dotenv import load_dotenv

load_dotenv()

WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")

def send_slack_alert(message: str):
    if not WEBHOOK_URL:
        print("⚠️ No Slack webhook configured")
        return
    payload = {"text": message}
    requests.post(WEBHOOK_URL, json=payload)
