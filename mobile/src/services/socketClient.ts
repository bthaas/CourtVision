import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./config";
import { ShotInference, SessionStats } from "../types/analytics";

type ShotEventWire = {
  session_id: string;
  timestamp_ms: number;
  x_norm: number;
  y_norm: number;
  result: "make" | "miss";
  confidence: number;
  inference_latency_ms: number;
  release_angle_deg?: number;
  session_stats: {
    attempts: number;
    makes: number;
    misses: number;
    fg_pct: number;
    avg_latency: number;
    current_streak: number;
    best_streak: number;
  };
};

export class CourtVisionSocketClient {
  private socket: Socket;

  constructor() {
    this.socket = io(API_BASE_URL, {
      transports: ["websocket"],
      autoConnect: false,
    });
  }

  connect(sessionId: string): void {
    this.socket.connect();
    this.socket.emit("join_session", { session_id: sessionId });
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  onShotEvent(handler: (shot: ShotInference, stats: SessionStats) => void): () => void {
    const listener = (payload: ShotEventWire) => {
      handler(
        {
          sessionId: payload.session_id,
          timestampMs: payload.timestamp_ms,
          xNorm: payload.x_norm,
          yNorm: payload.y_norm,
          result: payload.result,
          confidence: payload.confidence,
          inferenceLatencyMs: payload.inference_latency_ms,
          releaseAngleDeg: payload.release_angle_deg,
        },
        {
          attempts: payload.session_stats.attempts,
          makes: payload.session_stats.makes,
          misses: payload.session_stats.misses,
          fgPct: payload.session_stats.fg_pct,
          avgLatency: payload.session_stats.avg_latency,
          currentStreak: payload.session_stats.current_streak,
          bestStreak: payload.session_stats.best_streak,
        }
      );
    };

    this.socket.on("shot_event", listener);
    return () => this.socket.off("shot_event", listener);
  }

  sendShot(shot: ShotInference): void {
    this.socket.emit("shot_event", {
      session_id: shot.sessionId,
      timestamp_ms: shot.timestampMs,
      x_norm: shot.xNorm,
      y_norm: shot.yNorm,
      result: shot.result,
      confidence: shot.confidence,
      inference_latency_ms: shot.inferenceLatencyMs,
      release_angle_deg: shot.releaseAngleDeg,
    });
  }
}
