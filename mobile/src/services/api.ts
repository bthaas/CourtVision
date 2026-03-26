import { API_BASE_URL } from "./config";
import {
  AthleteProfile,
  AuthSession,
  SessionListItem,
  SessionSummary,
} from "../types/analytics";

export type SessionCredentials = {
  sessionId: string;
  publishToken: string;
  viewToken: string;
  viewerShareUrl: string;
  athleteId: string;
  athleteDisplayName: string;
  modelVersion?: string | null;
};

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function loginDevUser(displayName: string, email: string): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/api/dev/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName, email }),
  });

  if (!response.ok) {
    throw new Error(`Failed to bootstrap developer auth (${response.status})`);
  }

  const payload = (await response.json()) as {
    user_id: string;
    email: string;
    display_name: string;
    roles: string[];
    access_token: string;
    token_expires_at: string;
  };

  return {
    accessToken: payload.access_token,
    tokenExpiresAt: payload.token_expires_at,
    user: {
      user_id: payload.user_id,
      email: payload.email,
      display_name: payload.display_name,
      roles: payload.roles,
    },
  };
}

export async function listAthletes(accessToken: string): Promise<AthleteProfile[]> {
  const response = await fetch(`${API_BASE_URL}/api/athletes`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    throw new Error(`Failed to load athletes (${response.status})`);
  }
  return (await response.json()) as AthleteProfile[];
}

export async function createAthlete(accessToken: string, displayName: string): Promise<AthleteProfile> {
  const response = await fetch(`${API_BASE_URL}/api/athletes`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ display_name: displayName }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create athlete (${response.status})`);
  }
  return (await response.json()) as AthleteProfile;
}

export async function listSessions(accessToken: string): Promise<SessionListItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    throw new Error(`Failed to load session history (${response.status})`);
  }
  return (await response.json()) as SessionListItem[];
}

export async function startSession(
  accessToken: string,
  athleteId: string,
  deviceInfo: Record<string, string>,
  modelVersion: string
): Promise<SessionCredentials> {
  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      athlete_id: athleteId,
      device_info: deviceInfo,
      model_version: modelVersion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start session (${response.status})`);
  }

  const payload = (await response.json()) as {
    session_id: string;
    athlete_id: string;
    athlete_display_name: string;
    publish_token: string;
    view_token: string;
    viewer_share_url: string;
    model_version?: string | null;
  };
  return {
    sessionId: payload.session_id,
    athleteId: payload.athlete_id,
    athleteDisplayName: payload.athlete_display_name,
    publishToken: payload.publish_token,
    viewToken: payload.view_token,
    viewerShareUrl: payload.viewer_share_url,
    modelVersion: payload.model_version,
  };
}

export async function getSummary(sessionId: string, token: string): Promise<SessionSummary> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch summary (${response.status})`);
  }
  return (await response.json()) as SessionSummary;
}
