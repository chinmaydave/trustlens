import pandas as pd
from datetime import datetime

def compute_metrics(df: pd.DataFrame):
    metrics = {}
    # Null rate
    null_rate = df.isnull().mean().mean()
    metrics["null_rate"] = round(float(null_rate), 3)

    # Minutes since last update (if updated_at column exists)
    if "updated_at" in df.columns:
        last_update = pd.to_datetime(df["updated_at"]).max()
        delta = datetime.utcnow() - last_update.to_pydatetime()
        metrics["minutes_since_last_update"] = int(delta.total_seconds() / 60)
    else:
        metrics["minutes_since_last_update"] = None

    return metrics
