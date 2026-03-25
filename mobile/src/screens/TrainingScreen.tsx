import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CourtHeatMap } from "../components/HeatMap";
import type { SessionStats, ZoneName, ZoneStat } from "../types/analytics";

type Phase = "idle" | "starting" | "running" | "stopped" | "error";

type Props = {
  phase: Phase;
  stats: SessionStats;
  zones: Record<ZoneName, ZoneStat>;
  elapsed: string;
  error: string | null;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
};

const C = {
  bg: "#0a0e1a",
  surfaceLow: "#171b28",
  surface: "#1b1f2c",
  surfaceHigh: "#262a37",
  surfaceHighest: "#313442",
  primary: "#adc6ff",
  secondary: "#ffb690",
  tertiary: "#ffb3ad",
  tertiaryContainer: "#ff5451",
  errorContainer: "#93000a",
  onErrorContainer: "#ffdad6",
  onSurface: "#dfe2f3",
  onSurfaceVariant: "#c2c6d6",
  outline: "#8c909f",
  outlineVariant: "#424754",
  glass: "rgba(27, 31, 44, 0.85)",
  border: "rgba(255, 255, 255, 0.08)",
};

function formLabel(score: number): string {
  if (score >= 90) return "ELITE";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "FAIR";
  return "POOR";
}

export function TrainingScreen({ phase, stats, zones, elapsed, error, canStart, onStart, onStop }: Props) {
  const isLive = phase === "running";

  // ── Idle / Error ────────────────────────────────────────────────────────────
  if (!isLive) {
    return (
      <View style={s.root}>
        <View style={s.header}>
          <Text style={s.headerTitle}>COURT VISION</Text>
          <View style={s.aiChip}>
            <Text style={s.aiChipText}>AI ANALYTICS</Text>
          </View>
        </View>
        <View style={s.idleBody}>
          <Text style={s.idleHero}>Kinetic{"\n"}Precision</Text>
          <Text style={s.idleSub}>Real-time shot analytics powered by pose estimation AI</Text>
          {error ? <Text style={s.errorText}>{error}</Text> : null}
          <TouchableOpacity
            style={[s.startBtn, !canStart && s.btnDisabled]}
            onPress={onStart}
            disabled={!canStart}
            activeOpacity={0.85}
          >
            <Text style={s.startBtnText}>
              {phase === "starting" ? "CONNECTING…" : "START SESSION"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Live Session ────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>COURT VISION</Text>
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveBadgeText}>LIVE</Text>
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Timer */}
        <View style={s.timerSection}>
          <Text style={s.timerLabel}>SESSION DURATION</Text>
          <Text style={s.timerValue}>{elapsed}</Text>
        </View>

        {/* Court heatmap panel */}
        <View style={s.courtPanel}>
          <CourtHeatMap zones={zones} />
          <View style={s.aiPulse}>
            <View style={s.aiPulseDot} />
            <Text style={s.aiPulseText}>LIVE AI PROCESSING</Text>
          </View>
        </View>

        {/* Stats mini-grid */}
        <View style={s.miniGrid}>
          <View style={s.miniCard}>
            <Text style={s.miniLabel}>TOTAL SHOTS</Text>
            <Text style={s.miniValue}>{stats.attempts}</Text>
          </View>
          <View style={s.miniCard}>
            <Text style={s.miniLabel}>STREAK</Text>
            <Text style={[s.miniValue, { color: C.secondary }]}>{stats.currentStreak}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom performance bar */}
      <View style={s.bottomSheet}>
        <View style={s.sheetHandle} />
        <View style={s.sheetRow}>

          {/* FG% ring */}
          <View style={s.fgGroup}>
            <View style={[s.fgRing, { borderColor: C.secondary }]}>
              <Text style={s.fgRingPct}>{Math.round(stats.fgPct)}%</Text>
            </View>
            <View>
              <Text style={s.sheetLabel}>FIELD GOAL</Text>
              <Text style={s.sheetSubValue}>{stats.makes} / {stats.attempts}</Text>
            </View>
          </View>

          <View style={s.sheetDivider} />

          {/* Streak */}
          <View style={s.streakGroup}>
            <Text style={s.sheetLabel}>STREAK</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={[s.streakNum, { color: C.secondary }]}>{stats.currentStreak}</Text>
              <Text style={{ fontSize: 18 }}>🔥</Text>
            </View>
          </View>

          <View style={s.sheetDivider} />

          {/* Form score */}
          <View style={s.formGroup}>
            <Text style={s.sheetLabel}>FORM SCORE</Text>
            <View style={s.formBar}>
              <View style={[s.formFill, { width: `${Math.min(100, stats.avgFormScore)}%` as any }]} />
            </View>
            <Text style={s.formLabel}>
              {stats.avgFormScore > 0
                ? `${formLabel(stats.avgFormScore)} • ${Math.round(stats.avgFormScore)}`
                : "--"}
            </Text>
          </View>
        </View>

        {/* Stop button */}
        <TouchableOpacity style={s.stopBtn} onPress={onStop} activeOpacity={0.85}>
          <Text style={s.stopBtnText}>■  STOP SESSION</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: "rgba(15,19,31,0.9)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: {
    color: C.primary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.5,
    fontStyle: "italic",
  },
  aiChip: {
    backgroundColor: "rgba(173,198,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(173,198,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  aiChipText: { color: C.primary, fontSize: 9, fontWeight: "700", letterSpacing: 2 },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,84,81,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.tertiary },
  liveBadgeText: { color: C.tertiary, fontSize: 9, fontWeight: "700", letterSpacing: 2 },

  idleBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  idleHero: {
    color: C.onSurface,
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1.5,
    textAlign: "center",
    lineHeight: 52,
    marginBottom: 16,
  },
  idleSub: {
    color: C.onSurfaceVariant,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 48,
  },
  errorText: { color: "#ffb4ab", fontSize: 13, textAlign: "center", marginBottom: 16 },

  startBtn: {
    backgroundColor: C.secondary,
    paddingHorizontal: 44,
    paddingVertical: 18,
    borderRadius: 12,
    minWidth: 240,
    alignItems: "center",
  },
  btnDisabled: { backgroundColor: C.outlineVariant },
  startBtnText: { color: "#552100", fontWeight: "900", fontSize: 14, letterSpacing: 2.5 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  timerSection: { alignItems: "center", paddingVertical: 8 },
  timerLabel: {
    color: C.onSurfaceVariant,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3.5,
    marginBottom: 4,
  },
  timerValue: {
    color: C.primary,
    fontSize: 64,
    fontWeight: "700",
    letterSpacing: -2,
    fontVariant: ["tabular-nums"] as any,
  },

  courtPanel: {
    backgroundColor: C.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    overflow: "hidden",
  },
  aiPulse: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12 },
  aiPulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  aiPulseText: { color: C.primary, fontSize: 9, fontWeight: "700", letterSpacing: 2.5 },

  miniGrid: { flexDirection: "row", gap: 12 },
  miniCard: {
    flex: 1,
    backgroundColor: C.glass,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  miniLabel: {
    color: C.onSurfaceVariant,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 6,
  },
  miniValue: { color: C.onSurface, fontSize: 28, fontWeight: "900" },

  bottomSheet: {
    backgroundColor: C.surfaceLow,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 48,
    height: 4,
    backgroundColor: "rgba(66,71,84,0.35)",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },

  fgGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  fgRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  fgRingPct: { color: C.secondary, fontSize: 17, fontWeight: "900" },
  sheetLabel: {
    color: C.onSurfaceVariant,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 3,
  },
  sheetSubValue: { color: C.onSurface, fontSize: 13, fontWeight: "700" },

  sheetDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.05)" },

  streakGroup: { alignItems: "center" },
  streakNum: { fontSize: 28, fontWeight: "900" },

  formGroup: { flex: 1, alignItems: "flex-end" },
  formBar: {
    width: "100%",
    height: 6,
    backgroundColor: C.surfaceHighest,
    borderRadius: 3,
    overflow: "hidden",
    marginVertical: 6,
  },
  formFill: { height: "100%", backgroundColor: C.secondary, borderRadius: 3 },
  formLabel: { color: C.secondary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },

  stopBtn: {
    marginHorizontal: 20,
    backgroundColor: C.errorContainer,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  stopBtnText: { color: C.onErrorContainer, fontWeight: "900", fontSize: 14, letterSpacing: 2.5 },
});
