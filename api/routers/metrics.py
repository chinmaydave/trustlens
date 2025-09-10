from fastapi import APIRouter
from services.metrics_service import compute_metrics
from routers.ingest import DATASTORE

router = APIRouter()

@router.get("/check")
def run_metrics(source: str = "csv"):
    if source not in DATASTORE:
        return {"error": f"No data loaded for source '{source}'"}
    df = DATASTORE[source]
    metrics = compute_metrics(df)
    return {"source": source, "metrics": metrics}
