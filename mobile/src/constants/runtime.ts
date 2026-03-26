export const BASELINE_MODEL_VERSION = "baseline-synth-shot-model/v1";
export const RUNTIME_MODE_LABEL = "Tracker Baseline";
export const RUNTIME_MODE_DETAIL =
  "Using a simulated shot-tracking runtime until the native camera bridge lands.";

export type ReadinessStatus = "ready" | "warning" | "pending";

export type ReadinessCheck = {
  label: string;
  detail: string;
  status: ReadinessStatus;
};
