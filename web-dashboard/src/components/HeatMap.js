import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const zoneOrder = [
    "left_corner_3",
    "left_wing_3",
    "top_key_3",
    "right_wing_3",
    "right_corner_3",
    "left_midrange",
    "center_paint",
    "right_midrange",
];
function intensity(percentage) {
    if (percentage > 65)
        return "#14532d";
    if (percentage > 45)
        return "#4d7c0f";
    if (percentage > 30)
        return "#a16207";
    if (percentage > 15)
        return "#b45309";
    return "#7f1d1d";
}
export function HeatMap({ zones }) {
    return (_jsxs("section", { children: [_jsx("h2", { children: "Court Heat Map" }), _jsx("div", { className: "heatmap-grid", children: zoneOrder.map((zone) => {
                    const stat = zones[zone];
                    return (_jsxs("div", { className: "heatmap-cell", style: { backgroundColor: intensity(stat.percentage) }, children: [_jsx("p", { className: "zone-title", children: zone.replace(/_/g, " ") }), _jsxs("p", { children: [stat.makes, "/", stat.attempts] }), _jsxs("p", { children: [stat.percentage.toFixed(1), "%"] })] }, zone));
                }) })] }));
}
