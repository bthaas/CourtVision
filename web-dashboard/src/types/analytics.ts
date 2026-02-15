export type ShotResult = "make" | "miss";

export type ShotWireEvent = {
  session_id: string;
  timestamp_ms: number;
  x_norm: number;
  y_norm: number;
  result: ShotResult;
  confidence: number;
  inference_latency_ms: number;
  release_angle_deg?: number;
  elbow_angle_deg?: number;
  knee_angle_deg?: number;
  torso_tilt_deg?: number;
  form_score?: number;
  zone: ZoneName;
  session_stats: {
    attempts: number;
    makes: number;
    misses: number;
    fg_pct: number;
    avg_latency: number;
    avg_form_score: number;
    current_streak: number;
    best_streak: number;
  };
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
  average_form_score: number;
  current_streak: number;
  best_streak: number;
  zone_breakdown: Record<ZoneName, ZoneStat>;
};
