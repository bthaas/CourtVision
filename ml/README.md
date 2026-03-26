# CourtVision ML

This workspace contains the reproducible model-training paths for CourtVision.

Important:

- CourtVision ships today as a shooting tracker, not a biomechanics coaching product.
- The current baseline model is trained on **synthetic structured shot features**, not real camera frames.
- It is useful as a legacy experiment for validating the training, evaluation, and TensorFlow Lite export pipeline.
- It is **not** a production-ready computer-vision model for recruiter- or athlete-facing claims.
- The repo now also includes a first-pass model trained on a real public shot-outcome dataset, but it is still tabular and not yet connected to a native mobile runtime.

## What it trains

`train_baseline_model.py` is a legacy experimental trainer that builds a small multi-head Keras model and predicts:

- `make_probability`
- `form_score`

from structured inputs such as:

- release angle
- elbow angle
- knee angle
- torso tilt
- court position
- model confidence
- capture quality
- pose detected

Those synthetic labels are preserved for future research only. They are not part of the shipping tracker contract anymore.

`train_shotdetail_model.py` trains a logistic shot-make model on the public `shotdetail.parquet` dataset downloaded into `ml/datasets/nba_dataset/`.

It learns from:

- shot type
- action type
- shot zone
- court coordinates
- distance
- game clock context

It exports:

- `shotdetail_make_model_weights.npz`
- `shotdetail_make_model_preprocessing.json`
- `shotdetail_make_model_manifest.json`

## Run

```bash
cd /Users/bretthaas/CourtVision
python3 ml/train_baseline_model.py
```

Artifacts are written to `ml/artifacts/`:

- `baseline_shot_model.tflite`
- `baseline_shot_model_manifest.json`

To train the public-data shot model:

```bash
cd /Users/bretthaas/CourtVision
python3 ml/train_shotdetail_model.py
```

## Next real-production steps

1. Keep the shipping path focused on shooting tracking, not coaching claims.
2. Replace the mock mobile runtime with a real camera + tracking pipeline.
3. Add a native mobile inference bridge that consumes a production model artifact.
4. Treat pose/form work as a separate research branch using [docs/future_pose_research.md](../docs/future_pose_research.md).
