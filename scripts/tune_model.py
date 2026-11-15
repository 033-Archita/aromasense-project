"""Tune Extra Trees settings on validation data, then score once on held-out test data."""
import json

import numpy as np
from joblib import dump, load
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.metrics import average_precision_score
from sklearn.model_selection import train_test_split

from ml.common import FINGERPRINT_BITS, MORGAN_RADIUS, ROOT
from scripts.prepare_data import prepare
from scripts.train_model import evaluate


def probabilities(estimators, X: np.ndarray) -> np.ndarray:
    return np.column_stack([
        estimator.predict_proba(X)[:, list(estimator.classes_).index(1)]
        if 1 in estimator.classes_ else np.zeros(len(X))
        for estimator in estimators
    ])


def fit_labels(X: np.ndarray, y: np.ndarray, labels: list[str], options: dict, phase: str):
    fitted = []
    for index, label in enumerate(labels):
        model = ExtraTreesClassifier(
            n_estimators=20,
            max_features=options["max_features"],
            min_samples_leaf=options["min_samples_leaf"],
            class_weight="balanced",
            n_jobs=1,
            random_state=42,
        )
        model.fit(X, y[:, index])
        fitted.append(model)
        if (index + 1) % 20 == 0:
            print(f"{phase}: trained {index + 1}/{len(labels)} descriptors", flush=True)
    return fitted


def main() -> None:
    X, y, labels, _ = prepare()
    all_indices = np.arange(len(y))
    train_indices, test_indices = train_test_split(
        all_indices, test_size=0.2, random_state=42, shuffle=True
    )
    fit_indices, validation_indices = train_test_split(
        train_indices, test_size=0.25, random_state=43, shuffle=True
    )

    # Keep the original settings as a candidate; vary tree feature sampling and
    # leaf size. Macro average precision selects the probability-ranking model.
    candidates = [
        {"max_features": "sqrt", "min_samples_leaf": 1},
        {"max_features": "sqrt", "min_samples_leaf": 2},
        {"max_features": "log2", "min_samples_leaf": 1},
    ]
    search_rows = []
    for candidate_number, options in enumerate(candidates, start=1):
        print(f"Validation candidate {candidate_number}/{len(candidates)}: {options}", flush=True)
        fitted = fit_labels(
            X[fit_indices], y[fit_indices], labels, options,
            phase=f"candidate {candidate_number}",
        )
        val_probabilities = probabilities(fitted, X[validation_indices])
        val_truth = y[validation_indices]
        label_ap = [
            average_precision_score(val_truth[:, i], val_probabilities[:, i])
            for i in range(val_truth.shape[1]) if val_truth[:, i].sum() > 0
        ]
        search_rows.append({
            **options,
            "n_estimators": 20,
            "validation_macro_pr_auc": float(np.mean(label_ap)),
            "validation_rows": int(len(validation_indices)),
        })
    best = max(search_rows, key=lambda row: row["validation_macro_pr_auc"])
    best_options = {
        "max_features": best["max_features"],
        "min_samples_leaf": best["min_samples_leaf"],
    }

    # Existing saved model is the untuned baseline, trained on the same 80% split.
    old_bundle = load(ROOT / "models" / "aromasense_model.joblib")
    baseline_probabilities = probabilities(old_bundle["estimators"], X[test_indices])
    baseline_metrics = evaluate(y[test_indices], baseline_probabilities)

    print(f"Selected settings: {best_options}; refitting on all {len(train_indices)} training rows.", flush=True)
    tuned_estimators = fit_labels(
        X[train_indices], y[train_indices], labels, best_options, phase="final fit"
    )
    tuned_probabilities = probabilities(tuned_estimators, X[test_indices])
    tuned_metrics = evaluate(y[test_indices], tuned_probabilities)
    tuned_metrics.update({
        "model": "One binary ExtraTreesClassifier per descriptor (tuned)",
        "selected_hyperparameters": {**best_options, "n_estimators": 20,
                                     "class_weight": "balanced", "random_state": 42},
        "split": "random 80/20 test split, seed 42; tuning used a 75/25 split within training, seed 43",
        "train_rows": int(len(train_indices)), "test_rows": int(len(test_indices)),
        "label_count": int(len(labels)), "fingerprint_bits": FINGERPRINT_BITS,
        "morgan_radius": MORGAN_RADIUS,
        "tuning_metric": "validation macro PR-AUC (mean average precision across labels)",
        "validation_rows": int(len(validation_indices)),
        "baseline_test_metrics": baseline_metrics,
        "tuning_candidates": search_rows,
        "notes": "Test set was not used for hyperparameter selection. Threshold metrics use 0.5. Macro PR-AUC is mean average precision for labels with positives in the evaluated split.",
    })

    model_dir, report_dir = ROOT / "models", ROOT / "reports"
    dump({"estimators": tuned_estimators, "labels": labels,
          "fingerprint_bits": FINGERPRINT_BITS, "morgan_radius": MORGAN_RADIUS,
          "threshold": 0.5, "hyperparameters": tuned_metrics["selected_hyperparameters"]},
         model_dir / "aromasense_model.joblib", compress=3)
    (report_dir / "evaluation.json").write_text(json.dumps(tuned_metrics, indent=2), encoding="utf-8")
    (report_dir / "tuning_results.json").write_text(json.dumps({
        "selection_metric": tuned_metrics["tuning_metric"],
        "best_candidate": best,
        "candidates": search_rows,
        "train_validation_test_rows": [int(len(fit_indices)), int(len(validation_indices)), int(len(test_indices))],
    }, indent=2), encoding="utf-8")
    print(json.dumps({
        "selected_hyperparameters": tuned_metrics["selected_hyperparameters"],
        "validation_candidates": search_rows,
        "baseline_test": baseline_metrics,
        "tuned_test": {k: tuned_metrics[k] for k in (
            "macro_f1", "micro_f1", "macro_precision", "micro_precision",
            "macro_recall", "micro_recall", "macro_roc_auc_defined_labels",
            "macro_pr_auc_defined_labels",
        )},
    }, indent=2))


if __name__ == "__main__":
    main()
