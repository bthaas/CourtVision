import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { HeatMap } from "../components/HeatMap";
import { MetricCard } from "../components/MetricCard";
import { useCourtVisionSession } from "../state/useCourtVisionSession";
import { latency, percent } from "../utils/format";

export function TrainingScreen() {
  const {
    phase,
    error,
    sessionId,
    stats,
    lastShot,
    zones,
    canStart,
    runStart,
    runStop,
  } = useCourtVisionSession("athlete-demo");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>CourtVision</Text>
      <Text style={styles.subtitle}>AI Basketball Shot Analytics</Text>

      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>Session</Text>
        <Text style={styles.bannerValue}>{sessionId ?? "Not started"}</Text>
        <Text style={styles.bannerPhase}>State: {phase}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.metricRow}>
        <MetricCard label="Attempts" value={`${stats.attempts}`} />
        <MetricCard label="FG%" value={percent(stats.fgPct)} />
        <MetricCard label="Make / Miss" value={`${stats.makes} / ${stats.misses}`} />
        <MetricCard label="Avg Inference" value={latency(stats.avgLatency)} />
        <MetricCard label="Current Streak" value={`${stats.currentStreak}`} />
        <MetricCard label="Best Streak" value={`${stats.bestStreak}`} />
      </View>

      <View style={styles.controls}>
        <Pressable
          disabled={!canStart}
          onPress={runStart}
          style={[styles.button, !canStart ? styles.buttonDisabled : styles.buttonStart]}
        >
          <Text style={styles.buttonText}>Start Live Tracking</Text>
        </Pressable>
        <Pressable
          disabled={phase !== "running"}
          onPress={runStop}
          style={[styles.button, phase === "running" ? styles.buttonStop : styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>Stop & Load Summary</Text>
        </Pressable>
      </View>

      <View style={styles.lastShotCard}>
        <Text style={styles.lastShotTitle}>Last Shot</Text>
        {lastShot ? (
          <Text style={styles.lastShotText}>
            {lastShot.result.toUpperCase()} | conf {(lastShot.confidence * 100).toFixed(1)}% | latency {lastShot.inferenceLatencyMs.toFixed(0)}ms
          </Text>
        ) : (
          <Text style={styles.lastShotText}>No shots streamed yet.</Text>
        )}
      </View>

      <HeatMap zones={zones} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 30,
    backgroundColor: "#030712",
  },
  title: {
    color: "#f9fafb",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: "#93c5fd",
    fontSize: 14,
    marginBottom: 14,
  },
  banner: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  bannerLabel: {
    color: "#9ca3af",
    fontSize: 12,
  },
  bannerValue: {
    color: "#f9fafb",
    marginTop: 5,
    fontWeight: "600",
  },
  bannerPhase: {
    color: "#60a5fa",
    marginTop: 4,
  },
  error: {
    color: "#f87171",
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  button: {
    width: "48%",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonStart: {
    backgroundColor: "#15803d",
  },
  buttonStop: {
    backgroundColor: "#b91c1c",
  },
  buttonDisabled: {
    backgroundColor: "#374151",
  },
  buttonText: {
    color: "#f9fafb",
    fontWeight: "700",
    fontSize: 12,
  },
  lastShotCard: {
    backgroundColor: "#111827",
    borderColor: "#1f2937",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  lastShotTitle: {
    color: "#f9fafb",
    fontWeight: "700",
    marginBottom: 6,
  },
  lastShotText: {
    color: "#cbd5e1",
    fontSize: 13,
  },
});
