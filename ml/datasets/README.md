# Dataset Contract

The production tracker dataset is not fully in this repository yet.

For the shipping tracker path, each example should provide:

- `x_norm`
- `y_norm`
- `confidence`
- `capture_quality_code`
- `make_label`
- optional shot metadata such as zone, distance, and shot type

If the separate pose/form research branch is revived later, an extended dataset contract would add:

- `release_angle_deg`
- `elbow_angle_deg`
- `knee_angle_deg`
- `torso_tilt_deg`
- `x_norm`
- `y_norm`
- `confidence`
- `capture_quality_code`
- `pose_detected`
- `make_label`
- `form_score_label`

Recommended future dataset splits:

- `train`
- `validation`
- `test`

Recommended provenance metadata per dataset version:

- collection source
- device profile
- model/annotation version
- labeling rubric
- class balance summary
- privacy/deletion policy
