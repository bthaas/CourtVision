import { CaptureQuality, ShotResult } from "./analytics";

export type TFLiteInferenceOutput = {
  result: ShotResult;
  confidence: number;
  modelVersion?: string;
  captureQuality?: CaptureQuality;
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
