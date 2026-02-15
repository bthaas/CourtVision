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
      releaseAngleDeg: 44 + Math.random() * 9,
      elbowAngleDeg: 86 + Math.random() * 13,
      kneeAngleDeg: 106 + Math.random() * 18,
      torsoTiltDeg: 7 + Math.random() * 10,
      xNorm: Math.min(1, Math.max(0, 0.1 + Math.random() * 0.8)),
      yNorm: Math.min(1, Math.max(0, 0.08 + Math.random() * 0.85)),
      inferenceLatencyMs: Date.now() - started,
    };
  }
}
