from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

MODEL_VERSION = "nba-shotdetail-make-model/v3"
DATASET_PATH = Path(__file__).resolve().parent / "datasets" / "nba_dataset" / "shotdetail.parquet"
ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
WEIGHTS_PATH = ARTIFACT_DIR / "shotdetail_make_model_weights.npz"
MANIFEST_PATH = ARTIFACT_DIR / "shotdetail_make_model_manifest.json"
PREPROCESSING_PATH = ARTIFACT_DIR / "shotdetail_make_model_preprocessing.json"

NUMERIC_COLUMNS = [
    "PERIOD",
    "MINUTES_REMAINING",
    "SECONDS_REMAINING",
    "SHOT_DISTANCE",
    "LOC_X",
    "LOC_Y",
    "YEAR",
]

CATEGORICAL_COLUMNS = [
    "ACTION_TYPE",
    "SHOT_TYPE",
    "SHOT_ZONE_BASIC",
    "SHOT_ZONE_AREA",
    "SHOT_ZONE_RANGE",
]

TARGET_COLUMN = "SHOT_MADE_FLAG"
SAMPLE_SIZE = 50_000
TRAIN_SPLIT = 0.8
EPOCHS = 16
BATCH_SIZE = 2048
LEARNING_RATE = 0.12
L2_WEIGHT = 1e-4
SEED = 7


def load_frame() -> pd.DataFrame:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Missing dataset at {DATASET_PATH}")

    columns = NUMERIC_COLUMNS + CATEGORICAL_COLUMNS + [TARGET_COLUMN]
    frame = pd.read_parquet(DATASET_PATH, columns=columns)
    frame = frame.dropna(subset=columns)
    if len(frame) > SAMPLE_SIZE:
        frame = frame.sample(n=SAMPLE_SIZE, random_state=SEED)
    return frame.reset_index(drop=True)


def split_frame(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    shuffled = frame.sample(frac=1.0, random_state=SEED).reset_index(drop=True)
    split_index = int(len(shuffled) * TRAIN_SPLIT)
    train_frame = shuffled.iloc[:split_index].copy()
    val_frame = shuffled.iloc[split_index:].copy()
    return train_frame, val_frame


def build_feature_matrix(
    train_frame: pd.DataFrame,
    val_frame: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, list[str], dict[str, dict[str, float]], dict[str, int]]:
    numeric_means = train_frame[NUMERIC_COLUMNS].mean()
    numeric_stds = train_frame[NUMERIC_COLUMNS].std().replace(0, 1).fillna(1)

    train_numeric = ((train_frame[NUMERIC_COLUMNS] - numeric_means) / numeric_stds).astype("float32")
    val_numeric = ((val_frame[NUMERIC_COLUMNS] - numeric_means) / numeric_stds).astype("float32")

    train_cats = pd.get_dummies(
        train_frame[CATEGORICAL_COLUMNS].astype(str),
        prefix=CATEGORICAL_COLUMNS,
        dtype="float32",
    )
    val_cats = pd.get_dummies(
        val_frame[CATEGORICAL_COLUMNS].astype(str),
        prefix=CATEGORICAL_COLUMNS,
        dtype="float32",
    )
    dummy_columns = train_cats.columns.tolist()
    val_cats = val_cats.reindex(columns=dummy_columns, fill_value=0.0)

    train_features_frame = pd.concat([train_numeric, train_cats], axis=1)
    val_features_frame = pd.concat([val_numeric, val_cats], axis=1)
    feature_columns = train_features_frame.columns.tolist()

    preprocessing = {
        "numeric_mean": {column: float(numeric_means[column]) for column in NUMERIC_COLUMNS},
        "numeric_std": {column: float(numeric_stds[column]) for column in NUMERIC_COLUMNS},
    }
    vocab_sizes = {
        column: int(train_frame[column].astype(str).nunique())
        for column in CATEGORICAL_COLUMNS
    }
    train_labels = train_frame[TARGET_COLUMN].astype("float32").to_numpy().reshape(-1, 1)
    val_labels = val_frame[TARGET_COLUMN].astype("float32").to_numpy().reshape(-1, 1)
    return (
        train_features_frame.to_numpy(dtype="float32"),
        val_features_frame.to_numpy(dtype="float32"),
        train_labels,
        val_labels,
        feature_columns,
        preprocessing,
        vocab_sizes,
    )


def sigmoid(values: np.ndarray) -> np.ndarray:
    clipped = np.clip(values, -30.0, 30.0)
    return 1.0 / (1.0 + np.exp(-clipped))


def binary_cross_entropy(labels: np.ndarray, predictions: np.ndarray) -> float:
    clipped = np.clip(predictions, 1e-6, 1 - 1e-6)
    return float(-np.mean(labels * np.log(clipped) + (1 - labels) * np.log(1 - clipped)))


def binary_accuracy(labels: np.ndarray, predictions: np.ndarray) -> float:
    predicted_labels = (predictions >= 0.5).astype("float32")
    return float(np.mean(predicted_labels == labels))


def binary_auc(labels: np.ndarray, predictions: np.ndarray) -> float:
    flat_labels = labels.reshape(-1).astype(np.int32)
    flat_predictions = predictions.reshape(-1).astype(np.float64)
    positive_mask = flat_labels == 1
    negative_mask = flat_labels == 0
    positive_count = int(np.sum(positive_mask))
    negative_count = int(np.sum(negative_mask))
    if positive_count == 0 or negative_count == 0:
        return 0.5

    order = np.argsort(flat_predictions, kind="mergesort")
    ranks = np.empty_like(order, dtype=np.float64)
    ranks[order] = np.arange(1, len(flat_predictions) + 1, dtype=np.float64)
    positive_rank_sum = float(ranks[positive_mask].sum())
    return float(
        (positive_rank_sum - (positive_count * (positive_count + 1) / 2.0))
        / (positive_count * negative_count)
    )


def train_logistic_regression(
    train_features: np.ndarray,
    train_labels: np.ndarray,
    val_features: np.ndarray,
    val_labels: np.ndarray,
) -> tuple[np.ndarray, float, list[dict[str, float]]]:
    rng = np.random.default_rng(SEED)
    weights = np.zeros((train_features.shape[1], 1), dtype=np.float32)
    bias = 0.0
    history: list[dict[str, float]] = []

    for epoch in range(EPOCHS):
        order = rng.permutation(len(train_features))
        shuffled_features = train_features[order]
        shuffled_labels = train_labels[order]

        for start in range(0, len(shuffled_features), BATCH_SIZE):
            end = start + BATCH_SIZE
            batch_features = shuffled_features[start:end]
            batch_labels = shuffled_labels[start:end]
            predictions = sigmoid(batch_features @ weights + bias)
            errors = predictions - batch_labels
            gradient_w = (batch_features.T @ errors) / len(batch_features)
            gradient_w += L2_WEIGHT * weights
            gradient_b = float(errors.mean())
            weights -= LEARNING_RATE * gradient_w.astype(np.float32)
            bias -= LEARNING_RATE * gradient_b

        train_predictions = sigmoid(train_features @ weights + bias)
        val_predictions = sigmoid(val_features @ weights + bias)
        epoch_metrics = {
            "epoch": float(epoch + 1),
            "train_loss": binary_cross_entropy(train_labels, train_predictions),
            "train_accuracy": binary_accuracy(train_labels, train_predictions),
            "val_loss": binary_cross_entropy(val_labels, val_predictions),
            "val_accuracy": binary_accuracy(val_labels, val_predictions),
            "val_auc": binary_auc(val_labels, val_predictions),
        }
        history.append(epoch_metrics)
        print(json.dumps(epoch_metrics))

    return weights, float(bias), history


def train() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading shotdetail parquet...")
    frame = load_frame()
    train_frame, val_frame = split_frame(frame)
    print(
        f"Loaded {len(frame)} shot rows for training "
        f"({len(train_frame)} train / {len(val_frame)} validation)."
    )
    (
        train_features,
        val_features,
        train_labels,
        val_labels,
        feature_columns,
        preprocessing,
        vocab_sizes,
    ) = build_feature_matrix(train_frame, val_frame)

    print("Training fast real-data shot model...")
    weights, bias, history = train_logistic_regression(
        train_features,
        train_labels,
        val_features,
        val_labels,
    )

    print("Evaluating and exporting real-data artifact...")
    val_predictions = sigmoid(val_features @ weights + bias)
    metrics = {
        "loss": binary_cross_entropy(val_labels, val_predictions),
        "accuracy": binary_accuracy(val_labels, val_predictions),
        "auc": binary_auc(val_labels, val_predictions),
    }
    np.savez_compressed(
        WEIGHTS_PATH,
        weights=weights.astype("float32"),
        bias=np.array([bias], dtype="float32"),
    )
    PREPROCESSING_PATH.write_text(
        json.dumps(
            {
                "model_version": MODEL_VERSION,
                "feature_columns": feature_columns,
                "numeric_columns": NUMERIC_COLUMNS,
                "categorical_columns": CATEGORICAL_COLUMNS,
                "preprocessing": preprocessing,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    manifest = {
        "model_version": MODEL_VERSION,
        "artifact_path": str(WEIGHTS_PATH.relative_to(Path(__file__).resolve().parents[1])),
        "artifact_format": "numpy_npz",
        "dataset_path": str(DATASET_PATH.relative_to(Path(__file__).resolve().parents[1])),
        "preprocessing_path": str(PREPROCESSING_PATH.relative_to(Path(__file__).resolve().parents[1])),
        "dataset_rows_used": int(len(frame)),
        "license": "Apache-2.0",
        "numeric_columns": NUMERIC_COLUMNS,
        "categorical_columns": CATEGORICAL_COLUMNS,
        "target_column": TARGET_COLUMN,
        "feature_count": int(len(feature_columns)),
        "vocab_sizes": vocab_sizes,
        "metrics": metrics,
        "history_tail": history[-3:],
        "sha256": hashlib.sha256(WEIGHTS_PATH.read_bytes()).hexdigest(),
        "note": "This is a fast first-pass shot outcome model trained on public shot-detail labels. It is real-data-backed, but still tabular rather than frame-based vision inference and still needs a native/mobile runtime bridge.",
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"weights": str(WEIGHTS_PATH), "manifest": str(MANIFEST_PATH)}, indent=2))


if __name__ == "__main__":
    train()
