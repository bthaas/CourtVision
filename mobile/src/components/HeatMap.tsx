import { StyleSheet, Text, View } from "react-native";
import type { ZoneName, ZoneStat } from "../types/analytics";

type CourtHeatMapProps = {
  zones: Record<ZoneName, ZoneStat>;
};

// Absolute percentage positions within the court container
// Court portrait orientation, hoop at top-center
const ZONE_LAYOUT: Array<{
  key: ZoneName;
  label: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  blobSize: number;
}> = [
  { key: "top_key_3",      label: "Top Key",   top: "8%",    left: "39%",  blobSize: 72 },
  { key: "left_wing_3",    label: "L Wing",    top: "26%",   left: "4%",   blobSize: 60 },
  { key: "right_wing_3",   label: "R Wing",    top: "26%",   right: "4%",  blobSize: 60 },
  { key: "left_midrange",  label: "L Mid",     top: "44%",   left: "14%",  blobSize: 50 },
  { key: "right_midrange", label: "R Mid",     top: "44%",   right: "14%", blobSize: 50 },
  { key: "center_paint",   label: "Paint",     top: "50%",   left: "39%",  blobSize: 72 },
  { key: "left_corner_3",  label: "L Corner",  bottom: "6%", left: "3%",   blobSize: 44 },
  { key: "right_corner_3", label: "R Corner",  bottom: "6%", right: "3%",  blobSize: 44 },
];

function heatBg(pct: number): string {
  if (pct >= 60) return "rgba(147,0,10,0.50)";
  if (pct >= 40) return "rgba(236,106,6,0.42)";
  if (pct >= 20) return "rgba(255,182,144,0.30)";
  if (pct >= 5)  return "rgba(77,142,255,0.22)";
  return "rgba(77,142,255,0.08)";
}

function pctColor(pct: number): string {
  if (pct >= 60) return "#ffb4ab";
  if (pct >= 40) return "#ffb690";
  if (pct >= 20) return "#dfe2f3";
  return "#8c909f";
}

export function CourtHeatMap({ zones }: CourtHeatMapProps) {
  return (
    <View style={s.court}>
      {/* Three-point arc */}
      <View style={s.threePointArc} />
      {/* Key / paint rectangle */}
      <View style={s.keyArea} />
      {/* Backboard */}
      <View style={s.backboard} />
      {/* Hoop */}
      <View style={s.hoop} />

      {/* Zone overlays */}
      {ZONE_LAYOUT.map(({ key, label, top, bottom, left, right, blobSize }) => {
        const stat = zones[key];
        const hasData = stat.attempts > 0;

        const posStyle = {
          position: "absolute" as const,
          ...(top    !== undefined && { top:    top    as any }),
          ...(bottom !== undefined && { bottom: bottom as any }),
          ...(left   !== undefined && { left:   left   as any }),
          ...(right  !== undefined && { right:  right  as any }),
        };

        return (
          <View key={key}>
            {/* Heat blob */}
            <View
              style={[
                posStyle,
                {
                  width: blobSize,
                  height: blobSize,
                  borderRadius: blobSize / 2,
                  backgroundColor: hasData ? heatBg(stat.percentage) : "transparent",
                },
              ]}
            />
            {/* Zone label */}
            <View style={[posStyle, s.labelWrap]}>
              <Text style={s.zoneLabel}>{label}</Text>
              <Text style={[s.zonePct, { color: hasData ? pctColor(stat.percentage) : "#424754" }]}>
                {hasData ? `${stat.percentage.toFixed(0)}%` : "--"}
              </Text>
              {hasData && (
                <Text style={s.zoneMakes}>{stat.makes}/{stat.attempts}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  court: {
    width: "100%",
    aspectRatio: 1.35,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  threePointArc: {
    position: "absolute",
    bottom: 0,
    left: "5%",
    right: "5%",
    height: "86%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderBottomWidth: 0,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  keyArea: {
    position: "absolute",
    bottom: 0,
    left: "34%",
    right: "34%",
    height: "46%",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  backboard: {
    position: "absolute",
    top: "10%",
    left: "46%",
    width: "8%",
    height: 2,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  hoop: {
    position: "absolute",
    top: "13%",
    left: "46.5%",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ffb690",
    backgroundColor: "transparent",
  },
  labelWrap: { alignItems: "center" },
  zoneLabel: {
    color: "rgba(194,198,214,0.55)",
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  zonePct: { fontSize: 13, fontWeight: "900", lineHeight: 15 },
  zoneMakes: { color: "#8c909f", fontSize: 7, fontWeight: "500" },
});
