import type { Bucket, ClassSource, OverrideBucket } from "./classify";

export type LibraryArtist = {
  id: string;
  name: string;
  bucket: Bucket;
  source: ClassSource;
  tags: string[];
  matchedPhrase: string | null;
  override: OverrideBucket | null;
};

export type LibraryTrack = {
  id: string;
  uri: string;
  name: string;
  album: string;
  imageUrl: string | null;
  durationMs: number | null;
  liked: boolean;
  playlistIds: string[];
  playlistNames: string[];
  artists: LibraryArtist[];
  artistNames: string[];
  bucket: Bucket;
};

export type LibraryPlaylist = {
  id: string;
  name: string;
  count: number;
  snapshotId: string | null;
};

export type SessionResponse = {
  configured: boolean;
  redirectUri: string;
  lastfm: boolean;
  authenticated: boolean;
  demo: boolean;
  displayName: string | null;
  hasUndo: boolean;
  genresAvailable: boolean | null;
  syncedAt: number | null;
};
