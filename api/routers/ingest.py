from fastapi import APIRouter, UploadFile, File
import pandas as pd
import io

router = APIRouter()

# In-memory "datastore"
DATASTORE = {}

@router.post("/csv")
async def upload_csv(file: UploadFile = File(...)):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))
    DATASTORE["csv"] = df
    return {"rows": len(df), "columns": list(df.columns)}

@router.get("/demo")
def load_demo():
    df = pd.DataFrame({
        "id": [1, 2, 3],
        "value": [10, None, 30],
        "updated_at": pd.to_datetime(["2025-09-01", "2025-09-08", "2025-09-09"])
    })
    DATASTORE["demo"] = df
    return {"rows": len(df), "columns": list(df.columns)}
