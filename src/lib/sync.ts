import { appConfig } from "./config";
import {
  artistIdsWithTags,
  ensureUser,
  replaceLibrary,
  setGenresAvailable,
  touchSynced,
  type SessionRecord,
} from "./db";
import { extractTrack } from "./parse-item";
import type { LibrarySnapshot, SnapshotArtist, SnapshotTrack } from "./snapshot";
import { SpotifyError, authFromSession, spotifyError, spotifyFetch, type SpotifyAuth } from "./spotify";
import type { TagSource } from "./classify";

export type SyncEvent = { phase: "run" | "done" | "error"; message: string };

type ArtistFetch = { ok: boolean; status: number; hasKey: boolean; genres: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readPage(auth: SpotifyAuth, url: string) {
  const response = await spotifyFetch(auth, url);
  if (!response.ok) {
    const error = new SpotifyError(await spotifyError(response), response.status);
    throw error;
  }
  const body = (await response.json()) as { items?: unknown; next?: unknown; total?: unknown };
  return {
    items: Array.isArray(body.items) ? body.items : [],
    next: typeof body.next === "string" ? body.next : null,
    total: typeof body.total === "number" ? body.total : null,
  };
}

async function eachPage(
  auth: SpotifyAuth,
  url: string,
  label: string,
  send: (event: SyncEvent) => void,
  onItems: (items: unknown[]) => void,
) {
  let next: string | null = url;
  let page = 0;
  let seen = 0;
  while (next) {
    page += 1;
    if (page > 500) throw new SpotifyError("Zu viele Seiten von Spotify.");
    const body = await readPage(auth, next);
    seen += body.items.length;
    const total = body.total != null ? ` · ${seen}/${body.total}` : "";
    send({ phase: "run", message: `${label} · Seite ${page}${total}` });
    onItems(body.items);
    next = body.next;
  }
}

async function fetchArtist(auth: SpotifyAuth, id: string): Promise<ArtistFetch> {
  const response = await spotifyFetch(auth, `/artists/${encodeURIComponent(id)}`);
  if (!response.ok) return { ok: false, status: response.status, hasKey: false, genres: [] };
  const body = (await response.json()) as Record<string, unknown>;
  const hasKey = Object.prototype.hasOwnProperty.call(body, "genres");
  const genres = Array.isArray(body.genres)
    ? body.genres.filter((genre): genre is string => typeof genre === "string" && genre.trim().length > 0)
    : [];
  return { ok: true, status: response.status, hasKey, genres };
}

async function lastfmTags(name: string, apiKey: string): Promise<string[] | null> {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "artist.getTopTags");
  url.searchParams.set("artist", name);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "0");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    toptags?: { tag?: { name?: string; count?: number | string } | { name?: string; count?: number | string }[] };
    error?: number;
  };
  if (json.error) return null;
  const raw = json.toptags?.tag;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list
    .map((tag) => ({ name: tag.name?.trim() ?? "", count: Number(tag.count ?? 0) }))
    .filter((tag) => tag.name.length > 0 && tag.count > 0)
    .slice(0, 15)
    .map((tag) => tag.name);
}

function remember(artists: Map<string, string>, parsedArtists: { id: string; name: string }[]) {
  for (const artist of parsedArtists) artists.set(artist.id, artist.name);
}

function toTrack(parsed: NonNullable<ReturnType<typeof extractTrack>>, liked: boolean): SnapshotTrack {
  return {
    id: parsed.id,
    uri: parsed.uri,
    name: parsed.name,
    album: parsed.album,
    imageUrl: parsed.imageUrl,
    durationMs: parsed.durationMs,
    liked,
    artistIds: parsed.artists.map((artist) => artist.id),
  };
}

export async function syncLibrary(session: SessionRecord, send: (event: SyncEvent) => void) {
  if (session.mode !== "spotify") {
    throw new SpotifyError("Im Beispielmodus gibt es keinen Spotify-Abgleich.", 409);
  }
  const auth = authFromSession(session);
  send({ phase: "run", message: "Profil" });
  const meResponse = await spotifyFetch(auth, "/me");
  if (!meResponse.ok) throw new SpotifyError(await spotifyError(meResponse), meResponse.status);
  const me = (await meResponse.json()) as { id?: string; display_name?: string };
  if (!me.id) throw new SpotifyError("Spotify hat kein Profil geliefert.");
  if (me.id !== session.user_id) {
    throw new SpotifyError("Das Spotify-Profil passt nicht zur Sitzung.", 409);
  }
  ensureUser({
    id: me.id,
    mode: "spotify",
    displayName: me.display_name || me.id,
    spotifyId: me.id,
  });

  const artistNames = new Map<string, string>();
  const tracks = new Map<string, SnapshotTrack>();
  await eachPage(auth, "/me/tracks?limit=50", "Lieblingssongs", send, (items) => {
    for (const item of items) {
      const parsed = extractTrack(item);
      if (!parsed) continue;
      const existing = tracks.get(parsed.id);
      if (existing) existing.liked = true;
      else tracks.set(parsed.id, toTrack(parsed, true));
      remember(artistNames, parsed.artists);
    }
  });

  const owned: { id: string; name: string; snapshotId: string | null }[] = [];
  await eachPage(auth, "/me/playlists?limit=50", "Playlists", send, (items) => {
    for (const item of items) {
      if (!isRecord(item) || !isRecord(item.owner)) continue;
      if (item.owner.id !== me.id) continue;
      if (typeof item.id !== "string" || typeof item.name !== "string") continue;
      owned.push({
        id: item.id,
        name: item.name,
        snapshotId: typeof item.snapshot_id === "string" ? item.snapshot_id : null,
      });
    }
  });

  const skipped: string[] = [];
  const playlists: LibrarySnapshot["playlists"] = [];
  for (const playlist of owned) {
    const trackIds: string[] = [];
    try {
      await eachPage(
        auth,
        `/playlists/${encodeURIComponent(playlist.id)}/items?limit=50`,
        `Playlist ${playlist.name}`,
        send,
        (items) => {
          for (const item of items) {
            const parsed = extractTrack(item);
            if (!parsed) continue;
            if (!trackIds.includes(parsed.id)) trackIds.push(parsed.id);
            if (!tracks.has(parsed.id)) tracks.set(parsed.id, toTrack(parsed, false));
            remember(artistNames, parsed.artists);
          }
        },
      );
    } catch (error) {
      if (error instanceof SpotifyError && (error.status === 403 || error.status === 404)) {
        skipped.push(playlist.name);
        send({ phase: "run", message: `${playlist.name} übersprungen` });
        continue;
      }
      throw error;
    }
    playlists.push({
      id: playlist.id,
      name: playlist.name,
      snapshotId: playlist.snapshotId,
      ownerId: me.id,
      trackIds,
    });
  }

  const artistList = [...artistNames.entries()].map(([id, name]) => ({ id, name }));
  let genresAvailable = false;
  let probe: ArtistFetch | null = null;
  if (artistList.length > 0) {
    send({ phase: "run", message: "Genres prüfen" });
    probe = await fetchArtist(auth, artistList[0].id);
    if (probe.ok) {
      genresAvailable = probe.hasKey;
      setGenresAvailable(me.id, probe.hasKey);
    }
  }

  const config = appConfig();
  const knownTags = artistIdsWithTags(me.id);
  const artists: SnapshotArtist[] = [];
  let lastfmCount = 0;
  for (let index = 0; index < artistList.length; index += 1) {
    const artist = artistList[index];
    let tags: string[] | null | undefined;
    let tagSource: TagSource | null | undefined;
    if (genresAvailable) {
      if (index % 8 === 0) {
        send({ phase: "run", message: `Genres ${index + 1}/${artistList.length}` });
      }
      const fetched = index === 0 && probe ? probe : await fetchArtist(auth, artist.id);
      if (fetched.ok && fetched.genres.length > 0) {
        tags = fetched.genres;
        tagSource = "spotify";
      }
    }
    if (tags === undefined && config.lastfm && !knownTags.has(artist.id)) {
      lastfmCount += 1;
      if (lastfmCount === 1 || lastfmCount % 8 === 0) {
        send({ phase: "run", message: `Last.fm ${lastfmCount}` });
      }
      const remote = await lastfmTags(artist.name, config.lastfmKey);
      if (remote) {
        tags = remote;
        tagSource = "lastfm";
      }
    }
    const incoming: SnapshotArtist = { id: artist.id, name: artist.name };
    if (tags !== undefined) {
      incoming.tags = tags;
      incoming.tagSource = tagSource ?? null;
    }
    artists.push(incoming);
  }

  send({ phase: "run", message: "Einordnen" });
  replaceLibrary(me.id, { artists, tracks: [...tracks.values()], playlists });
  touchSynced(me.id);
  const skipNote = skipped.length > 0 ? ` Übersprungen: ${skipped.join(", ")}.` : "";
  send({
    phase: "done",
    message: `Abgleich fertig · ${tracks.size} Titel · ${playlists.length} Playlists.${skipNote}`,
  });
}
