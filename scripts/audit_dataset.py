"""Download (when needed) and audit the OpenPOM-associated CSV dataset."""
import json
import urllib.request
from collections import Counter

import pandas as pd

from ml.common import DATA_URL, DESCRIPTORS_COLUMN, RAW_DATA, SMILES_COLUMN, load_dataset, parse_molecule


def ensure_dataset() -> None:
    if RAW_DATA.exists():
        return
    RAW_DATA.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading source dataset: {DATA_URL}")
    urllib.request.urlretrieve(DATA_URL, RAW_DATA)


def audit() -> dict:
    ensure_dataset()
    frame = load_dataset()
    missing_smiles = int(frame[SMILES_COLUMN].isna().sum()) if SMILES_COLUMN in frame else len(frame)
    invalid_smiles = int(frame[SMILES_COLUMN].map(parse_molecule).isna().sum()) if SMILES_COLUMN in frame else len(frame)
    duplicate_smiles = int(frame[SMILES_COLUMN].duplicated(keep="first").sum()) if SMILES_COLUMN in frame else 0
    targets = [c for c in frame.columns if c not in (SMILES_COLUMN, DESCRIPTORS_COLUMN)]
    numeric_targets = frame[targets].apply(pd.to_numeric, errors="coerce")
    positive_counts = numeric_targets.fillna(0).sum().astype(int)
    descriptor_lists = frame.get(DESCRIPTORS_COLUMN, pd.Series(dtype=str)).fillna("").astype(str)
    parsed_descriptors = [label.strip() for cell in descriptor_lists for label in cell.split(";") if label.strip()]
    report = {
        "source_url": DATA_URL,
        "rows": int(len(frame)),
        "columns": int(len(frame.columns)),
        "column_names": list(map(str, frame.columns)),
        "smiles_column": SMILES_COLUMN if SMILES_COLUMN in frame else None,
        "descriptor_text_column": DESCRIPTORS_COLUMN if DESCRIPTORS_COLUMN in frame else None,
        "missing_values_by_column": {str(k): int(v) for k, v in frame.isna().sum().items() if v},
        "missing_smiles": missing_smiles,
        "invalid_smiles": invalid_smiles,
        "duplicate_smiles_after_first": duplicate_smiles,
        "descriptor_count": len(targets),
        "descriptor_positive_counts": {str(k): int(v) for k, v in positive_counts.items()},
        "descriptor_text_frequency": dict(Counter(parsed_descriptors).most_common()),
        "binary_target_values": {str(c): sorted(map(str, numeric_targets[c].dropna().unique().tolist())) for c in targets},
    }
    output = __import__("pathlib").Path(__file__).resolve().parents[1] / "reports" / "dataset_audit.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("rows", "columns", "descriptor_count", "missing_smiles", "invalid_smiles", "duplicate_smiles_after_first")}, indent=2))
    print(f"Full audit written to {output}")
    return report


if __name__ == "__main__":
    audit()
