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
  surfaceHighest: "#313442",
  primary: "#adc6ff",
  primaryContainer: "#4d8eff",
  secondary: "#ffb690",
  error: "#ffb4ab",
  onSurface: "#dfe2f3",
  onSurfaceVariant: "#c2c6d6",
  outline: "#8c909f",
  outlineVariant: "#424754",
  glass: "rgba(27, 31, 44, 0.97)",
  border: "rgba(255, 255, 255, 0.08)",
};

type AngleBarProps = {
  icon: string;
  label: string;
  value: number;
  targetMin: number;
  targetMax: number;
  rangeMin: number;
  rangeMax: number;
};

function AngleBar({ icon, label, value, targetMin, targetMax, rangeMin, rangeMax }: AngleBarProps) {
  const range = rangeMax - rangeMin;
  const valuePct = Math.min(100, Math.max(0, ((value - rangeMin) / range) * 100));
  const targetMinPct = Math.max(0, ((targetMin - rangeMin) / range) * 100);
  const targetMaxPct = Math.min(100, ((targetMax - rangeMin) / range) * 100);
  const inTarget = value >= targetMin && value <= targetMax;
  const valueColor = inTarget ? C.primary : C.secondary;

  return (
    <View style={ab.row}>
      <View style={ab.topRow}>
        <View style={ab.labelGroup}>
          <Text style={ab.icon}>{icon}</Text>
          <Text style={ab.label}>{label}</Text>
        </View>
        <View style={ab.valueGroup}>
          <Text style={ab.target}>TARGET: {targetMin}°–{targetMax}°</Text>
          <Text style={[ab.value, { color: valueColor }]}>{value.toFixed(0)}°</Text>
        </View>
      </View>
      <View style={ab.track}>
        <View
          style={[
            ab.targetZone,
            { left: `${targetMinPct}%` as any, width: `${targetMaxPct - targetMinPct}%` as any },
          ]}
        />
        <View style={[ab.fill, { width: `${valuePct}%` as any, backgroundColor: valueColor }]} />
      </View>
    </View>
  );
}

const ab = StyleSheet.create({
  row: { marginBottom: 22 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  labelGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { fontSize: 18 },
  label: {
    color: C.onSurfaceVariant,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  valueGroup: { alignItems: "flex-end" },
  target: { color: C.outline, fontSize: 9, marginBottom: 2 },
  value: { fontSize: 20, fontWeight: "900" },
  track: {
    height: 4,
    backgroundColor: C.surfaceLowest,
    borderRadius: 2,
    overflow: "hidden",
  },
  targetZone: {
    position: "absolute",
    top: 0,
    height: "100%",
    backgroundColor: "rgba(66,71,84,0.7)",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    borderRadius: 2,
  },
});

export function ShotFormScoreModal({ shot, visible, onDismiss }: Props) {
  if (!shot) return null;

  const isMake = shot.result === "make";
  const formScore = shot.formScore ?? 0;
  const elbow = shot.elbowAngleDeg ?? 91;
  const knee = shot.kneeAngleDeg ?? 118;
  const torso = shot.torsoTiltDeg ?? 7;

  const ringColor = formScore >= 75 ? C.primary : formScore >= 50 ? C.secondary : C.error;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          {/* Handle */}
          <View style={m.handle} />

          {/* Shot status */}
          <View style={m.header}>
            <Text style={m.detected}>SHOT DETECTED</Text>
            <View style={[m.resultBadge, { borderLeftColor: isMake ? C.secondary : C.error }]}>
              <Text style={[m.resultIcon, { color: isMake ? C.secondary : C.error }]}>
                {isMake ? "✓" : "✗"}
              </Text>
              <Text style={[m.resultText, { color: isMake ? C.secondary : C.error }]}>
                {isMake ? "MAKE" : "MISS"}
              </Text>
            </View>
          </View>

          {/* Form score ring */}
          <View style={m.ringSection}>
            <View style={m.ringOuter}>
              <View style={[m.ringInner, { borderColor: ringColor }]}>
                <Text style={m.scoreNum}>{formScore > 0 ? Math.round(formScore) : "--"}</Text>
                <Text style={m.scoreLabel}>FORM SCORE</Text>
              </View>
            </View>
          </View>

          {/* Angle metrics */}
          <View style={m.metrics}>
            <AngleBar
              icon="📐" label="Elbow Angle"
              value={elbow} targetMin={88} targetMax={92}
              rangeMin={50} rangeMax={150}
            />
            <AngleBar
              icon="🦵" label="Knee Bend"
              value={knee} targetMin={115} targetMax={125}
              rangeMin={80} rangeMax={160}
            />
            <AngleBar
              icon="📏" label="Torso Lean"
              value={torso} targetMin={2} targetMax={5}
              rangeMin={0} rangeMax={20}
            />
          </View>

          {/* Next shot button */}
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

  ringSection: { alignItems: "center", marginBottom: 28 },
  ringOuter: {
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: C.surfaceLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: {
    color: C.onSurface,
    fontSize: 60,
    fontWeight: "900",
    lineHeight: 64,
    letterSpacing: -2,
  },
  scoreLabel: {
    color: C.onSurfaceVariant,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: -4,
  },

  metrics: { paddingHorizontal: 32, marginBottom: 24 },

  nextBtn: {
    marginHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: "center",
  },
  nextBtnText: { color: "#002e6a", fontWeight: "900", fontSize: 14, letterSpacing: 2.5 },
});
