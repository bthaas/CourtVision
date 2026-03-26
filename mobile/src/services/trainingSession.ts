import { MockTFLiteShotModel } from "./tfliteModel";
import { CourtVisionSocketClient } from "./socketClient";
import { SessionStats, ShotInference, ZoneName, ZoneStat } from "../types/analytics";

export class TrainingSessionController {
  private running = false;
  private readonly model = new MockTFLiteShotModel();
  private readonly socket = new CourtVisionSocketClient();
  private sequence = 0;

  async start(
    sessionId: string,
    publishToken: string,
    modelVersion: string,
    onRuntimeError: (message: string) => void
  ): Promise<void> {
    await this.model.warmup();
    await this.socket.connect(sessionId, publishToken);
    this.running = true;
    this.sequence = 0;
    void this.runInferenceLoop(sessionId, modelVersion, onRuntimeError);
  }

  private async runInferenceLoop(
    sessionId: string,
    modelVersion: string,
    onRuntimeError: (message: string) => void
  ): Promise<void> {
    while (this.running) {
      const loopStartedAt = Date.now();

      try {
        const output = await this.model.infer({
          width: 192,
          height: 192,
          data: new Uint8Array(192 * 192),
        });

        if (!this.running) {
          break;
        }

        this.sequence += 1;
        const shot: ShotInference = {
          sessionId,
          eventId: `${sessionId}-${this.sequence}-${Date.now()}`,
          sequence: this.sequence,
          timestampMs: Date.now(),
          clientSentAtMs: Date.now(),
          result: output.result,
          confidence: output.confidence,
          inferenceLatencyMs: output.inferenceLatencyMs,
          modelVersion: output.modelVersion ?? modelVersion,
          captureQuality: output.captureQuality ?? "medium",
          xNorm: output.xNorm,
          yNorm: output.yNorm,
        };

        this.socket.sendShot(shot);
      } catch {
        onRuntimeError("One inference frame failed, but the session is still running.");
      }

      const waitMs = Math.max(0, 1000 - (Date.now() - loopStartedAt));
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  stop(): void {
    this.running = false;
    this.sequence = 0;
    this.socket.disconnect();
  }

  onShotEvent(
    handler: (shot: ShotInference, stats: SessionStats, zones: Record<ZoneName, ZoneStat>) => void
  ): () => void {
    return this.socket.onShotEvent(handler);
  }
}
