from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import tensorflow as tf

MODEL_VERSION = "baseline-synth-shot-model/v1"
ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
TFLITE_PATH = ARTIFACT_DIR / "baseline_shot_model.tflite"
MANIFEST_PATH = ARTIFACT_DIR / "baseline_shot_model_manifest.json"
KERAS_PATH = ARTIFACT_DIR / "baseline_shot_model.keras"

FEATURE_NAMES = [
    "release_angle_deg",
    "elbow_angle_deg",
    "knee_angle_deg",
    "torso_tilt_deg",
    "x_norm",
    "y_norm",
    "confidence",
    "capture_quality_code",
    "pose_detected",
]

FORM_TARGETS = {
    "elbow_angle_deg": {"target": 92.0, "tolerance": 35.0},
    "knee_angle_deg": {"target": 115.0, "tolerance": 45.0},
    "torso_tilt_deg": {"target": 11.0, "tolerance": 18.0},
}


@dataclass(slots=True)
class DatasetBundle:
    features: np.ndarray
    make_labels: np.ndarray
    form_score_labels: np.ndarray


def score_angle(value: float, *, target: float, tolerance: float) -> float:
    delta = abs(value - target)
    if delta >= tolerance:
        return 0.0
    return (1.0 - (delta / tolerance)) * 100.0


def calculate_form_score(elbow: float, knee: float, torso: float, pose_detected: float) -> float:
    if pose_detected < 0.5:
        return 0.0
    elbow_score = score_angle(elbow, **FORM_TARGETS["elbow_angle_deg"])
    knee_score = score_angle(knee, **FORM_TARGETS["knee_angle_deg"])
    torso_score = score_angle(torso, **FORM_TARGETS["torso_tilt_deg"])
    return (elbow_score * 0.45) + (knee_score * 0.35) + (torso_score * 0.2)


def zone_bonus(x_norm: float, y_norm: float) -> float:
    center_distance = abs(x_norm - 0.5)
    paint_bonus = 0.1 if y_norm < 0.4 and center_distance < 0.2 else 0.0
    corner_penalty = -0.05 if y_norm < 0.18 and center_distance > 0.3 else 0.0
    return paint_bonus + corner_penalty


def capture_quality_bonus(code: float) -> float:
    mapping = {
        0.0: -0.32,  # unusable
        1.0: -0.14,  # low
        2.0: 0.02,   # medium
        3.0: 0.08,   # high
    }
    return mapping.get(float(code), 0.0)


def sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def generate_synthetic_dataset(sample_count: int = 4096, seed: int = 7) -> DatasetBundle:
    rng = np.random.default_rng(seed)

    features = []
    make_labels = []
    form_labels = []

    for _ in range(sample_count):
        pose_detected = 1.0 if rng.random() > 0.08 else 0.0
        release_angle = float(rng.uniform(34.0, 58.0))
        elbow_angle = float(rng.uniform(55.0, 135.0)) if pose_detected else 0.0
        knee_angle = float(rng.uniform(70.0, 160.0)) if pose_detected else 0.0
        torso_tilt = float(rng.uniform(-5.0, 30.0)) if pose_detected else 0.0
        x_norm = float(rng.uniform(0.0, 1.0))
        y_norm = float(rng.uniform(0.0, 1.0))
        confidence = float(rng.uniform(0.45, 0.99))
        capture_quality_code = float(rng.choice([0.0, 1.0, 2.0, 3.0], p=[0.05, 0.12, 0.48, 0.35]))

        form_score = calculate_form_score(elbow_angle, knee_angle, torso_tilt, pose_detected)
        logit = (
            ((form_score - 68.0) / 10.0)
            + ((release_angle - 45.0) * -0.015)
            + ((confidence - 0.7) * 2.3)
            + zone_bonus(x_norm, y_norm)
            + capture_quality_bonus(capture_quality_code)
            - (0.85 if pose_detected < 0.5 else 0.0)
        )
        make_probability = sigmoid(logit)
        make_label = 1.0 if rng.random() < make_probability else 0.0

        features.append(
            [
                release_angle,
                elbow_angle,
                knee_angle,
                torso_tilt,
                x_norm,
                y_norm,
                confidence,
                capture_quality_code,
                pose_detected,
            ]
        )
        make_labels.append([make_label])
        form_labels.append([form_score / 100.0])

    return DatasetBundle(
        features=np.asarray(features, dtype=np.float32),
        make_labels=np.asarray(make_labels, dtype=np.float32),
        form_score_labels=np.asarray(form_labels, dtype=np.float32),
    )


def build_model(train_features: np.ndarray) -> tf.keras.Model:
    inputs = tf.keras.Input(shape=(len(FEATURE_NAMES),), name="shot_features")
    normalization = tf.keras.layers.Normalization(name="feature_norm")
    normalization.adapt(train_features)

    x = normalization(inputs)
    x = tf.keras.layers.Dense(32, activation="relu")(x)
    x = tf.keras.layers.Dense(16, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.1)(x)

    make_probability = tf.keras.layers.Dense(1, activation="sigmoid", name="make_probability")(x)
    form_score = tf.keras.layers.Dense(1, activation="sigmoid", name="form_score")(x)

    model = tf.keras.Model(inputs=inputs, outputs=[make_probability, form_score], name="courtvision_baseline")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.003),
        loss={
            "make_probability": tf.keras.losses.BinaryCrossentropy(),
            "form_score": tf.keras.losses.MeanSquaredError(),
        },
        metrics={
            "make_probability": [tf.keras.metrics.BinaryAccuracy(name="accuracy")],
            "form_score": [tf.keras.metrics.MeanAbsoluteError(name="mae")],
        },
        loss_weights={"make_probability": 0.7, "form_score": 0.3},
    )
    return model


def train_and_export() -> None:
    tf.keras.utils.set_random_seed(7)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    bundle = generate_synthetic_dataset()
    split_index = int(len(bundle.features) * 0.8)
    train_features = bundle.features[:split_index]
    val_features = bundle.features[split_index:]
    train_make = bundle.make_labels[:split_index]
    val_make = bundle.make_labels[split_index:]
    train_form = bundle.form_score_labels[:split_index]
    val_form = bundle.form_score_labels[split_index:]

    model = build_model(train_features)
    history = model.fit(
        train_features,
        {"make_probability": train_make, "form_score": train_form},
        validation_data=(val_features, {"make_probability": val_make, "form_score": val_form}),
        epochs=10,
        batch_size=64,
        verbose=0,
    )

    eval_results = model.evaluate(
        val_features,
        {"make_probability": val_make, "form_score": val_form},
        verbose=0,
        return_dict=True,
    )

    model.save(KERAS_PATH, overwrite=True)

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    TFLITE_PATH.write_bytes(tflite_model)

    sha256 = hashlib.sha256(tflite_model).hexdigest()
    manifest = {
        "model_version": MODEL_VERSION,
        "artifact_path": str(TFLITE_PATH.relative_to(Path(__file__).resolve().parents[1])),
        "keras_path": str(KERAS_PATH.relative_to(Path(__file__).resolve().parents[1])),
        "sha256": sha256,
        "feature_names": FEATURE_NAMES,
        "dataset": {
            "type": "synthetic_structured_features",
            "sample_count": int(len(bundle.features)),
            "train_count": int(len(train_features)),
            "validation_count": int(len(val_features)),
            "note": "Synthetic labels are derived from backend-aligned heuristics. Replace before production claims.",
        },
        "metrics": {key: float(value) for key, value in eval_results.items()},
        "training": {
            "epochs": 10,
            "batch_size": 64,
            "seed": 7,
        },
        "history_tail": {
            key: [float(v) for v in values[-3:]]
            for key, values in history.history.items()
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({"tflite": str(TFLITE_PATH), "manifest": str(MANIFEST_PATH), "sha256": sha256}, indent=2))


if __name__ == "__main__":
    train_and_export()
