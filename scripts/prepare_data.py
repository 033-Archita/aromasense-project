"""Validate, de-duplicate and serialize molecular fingerprints and labels."""
import json

import numpy as np
import pandas as pd

from ml.common import DESCRIPTORS_COLUMN, RAW_DATA, SMILES_COLUMN, descriptor_columns, fingerprint_molecule, load_dataset, parse_molecule


def prepare() -> tuple[np.ndarray, np.ndarray, list[str], list[str]]:
    frame = load_dataset()
    if SMILES_COLUMN not in frame or DESCRIPTORS_COLUMN not in frame:
        raise ValueError(f"Expected columns {SMILES_COLUMN!r} and {DESCRIPTORS_COLUMN!r}.")
    labels = descriptor_columns(frame)
    # Keep one row per exact SMILES; discard rows without usable structures or labels.
    frame = frame.dropna(subset=[SMILES_COLUMN]).drop_duplicates(subset=[SMILES_COLUMN], keep="first")
    frame[SMILES_COLUMN] = frame[SMILES_COLUMN].astype(str).str.strip()
    frame = frame[frame[SMILES_COLUMN] != ""]
    molecules = frame[SMILES_COLUMN].map(parse_molecule)
    valid = molecules.notna()
    frame, molecules = frame.loc[valid], molecules.loc[valid]
    target_frame = frame[labels].apply(pd.to_numeric, errors="coerce").fillna(0)
    if not target_frame.isin([0, 1]).all().all():
        raise ValueError("Descriptor targets must be binary (0/1); inspect the dataset audit.")
    keep = target_frame.sum(axis=1) > 0
    frame, molecules, target_frame = frame.loc[keep], molecules.loc[keep], target_frame.loc[keep]
    fingerprints = np.stack([fingerprint_molecule(mol) for mol in molecules])
    y = target_frame.to_numpy(dtype=np.uint8)
    root = RAW_DATA.parents[2]
    processed = root / "data" / "processed"
    processed.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(processed / "molecular_dataset.npz", X=fingerprints, y=y)
    (processed / "metadata.json").write_text(json.dumps({
        "smiles": frame[SMILES_COLUMN].tolist(), "labels": labels,
        "rows": int(len(frame)), "fingerprint_bits": int(fingerprints.shape[1]),
        "morgan_radius": 2,
    }, indent=2), encoding="utf-8")
    print(f"Prepared {len(frame)} molecules, {len(labels)} labels, {fingerprints.shape[1]} fingerprint bits.")
    return fingerprints, y, labels, frame[SMILES_COLUMN].tolist()


if __name__ == "__main__":
    prepare()
