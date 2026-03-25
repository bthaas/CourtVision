import { useEffect, useState } from "react";
import { SafeAreaView, StatusBar } from "react-native";
import { SessionSummaryScreen } from "./src/screens/SessionSummaryScreen";
import { ShotFormScoreModal } from "./src/screens/ShotFormScoreModal";
import { TrainingScreen } from "./src/screens/TrainingScreen";
import { useCourtVisionSession } from "./src/state/useCourtVisionSession";
import type { ShotInference } from "./src/types/analytics";

export default function App() {
  const session = useCourtVisionSession("athlete-demo");
  const [elapsed, setElapsed] = useState("00:00");
  const [modalShot, setModalShot] = useState<ShotInference | null>(null);

  // Session timer
  useEffect(() => {
    if (!session.sessionStartTime) {
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
  }, [session.sessionStartTime]);

  // Show form score modal for each new shot, auto-dismiss after 3s
  useEffect(() => {
    if (!session.lastShot || session.phase !== "running") return;
    setModalShot(session.lastShot);
    const t = setTimeout(() => setModalShot(null), 3000);
    return () => clearTimeout(t);
  }, [session.lastShot]);

  if (session.phase === "stopped") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0a0e1a" }}>
        <StatusBar barStyle="light-content" />
        <SessionSummaryScreen
          stats={session.stats}
          zones={session.zones}
          onNewSession={session.runStart}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0a0e1a" }}>
      <StatusBar barStyle="light-content" />
      <TrainingScreen
        phase={session.phase}
        stats={session.stats}
        zones={session.zones}
        elapsed={elapsed}
        error={session.error}
        canStart={session.canStart}
        onStart={session.runStart}
        onStop={session.runStop}
      />
      <ShotFormScoreModal
        shot={modalShot}
        visible={!!modalShot}
        onDismiss={() => setModalShot(null)}
      />
    </SafeAreaView>
  );
}
