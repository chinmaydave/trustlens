from fastapi import FastAPI
from api.routers import ingest, metrics, alerts

app = FastAPI(title="TrustLens API", version="0.1")

# Root endpoint
@app.get("/")
def root():
    return {"message": "Welcome to TrustLens 🚀"}

# Include routers
app.include_router(ingest.router, prefix="/ingest", tags=["Ingest"])
app.include_router(metrics.router, prefix="/metrics", tags=["Metrics"])
app.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
