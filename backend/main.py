"""FastAPI bridge for the frozen AromaSense molecular predictor."""
import base64
import json
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from rdkit import Chem
from rdkit.Chem import Draw

from ml.common import ROOT
from ml.predict import MODEL_PATH, OdourPredictor

app = FastAPI(title="AromaSense Molecular API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class PredictionRequest(BaseModel):
    smiles: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=10, ge=1, le=138)


@lru_cache(maxsize=1)
def get_predictor() -> OdourPredictor:
    return OdourPredictor(MODEL_PATH)


def structure_svg(smiles: str) -> str:
    molecule = Chem.MolFromSmiles(smiles)
    if molecule is None:
        raise ValueError("Invalid SMILES: RDKit could not parse this structure.")
    drawer = Draw.MolDraw2DSVG(420, 280)
    drawer.drawOptions().padding = 0.25
    drawer.DrawMolecule(molecule)
    drawer.FinishDrawing()
    return drawer.GetDrawingText()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "model_loaded": MODEL_PATH.exists(), "threshold": 0.6}


@app.get("/api/model/summary")
def model_summary() -> dict:
    metrics_path = ROOT / "reports" / "evaluation.json"
    audit_path = ROOT / "reports" / "dataset_audit.json"
    if not metrics_path.exists() or not audit_path.exists():
        raise HTTPException(status_code=503, detail="Model evaluation or dataset audit is unavailable.")
    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    final = metrics.get("final_test_metrics_at_selected_threshold", {})
    return {
        "dataset_rows": audit["rows"],
        "descriptor_count": audit["descriptor_count"],
        "threshold": 0.6,
        "metrics": {
            "macro_precision": final.get("macro_precision"),
            "macro_recall": final.get("macro_recall"),
            "macro_f1": final.get("macro_f1"),
            "micro_f1": final.get("micro_f1"),
            "macro_roc_auc": final.get("macro_roc_auc_defined_labels"),
            "macro_pr_auc": final.get("macro_pr_auc_defined_labels"),
        },
        "common_descriptors": sorted(
            [
                {"descriptor": label, "positive_count": int(count)}
                for label, count in audit["descriptor_positive_counts"].items()
            ],
            key=lambda item: item["positive_count"],
            reverse=True,
        )[:12],
    }


@app.post("/api/predict")
def predict(request: PredictionRequest) -> dict:
    smiles = request.smiles.strip()
    if not smiles:
        raise HTTPException(status_code=422, detail="Enter a SMILES structure.")
    try:
        predictor = get_predictor()
        predictions = predictor.predict(smiles, request.top_k)
        svg = structure_svg(smiles)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {
        "smiles": smiles,
        "threshold": float(predictor.bundle.get("threshold", 0.6)),
        # Ranked probability scores are always returned, even below threshold.
        "predictions": predictions,
        "structure_svg_base64": base64.b64encode(svg.encode("utf-8")).decode("ascii"),
    }
