from fastapi import FastAPI
from api.routers import ingest, metrics, alerts, health

app = FastAPI(title="TrustLens API", version="0.1")

@app.get("/")
def root():
    return {"message": "Welcome to TrustLens 🚀"}

app.include_router(ingest.router, prefix="/ingest", tags=["Ingest"])
app.include_router(metrics.router, prefix="/metrics", tags=["Metrics"])
app.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
app.include_router(health.router, prefix="/health", tags=["Health"])
