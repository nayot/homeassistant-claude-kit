export function parseNumericState(state: string | undefined | null): number | null {
  if (state == null || state === "unavailable" || state === "unknown") return null;
  const n = parseFloat(state);
  return Number.isFinite(n) ? n : null;
}

export function formatTemp(state: string | undefined): string | null {
  const n = parseNumericState(state);
  if (n === null) return null;
  return `${n.toFixed(1)}°`;
}

export function toWatts(state: string | undefined, unit?: string): number | null {
  const n = parseNumericState(state);
  if (n === null) return null;
  if (unit === "kW") return n * 1000;
  return n;
}

export function formatPower(watts: number): string {
  if (watts >= 1000) return `${(watts / 1000).toFixed(1)} kW`;
  return `${Math.round(watts)} W`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatHour(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatTimeAgo(d);
}
