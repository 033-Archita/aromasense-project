"""Load the trained model and predict ranked odour descriptors for a SMILES."""
from pathlib import Path

import numpy as np
from joblib import load

from ml.common import ROOT, fingerprint_smiles

MODEL_PATH = ROOT / "models" / "aromasense_model.joblib"


class OdourPredictor:
    def __init__(self, model_path: Path = MODEL_PATH):
        if not model_path.exists():
            raise FileNotFoundError("Trained model not found. Run python -m scripts.train_model first.")
        self.bundle = load(model_path)

    def predict(self, smiles: str, top_k: int = 10) -> list[dict]:
        if not 1 <= top_k <= len(self.bundle["labels"]):
            raise ValueError(f"top_k must be from 1 to {len(self.bundle['labels'])}.")
        fingerprint = fingerprint_smiles(smiles).reshape(1, -1)
        probabilities = np.array([
            estimator.predict_proba(fingerprint)[0, list(estimator.classes_).index(1)]
            if 1 in estimator.classes_ else 0.0
            for estimator in self.bundle["estimators"]
        ])
        order = np.argsort(probabilities)[::-1][:top_k]
        labels = self.bundle["labels"]
        threshold = float(self.bundle.get("threshold", 0.5))
        return [{
            "descriptor": labels[i],
            "probability": float(probabilities[i]),
            "predicted": bool(probabilities[i] >= threshold),
        } for i in order]


def predict(smiles: str, top_k: int = 10) -> list[dict]:
    return OdourPredictor().predict(smiles, top_k)


if __name__ == "__main__":
    import argparse
    import sys
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("smiles")
    parser.add_argument("--top-k", type=int, default=10)
    args = parser.parse_args()
    try:
        predictions = predict(args.smiles, args.top_k)
    except (ValueError, FileNotFoundError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)
    for item in predictions:
        print(f"{item['descriptor']}: {item['probability']:.3f}")
