export function pct(value) {
    return `${value.toFixed(1)}%`;
}
export function ms(value) {
    return `${value.toFixed(0)} ms`;
}
export function time(ts) {
    return new Date(ts).toLocaleTimeString();
}
