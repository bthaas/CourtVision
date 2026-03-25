import { FormEvent, useEffect, useState } from "react";
import { CourtHeatMap } from "./components/HeatMap";
import { useDashboardSession } from "./hooks/useDashboardSession";
import { time } from "./utils/format";

const FG_CIRCUMFERENCE = 2 * Math.PI * 34; // ≈ 213.63

function formLabel(score: number): string {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  return "Needs Work";
}

function formColor(score: number): string {
  if (score >= 90) return "#adc6ff";
  if (score >= 75) return "#ffb690";
  return "#ffb4ab";
}

export function App() {
  const session = useDashboardSession();
  const [elapsed, setElapsed] = useState("00:00");
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinId, setJoinId] = useState("");

  // Live session timer
  useEffect(() => {
    if (!session.connected || !session.sessionStartTime) {
      setElapsed("00:00");
      return;
    }
    const tick = () => {
      const secs = Math.floor((Date.now() - session.sessionStartTime!) / 1000);
      const m = String(Math.floor(secs / 60)).padStart(2, "0");
      const s = String(secs % 60).padStart(2, "0");
      setElapsed(`${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.connected, session.sessionStartTime]);

  function handleJoinExisting(e: FormEvent) {
    e.preventDefault();
    session.setSessionId(joinId);
    session.joinSession(joinId);
  }

  // FG% circular progress
  const fgOffset = FG_CIRCUMFERENCE * (1 - session.fgPct / 100);

  // Last 10 shots oldest-first for streak bars
  const streakBars = [...session.feed].reverse().slice(-10);

  // Last 4 latency readings for mini chart
  const latencyVals = session.feed.slice(0, 4).map((e) => e.inference_latency_ms);
  const maxLatency = Math.max(...latencyVals, 1);

  // ── Start Screen ───────────────────────────────────────────────────────────
  if (!session.connected) {
    return (
      <div className="bg-background text-on-surface min-h-screen flex items-center justify-center p-4">
        <div className="glass w-full max-w-sm rounded-2xl p-10 flex flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-headline font-bold tracking-tighter text-primary uppercase">
            COURTVISION
          </h1>
          <p className="text-sm text-on-surface-variant">Professional Shot Analytics</p>

          <div className="w-full text-left">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
              Athlete Name
            </label>
            <input
              className="w-full bg-surface-container border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/50"
              value={session.athleteName}
              onChange={(e) => session.setAthleteName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <button
            className="w-full bg-primary text-on-primary font-headline font-bold uppercase text-sm tracking-widest px-6 py-3 rounded-lg hover:brightness-110 transition-all"
            onClick={session.createAndJoinSession}
          >
            Start New Session
          </button>

          <button
            className="text-[10px] text-on-surface-variant hover:text-primary transition-colors uppercase tracking-widest font-bold"
            onClick={() => setShowJoinForm((v) => !v)}
          >
            {showJoinForm ? "Cancel" : "Join Existing Session"}
          </button>

          {showJoinForm && (
            <form onSubmit={handleJoinExisting} className="w-full flex flex-col gap-3">
              <input
                className="w-full bg-surface-container border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/50"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Paste session UUID"
              />
              <button
                type="submit"
                disabled={!joinId.trim()}
                className="w-full bg-surface-container-high border border-white/10 text-on-surface font-bold text-sm py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                Join
              </button>
            </form>
          )}

          {session.error && <p className="text-error text-xs">{session.error}</p>}
        </div>
      </div>
    );
  }

  // ── Live Dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="bg-background text-on-surface h-screen overflow-hidden flex flex-col">

      {/* ── Header ── */}
      <header className="flex-none flex justify-between items-center px-6 py-4 bg-[#0f131f]/80 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-blue-900/20 z-50">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-headline font-bold tracking-tighter text-primary uppercase">
            COURTVISION
          </h1>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-primary-fixed-dim"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              account_circle
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant leading-none">
                Athlete
              </span>
              <span className="text-sm font-semibold text-primary">{session.athleteName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-lg border border-white/5">
            <span className="material-symbols-outlined text-secondary text-sm">timer</span>
            <span className="font-headline font-bold text-lg tabular-nums">{elapsed}</span>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-primary shot-pulse" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-primary">LIVE SESSION</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="bg-surface-container-highest hover:bg-white/10 transition-colors p-2 rounded-lg text-on-surface-variant"
              title="Session info"
            >
              <span className="material-symbols-outlined">sensors</span>
            </button>
            <button
              className="bg-error-container hover:brightness-110 transition-all text-on-error-container font-headline font-bold uppercase text-xs tracking-widest px-6 py-2.5 rounded shadow-lg shadow-error/10"
              onClick={session.disconnect}
            >
              Stop Session
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="flex-none w-20 bg-surface-container-low/60 border-r border-white/5 flex flex-col items-center py-8 gap-8">
          <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              sensors
            </span>
          </div>
          <div className="p-3 text-on-surface-variant hover:bg-white/5 rounded-xl transition-colors cursor-pointer">
            <span className="material-symbols-outlined">insights</span>
          </div>
          <div className="p-3 text-on-surface-variant hover:bg-white/5 rounded-xl transition-colors cursor-pointer">
            <span className="material-symbols-outlined">adjust</span>
          </div>
          <div className="p-3 text-on-surface-variant hover:bg-white/5 rounded-xl transition-colors cursor-pointer">
            <span className="material-symbols-outlined">history</span>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-surface-container-lowest relative">
          <div className="absolute inset-0 court-gradient-top pointer-events-none" />

          {/* Top panel: court + stats */}
          <div className="flex flex-1 overflow-hidden p-6 gap-6 min-h-0">

            {/* Left column: Court heatmap (60%) */}
            <section className="flex-[0.6] flex flex-col gap-4 min-h-0">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                    Shot Distribution
                  </h2>
                  <span className="text-xs text-outline">Real-time Heatmap Analysis</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] px-2 py-0.5 border border-white/10 rounded-sm bg-surface-container text-on-surface-variant">
                    FULL SESSION
                  </span>
                  <span className="text-[10px] px-2 py-0.5 border border-primary/20 rounded-sm bg-primary/10 text-primary">
                    {session.attempts} SHOTS
                  </span>
                </div>
              </div>
              <div className="relative flex-1 bg-surface-container-low rounded-xl border border-white/5 overflow-hidden flex items-center justify-center p-8">
                <CourtHeatMap zones={session.zones} />
              </div>
            </section>

            {/* Right column: Stats stack (40%) */}
            <section className="flex-[0.4] flex flex-col gap-4 overflow-y-auto pr-1 min-h-0">

              {/* FG% Card */}
              <div className="glass p-5 rounded-xl flex items-center justify-between flex-none">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                    Field Goal %
                  </span>
                  <div className="text-4xl font-headline font-bold text-on-surface">
                    {session.fgPct.toFixed(1)}
                    <span className="text-lg font-normal opacity-50">%</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-[10px] text-secondary font-bold">
                      {session.makes}M · {session.misses}X · {session.attempts} total
                    </span>
                  </div>
                </div>
                <div className="relative w-20 h-20 flex-none">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="transparent" stroke="currentColor" strokeWidth="6" className="text-white/5" />
                    <circle
                      cx="40" cy="40" r="34" fill="transparent"
                      stroke="currentColor" strokeWidth="6"
                      strokeDasharray={FG_CIRCUMFERENCE}
                      strokeDashoffset={fgOffset}
                      className="text-secondary"
                      style={{ transition: "stroke-dashoffset 0.6s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-headline font-bold">{session.makes}/{session.attempts}</span>
                  </div>
                </div>
              </div>

              {/* Streak Card */}
              <div className="glass p-5 rounded-xl flex-none">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-3">
                  Streak Analysis
                </span>
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-xs text-outline mb-1 block">Current</span>
                    <div className="text-3xl font-headline font-bold text-secondary">
                      {session.currentStreak} {session.currentStreak === 1 ? "MAKE" : "MAKES"}
                    </div>
                  </div>
                  <div className="h-10 w-px bg-white/10 mx-4" />
                  <div className="text-right">
                    <span className="text-xs text-outline mb-1 block">Best Today</span>
                    <div className="text-3xl font-headline font-bold text-on-surface">{session.bestStreak}</div>
                  </div>
                </div>
                <div className="mt-4 flex gap-1">
                  {Array.from({ length: 10 }, (_, i) => {
                    const shot = streakBars[i];
                    const cls = shot
                      ? shot.result === "make"
                        ? "bg-secondary"
                        : "bg-error/50"
                      : "bg-white/5";
                    return <div key={i} className={`h-1.5 flex-1 rounded-full ${cls}`} />;
                  })}
                </div>
              </div>

              {/* Form Score Card */}
              <div className="glass p-5 rounded-xl flex-none">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Avg Form Score
                  </span>
                  <span className="material-symbols-outlined text-primary text-lg">fitness_center</span>
                </div>
                <div className="flex items-center gap-6">
                  <div
                    className="text-5xl font-headline font-bold"
                    style={{ color: session.avgFormScore > 0 ? formColor(session.avgFormScore) : "#424754" }}
                  >
                    {session.avgFormScore > 0 ? Math.round(session.avgFormScore) : "--"}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-tighter">
                      <span className="text-on-surface-variant">Mechanics</span>
                      <span className="text-primary">
                        {session.avgFormScore > 0 ? formLabel(session.avgFormScore) : "N/A"}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(100, session.avgFormScore)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Latency Card */}
              <div className="glass p-4 rounded-xl flex items-center gap-4 flex-none">
                <div className="p-2 bg-white/5 rounded-lg">
                  <span className="material-symbols-outlined text-outline text-xl">bolt</span>
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold uppercase text-on-surface-variant block">
                    AI Inference Latency
                  </span>
                  <div className="text-lg font-headline font-bold text-on-surface">
                    {session.avgLatency > 0 ? session.avgLatency.toFixed(1) : "--"}
                    <span className="text-xs font-normal text-outline ml-1">ms</span>
                  </div>
                </div>
                <div className="flex gap-0.5 items-end h-8">
                  {latencyVals.length === 0
                    ? [3, 5, 4, 6].map((h, i) => (
                        <div key={i} className="w-1.5 bg-primary/20 rounded-full" style={{ height: `${h * 4}px` }} />
                      ))
                    : latencyVals.map((val, i) => (
                        <div
                          key={i}
                          className="w-1.5 bg-primary rounded-full"
                          style={{
                            height: `${Math.max(4, (val / maxLatency) * 28)}px`,
                            opacity: 0.3 + 0.7 * ((i + 1) / latencyVals.length),
                          }}
                        />
                      ))}
                </div>
              </div>

            </section>
          </div>

          {/* ── Bottom live feed strip ── */}
          <footer className="flex-none h-56 bg-surface-container-low border-t border-white/5 flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-surface-container flex-none">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-secondary" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">Live Performance Stream</h3>
              </div>
              <div className="flex gap-4 text-[10px] font-bold text-outline">
                <span>TOTAL: {session.attempts} SHOTS</span>
                <span>SESSION: {session.sessionId ? session.sessionId.slice(0, 8).toUpperCase() : "---"}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface-container-low text-[9px] uppercase tracking-wider text-on-surface-variant font-bold">
                  <tr>
                    <th className="px-6 py-2">Timestamp</th>
                    <th className="px-6 py-2">Zone</th>
                    <th className="px-6 py-2">Outcome</th>
                    <th className="px-6 py-2">Form Score</th>
                    <th className="px-6 py-2">Trajectory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {session.feed.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-6 text-center text-xs text-outline">
                        No shot events yet — waiting for live data...
                      </td>
                    </tr>
                  ) : (
                    session.feed.map((event) => {
                      const isMake = event.result === "make";
                      const formScore = event.form_score ?? 0;
                      return (
                        <tr key={event.timestamp_ms} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-2.5 text-xs font-headline text-outline">
                            {time(event.timestamp_ms)}
                          </td>
                          <td className="px-6 py-2.5 text-xs font-bold uppercase text-on-surface">
                            {event.zone.replace(/_/g, " ")}
                          </td>
                          <td className="px-6 py-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`material-symbols-outlined text-base ${isMake ? "text-secondary" : "text-error"}`}
                                style={{ fontVariationSettings: isMake ? "'FILL' 1" : "'FILL' 0" }}
                              >
                                {isMake ? "check_circle" : "cancel"}
                              </span>
                              <span className={`text-[10px] font-bold uppercase ${isMake ? "text-secondary" : "text-error"}`}>
                                {event.result}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="w-20 h-1.5 bg-surface-container rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${Math.min(100, formScore)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-bold">
                                {formScore > 0 ? Math.round(formScore) : "--"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-2.5 text-[10px] text-outline">
                            {event.release_angle_deg != null
                              ? `${event.release_angle_deg.toFixed(0)}° arc`
                              : `${(event.confidence * 100).toFixed(0)}% conf`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
