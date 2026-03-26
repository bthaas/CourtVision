import { BASELINE_MODEL_VERSION } from "../constants/runtime";
import { FrameInput, TFLiteInferenceOutput, TFLiteShotModel } from "../types/tflite";

// This mock preserves the production integration shape so replacing with
// a native TFLite bridge does not affect higher-level app logic.
export class MockTFLiteShotModel implements TFLiteShotModel {
  async warmup(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  async infer(_frame: FrameInput): Promise<TFLiteInferenceOutput> {
    const started = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 120 + Math.random() * 60));

    const make = Math.random() > 0.43;
    return {
      result: make ? "make" : "miss",
      confidence: 0.82 + Math.random() * 0.17,
      modelVersion: BASELINE_MODEL_VERSION,
      captureQuality: Math.random() > 0.82 ? "low" : Math.random() > 0.45 ? "medium" : "high",
      xNorm: Math.min(1, Math.max(0, 0.1 + Math.random() * 0.8)),
      yNorm: Math.min(1, Math.max(0, 0.08 + Math.random() * 0.85)),
      inferenceLatencyMs: Date.now() - started,
    };
  }
}
