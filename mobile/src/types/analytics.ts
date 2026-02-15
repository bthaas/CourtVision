export type ShotResult = "make" | "miss";

export type ShotInference = {
  sessionId: string;
  timestampMs: number;
  xNorm: number;
  yNorm: number;
  result: ShotResult;
  confidence: number;
  inferenceLatencyMs: number;
  releaseAngleDeg?: number;
};

export type SessionStats = {
  attempts: number;
  makes: number;
  misses: number;
  fgPct: number;
  avgLatency: number;
  currentStreak: number;
  bestStreak: number;
};

export type ZoneName =
  | "left_corner_3"
  | "left_wing_3"
  | "top_key_3"
  | "right_wing_3"
  | "right_corner_3"
  | "left_midrange"
  | "center_paint"
  | "right_midrange";

export type ZoneStat = {
  attempts: number;
  makes: number;
  percentage: number;
};

export type SessionSummary = {
  session_id: string;
  attempts: number;
  makes: number;
  misses: number;
  fg_pct: number;
  average_inference_latency_ms: number;
  current_streak: number;
  best_streak: number;
  zone_breakdown: Record<ZoneName, ZoneStat>;
};
