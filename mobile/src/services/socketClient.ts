import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./config";
import { ShotInference, SessionStats, ZoneName, ZoneStat } from "../types/analytics";

type ShotEventWire = {
  session_id: string;
  event_id: string;
  sequence: number;
  timestamp_ms: number;
  client_sent_at_ms?: number;
  x_norm: number;
  y_norm: number;
  zone: ZoneName;
  result: "make" | "miss";
  confidence: number;
  inference_latency_ms: number;
  model_version?: string | null;
  capture_quality?: "high" | "medium" | "low" | "unusable" | null;
  zone_breakdown: Record<ZoneName, ZoneStat>;
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
  private joinedSessionId: string | null = null;
  private publishToken: string | null = null;

  constructor() {
    this.socket = io(API_BASE_URL, {
      transports: ["websocket"],
      autoConnect: false,
    });
  }

  async connect(sessionId: string, token: string): Promise<void> {
    this.joinedSessionId = null;
    this.publishToken = token;

    if (this.socket.connected) {
      this.socket.disconnect();
    }

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        this.socket.disconnect();
        reject(new Error("Timed out joining session."));
      }, 5000);

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.socket.off("session_joined", handleJoined);
        this.socket.off("error", handleError);
        this.socket.off("connect_error", handleConnectError);
      };

      const handleJoined = (payload: { session_id?: string }) => {
        if (payload.session_id !== sessionId) {
          return;
        }

        this.joinedSessionId = sessionId;
        cleanup();
        resolve();
      };

      const handleError = (payload: { message?: string }) => {
        cleanup();
        this.socket.disconnect();
        reject(new Error(payload.message ?? "Unable to join session."));
      };

      const handleConnectError = (error: Error) => {
        cleanup();
        this.socket.disconnect();
        reject(error);
      };

      this.socket.on("session_joined", handleJoined);
      this.socket.on("error", handleError);
      this.socket.on("connect_error", handleConnectError);
      this.socket.connect();
      this.socket.emit("join_session", { session_id: sessionId, token });
    });
  }

  disconnect(): void {
    this.joinedSessionId = null;
    this.publishToken = null;
    this.socket.removeAllListeners("session_joined");
    this.socket.removeAllListeners("error");
    this.socket.removeAllListeners("connect_error");
    this.socket.disconnect();
  }

  onShotEvent(handler: (shot: ShotInference, stats: SessionStats, zones: Record<ZoneName, ZoneStat>) => void): () => void {
    const listener = (payload: ShotEventWire) => {
      handler(
        {
          sessionId: payload.session_id,
          eventId: payload.event_id,
          sequence: payload.sequence,
          timestampMs: payload.timestamp_ms,
          clientSentAtMs: payload.client_sent_at_ms,
          xNorm: payload.x_norm,
          yNorm: payload.y_norm,
          zone: payload.zone,
          result: payload.result,
          confidence: payload.confidence,
          inferenceLatencyMs: payload.inference_latency_ms,
          modelVersion: payload.model_version ?? undefined,
          captureQuality: payload.capture_quality ?? undefined,
        },
        {
          attempts: payload.session_stats.attempts,
          makes: payload.session_stats.makes,
          misses: payload.session_stats.misses,
          fgPct: payload.session_stats.fg_pct,
          avgLatency: payload.session_stats.avg_latency,
          currentStreak: payload.session_stats.current_streak,
          bestStreak: payload.session_stats.best_streak,
        },
        payload.zone_breakdown
      );
    };

    this.socket.on("shot_event", listener);
    return () => this.socket.off("shot_event", listener);
  }

  sendShot(shot: ShotInference): void {
    if (!this.socket.connected || this.joinedSessionId !== shot.sessionId || !this.publishToken) {
      return;
    }

    this.socket.emit("shot_event", {
      session_id: shot.sessionId,
      token: this.publishToken,
      event_id: shot.eventId,
      sequence: shot.sequence,
      timestamp_ms: shot.timestampMs,
      client_sent_at_ms: shot.clientSentAtMs,
      x_norm: shot.xNorm,
      y_norm: shot.yNorm,
      result: shot.result,
      confidence: shot.confidence,
      inference_latency_ms: shot.inferenceLatencyMs,
      model_version: shot.modelVersion,
      capture_quality: shot.captureQuality,
    });
  }
}
