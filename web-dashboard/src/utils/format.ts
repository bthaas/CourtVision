export function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function ms(value: number): string {
  return `${value.toFixed(0)} ms`;
}

export function time(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}
