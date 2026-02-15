import { MockTFLiteShotModel } from "./tfliteModel";
import { CourtVisionSocketClient } from "./socketClient";
import { SessionStats, ShotInference } from "../types/analytics";

export class TrainingSessionController {
  private timer?: ReturnType<typeof setInterval>;
  private readonly model = new MockTFLiteShotModel();
  private readonly socket = new CourtVisionSocketClient();

  async start(sessionId: string, onError: (message: string) => void): Promise<void> {
    try {
      await this.model.warmup();
      this.socket.connect(sessionId);
      this.timer = setInterval(async () => {
        try {
          const output = await this.model.infer({
            width: 192,
            height: 192,
            data: new Uint8Array(192 * 192),
          });

          const shot: ShotInference = {
            sessionId,
            timestampMs: Date.now(),
            result: output.result,
            confidence: output.confidence,
            inferenceLatencyMs: output.inferenceLatencyMs,
            releaseAngleDeg: output.releaseAngleDeg,
            elbowAngleDeg: output.elbowAngleDeg,
            kneeAngleDeg: output.kneeAngleDeg,
            torsoTiltDeg: output.torsoTiltDeg,
            xNorm: output.xNorm,
            yNorm: output.yNorm,
          };

          this.socket.sendShot(shot);
        } catch {
          onError("Inference failed for one frame.");
        }
      }, 1000);
    } catch {
      onError("Unable to start training session.");
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.socket.disconnect();
  }

  onShotEvent(handler: (shot: ShotInference, stats: SessionStats) => void): () => void {
    return this.socket.onShotEvent(handler);
  }
}
