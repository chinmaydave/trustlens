from fastapi import APIRouter
from services.slack_service import send_slack_alert
from routers.metrics import run_metrics

router = APIRouter()

@router.post("/trigger")
def trigger_alert(source: str = "csv", null_threshold: float = 0.2, minutes_threshold: int = 60):
    result = run_metrics(source)
    if "error" in result:
        return result

    metrics = result["metrics"]
    alerts = []

    if metrics["null_rate"] is not None and metrics["null_rate"] > null_threshold:
        alerts.append(f"High null rate: {metrics['null_rate']*100:.1f}%")

    if metrics["minutes_since_last_update"] is not None and metrics["minutes_since_last_update"] > minutes_threshold:
        alerts.append(f"Data stale: {metrics['minutes_since_last_update']} minutes since last update")

    if alerts:
        msg = f"⚠️ TrustLens Alert for {source}:\n" + "\n".join(alerts)
        send_slack_alert(msg)
        return {"alerts": alerts, "slack": "sent"}
    else:
        return {"alerts": [], "status": "all good ✅"}
