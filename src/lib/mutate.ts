import { chunk } from "./chunk";
import {
  applyLocalRemoval,
  applyLocalUndo,
  clearUndo,
  playlistMembership,
  readUndo,
  saveUndo,
  setPlaylistSnapshot,
  tracksByIds,
  type SessionRecord,
  type UndoPayload,
} from "./db";
import { SpotifyError, authFromSession, spotifyError, spotifyFetch } from "./spotify";

const LIBRARY_BATCH = 40;
const PLAYLIST_BATCH = 100;

type TrackRef = { id: string; uri: string };

function emptyPayload(): UndoPayload {
  return { liked: [], playlists: [] };
}

function payloadSize(payload: UndoPayload): number {
  return payload.liked.length + payload.playlists.reduce((sum, playlist) => sum + playlist.uris.length, 0);
}

async function deleteLiked(session: SessionRecord, tracks: TrackRef[]) {
  const auth = authFromSession(session);
  for (const batch of chunk(tracks, LIBRARY_BATCH)) {
    const params = new URLSearchParams({ uris: batch.map((track) => track.uri).join(",") });
    const response = await spotifyFetch(auth, `/me/library?${params.toString()}`, { method: "DELETE" });
    if (!response.ok) throw new SpotifyError(await spotifyError(response), response.status);
  }
}

async function saveLiked(session: SessionRecord, tracks: TrackRef[]) {
  const auth = authFromSession(session);
  for (const batch of chunk(tracks, LIBRARY_BATCH)) {
    const params = new URLSearchParams({ uris: batch.map((track) => track.uri).join(",") });
    const response = await spotifyFetch(auth, `/me/library?${params.toString()}`, { method: "PUT" });
    if (!response.ok) throw new SpotifyError(await spotifyError(response), response.status);
  }
}

async function deletePlaylistBatch(
  session: SessionRecord,
  playlistId: string,
  snapshotId: string | null,
  tracks: TrackRef[],
): Promise<string | null> {
  const auth = authFromSession(session);
  const body: { items: { uri: string }[]; snapshot_id?: string } = {
    items: tracks.map((track) => ({ uri: track.uri })),
  };
  if (snapshotId) body.snapshot_id = snapshotId;
  const response = await spotifyFetch(auth, `/playlists/${encodeURIComponent(playlistId)}/items`, {
    method: "DELETE",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new SpotifyError(await spotifyError(response), response.status);
  const json = (await response.json().catch(() => ({}))) as { snapshot_id?: string };
  if (json.snapshot_id) setPlaylistSnapshot(session.user_id, playlistId, json.snapshot_id);
  return json.snapshot_id ?? snapshotId;
}

async function addToPlaylist(session: SessionRecord, playlistId: string, tracks: TrackRef[]) {
  const auth = authFromSession(session);
  for (const batch of chunk(tracks, PLAYLIST_BATCH)) {
    const response = await spotifyFetch(auth, `/playlists/${encodeURIComponent(playlistId)}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: batch.map((track) => track.uri) }),
    });
    if (!response.ok) throw new SpotifyError(await spotifyError(response), response.status);
    const json = (await response.json().catch(() => ({}))) as { snapshot_id?: string };
    if (json.snapshot_id) setPlaylistSnapshot(session.user_id, playlistId, json.snapshot_id);
  }
}

export async function removeTracks(
  session: SessionRecord,
  input: { trackIds: string[]; unlike: boolean; playlistIds: string[] },
): Promise<{ unliked: number; removed: number; partial: boolean; message: string }> {
  const trackIds = [...new Set(input.trackIds)].slice(0, 2000);
  if (trackIds.length === 0) throw new SpotifyError("Keine Titel gewählt.", 400);
  if (!input.unlike && input.playlistIds.length === 0) {
    throw new SpotifyError("Wähle, wo die Titel herausgenommen werden.", 400);
  }
  const known = tracksByIds(session.user_id, trackIds);
  const payload = emptyPayload();
  if (input.unlike) {
    payload.liked = known.filter((track) => track.liked === 1).map((track) => ({ id: track.id, uri: track.uri }));
  }
  if (input.playlistIds.length > 0) {
    const links = playlistMembership(session.user_id, trackIds, [...new Set(input.playlistIds)]);
    const grouped = new Map<string, TrackRef[]>();
    for (const link of links) {
      const list = grouped.get(link.playlist_id) ?? [];
      list.push({ id: link.track_id, uri: link.uri });
      grouped.set(link.playlist_id, list);
    }
    for (const [playlistId, uris] of grouped) {
      payload.playlists.push({ playlistId, uris });
    }
  }
  if (payloadSize(payload) === 0) {
    throw new SpotifyError("Die Auswahl ändert nichts an Lieblingssongs oder den gewählten Playlists.", 400);
  }

  const completed = emptyPayload();
  let partial = false;
  let warning = "";
  try {
    if (session.mode === "spotify" && payload.liked.length > 0) {
      for (const batch of chunk(payload.liked, LIBRARY_BATCH)) {
        await deleteLiked(session, batch);
        completed.liked.push(...batch);
      }
    } else {
      completed.liked = payload.liked;
    }
    for (const playlist of payload.playlists) {
      const done: TrackRef[] = [];
      if (session.mode === "spotify") {
        let snapshot =
          playlistMembership(
            session.user_id,
            playlist.uris.map((track) => track.id),
            [playlist.playlistId],
          )[0]?.snapshot_id ?? null;
        for (const batch of chunk(playlist.uris, PLAYLIST_BATCH)) {
          snapshot = await deletePlaylistBatch(session, playlist.playlistId, snapshot, batch);
          done.push(...batch);
        }
      } else {
        done.push(...playlist.uris);
      }
      if (done.length > 0) completed.playlists.push({ playlistId: playlist.playlistId, uris: done });
    }
  } catch (error) {
    partial = payloadSize(completed) > 0;
    warning = error instanceof Error ? error.message : "Entfernen fehlgeschlagen.";
    if (!partial) throw error instanceof SpotifyError ? error : new SpotifyError(warning, 502);
  }

  applyLocalRemoval(session.user_id, completed);
  saveUndo(session.id, completed);
  const unliked = completed.liked.length;
  const removed = completed.playlists.reduce((sum, playlist) => sum + playlist.uris.length, 0);
  const message = partial
    ? `Nur ein Teil ist draussen. ${warning}`
    : `${unliked} aus Lieblingssongs, ${removed} Playlist-Einträge entfernt.`;
  return { unliked, removed, partial, message };
}

export async function undoTracks(session: SessionRecord): Promise<{ message: string }> {
  const payload = readUndo(session.id);
  if (!payload || payloadSize(payload) === 0) {
    throw new SpotifyError("In dieser Sitzung gibt es nichts rückgängig zu machen.", 400);
  }
  const remaining: UndoPayload = {
    liked: [...payload.liked],
    playlists: payload.playlists.map((playlist) => ({ ...playlist, uris: [...playlist.uris] })),
  };
  const restored = emptyPayload();
  try {
    if (session.mode === "spotify") {
      for (const batch of chunk(remaining.liked, LIBRARY_BATCH)) {
        await saveLiked(session, batch);
        restored.liked.push(...batch);
        remaining.liked.splice(0, batch.length);
      }
      for (const playlist of remaining.playlists) {
        const done: TrackRef[] = [];
        for (const batch of chunk(playlist.uris, PLAYLIST_BATCH)) {
          await addToPlaylist(session, playlist.playlistId, batch);
          done.push(...batch);
          playlist.uris.splice(0, batch.length);
        }
        if (done.length > 0) restored.playlists.push({ playlistId: playlist.playlistId, uris: done });
      }
    } else {
      restored.liked = remaining.liked;
      restored.playlists = remaining.playlists;
      remaining.liked = [];
      remaining.playlists = [];
    }
  } catch (error) {
    if (payloadSize(restored) > 0) {
      applyLocalUndo(session.user_id, restored);
      if (payloadSize(remaining) > 0) saveUndo(session.id, remaining);
      else clearUndo(session.id);
    }
    const message = error instanceof Error ? error.message : "Rückgängig fehlgeschlagen.";
    throw new SpotifyError(`Rückgängig unvollständig. ${message}`, 502);
  }
  applyLocalUndo(session.user_id, restored);
  clearUndo(session.id);
  return { message: "Letzte Aktion ist zurück in der Bibliothek." };
}
