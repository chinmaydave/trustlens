from datetime import datetime, timedelta
from typing import Literal, List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="TrustLens API", version="0.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # dev only; tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Status = Literal["healthy", "warning", "failing"]
Severity = Literal["low", "medium", "high"]

class DataSource(BaseModel):
    id: str
    name: str
    type: str
    status: Status
    lastRun: str

class AlertItem(BaseModel):
    id: int
    severity: Severity
    message: str
    created_at: str

class TrendPoint(BaseModel):
    t: str
    nullRate: float
    freshnessMin: int

def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

DATA_SOURCES: List[DataSource] = [
    DataSource(id="1", name="Orders DB", type="postgres", status="healthy", lastRun=_now_iso()),
    DataSource(id="2", name="Users API", type="api",      status="warning", lastRun=_now_iso()),
    DataSource(id="3", name="Inventory S3", type="s3",    status="failing", lastRun=_now_iso()),
    DataSource(id="4", name="Billing Warehouse", type="postgres", status="healthy", lastRun=_now_iso()),
]

ALERTS: List[AlertItem] = [
    AlertItem(id=1, severity="high",   message="Orders freshness > 60 min", created_at=_now_iso()),
    AlertItem(id=2, severity="medium", message="Email NULL rate spiked",    created_at=_now_iso()),
    AlertItem(id=3, severity="low",    message="Inventory sync delayed",    created_at=_now_iso()),
]

def _trend_points(n: int = 30) -> List[TrendPoint]:
    pts: List[TrendPoint] = []
    now = datetime.utcnow()
    for i in range(n):
        ts = now - timedelta(minutes=(n - 1 - i))
        t_label = ts.strftime("%H:%M")
        null_rate = round(((i * 7) % 21) + (i % 3) * 0.3, 1)
        freshness = (i * 4) % 120 + 5
        pts.append(TrendPoint(t=t_label, nullRate=float(null_rate), freshnessMin=int(freshness)))
    return pts

@app.get("/health")
def health():
    return {"ok": True, "service": "trustlens-api", "time": _now_iso()}

@app.get("/data-sources", response_model=List[DataSource])
def list_data_sources():
    return DATA_SOURCES

@app.get("/alerts", response_model=List[AlertItem])
def list_alerts(limit: int = 20):
    return ALERTS[:limit]

@app.get("/metrics/null-rate", response_model=List[TrendPoint])
def null_rate(window: str = "30min"):
    return _trend_points(30)
