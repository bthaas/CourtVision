import { StyleSheet, Text, View } from "react-native";
import { ZoneName, ZoneStat } from "../types/analytics";

const zoneOrder: ZoneName[] = [
  "left_corner_3",
  "left_wing_3",
  "top_key_3",
  "right_wing_3",
  "right_corner_3",
  "left_midrange",
  "center_paint",
  "right_midrange",
];

type Props = {
  zones: Record<ZoneName, ZoneStat>;
};

function intensity(percentage: number) {
  if (percentage > 65) return "#166534";
  if (percentage > 45) return "#65a30d";
  if (percentage > 30) return "#ca8a04";
  if (percentage > 15) return "#ea580c";
  return "#991b1b";
}

export function HeatMap({ zones }: Props) {
  return (
    <View>
      <Text style={styles.title}>Court Heat Map</Text>
      <View style={styles.grid}>
        {zoneOrder.map((zone) => {
          const stat = zones[zone];
          return (
            <View key={zone} style={[styles.cell, { backgroundColor: intensity(stat.percentage) }]}>
              <Text style={styles.zone}>{zone.replaceAll("_", " ")}</Text>
              <Text style={styles.meta}>{stat.makes}/{stat.attempts}</Text>
              <Text style={styles.meta}>{stat.percentage.toFixed(1)}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: "#f3f4f6",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cell: {
    width: "48%",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    minHeight: 90,
  },
  zone: {
    color: "#f9fafb",
    fontSize: 11,
    textTransform: "capitalize",
    marginBottom: 6,
  },
  meta: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "600",
  },
});
