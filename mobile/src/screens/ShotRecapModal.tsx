import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ShotInference } from "../types/analytics";

type Props = {
  shot: ShotInference | null;
  visible: boolean;
  onDismiss: () => void;
};

const C = {
  bg: "#0a0e1a",
  surfaceLowest: "#0a0e1a",
  surface: "#1b1f2c",
  primary: "#adc6ff",
  secondary: "#ffb690",
  error: "#ffb4ab",
  onSurface: "#dfe2f3",
  onSurfaceVariant: "#c2c6d6",
  outline: "#8c909f",
  glass: "rgba(27, 31, 44, 0.97)",
  border: "rgba(255, 255, 255, 0.08)",
};

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function captureLabel(captureQuality: ShotInference["captureQuality"]): string {
  switch (captureQuality) {
    case "high":
      return "Capture High";
    case "medium":
      return "Capture Medium";
    case "low":
      return "Capture Low";
    case "unusable":
      return "Capture Unusable";
    default:
      return "Capture Pending";
  }
}

function captureTone(captureQuality: ShotInference["captureQuality"]): string {
  switch (captureQuality) {
    case "high":
      return C.secondary;
    case "medium":
      return C.primary;
    case "low":
    case "unusable":
      return C.error;
    default:
      return C.outline;
  }
}

export function ShotRecapModal({ shot, visible, onDismiss }: Props) {
  if (!shot) return null;

  const isMake = shot.result === "make";
  const confidencePct = Math.round(shot.confidence * 100);
  const shotZone = shot.zone ? titleCase(shot.zone) : "Court position tracked";
  const qualityTone = captureTone(shot.captureQuality);
  const lowQuality = shot.captureQuality === "low" || shot.captureQuality === "unusable";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.handle} />

          <View style={m.header}>
            <Text style={m.detected}>SHOT LOGGED</Text>
            <View style={[m.resultBadge, { borderLeftColor: isMake ? C.secondary : C.error }]}>
              <Text style={[m.resultIcon, { color: isMake ? C.secondary : C.error }]}>
                {isMake ? "✓" : "✗"}
              </Text>
              <Text style={[m.resultText, { color: isMake ? C.secondary : C.error }]}>
                {isMake ? "MAKE" : "MISS"}
              </Text>
            </View>
            <View style={m.signalRow}>
              <View style={[m.signalBadge, { borderColor: `${qualityTone}55` }]}>
                <Text style={[m.signalText, { color: qualityTone }]}>
                  {captureLabel(shot.captureQuality)}
                </Text>
              </View>
              <View style={[m.signalBadge, { borderColor: `${C.primary}55` }]}>
                <Text style={[m.signalText, { color: C.primary }]}>{shotZone.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View style={m.heroSection}>
            <View style={m.heroRingOuter}>
              <View style={[m.heroRingInner, { borderColor: isMake ? C.secondary : C.primary }]}>
                <Text style={m.heroValue}>{confidencePct}%</Text>
                <Text style={m.heroLabel}>SHOT CONFIDENCE</Text>
              </View>
            </View>
          </View>

          <View style={m.metrics}>
            <View style={m.metricCard}>
              <Text style={m.metricLabel}>Latency</Text>
              <Text style={m.metricValue}>{Math.round(shot.inferenceLatencyMs)} ms</Text>
              <Text style={m.metricCopy}>Tracker response time</Text>
            </View>
            <View style={m.metricCard}>
              <Text style={m.metricLabel}>Location</Text>
              <Text style={m.metricValue}>{shotZone}</Text>
              <Text style={m.metricCopy}>
                x {shot.xNorm.toFixed(2)} · y {shot.yNorm.toFixed(2)}
              </Text>
            </View>
          </View>

          {lowQuality ? (
            <Text style={m.captureNote}>
              Capture quality was {shot.captureQuality}, so this shot should be treated as lower-confidence tracking data.
            </Text>
          ) : null}

          <TouchableOpacity style={m.nextBtn} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={m.nextBtnText}>NEXT SHOT  →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10,14,26,0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.glass,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  handle: {
    width: 48,
    height: 4,
    backgroundColor: "rgba(66,71,84,0.4)",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 32,
    marginBottom: 24,
    gap: 12,
  },
  detected: {
    color: C.primary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3.5,
  },
  resultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "rgba(255,182,144,0.07)",
  },
  resultIcon: { fontSize: 16, fontWeight: "900" },
  resultText: { fontSize: 14, fontWeight: "900", letterSpacing: 2.5 },
  signalRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  signalBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  signalText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  heroSection: { alignItems: "center", marginBottom: 24 },
  heroRingOuter: {
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: C.surfaceLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  heroRingInner: {
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  heroValue: {
    color: C.onSurface,
    fontSize: 54,
    fontWeight: "900",
    lineHeight: 58,
    letterSpacing: -2,
  },
  heroLabel: {
    color: C.onSurfaceVariant,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: -2,
  },
  metrics: {
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 12,
  },
  metricCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 4,
  },
  metricLabel: {
    color: C.onSurfaceVariant,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  metricValue: {
    color: C.onSurface,
    fontSize: 24,
    fontWeight: "900",
  },
  metricCopy: {
    color: C.outline,
    fontSize: 12,
  },
  captureNote: {
    color: C.error,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  nextBtn: {
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: "center",
  },
  nextBtnText: { color: "#002e6a", fontWeight: "900", fontSize: 14, letterSpacing: 2.5 },
});
