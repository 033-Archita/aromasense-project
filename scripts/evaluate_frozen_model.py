"""Score the frozen validation-selected model once on the reserved test split."""
import json

import numpy as np
from joblib import load
from sklearn.model_selection import train_test_split

from ml.common import ROOT
from scripts.train_model import evaluate


def main() -> None:
    data = np.load(ROOT / "data" / "processed" / "molecular_dataset.npz")
    X, y = data["X"], data["y"]
    indices = np.arange(len(y))
    train_indices, test_indices = train_test_split(
        indices, test_size=0.2, random_state=42, shuffle=True
    )
    bundle = load(ROOT / "models" / "aromasense_model.joblib")
    threshold = float(bundle["threshold"])
    probabilities = np.column_stack([
        estimator.predict_proba(X[test_indices])[:, list(estimator.classes_).index(1)]
        if 1 in estimator.classes_ else np.zeros(len(test_indices))
        for estimator in bundle["estimators"]
    ])
    metrics = evaluate(y[test_indices], probabilities, threshold=threshold)
    metrics.update({
        "model": "Frozen tuned Extra Trees model",
        "selected_hyperparameters": bundle["hyperparameters"],
        "selected_threshold": threshold,
        "threshold_selected_on": "validation split only",
        "split": "reserved random 80/20 split, seed 42",
        "train_rows": int(len(train_indices)),
        "test_rows": int(len(test_indices)),
        "label_count": int(y.shape[1]),
        "test_used_for_tuning": False,
        "test_used_for_threshold_selection": False,
        "notes": "Final test metrics were computed after the model and global threshold were frozen. No test-driven tuning was performed.",
    })
    report_path = ROOT / "reports" / "final_test_metrics.json"
    report_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    evaluation_path = ROOT / "reports" / "evaluation.json"
    evaluation = json.loads(evaluation_path.read_text(encoding="utf-8"))
    # Keep the earlier 0.5 tuned and original-baseline results intact.
    evaluation["final_test_metrics_at_selected_threshold"] = metrics
    evaluation["selected_operating_threshold"] = threshold
    evaluation_path.write_text(json.dumps(evaluation, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
