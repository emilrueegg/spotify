import type { Bucket } from "./classify";

export type LocationMode = "intersection" | "liked" | "playlists" | "both";

export const DEFAULT_LOCATION: LocationMode = "intersection";
export const DEFAULT_BUCKETS: Bucket[] = ["trap", "modern_rap"];

export type ArtistCredit = {
  bucket: Bucket;
  position: number;
};

export function trackBucket(artists: ArtistCredit[]): Bucket {
  if (artists.some((artist) => artist.bucket === "deutschrap")) return "deutschrap";
  const ordered = [...artists].sort((a, b) => a.position - b.position);
  const primary = ordered[0];
  if (!primary) return "unknown";
  if (primary.bucket === "trap" || primary.bucket === "modern_rap") return primary.bucket;
  if (ordered.some((artist) => artist.bucket === "trap")) return "trap";
  if (ordered.some((artist) => artist.bucket === "modern_rap")) return "modern_rap";
  if (ordered.some((artist) => artist.bucket === "other")) return "other";
  return primary.bucket;
}

export type FilterTrack = {
  id: string;
  name: string;
  album?: string;
  liked: boolean;
  playlistIds: string[];
  playlistNames: string[];
  artistNames: string[];
  bucket: Bucket;
};

export type FilterOptions = {
  location: LocationMode;
  buckets: Bucket[];
  playlistId?: string | null;
  query?: string | null;
};

export function passesLocation(
  track: { liked: boolean; playlistIds: string[] },
  location: LocationMode,
  playlistId?: string | null,
): boolean {
  if (playlistId && !track.playlistIds.includes(playlistId)) return false;
  const inPlaylist = track.playlistIds.length > 0;
  switch (location) {
    case "intersection":
      return track.liked && inPlaylist;
    case "liked":
      return track.liked;
    case "playlists":
      return inPlaylist;
    case "both":
      return track.liked || inPlaylist;
    default:
      return false;
  }
}

export function filterTracks<T extends FilterTrack>(tracks: T[], options: FilterOptions): T[] {
  const query = (options.query ?? "").trim().toLowerCase();
  const enabled = new Set(options.buckets);
  return tracks.filter((track) => {
    if (!passesLocation(track, options.location, options.playlistId)) return false;
    if (!enabled.has(track.bucket)) return false;
    if (!query) return true;
    const hay = [track.name, track.album ?? "", ...track.artistNames, ...track.playlistNames]
      .join("\n")
      .toLowerCase();
    return hay.includes(query);
  });
}
