"""Shared dataset and Morgan fingerprint helpers for AromaSense Phase 1."""
from pathlib import Path

import numpy as np
import pandas as pd
from rdkit import Chem, DataStructs
from rdkit.Chem import rdFingerprintGenerator

ROOT = Path(__file__).resolve().parents[1]
DATA_URL = (
    "https://raw.githubusercontent.com/ARY2260/openpom/main/openpom/data/"
    "curated_datasets/curated_GS_LF_merged_4983.csv"
)
RAW_DATA = ROOT / "data" / "raw" / "curated_GS_LF_merged_4983.csv"
SMILES_COLUMN = "nonStereoSMILES"
DESCRIPTORS_COLUMN = "descriptors"
FINGERPRINT_BITS = 2048
MORGAN_RADIUS = 2
_FINGERPRINT_GENERATOR = rdFingerprintGenerator.GetMorganGenerator(
    radius=MORGAN_RADIUS, fpSize=FINGERPRINT_BITS
)


def load_dataset(path: Path = RAW_DATA) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {path}. Download it from {DATA_URL} first."
        )
    return pd.read_csv(path, low_memory=False)


def parse_molecule(smiles: str):
    if not isinstance(smiles, str) or not smiles.strip():
        return None
    try:
        return Chem.MolFromSmiles(smiles.strip())
    except (TypeError, ValueError):
        return None


def fingerprint_molecule(molecule) -> np.ndarray:
    """Return a dense, binary Morgan fingerprint for an RDKit molecule."""
    bit_vector = _FINGERPRINT_GENERATOR.GetFingerprint(molecule)
    result = np.zeros((FINGERPRINT_BITS,), dtype=np.uint8)
    DataStructs.ConvertToNumpyArray(bit_vector, result)
    return result


def fingerprint_smiles(smiles: str) -> np.ndarray:
    molecule = parse_molecule(smiles)
    if molecule is None:
        raise ValueError("Invalid SMILES: RDKit could not parse this structure.")
    return fingerprint_molecule(molecule)


def descriptor_columns(frame: pd.DataFrame) -> list[str]:
    """Identify binary target columns, excluding the two source text columns."""
    columns = [c for c in frame.columns if c not in (SMILES_COLUMN, DESCRIPTORS_COLUMN)]
    return columns
