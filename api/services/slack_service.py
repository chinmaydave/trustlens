import requests
import os

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")

def send_slack_alert(message: str):
    if not SLACK_WEBHOOK_URL:
        return {"error": "No Slack webhook configured"}
    payload = {"text": message}
    response = requests.post(SLACK_WEBHOOK_URL, json=payload)
    return {"status": response.status_code}
