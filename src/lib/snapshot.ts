import type { TagSource } from "./classify";

export type SnapshotArtist = {
  id: string;
  name: string;
  /** Undefined keeps tags already stored for this artist. */
  tags?: string[] | null;
  tagSource?: TagSource | null;
};

export type SnapshotTrack = {
  id: string;
  uri: string;
  name: string;
  album: string;
  imageUrl: string | null;
  durationMs: number | null;
  liked: boolean;
  artistIds: string[];
};

export type SnapshotPlaylist = {
  id: string;
  name: string;
  snapshotId: string | null;
  ownerId: string;
  trackIds: string[];
};

export type LibrarySnapshot = {
  artists: SnapshotArtist[];
  tracks: SnapshotTrack[];
  playlists: SnapshotPlaylist[];
};
