import { ShotResult } from "./analytics";

export type TFLiteInferenceOutput = {
  result: ShotResult;
  confidence: number;
  releaseAngleDeg: number;
  elbowAngleDeg: number;
  kneeAngleDeg: number;
  torsoTiltDeg: number;
  xNorm: number;
  yNorm: number;
  inferenceLatencyMs: number;
};

export type FrameInput = {
  width: number;
  height: number;
  data: Uint8Array;
};

export interface TFLiteShotModel {
  warmup(): Promise<void>;
  infer(frame: FrameInput): Promise<TFLiteInferenceOutput>;
}
