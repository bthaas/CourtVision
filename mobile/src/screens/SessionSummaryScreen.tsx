import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { SessionStats, ZoneName, ZoneStat } from "../types/analytics";

type Props = {
  stats: SessionStats;
  zones: Record<ZoneName, ZoneStat>;
  onNewSession: () => void;
};

const C = {
  bg: "#0a0e1a",
  surface: "#1b1f2c",
  surfaceHigh: "#262a37",
  surfaceHighest: "#313442",
  primary: "#adc6ff",
  secondary: "#ffb690",
  secondaryFixedDim: "#ffb690",
  onSurface: "#dfe2f3",
  onSurfaceVariant: "#c2c6d6",
  outline: "#8c909f",
  glass: "rgba(27, 31, 44, 0.85)",
  border: "rgba(255, 255, 255, 0.08)",
};

// Decorative sparkline — last-N form scores from session (placeholder progression)
const SPARK_HEIGHTS = [55, 42, 68, 60, 80, 74, 88, 85, 90, 95];

export function SessionSummaryScreen({ stats, onNewSession }: Props) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();

  const sparkMax = Math.max(...SPARK_HEIGHTS);
  const sparkMin = Math.min(...SPARK_HEIGHTS);
  const sparkRange = sparkMax - sparkMin || 1;

  return (
    <ScrollView style={ss.root} contentContainerStyle={ss.content} showsVerticalScrollIndicator={false}>

      {/* Top bar */}
      <View style={ss.topBar}>
        <Text style={ss.logo}>COURT VISION</Text>
      </View>

      {/* Title */}
      <View style={ss.titleSection}>
        <View style={ss.verifiedRow}>
          <View style={ss.verifiedDot} />
          <Text style={ss.verifiedText}>DATA VERIFIED</Text>
        </View>
        <Text style={ss.headline}>SESSION{"\n"}COMPLETE</Text>
        <Text style={ss.dateText}>{today}</Text>
      </View>

      {/* Shot chart (decorative court) */}
      <View style={ss.courtWrap}>
        <View style={ss.courtOutline} />
        <View style={ss.courtKey} />
        {/* Simulated shot dots */}
        {([
          { left: "24%", bottom: "28%" },
          { left: "32%", bottom: "44%" },
          { left: "50%", bottom: "58%" },
          { right: "24%", bottom: "32%" },
          { right: "32%", bottom: "48%" },
          { left: "48%", bottom: "22%" },
        ] as const).map((pos, i) => (
          <View
            key={i}
            style={[
              ss.shotDot,
              {
                left: (pos as any).left,
                right: (pos as any).right,
                bottom: pos.bottom,
                backgroundColor: i % 2 === 0 ? C.secondary : C.primary,
              },
            ]}
          />
        ))}
        <View style={ss.chartBadge}>
          <Text style={ss.chartBadgeText}>Shot Distribution Heatmap</Text>
        </View>
      </View>

      {/* Stats 2×2 grid */}
      <View style={ss.statsGrid}>
        <View style={ss.statCard}>
          <Text style={ss.cardLabel}>Total Shots</Text>
          <View style={ss.cardBottom}>
            <Text style={ss.cardValue}>{stats.attempts}</Text>
            <Text style={ss.cardIcon}>◎</Text>
          </View>
        </View>

        <View style={[ss.statCard, ss.accentCard]}>
          <Text style={ss.cardLabel}>Field Goal %</Text>
          <View style={ss.cardBottom}>
            <Text style={[ss.cardValue, { color: C.secondary }]}>
              {stats.fgPct.toFixed(0)}%
            </Text>
          </View>
        </View>

        <View style={ss.statCard}>
          <Text style={ss.cardLabel}>Best Streak</Text>
          <View style={ss.cardBottom}>
            <Text style={ss.cardValue}>{stats.bestStreak}</Text>
            <Text style={ss.flameLabel}>FLAME</Text>
          </View>
        </View>

        <View style={ss.statCard}>
          <Text style={ss.cardLabel}>Avg Form Score</Text>
          <View style={ss.cardBottom}>
            <Text style={[ss.cardValue, { color: C.primary }]}>
              {stats.avgFormScore > 0 ? Math.round(stats.avgFormScore) : "--"}
            </Text>
            <Text style={ss.outOf}>/ 100</Text>
          </View>
        </View>
      </View>

      {/* Form score trend */}
      <View style={ss.trendCard}>
        <View style={ss.trendHeader}>
          <Text style={ss.cardLabel}>Form Score Trend</Text>
          <View style={ss.consistencyBadge}>
            <Text style={ss.consistencyText}>+4.2% Consistency</Text>
          </View>
        </View>
        <View style={ss.sparkRow}>
          {SPARK_HEIGHTS.map((h, i) => {
            const pct = (h - sparkMin) / sparkRange;
            const barH = 16 + pct * 64;
            const opacity = 0.25 + pct * 0.75;
            const isLast = i === SPARK_HEIGHTS.length - 1;
            return (
              <View
                key={i}
                style={[ss.sparkBar, {
                  height: barH,
                  backgroundColor: isLast ? C.primary : C.primary,
                  opacity: isLast ? 1 : opacity,
                }]}
              />
            );
          })}
        </View>
        <View style={ss.sparkAxisRow}>
          <Text style={ss.sparkAxis}>START</Text>
          <Text style={ss.sparkAxis}>MID</Text>
          <Text style={ss.sparkAxis}>END</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={ss.actions}>
        <TouchableOpacity style={ss.shareBtn} activeOpacity={0.8}>
          <Text style={ss.shareBtnText}>SHARE RESULTS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ss.newBtn} onPress={onNewSession} activeOpacity={0.85}>
          <Text style={ss.newBtnText}>NEW SESSION</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 56 },

  topBar: {
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(15,19,31,0.9)",
  },
  logo: {
    color: C.primary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.5,
    fontStyle: "italic",
  },

  titleSection: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
  verifiedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  verifiedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  verifiedText: {
    color: "rgba(173,198,255,0.65)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3.5,
  },
  headline: {
    color: C.onSurface,
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: -1.5,
    lineHeight: 52,
    marginBottom: 8,
  },
  dateText: {
    color: C.onSurfaceVariant,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.8,
  },

  courtWrap: {
    marginHorizontal: 24,
    height: 200,
    backgroundColor: C.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    marginBottom: 20,
  },
  courtOutline: {
    position: "absolute",
    top: 16,
    left: 28,
    right: 28,
    bottom: 0,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
  },
  courtKey: {
    position: "absolute",
    bottom: 0,
    left: "38%",
    right: "38%",
    height: 72,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  shotDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowRadius: 6,
    shadowOpacity: 0.8,
  },
  chartBadge: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  chartBadgeText: {
    backgroundColor: "rgba(49,52,66,0.85)",
    color: C.onSurfaceVariant,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: "hidden",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: "46%",
    flexGrow: 1,
    backgroundColor: C.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    height: 112,
    justifyContent: "space-between",
  },
  accentCard: {
    borderLeftWidth: 3,
    borderLeftColor: C.secondary,
  },
  cardLabel: {
    color: C.onSurfaceVariant,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  cardBottom: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  cardValue: { color: C.onSurface, fontSize: 38, fontWeight: "900", letterSpacing: -1 },
  cardIcon: { color: C.primary, fontSize: 14 },
  flameLabel: { color: C.secondaryFixedDim, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  outOf: { color: C.outline, fontSize: 14, fontWeight: "700" },

  trendCard: {
    marginHorizontal: 24,
    backgroundColor: C.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    marginBottom: 20,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  consistencyBadge: {
    backgroundColor: "rgba(173,198,255,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  consistencyText: { color: C.primary, fontSize: 10, fontWeight: "600" },
  sparkRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 80,
    gap: 4,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 3,
  },
  sparkAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sparkAxis: { color: C.outline, fontSize: 9, fontWeight: "700", letterSpacing: 1 },

  actions: {
    paddingHorizontal: 24,
    flexDirection: "row",
    gap: 12,
  },
  shareBtn: {
    flex: 1,
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(140,144,159,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtnText: { color: C.onSurface, fontWeight: "900", fontSize: 12, letterSpacing: 2 },
  newBtn: {
    flex: 1.5,
    height: 54,
    borderRadius: 8,
    backgroundColor: C.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  newBtnText: { color: "#552100", fontWeight: "900", fontSize: 12, letterSpacing: 2 },
});
