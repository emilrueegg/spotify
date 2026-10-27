import type { Bucket, ClassSource } from "./classify";
import type { LocationMode } from "./filter";

export const BUCKET_LABEL: Record<Bucket, string> = {
  trap: "Trap",
  modern_rap: "Moderner Rap",
  deutschrap: "Deutschrap",
  other: "Anderes",
  unknown: "Unbekannt",
};

export const SOURCE_LABEL: Record<ClassSource, string> = {
  spotify: "Spotify",
  lastfm: "Last.fm",
  demo: "Beispiel",
  override: "Korrektur",
  none: "—",
};

export const LOCATION_OPTIONS: { id: LocationMode; label: string; hint: string }[] = [
  { id: "intersection", label: "Schnittmenge", hint: "Geliked und in einer eigenen Playlist" },
  { id: "liked", label: "Nur Lieblingssongs", hint: "Auch ohne Playlist" },
  { id: "playlists", label: "Nur eigene Playlists", hint: "Auch ohne Like" },
  { id: "both", label: "Beides", hint: "Like oder eigene Playlist" },
];

export function formatDuration(ms: number | null): string {
  if (ms == null || ms < 0) return "–:––";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatZurich(date: Date): { time: string; day: string } {
  const time = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
  const day = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  return { time, day };
}
