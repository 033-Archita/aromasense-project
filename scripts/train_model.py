"""Train and evaluate a CPU-friendly multi-label Extra Trees model."""
import json
from pathlib import Path

import numpy as np
from joblib import dump
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.metrics import average_precision_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

from ml.common import FINGERPRINT_BITS, MORGAN_RADIUS, ROOT
from scripts.prepare_data import prepare


def evaluate(y_true: np.ndarray, probabilities: np.ndarray, threshold: float = 0.5) -> dict:
    predicted = probabilities >= threshold
    per_label_roc, per_label_pr = [], []
    for index in range(y_true.shape[1]):
        truth = y_true[:, index]
        # ROC-AUC is undefined if the test split contains only one class.
        if np.unique(truth).size == 2:
            per_label_roc.append(roc_auc_score(truth, probabilities[:, index]))
        if truth.sum() > 0:
            per_label_pr.append(average_precision_score(truth, probabilities[:, index]))
    return {
        "threshold": threshold,
        "macro_f1": float(f1_score(y_true, predicted, average="macro", zero_division=0)),
        "micro_f1": float(f1_score(y_true, predicted, average="micro", zero_division=0)),
        "macro_precision": float(precision_score(y_true, predicted, average="macro", zero_division=0)),
        "micro_precision": float(precision_score(y_true, predicted, average="micro", zero_division=0)),
        "macro_recall": float(recall_score(y_true, predicted, average="macro", zero_division=0)),
        "micro_recall": float(recall_score(y_true, predicted, average="micro", zero_division=0)),
        "macro_roc_auc_defined_labels": float(np.mean(per_label_roc)) if per_label_roc else None,
        "macro_pr_auc_defined_labels": float(np.mean(per_label_pr)) if per_label_pr else None,
        "roc_auc_label_count": len(per_label_roc),
        "pr_auc_label_count": len(per_label_pr),
    }


def main() -> None:
    X, y, labels, smiles = prepare()
    indices = np.arange(len(y))
    train_idx, test_idx = train_test_split(indices, test_size=0.2, random_state=42, shuffle=True)
    X_train, X_test, y_train, y_test = X[train_idx], X[test_idx], y[train_idx], y[test_idx]

    # Settings selected by scripts.tune_model.py; class weights address skew.
    # Fit one binary classifier per descriptor. The explicit loop is easier to
    # explain and avoids worker-process startup problems on restricted Windows PCs.
    estimators = []
    for label_index, label in enumerate(labels):
        fitted = ExtraTreesClassifier(
            n_estimators=20, min_samples_leaf=2, max_features="sqrt",
            class_weight="balanced", n_jobs=1, random_state=42,
        )
        fitted.fit(X_train, y_train[:, label_index])
        estimators.append(fitted)
        if (label_index + 1) % 10 == 0:
            print(f"Trained {label_index + 1}/{len(labels)} descriptors", flush=True)
    probabilities = np.column_stack([
        per_label.predict_proba(X_test)[:, list(per_label.classes_).index(1)]
        if 1 in per_label.classes_ else np.zeros(len(X_test))
        for per_label in estimators
    ])
    metrics = evaluate(y_test, probabilities)
    metrics.update({
        "model": "One binary ExtraTreesClassifier per descriptor (tuned)",
        "selected_hyperparameters": {"n_estimators": 20, "max_features": "sqrt",
                                     "min_samples_leaf": 2, "class_weight": "balanced",
                                     "random_state": 42},
        "split": "random 80/20, seed 42; exact-SMILES duplicates removed before split",
        "train_rows": int(len(train_idx)), "test_rows": int(len(test_idx)),
        "label_count": int(len(labels)), "fingerprint_bits": FINGERPRINT_BITS,
        "morgan_radius": MORGAN_RADIUS,
        "notes": "Macro PR-AUC averages average precision only over labels with positives in test; ROC-AUC only where both classes occur.",
    })
    model_dir, report_dir = ROOT / "models", ROOT / "reports"
    model_dir.mkdir(exist_ok=True)
    report_dir.mkdir(exist_ok=True)
    dump({"estimators": estimators, "labels": labels, "fingerprint_bits": FINGERPRINT_BITS,
          "morgan_radius": MORGAN_RADIUS, "threshold": 0.5,
          "hyperparameters": metrics["selected_hyperparameters"]},
         model_dir / "aromasense_model.joblib", compress=3)
    (report_dir / "evaluation.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (model_dir / "label_mapping.json").write_text(json.dumps({"index_to_label": labels}, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
