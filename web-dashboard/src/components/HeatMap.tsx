import type { CSSProperties } from "react";
import { ZoneName, ZoneStat } from "../types/analytics";

type CourtHeatMapProps = {
  zones: Record<ZoneName, ZoneStat>;
};

type ZoneLayout = {
  label: string;
  blobStyle: CSSProperties;
  textStyle: CSSProperties;
  blobSize: number;
};

const ZONE_LAYOUT: Record<ZoneName, ZoneLayout> = {
  left_corner_3: {
    label: "L Corner",
    blobStyle: { bottom: "6%", left: "0%" },
    textStyle: { bottom: "8%", left: "3%" },
    blobSize: 64,
  },
  left_wing_3: {
    label: "Left Wing",
    blobStyle: { top: "27%", left: "2%" },
    textStyle: { top: "33%", left: "8%" },
    blobSize: 90,
  },
  top_key_3: {
    label: "Top Key",
    blobStyle: { top: "8%", left: "50%", transform: "translateX(-50%)" },
    textStyle: { top: "13%", left: "50%", transform: "translateX(-50%)" },
    blobSize: 120,
  },
  right_wing_3: {
    label: "Right Wing",
    blobStyle: { top: "27%", right: "2%" },
    textStyle: { top: "33%", right: "8%" },
    blobSize: 90,
  },
  right_corner_3: {
    label: "R Corner",
    blobStyle: { bottom: "6%", right: "0%" },
    textStyle: { bottom: "8%", right: "3%" },
    blobSize: 64,
  },
  left_midrange: {
    label: "L Mid",
    blobStyle: { top: "46%", left: "12%" },
    textStyle: { top: "50%", left: "16%" },
    blobSize: 72,
  },
  center_paint: {
    label: "Paint",
    blobStyle: { top: "52%", left: "50%", transform: "translateX(-50%)" },
    textStyle: { top: "57%", left: "50%", transform: "translateX(-50%)" },
    blobSize: 112,
  },
  right_midrange: {
    label: "R Mid",
    blobStyle: { top: "46%", right: "12%" },
    textStyle: { top: "50%", right: "16%" },
    blobSize: 72,
  },
};

function heatBackground(pct: number): string {
  if (pct >= 60) return "rgba(147, 0, 10, 0.45)";
  if (pct >= 40) return "rgba(236, 106, 6, 0.38)";
  if (pct >= 20) return "rgba(255, 182, 144, 0.25)";
  if (pct >= 5) return "rgba(77, 142, 255, 0.20)";
  return "rgba(77, 142, 255, 0.10)";
}

function pctTextColor(pct: number): string {
  if (pct >= 60) return "#ffb4ab";   // error
  if (pct >= 40) return "#ffb690";   // secondary
  if (pct >= 20) return "#dfe2f3";   // on-surface
  return "#8c909f";                   // outline
}

export function CourtHeatMap({ zones }: CourtHeatMapProps) {
  return (
    <div className="relative w-full h-full" style={{ maxWidth: "560px", aspectRatio: "1.2" }}>
      {/* Court boundary */}
      <div className="absolute inset-0 border-2 border-white/10 opacity-80" style={{ borderRadius: "8% 8% 0 0" }} />

      {/* Key (paint box) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 border-2 border-white/10" style={{ width: "33%", height: "50%" }} />

      {/* Three-point arc */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 border-2 border-white/10"
        style={{ width: "90%", height: "90%", borderRadius: "50% 50% 0 0 / 60% 60% 0 0", borderBottom: "none" }}
      />

      {/* Backboard */}
      <div className="absolute left-1/2 -translate-x-1/2 bg-white/20" style={{ top: "11%", width: "48px", height: "2px" }} />

      {/* Hoop */}
      <div
        className="absolute left-1/2 -translate-x-1/2 border-2 border-secondary rounded-full"
        style={{ top: "14%", width: "16px", height: "16px" }}
      />

      {/* Zone overlays */}
      {(Object.entries(ZONE_LAYOUT) as [ZoneName, ZoneLayout][]).map(([zone, layout]) => {
        const stat = zones[zone];
        const hasData = stat.attempts > 0;

        return (
          <div key={zone}>
            {/* Heat blob */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                ...layout.blobStyle,
                width: layout.blobSize,
                height: layout.blobSize,
                background: hasData ? heatBackground(stat.percentage) : "transparent",
                filter: "blur(20px)",
              }}
            />
            {/* Stats label */}
            <div className="absolute text-center pointer-events-none" style={layout.textStyle}>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#c2c6d6", opacity: 0.7 }}>
                {layout.label}
              </div>
              <div
                className="font-headline font-bold leading-tight"
                style={{
                  fontSize: "1.1rem",
                  color: hasData ? pctTextColor(stat.percentage) : "#424754",
                }}
              >
                {hasData ? `${stat.percentage.toFixed(0)}%` : "--"}
              </div>
              {hasData && (
                <div className="text-[8px]" style={{ color: "#8c909f" }}>
                  {stat.makes}/{stat.attempts}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
