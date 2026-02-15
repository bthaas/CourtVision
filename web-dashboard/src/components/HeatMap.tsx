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

type HeatMapProps = {
  zones: Record<ZoneName, ZoneStat>;
};

function intensity(percentage: number): string {
  if (percentage > 65) return "#14532d";
  if (percentage > 45) return "#4d7c0f";
  if (percentage > 30) return "#a16207";
  if (percentage > 15) return "#b45309";
  return "#7f1d1d";
}

export function HeatMap({ zones }: HeatMapProps) {
  return (
    <section>
      <h2>Court Heat Map</h2>
      <div className="heatmap-grid">
        {zoneOrder.map((zone) => {
          const stat = zones[zone];
          return (
            <div key={zone} className="heatmap-cell" style={{ backgroundColor: intensity(stat.percentage) }}>
              <p className="zone-title">{zone.replace(/_/g, " ")}</p>
              <p>{stat.makes}/{stat.attempts}</p>
              <p>{stat.percentage.toFixed(1)}%</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
