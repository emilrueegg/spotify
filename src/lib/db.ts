import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SqlValue } from "node:sqlite";
import {
  classify,
  DEFAULT_RULES,
  isOverrideBucket,
  isRuleBucket,
  type ClassSource,
  type OverrideBucket,
  type Rule,
  type TagSource,
} from "./classify";
import { trackBucket } from "./filter";
import type { LibraryArtist, LibraryPlaylist, LibraryTrack } from "./library-types";
import type { LibrarySnapshot } from "./snapshot";

export type { LibraryArtist, LibraryPlaylist, LibraryTrack };

export type SessionMode = "spotify" | "demo";

export type SessionRecord = {
  id: string;
  user_id: string;
  mode: SessionMode;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  display_name: string | null;
};

type ArtistRow = {
  id: string;
  name: string;
  tags_json: string | null;
  tag_source: string | null;
  override: string | null;
  bucket: string;
  matched_phrase: string | null;
  class_source: string;
};

const globalForDb = globalThis as unknown as { __reiheDb?: DatabaseSync };

function databasePath(): string {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "library.db");
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__reiheDb) {
    const db = new DatabaseSync(databasePath());
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA busy_timeout = 5000");
    migrate(db);
    globalForDb.__reiheDb = db;
  }
  return globalForDb.__reiheDb;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      display_name TEXT NOT NULL,
      spotify_id TEXT,
      genres_available INTEGER,
      synced_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      display_name TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS artists (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      tags_json TEXT,
      tag_source TEXT,
      override TEXT,
      bucket TEXT NOT NULL,
      matched_phrase TEXT,
      class_source TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE IF NOT EXISTS tracks (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      uri TEXT NOT NULL,
      name TEXT NOT NULL,
      album_name TEXT,
      image_url TEXT,
      liked INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE IF NOT EXISTS track_artists (
      user_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      artist_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (user_id, track_id, artist_id)
    );
    CREATE TABLE IF NOT EXISTS playlists (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      snapshot_id TEXT,
      owner_id TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      user_id TEXT NOT NULL,
      playlist_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (user_id, playlist_id, track_id)
    );
    CREATE TABLE IF NOT EXISTS rules (
      user_id TEXT NOT NULL,
      bucket TEXT NOT NULL,
      phrase TEXT NOT NULL,
      PRIMARY KEY (user_id, bucket, phrase)
    );
    CREATE TABLE IF NOT EXISTS undo_batches (
      session_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

function all<T>(sql: string, ...params: SqlValue[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

function one<T>(sql: string, ...params: SqlValue[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

function run(sql: string, ...params: SqlValue[]) {
  getDb().prepare(sql).run(...params);
}

export function ensureUser(input: {
  id: string;
  mode: SessionMode;
  displayName: string;
  spotifyId?: string | null;
}) {
  run(
    `INSERT INTO users (id, mode, display_name, spotify_id, genres_available, synced_at)
     VALUES (?, ?, ?, ?, NULL, NULL)
     ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, mode = excluded.mode`,
    input.id,
    input.mode,
    input.displayName,
    input.spotifyId ?? null,
  );
  const count = one<{ n: number }>("SELECT COUNT(*) AS n FROM rules WHERE user_id = ?", input.id);
  if (!count || count.n === 0) replaceRules(input.id, DEFAULT_RULES);
}

export function createSession(input: {
  id: string;
  userId: string;
  mode: SessionMode;
  displayName: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
}) {
  run(
    `INSERT INTO sessions (id, user_id, mode, access_token, refresh_token, expires_at, display_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.id,
    input.userId,
    input.mode,
    input.accessToken ?? null,
    input.refreshToken ?? null,
    input.expiresAt ?? null,
    input.displayName,
    Date.now(),
  );
}

export function getSession(id: string): SessionRecord | null {
  const row = one<SessionRecord>("SELECT * FROM sessions WHERE id = ?", id);
  return row ?? null;
}

export function updateSessionTokens(session: SessionRecord) {
  run(
    "UPDATE sessions SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = ?",
    session.access_token,
    session.refresh_token,
    session.expires_at,
    session.id,
  );
}

export function deleteSession(id: string) {
  run("DELETE FROM undo_batches WHERE session_id = ?", id);
  run("DELETE FROM sessions WHERE id = ?", id);
}

export function userMeta(userId: string): {
  displayName: string;
  mode: SessionMode;
  genresAvailable: boolean | null;
  syncedAt: number | null;
} | null {
  const row = one<{
    display_name: string;
    mode: SessionMode;
    genres_available: number | null;
    synced_at: number | null;
  }>("SELECT display_name, mode, genres_available, synced_at FROM users WHERE id = ?", userId);
  if (!row) return null;
  return {
    displayName: row.display_name,
    mode: row.mode,
    genresAvailable: row.genres_available == null ? null : row.genres_available === 1,
    syncedAt: row.synced_at,
  };
}

export function setGenresAvailable(userId: string, value: boolean | null) {
  run(
    "UPDATE users SET genres_available = ? WHERE id = ?",
    value == null ? null : value ? 1 : 0,
    userId,
  );
}

export function touchSynced(userId: string) {
  run("UPDATE users SET synced_at = ? WHERE id = ?", Date.now(), userId);
}

export function artistIdsWithTags(userId: string): Set<string> {
  const rows = all<{ id: string }>(
    "SELECT id FROM artists WHERE user_id = ? AND tags_json IS NOT NULL",
    userId,
  );
  return new Set(rows.map((row) => row.id));
}

export function loadRules(userId: string): Rule[] {
  const rows = all<{ bucket: string; phrase: string }>(
    "SELECT bucket, phrase FROM rules WHERE user_id = ? ORDER BY bucket, phrase",
    userId,
  );
  return rows.flatMap((row) =>
    isRuleBucket(row.bucket) ? [{ bucket: row.bucket, phrase: row.phrase }] : [],
  );
}

export function replaceRules(userId: string, rules: Rule[]) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM rules WHERE user_id = ?").run(userId);
    const insert = db.prepare("INSERT OR IGNORE INTO rules (user_id, bucket, phrase) VALUES (?, ?, ?)");
    for (const rule of rules) {
      const phrase = rule.phrase.trim();
      if (!phrase || !isRuleBucket(rule.bucket)) continue;
      insert.run(userId, rule.bucket, phrase);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  reclassifyUser(userId);
}

export function setArtistOverride(userId: string, artistId: string, override: OverrideBucket | null) {
  const row = one<{ id: string }>("SELECT id FROM artists WHERE user_id = ? AND id = ?", userId, artistId);
  if (!row) return false;
  run("UPDATE artists SET override = ? WHERE user_id = ? AND id = ?", override, userId, artistId);
  reclassifyUser(userId);
  return true;
}

function parseTags(value: string | null): string[] | null {
  if (value == null) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((tag): tag is string => typeof tag === "string");
  } catch {
    return null;
  }
}

function asTagSource(value: string | null | undefined): TagSource | null {
  if (value === "spotify" || value === "lastfm" || value === "demo") return value;
  return null;
}

function asClassSource(value: string): ClassSource {
  if (value === "spotify" || value === "lastfm" || value === "demo" || value === "override" || value === "none") {
    return value;
  }
  return "none";
}

export function reclassifyUser(userId: string) {
  const rules = loadRules(userId);
  const rows = all<ArtistRow>(
    "SELECT id, name, tags_json, tag_source, override, bucket, matched_phrase, class_source FROM artists WHERE user_id = ?",
    userId,
  );
  const update = getDb().prepare(
    "UPDATE artists SET bucket = ?, matched_phrase = ?, class_source = ? WHERE user_id = ? AND id = ?",
  );
  for (const row of rows) {
    const override = row.override && isOverrideBucket(row.override) ? row.override : null;
    const result = classify(
      { tags: parseTags(row.tags_json), override, tagSource: asTagSource(row.tag_source) },
      rules,
    );
    update.run(result.bucket, result.matchedPhrase, result.source, userId, row.id);
  }
}

export function replaceLibrary(userId: string, snapshot: LibrarySnapshot) {
  const db = getDb();
  const rules = loadRules(userId);
  const existing = new Map(
    all<ArtistRow>("SELECT * FROM artists WHERE user_id = ?", userId).map((row) => [row.id, row]),
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM playlist_tracks WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM track_artists WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM tracks WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM playlists WHERE user_id = ?").run(userId);
    db.exec("CREATE TEMP TABLE IF NOT EXISTS seen_artists (id TEXT PRIMARY KEY)");
    db.exec("DELETE FROM seen_artists");

    const upsertArtist = db.prepare(
      `INSERT INTO artists (user_id, id, name, tags_json, tag_source, override, bucket, matched_phrase, class_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, id) DO UPDATE SET
         name = excluded.name,
         tags_json = excluded.tags_json,
         tag_source = excluded.tag_source,
         override = excluded.override,
         bucket = excluded.bucket,
         matched_phrase = excluded.matched_phrase,
         class_source = excluded.class_source`,
    );
    const markSeen = db.prepare("INSERT OR IGNORE INTO seen_artists (id) VALUES (?)");
    for (const artist of snapshot.artists) {
      const previous = existing.get(artist.id);
      const override =
        previous?.override && isOverrideBucket(previous.override) ? previous.override : null;
      const tags = artist.tags !== undefined ? artist.tags : parseTags(previous?.tags_json ?? null);
      const tagSource =
        artist.tagSource !== undefined ? artist.tagSource : asTagSource(previous?.tag_source);
      const result = classify({ tags, override, tagSource }, rules);
      upsertArtist.run(
        userId,
        artist.id,
        artist.name,
        tags == null ? null : JSON.stringify(tags),
        tagSource,
        override,
        result.bucket,
        result.matchedPhrase,
        result.source,
      );
      markSeen.run(artist.id);
    }
    db.prepare(
      "DELETE FROM artists WHERE user_id = ? AND override IS NULL AND id NOT IN (SELECT id FROM seen_artists)",
    ).run(userId);

    const insertTrack = db.prepare(
      `INSERT INTO tracks (user_id, id, uri, name, album_name, image_url, liked, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertCredit = db.prepare(
      "INSERT OR IGNORE INTO track_artists (user_id, track_id, artist_id, position) VALUES (?, ?, ?, ?)",
    );
    for (const track of snapshot.tracks) {
      insertTrack.run(
        userId,
        track.id,
        track.uri,
        track.name,
        track.album,
        track.imageUrl,
        track.liked ? 1 : 0,
        track.durationMs,
      );
      track.artistIds.forEach((artistId, position) => {
        insertCredit.run(userId, track.id, artistId, position);
      });
    }
    const insertPlaylist = db.prepare(
      "INSERT INTO playlists (user_id, id, name, snapshot_id, owner_id) VALUES (?, ?, ?, ?, ?)",
    );
    const insertLink = db.prepare(
      "INSERT OR IGNORE INTO playlist_tracks (user_id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)",
    );
    for (const playlist of snapshot.playlists) {
      insertPlaylist.run(userId, playlist.id, playlist.name, playlist.snapshotId, playlist.ownerId);
      playlist.trackIds.forEach((trackId, position) => {
        insertLink.run(userId, playlist.id, trackId, position);
      });
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function resetDemoUser(userId: string) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of [
      "playlist_tracks",
      "track_artists",
      "tracks",
      "playlists",
      "artists",
      "rules",
    ]) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    }
    db.prepare("DELETE FROM undo_batches WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)").run(
      userId,
    );
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  replaceRules(userId, DEFAULT_RULES);
}

export function loadLibrary(userId: string): {
  tracks: LibraryTrack[];
  playlists: LibraryPlaylist[];
} {
  const artistRows = all<ArtistRow>("SELECT * FROM artists WHERE user_id = ?", userId);
  const artists = new Map<string, LibraryArtist>();
  for (const row of artistRows) {
    const override = row.override && isOverrideBucket(row.override) ? row.override : null;
    artists.set(row.id, {
      id: row.id,
      name: row.name,
      bucket: isBucket(row.bucket) ? row.bucket : "unknown",
      source: asClassSource(row.class_source),
      tags: parseTags(row.tags_json) ?? [],
      matchedPhrase: row.matched_phrase,
      override,
    });
  }
  const credits = all<{ track_id: string; artist_id: string; position: number }>(
    "SELECT track_id, artist_id, position FROM track_artists WHERE user_id = ? ORDER BY position",
    userId,
  );
  const creditsByTrack = new Map<string, { artist: LibraryArtist; position: number }[]>();
  for (const credit of credits) {
    const artist = artists.get(credit.artist_id);
    if (!artist) continue;
    const list = creditsByTrack.get(credit.track_id) ?? [];
    list.push({ artist, position: credit.position });
    creditsByTrack.set(credit.track_id, list);
  }
  const playlistRows = all<{ id: string; name: string; snapshot_id: string | null }>(
    "SELECT id, name, snapshot_id FROM playlists WHERE user_id = ? ORDER BY name COLLATE NOCASE",
    userId,
  );
  const links = all<{ playlist_id: string; track_id: string }>(
    "SELECT playlist_id, track_id FROM playlist_tracks WHERE user_id = ?",
    userId,
  );
  const playlistsByTrack = new Map<string, { id: string; name: string }[]>();
  const counts = new Map<string, number>();
  const playlistName = new Map(playlistRows.map((row) => [row.id, row.name]));
  for (const link of links) {
    const name = playlistName.get(link.playlist_id);
    if (!name) continue;
    const list = playlistsByTrack.get(link.track_id) ?? [];
    list.push({ id: link.playlist_id, name });
    playlistsByTrack.set(link.track_id, list);
    counts.set(link.playlist_id, (counts.get(link.playlist_id) ?? 0) + 1);
  }
  const trackRows = all<{
    id: string;
    uri: string;
    name: string;
    album_name: string | null;
    image_url: string | null;
    liked: number;
    duration_ms: number | null;
  }>("SELECT id, uri, name, album_name, image_url, liked, duration_ms FROM tracks WHERE user_id = ?", userId);

  const tracks: LibraryTrack[] = [];
  for (const row of trackRows) {
    const membership = (playlistsByTrack.get(row.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, "de"),
    );
    const liked = row.liked === 1;
    if (!liked && membership.length === 0) continue;
    const creditList = creditsByTrack.get(row.id) ?? [];
    const trackArtists = creditList.map((credit) => credit.artist);
    tracks.push({
      id: row.id,
      uri: row.uri,
      name: row.name,
      album: row.album_name ?? "",
      imageUrl: row.image_url,
      durationMs: row.duration_ms,
      liked,
      playlistIds: membership.map((playlist) => playlist.id),
      playlistNames: membership.map((playlist) => playlist.name),
      artists: trackArtists,
      artistNames: trackArtists.map((artist) => artist.name),
      bucket: trackBucket(creditList.map((credit) => ({ bucket: credit.artist.bucket, position: credit.position }))),
    });
  }
  tracks.sort((a, b) => {
    const artist = (a.artistNames[0] ?? "").localeCompare(b.artistNames[0] ?? "", "de");
    if (artist !== 0) return artist;
    return a.name.localeCompare(b.name, "de");
  });
  return {
    tracks,
    playlists: playlistRows.map((row) => ({
      id: row.id,
      name: row.name,
      count: counts.get(row.id) ?? 0,
      snapshotId: row.snapshot_id,
    })),
  };
}

function isBucket(value: string): value is LibraryArtist["bucket"] {
  return value === "trap" || value === "modern_rap" || value === "deutschrap" || value === "other" || value === "unknown";
}

export type UndoPayload = {
  liked: { id: string; uri: string }[];
  playlists: { playlistId: string; uris: { id: string; uri: string }[] }[];
};

export function saveUndo(sessionId: string, payload: UndoPayload) {
  run(
    `INSERT INTO undo_batches (session_id, payload_json, created_at) VALUES (?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET payload_json = excluded.payload_json, created_at = excluded.created_at`,
    sessionId,
    JSON.stringify(payload),
    Date.now(),
  );
}

export function readUndo(sessionId: string): UndoPayload | null {
  const row = one<{ payload_json: string }>("SELECT payload_json FROM undo_batches WHERE session_id = ?", sessionId);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.payload_json) as UndoPayload;
    if (!parsed || !Array.isArray(parsed.liked) || !Array.isArray(parsed.playlists)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearUndo(sessionId: string) {
  run("DELETE FROM undo_batches WHERE session_id = ?", sessionId);
}

export function hasUndo(sessionId: string): boolean {
  const row = one<{ session_id: string }>("SELECT session_id FROM undo_batches WHERE session_id = ?", sessionId);
  return Boolean(row);
}

export function tracksByIds(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  return all<{ id: string; uri: string; liked: number; name: string }>(
    `SELECT id, uri, liked, name FROM tracks WHERE user_id = ? AND id IN (${placeholders})`,
    userId,
    ...ids,
  );
}

export function playlistMembership(userId: string, trackIds: string[], playlistIds: string[]) {
  if (trackIds.length === 0 || playlistIds.length === 0) return [];
  const trackSlots = trackIds.map(() => "?").join(", ");
  const playlistSlots = playlistIds.map(() => "?").join(", ");
  return all<{ playlist_id: string; track_id: string; snapshot_id: string | null; uri: string }>(
    `SELECT pt.playlist_id, pt.track_id, p.snapshot_id, t.uri
     FROM playlist_tracks pt
     JOIN playlists p ON p.user_id = pt.user_id AND p.id = pt.playlist_id
     JOIN tracks t ON t.user_id = pt.user_id AND t.id = pt.track_id
     WHERE pt.user_id = ? AND pt.track_id IN (${trackSlots}) AND pt.playlist_id IN (${playlistSlots})`,
    userId,
    ...trackIds,
    ...playlistIds,
  );
}

export function applyLocalRemoval(userId: string, payload: UndoPayload) {
  const db = getDb();
  const unlike = db.prepare("UPDATE tracks SET liked = 0 WHERE user_id = ? AND id = ?");
  const unlink = db.prepare(
    "DELETE FROM playlist_tracks WHERE user_id = ? AND playlist_id = ? AND track_id = ?",
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const track of payload.liked) unlike.run(userId, track.id);
    for (const playlist of payload.playlists) {
      for (const track of playlist.uris) unlink.run(userId, playlist.playlistId, track.id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function applyLocalUndo(userId: string, payload: UndoPayload) {
  const db = getDb();
  const like = db.prepare("UPDATE tracks SET liked = 1 WHERE user_id = ? AND id = ?");
  const link = db.prepare(
    "INSERT OR IGNORE INTO playlist_tracks (user_id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)",
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const track of payload.liked) like.run(userId, track.id);
    for (const playlist of payload.playlists) {
      playlist.uris.forEach((track, index) => {
        link.run(userId, playlist.playlistId, track.id, 100000 + index);
      });
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function setPlaylistSnapshot(userId: string, playlistId: string, snapshotId: string) {
  run("UPDATE playlists SET snapshot_id = ? WHERE user_id = ? AND id = ?", snapshotId, userId, playlistId);
}

export function ownedPlaylist(userId: string, playlistId: string) {
  return one<{ id: string; snapshot_id: string | null }>(
    "SELECT id, snapshot_id FROM playlists WHERE user_id = ? AND id = ?",
    userId,
    playlistId,
  );
}
