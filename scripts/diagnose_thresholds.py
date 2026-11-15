"""Validation-only threshold and error analysis for the saved tuned model."""
import json

import numpy as np
from joblib import dump, load
from sklearn.metrics import (
    f1_score, precision_score, recall_score, average_precision_score,
)
from sklearn.model_selection import train_test_split

from ml.common import ROOT
from scripts.prepare_data import prepare
from scripts.tune_model import fit_labels, probabilities

THRESHOLDS = np.round(np.arange(0.20, 0.801, 0.05), 2)


def score_at(y_true: np.ndarray, probabilities_: np.ndarray, threshold: float) -> dict:
    predicted = probabilities_ >= threshold
    return {
        "threshold": float(threshold),
        "macro_precision": float(precision_score(y_true, predicted, average="macro", zero_division=0)),
        "micro_precision": float(precision_score(y_true, predicted, average="micro", zero_division=0)),
        "macro_recall": float(recall_score(y_true, predicted, average="macro", zero_division=0)),
        "micro_recall": float(recall_score(y_true, predicted, average="micro", zero_division=0)),
        "macro_f1": float(f1_score(y_true, predicted, average="macro", zero_division=0)),
        "micro_f1": float(f1_score(y_true, predicted, average="micro", zero_division=0)),
        "mean_descriptors_per_molecule": float(predicted.sum(axis=1).mean()),
        "median_descriptors_per_molecule": float(np.median(predicted.sum(axis=1))),
        "false_positives": int(np.logical_and(predicted, y_true == 0).sum()),
        "false_negatives": int(np.logical_and(~predicted, y_true == 1).sum()),
    }


def main() -> None:
    X, y, labels, _ = prepare()
    all_indices = np.arange(len(y))
    train_indices, test_indices = train_test_split(
        all_indices, test_size=0.2, random_state=42, shuffle=True
    )
    fit_indices, validation_indices = train_test_split(
        train_indices, test_size=0.25, random_state=43, shuffle=True
    )
    # The held-out test indices are deliberately not read for metric calculations.
    assert len(test_indices) == 997

    bundle_path = ROOT / "models" / "aromasense_model.joblib"
    bundle = load(bundle_path)
    params = bundle["hyperparameters"]
    options = {"max_features": params["max_features"],
               "min_samples_leaf": params["min_samples_leaf"]}
    validation_estimators = fit_labels(
        X[fit_indices], y[fit_indices], labels, options,
        phase="validation diagnostic fit",
    )
    val_y = y[validation_indices]
    val_prob = probabilities(validation_estimators, X[validation_indices])

    threshold_rows = [score_at(val_y, val_prob, cutoff) for cutoff in THRESHOLDS]
    baseline = next(row for row in threshold_rows if row["threshold"] == 0.5)
    # Conservative policy: require better macro precision than 0.5 and retain
    # at least 80% of its macro recall; then choose the highest macro F1.
    eligible = [row for row in threshold_rows
                if row["threshold"] > 0.5
                and row["macro_precision"] > baseline["macro_precision"]
                and row["macro_recall"] >= 0.8 * baseline["macro_recall"]]
    chosen = max(eligible, key=lambda row: row["macro_f1"]) if eligible else baseline

    # Per-label F1-optimal cutoffs are diagnostic only. Choosing and scoring
    # them on the same modest validation set would overfit, especially for rare labels.
    per_label = []
    for i, label in enumerate(labels):
        label_rows = [score_at(val_y[:, i:i+1], val_prob[:, i:i+1], cutoff)
                      for cutoff in THRESHOLDS]
        best_label = max(label_rows, key=lambda row: row["macro_f1"])
        per_label.append({"descriptor": label, "validation_positives": int(val_y[:, i].sum()),
                          "diagnostic_best_threshold": best_label["threshold"],
                          "f1_at_0_5": next(r["macro_f1"] for r in label_rows if r["threshold"] == 0.5),
                          "diagnostic_best_f1": best_label["macro_f1"]})

    # Frequency strata are derived from training labels only, never test labels.
    train_positive_counts = y[train_indices].sum(axis=0)
    median_frequency = float(np.median(train_positive_counts))
    rare_mask = train_positive_counts <= median_frequency
    common_mask = ~rare_mask
    stratum_results = {}
    for name, mask in (("rare_at_or_below_training_median", rare_mask),
                       ("common_above_training_median", common_mask)):
        stratum_results[name] = {
            "descriptor_count": int(mask.sum()),
            "training_positive_count_min": int(train_positive_counts[mask].min()),
            "training_positive_count_median": float(np.median(train_positive_counts[mask])),
            "training_positive_count_max": int(train_positive_counts[mask].max()),
            "at_0_5": score_at(val_y[:, mask], val_prob[:, mask], 0.5),
            "at_selected_threshold": score_at(val_y[:, mask], val_prob[:, mask], chosen["threshold"]),
        }

    threshold_distribution = np.array([item["diagnostic_best_threshold"] for item in per_label])
    report = {
        "selection_split": {"fit_rows": int(len(fit_indices)), "validation_rows": int(len(validation_indices)),
                            "test_rows_reserved_and_not_scored": int(len(test_indices)),
                            "split_seeds": {"train_test": 42, "fit_validation": 43}},
        "threshold_candidates": threshold_rows,
        "selection_policy": "Choose the highest macro-F1 cutoff above 0.5 that improves macro precision and retains at least 80% of validation macro recall at 0.5; otherwise keep 0.5.",
        "selected_global_threshold": float(chosen["threshold"]),
        "baseline_at_0_5": baseline,
        "selected_validation_metrics": chosen,
        "selected_cutoff_is_more_conservative": bool(chosen["threshold"] > 0.5),
        "per_label_threshold_diagnostic": {
            "selected_per_label_thresholds_before_analysis": "None; the model used one shared 0.5 cutoff.",
            "validation_only_f1_optimal_cutoff_summary": {
                "min": float(threshold_distribution.min()),
                "q1": float(np.quantile(threshold_distribution, 0.25)),
                "median": float(np.median(threshold_distribution)),
                "q3": float(np.quantile(threshold_distribution, 0.75)),
                "max": float(threshold_distribution.max()),
                "below_0_5_count": int((threshold_distribution < 0.5).sum()),
                "at_0_5_count": int((threshold_distribution == 0.5).sum()),
                "above_0_5_count": int((threshold_distribution > 0.5).sum()),
            },
            "warning": "Per-label cutoffs are an in-sample validation diagnostic, not selected for deployment; use a separate calibration split to estimate them reliably.",
            "labels": per_label,
        },
        "common_rare_descriptor_performance": {
            "grouping_rule": "Rare means training positive count at or below the median; common means above the median. Grouping uses training labels only.",
            "training_positive_count_median": median_frequency,
            "groups": stratum_results,
        },
        "test_set_used": False,
    }

    # Preserve model weights and held-out scores; only attach the validation-selected
    # operating threshold to the existing saved bundle.
    bundle["threshold"] = float(chosen["threshold"])
    bundle["threshold_selection"] = report["selection_policy"]
    dump(bundle, bundle_path, compress=3)
    report_path = ROOT / "reports" / "threshold_diagnostics.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "thresholds": threshold_rows,
        "selected_global_threshold": chosen["threshold"],
        "selected_validation_metrics": chosen,
        "per_label_threshold_summary": report["per_label_threshold_diagnostic"]["validation_only_f1_optimal_cutoff_summary"],
        "common_rare": stratum_results,
        "test_set_used": False,
    }, indent=2))


if __name__ == "__main__":
    main()
