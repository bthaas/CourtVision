import { API_BASE_URL } from "./config";
import { SessionSummary } from "../types/analytics";

export async function startSession(athleteId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ athlete_id: athleteId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start session (${response.status})`);
  }

  const payload = (await response.json()) as { session_id: string };
  return payload.session_id;
}

export async function getSummary(sessionId: string): Promise<SessionSummary> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/summary`);
  if (!response.ok) {
    throw new Error(`Failed to fetch summary (${response.status})`);
  }
  return (await response.json()) as SessionSummary;
}
