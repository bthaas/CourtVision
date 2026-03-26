export type ShotResult = "make" | "miss";
export type CaptureQuality = "high" | "medium" | "low" | "unusable";

export type ZoneName =
  | "left_corner_3"
  | "left_wing_3"
  | "top_key_3"
  | "right_wing_3"
  | "right_corner_3"
  | "left_midrange"
  | "center_paint"
  | "right_midrange";

export type ShotInference = {
  sessionId: string;
  eventId?: string;
  sequence?: number;
  timestampMs: number;
  clientSentAtMs?: number;
  xNorm: number;
  yNorm: number;
  zone?: ZoneName;
  result: ShotResult;
  confidence: number;
  inferenceLatencyMs: number;
  modelVersion?: string;
  captureQuality?: CaptureQuality;
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

export type ZoneStat = {
  attempts: number;
  makes: number;
  percentage: number;
};

export type SessionSummary = {
  session_id: string;
  athlete_id: string;
  athlete_display_name: string;
  started_at: string;
  attempts: number;
  makes: number;
  misses: number;
  fg_pct: number;
  average_inference_latency_ms: number;
  current_streak: number;
  best_streak: number;
  model_version?: string;
  quality_flags: Record<string, number>;
  zone_breakdown: Record<ZoneName, ZoneStat>;
  shots: Array<{
    session_id: string;
    event_id: string;
    sequence: number;
    timestamp_ms: number;
    client_sent_at_ms?: number | null;
    x_norm: number;
    y_norm: number;
    result: ShotResult;
    confidence: number;
    inference_latency_ms: number;
    model_version?: string | null;
    capture_quality?: CaptureQuality | null;
    zone: ZoneName;
  }>;
};

export type SessionListItem = {
  session_id: string;
  athlete_id: string;
  athlete_display_name: string;
  started_at: string;
  attempts: number;
  makes: number;
  misses: number;
  fg_pct: number;
  model_version?: string | null;
};

export type AthleteProfile = {
  athlete_id: string;
  owner_user_id: string;
  display_name: string;
  created_at: string;
};

export type UserProfile = {
  user_id: string;
  email: string;
  display_name: string;
  roles: string[];
};

export type AuthSession = {
  accessToken: string;
  tokenExpiresAt: string;
  user: UserProfile;
};
