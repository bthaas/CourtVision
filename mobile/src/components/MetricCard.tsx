import { StyleSheet, Text, View } from "react-native";

type Props = {
  label: string;
  value: string;
};

export function MetricCard({ label, value }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  label: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 6,
  },
  value: {
    color: "#f9fafb",
    fontSize: 21,
    fontWeight: "700",
  },
});
