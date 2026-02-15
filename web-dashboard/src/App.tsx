import { FormEvent } from "react";
import { HeatMap } from "./components/HeatMap";
import { MetricCard } from "./components/MetricCard";
import { useDashboardSession } from "./hooks/useDashboardSession";
import { ms, pct, time } from "./utils/format";

export function App() {
  const {
    sessionId,
    connected,
    attempts,
    makes,
    misses,
    fgPct,
    avgLatency,
    avgFormScore,
    currentStreak,
    bestStreak,
    zones,
    feed,
    error,
    setSessionId,
    canJoin,
    createAndJoinSession,
    joinSession,
    disconnect,
  } = useDashboardSession();

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    joinSession();
  }

  return (
    <main className="page">
      <header className="hero">
        <div>
          <h1>CourtVision Live Dashboard</h1>
          <p>WebSocket-powered shooting analytics and court heat mapping</p>
        </div>
        <div className={`status ${connected ? "ok" : "off"}`}>
          {connected ? "Connected" : "Disconnected"}
        </div>
      </header>

      <section className="controls">
        <form onSubmit={handleJoin}>
          <label htmlFor="session">Session ID</label>
          <input
            id="session"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Paste session UUID"
          />
          <div className="button-row">
            <button type="submit" disabled={!canJoin}>Join Session</button>
            <button type="button" className="secondary" onClick={createAndJoinSession}>Create Session</button>
            <button type="button" className="danger" onClick={disconnect}>Disconnect</button>
          </div>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="metrics-grid">
        <MetricCard label="Attempts" value={`${attempts}`} />
        <MetricCard label="FG%" value={pct(fgPct)} />
        <MetricCard label="Make / Miss" value={`${makes} / ${misses}`} />
        <MetricCard label="Avg Inference" value={ms(avgLatency)} />
        <MetricCard label="Form Score" value={pct(avgFormScore)} />
        <MetricCard label="Current Streak" value={`${currentStreak}`} />
        <MetricCard label="Best Streak" value={`${bestStreak}`} />
      </section>

      <section className="content-grid">
        <HeatMap zones={zones} />
        <section>
          <h2>Recent Shot Feed</h2>
          <div className="feed-list">
            {feed.length === 0 ? <p className="feed-empty">No live shot events yet.</p> : null}
            {feed.map((event) => (
              <article key={`${event.timestamp_ms}-${event.result}`} className="feed-item">
                <p>
                  <strong>{event.result.toUpperCase()}</strong> at {time(event.timestamp_ms)}
                </p>
                <p>
                  Conf {(event.confidence * 100).toFixed(1)}% | Latency {event.inference_latency_ms.toFixed(0)}ms | Form {(event.form_score ?? 0).toFixed(1)}%
                </p>
                <p>
                  Zone: {event.zone.replace(/_/g, " ")} | Pose: elbow {(event.elbow_angle_deg ?? 0).toFixed(1)}°, knee {(event.knee_angle_deg ?? 0).toFixed(1)}°, torso {(event.torso_tilt_deg ?? 0).toFixed(1)}°
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
