import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function MetricCard({ label, value }) {
    return (_jsxs("article", { className: "metric-card", children: [_jsx("p", { className: "metric-label", children: label }), _jsx("p", { className: "metric-value", children: value })] }));
}
