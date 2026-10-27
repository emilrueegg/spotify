export type ParsedArtist = { id: string; name: string };

export type ParsedTrack = {
  id: string;
  uri: string;
  name: string;
  album: string;
  imageUrl: string | null;
  durationMs: number | null;
  artists: ParsedArtist[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickImage(album: unknown): string | null {
  if (!isRecord(album) || !Array.isArray(album.images)) return null;
  const images = album.images.filter(isRecord).flatMap((image) => {
    if (typeof image.url !== "string" || image.url.length === 0) return [];
    return [{ url: image.url, width: typeof image.width === "number" ? image.width : 0 }];
  });
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => a.width - b.width);
  return (sorted.find((image) => image.width >= 64) ?? sorted[sorted.length - 1]).url;
}

function readArtists(value: unknown): ParsedArtist[] {
  if (!Array.isArray(value)) return [];
  const artists: ParsedArtist[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.id !== "string" || typeof entry.name !== "string") continue;
    artists.push({ id: entry.id, name: entry.name });
  }
  return artists;
}

function mediaOf(entry: Record<string, unknown>): unknown {
  if ("item" in entry) {
    if (typeof entry.item === "boolean") return entry.item;
    if (entry.item != null) return entry.item;
  }
  if ("track" in entry) return entry.track;
  return entry;
}

export function extractTrack(entry: unknown): ParsedTrack | null {
  if (!isRecord(entry)) return null;
  if (entry.is_local === true) return null;
  const media = mediaOf(entry);
  if (media == null || typeof media === "boolean" || !isRecord(media)) return null;
  if (media.is_local === true) return null;
  if (media.type !== "track") return null;
  if (typeof media.id !== "string" || typeof media.uri !== "string" || typeof media.name !== "string") {
    return null;
  }
  if (media.uri.startsWith("spotify:local:")) return null;
  const album = isRecord(media.album) ? media.album : null;
  return {
    id: media.id,
    uri: media.uri,
    name: media.name,
    album: album && typeof album.name === "string" ? album.name : "",
    imageUrl: pickImage(album),
    durationMs: typeof media.duration_ms === "number" ? media.duration_ms : null,
    artists: readArtists(media.artists),
  };
}
