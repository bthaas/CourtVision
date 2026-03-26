import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CourtHeatMap } from "../components/HeatMap";
import type { SessionStats, ShotInference, ZoneName, ZoneStat } from "../types/analytics";

type Props = {
  stats: SessionStats;
  shots: ShotInference[];
  zones: Record<ZoneName, ZoneStat>;
  sessionId: string | null;
  viewerShareUrl: string | null;
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

const ZONE_LABELS: Record<ZoneName, string> = {
  left_corner_3: "Left Corner 3",
  left_wing_3: "Left Wing 3",
  top_key_3: "Top Key 3",
  right_wing_3: "Right Wing 3",
  right_corner_3: "Right Corner 3",
  left_midrange: "Left Midrange",
  center_paint: "Paint",
  right_midrange: "Right Midrange",
};

function getHotZone(zones: Record<ZoneName, ZoneStat>): [ZoneName, ZoneStat] | null {
  return (
    Object.entries(zones)
      .filter(([, zone]) => zone.attempts > 0)
      .sort((left, right) => {
        const [, leftZone] = left as [ZoneName, ZoneStat];
        const [, rightZone] = right as [ZoneName, ZoneStat];
        return rightZone.percentage - leftZone.percentage || rightZone.attempts - leftZone.attempts;
      })[0] as [ZoneName, ZoneStat] | undefined
  ) ?? null;
}

function getFgTrendDelta(shots: ShotInference[]): number | null {
  if (shots.length < 4) {
    return null;
  }

  const midpoint = Math.floor(shots.length / 2);
  const opening = shots.slice(0, midpoint);
  const closing = shots.slice(midpoint);

  const fgPct = (values: ShotInference[]) =>
    (values.filter((shot) => shot.result === "make").length / values.length) * 100;

  return fgPct(closing) - fgPct(opening);
}

export function SessionSummaryScreen({ stats, shots, zones, sessionId, viewerShareUrl, onNewSession }: Props) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();

  const hotZone = getHotZone(zones);
  const recentShots = shots.slice(-18);
  const trendShots = shots.slice(-10);
  const sparkMax = Math.max(...trendShots.map((shot) => shot.confidence), 1);
  const sparkMin = Math.min(...trendShots.map((shot) => shot.confidence), 0);
  const sparkRange = sparkMax - sparkMin || 1;
  const trendDelta = getFgTrendDelta(trendShots);
  const lowTrustShots = shots.filter(
    (shot) => shot.captureQuality === "low" || shot.captureQuality === "unusable"
  ).length;
  const averageConfidence =
    shots.length > 0 ? (shots.reduce((sum, shot) => sum + shot.confidence, 0) / shots.length) * 100 : 0;
  const activeZones = Object.values(zones).filter((zone) => zone.attempts > 0).length;
  const modelVersion =
    [...shots].reverse().find((shot) => typeof shot.modelVersion === "string")?.modelVersion ?? "not reported";

  async function handleShare() {
    const hotZoneLine = hotZone
      ? `Hot zone: ${ZONE_LABELS[hotZone[0]]} (${hotZone[1].makes}/${hotZone[1].attempts}, ${hotZone[1].percentage.toFixed(0)}%)`
      : "Hot zone: not enough shot data yet";
    const sessionLine = sessionId ? `Session: ${sessionId.slice(0, 8).toUpperCase()}` : "Session: local summary";

    await Share.share({
      message: [
        "CourtVision Session Summary",
        sessionLine,
        `Shots: ${stats.attempts}`,
        `FG%: ${stats.fgPct.toFixed(1)}%`,
        `Best streak: ${stats.bestStreak}`,
        `Avg confidence: ${averageConfidence > 0 ? `${averageConfidence.toFixed(0)}%` : "n/a"}`,
        hotZoneLine,
        ...(viewerShareUrl ? [`Viewer link: ${viewerShareUrl}`] : []),
      ].join("\n"),
    });
  }

  return (
    <ScrollView style={ss.root} contentContainerStyle={ss.content} showsVerticalScrollIndicator={false}>
      <View style={ss.topBar}>
        <Text style={ss.logo}>COURT VISION</Text>
      </View>

      <View style={ss.titleSection}>
        <View style={ss.verifiedRow}>
          <View style={ss.verifiedDot} />
          <Text style={ss.verifiedText}>DATA VERIFIED</Text>
        </View>
        <Text style={ss.headline}>SESSION{"\n"}COMPLETE</Text>
        <Text style={ss.dateText}>{today}</Text>
      </View>

      <View style={ss.courtWrap}>
        <View style={ss.courtChart}>
          <CourtHeatMap zones={zones} />
          <View pointerEvents="none" style={ss.shotOverlay}>
            {recentShots.map((shot, index) => (
              <View
                key={`${shot.timestampMs}-${index}`}
                style={[
                  ss.shotDot,
                  {
                    left: `${shot.xNorm * 100}%`,
                    bottom: `${shot.yNorm * 100}%`,
                    backgroundColor: shot.result === "make" ? C.secondary : C.primary,
                    opacity: 0.45 + ((index + 1) / Math.max(recentShots.length, 1)) * 0.55,
                  },
                ]}
              />
            ))}
          </View>
        </View>
        <View style={ss.chartFooter}>
          <Text style={ss.chartBadgeText}>
            {hotZone
              ? `HOT ZONE  ${ZONE_LABELS[hotZone[0]].toUpperCase()}`
              : "SHOT DISTRIBUTION HEATMAP"}
          </Text>
          <Text style={ss.chartFootnote}>
            {recentShots.length > 0 ? `${recentShots.length} recent shots plotted` : "Waiting for shot location data"}
          </Text>
        </View>
      </View>

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
          <Text style={ss.cardLabel}>Avg Confidence</Text>
          <View style={ss.cardBottom}>
            <Text style={[ss.cardValue, { color: C.primary }]}>
              {averageConfidence > 0 ? Math.round(averageConfidence) : "--"}
            </Text>
            <Text style={ss.outOf}>%</Text>
          </View>
        </View>
      </View>

      <View style={ss.trendCard}>
        <View style={ss.trendHeader}>
          <Text style={ss.cardLabel}>Shot Trend</Text>
          <View style={ss.consistencyBadge}>
            <Text style={ss.consistencyText}>
              {trendDelta == null
                ? "Trend building"
                : `${trendDelta >= 0 ? "+" : ""}${trendDelta.toFixed(0)}% finish`}
            </Text>
          </View>
        </View>
        {trendShots.length === 0 ? (
          <Text style={ss.emptyTrendText}>
            Shot trend will appear once a few tracked attempts are recorded.
          </Text>
        ) : (
          <>
            <View style={ss.sparkRow}>
              {trendShots.map((shot, i) => {
                const pct = (shot.confidence - sparkMin) / sparkRange;
                const barH = 16 + pct * 64;
                const opacity = 0.25 + pct * 0.75;
                const isLast = i === trendShots.length - 1;
                return (
                  <View
                    key={`${shot.timestampMs}-${i}`}
                    style={[
                      ss.sparkBar,
                      {
                        height: barH,
                        backgroundColor: shot.result === "make" ? C.secondary : C.primary,
                        opacity: isLast ? 1 : opacity,
                      },
                    ]}
                  />
                );
              })}
            </View>
            <View style={ss.sparkAxisRow}>
              <Text style={ss.sparkAxis}>START</Text>
              <Text style={ss.sparkAxis}>MID</Text>
              <Text style={ss.sparkAxis}>END</Text>
            </View>
          </>
        )}
      </View>

      <View style={ss.trustCard}>
        <View style={ss.trustHeader}>
          <Text style={ss.cardLabel}>Session Signals</Text>
          <Text style={ss.trustVersion}>{modelVersion}</Text>
        </View>
        <View style={ss.trustRow}>
          <Text style={ss.trustMetric}>{activeZones}</Text>
          <Text style={ss.trustCopy}>shooting zones recorded with attempts</Text>
        </View>
        <View style={ss.trustRow}>
          <Text style={[ss.trustMetric, { color: lowTrustShots > 0 ? C.secondary : C.primary }]}>
            {lowTrustShots}
          </Text>
          <Text style={ss.trustCopy}>shots flagged low capture quality</Text>
        </View>
      </View>

      <View style={ss.actions}>
        <TouchableOpacity style={ss.shareBtn} activeOpacity={0.8} onPress={handleShare}>
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
    backgroundColor: C.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
    padding: 14,
  },
  courtChart: {
    position: "relative",
    width: "100%",
  },
  shotOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  shotDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowRadius: 6,
    shadowOpacity: 0.8,
    marginLeft: -5,
    marginBottom: -5,
    borderWidth: 1,
    borderColor: "rgba(10,14,26,0.9)",
  },
  chartFooter: {
    marginTop: 14,
    alignItems: "center",
    gap: 6,
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
  chartFootnote: {
    color: C.outline,
    fontSize: 11,
    fontWeight: "600",
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
  trustCard: {
    marginHorizontal: 24,
    backgroundColor: C.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginBottom: 20,
    gap: 12,
  },
  trustHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  trustVersion: {
    color: C.primary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  trustMetric: {
    color: C.onSurface,
    fontSize: 22,
    fontWeight: "900",
  },
  trustCopy: {
    color: C.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
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
  emptyTrendText: {
    color: C.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 20,
  },
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
