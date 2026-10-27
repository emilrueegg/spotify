import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_BUCKETS, filterTracks, passesLocation, trackBucket, type FilterTrack } from "../src/lib/filter.ts";

function track(partial: Partial<FilterTrack> & Pick<FilterTrack, "id" | "bucket">): FilterTrack {
  return {
    name: partial.id,
    liked: partial.liked ?? false,
    playlistIds: partial.playlistIds ?? [],
    playlistNames: partial.playlistNames ?? [],
    artistNames: partial.artistNames ?? [],
    album: partial.album,
    ...partial,
  };
}

describe("track bucket", () => {
  it("hides a track when any artist is deutschrap", () => {
    assert.equal(
      trackBucket([
        { bucket: "trap", position: 0 },
        { bucket: "deutschrap", position: 1 },
      ]),
      "deutschrap",
    );
  });

  it("uses the primary trap or modern rap credit", () => {
    assert.equal(
      trackBucket([
        { bucket: "other", position: 0 },
        { bucket: "trap", position: 1 },
      ]),
      "trap",
    );
    assert.equal(trackBucket([{ bucket: "modern_rap", position: 0 }]), "modern_rap");
    assert.equal(trackBucket([]), "unknown");
  });
});

describe("location and genre filter", () => {
  const rows: FilterTrack[] = [
    track({ id: "trap-both", bucket: "trap", liked: true, playlistIds: ["pl"], playlistNames: ["Nachtzug"], artistNames: ["Future"] }),
    track({ id: "modern-both", bucket: "modern_rap", liked: true, playlistIds: ["pl"], playlistNames: ["Nachtzug"], artistNames: ["Central Cee"] }),
    track({ id: "deutsch-both", bucket: "deutschrap", liked: true, playlistIds: ["kueche"], playlistNames: ["Küche"], artistNames: ["Apache 207"] }),
    track({ id: "other-both", bucket: "other", liked: true, playlistIds: ["alt"], playlistNames: ["Alt & gut"], artistNames: ["Nas"] }),
    track({ id: "unknown-both", bucket: "unknown", liked: true, playlistIds: ["pl"], playlistNames: ["Nachtzug"], artistNames: ["Keller & Sohn"] }),
    track({ id: "trap-liked", bucket: "trap", liked: true, playlistIds: [], artistNames: ["Travis Scott"] }),
    track({ id: "trap-playlist", bucket: "trap", liked: false, playlistIds: ["gym"], playlistNames: ["Gym"], artistNames: ["Gunna"] }),
  ];

  it("defaults to the trap and modern rap intersection", () => {
    const shown = filterTracks(rows, { location: "intersection", buckets: DEFAULT_BUCKETS });
    assert.deepEqual(
      shown.map((row) => row.id),
      ["trap-both", "modern-both"],
    );
  });

  it("keeps deutschrap hidden until the toggle and never preselects other or unknown", () => {
    const withDeutsch = filterTracks(rows, {
      location: "intersection",
      buckets: [...DEFAULT_BUCKETS, "deutschrap"],
    });
    assert.deepEqual(
      withDeutsch.map((row) => row.id),
      ["trap-both", "modern-both", "deutsch-both"],
    );
    assert.equal(DEFAULT_BUCKETS.includes("other"), false);
    assert.equal(DEFAULT_BUCKETS.includes("unknown"), false);
    assert.equal(DEFAULT_BUCKETS.includes("deutschrap"), false);
  });

  it("switches location without changing the genre gate", () => {
    const liked = filterTracks(rows, { location: "liked", buckets: ["trap"] });
    assert.deepEqual(
      liked.map((row) => row.id),
      ["trap-both", "trap-liked"],
    );
    const playlists = filterTracks(rows, { location: "playlists", buckets: ["trap"] });
    assert.deepEqual(
      playlists.map((row) => row.id),
      ["trap-both", "trap-playlist"],
    );
    const both = filterTracks(rows, { location: "both", buckets: ["trap"] });
    assert.equal(both.length, 3);
  });

  it("filters by playlist and search", () => {
    const playlist = filterTracks(rows, {
      location: "both",
      buckets: ["trap", "modern_rap", "deutschrap", "other", "unknown"],
      playlistId: "kueche",
    });
    assert.deepEqual(
      playlist.map((row) => row.id),
      ["deutsch-both"],
    );
    const search = filterTracks(rows, {
      location: "both",
      buckets: ["other"],
      query: "nas",
    });
    assert.deepEqual(
      search.map((row) => row.id),
      ["other-both"],
    );
  });

  it("requires both like and playlist for the intersection", () => {
    assert.equal(passesLocation({ liked: true, playlistIds: ["a"] }, "intersection"), true);
    assert.equal(passesLocation({ liked: true, playlistIds: [] }, "intersection"), false);
    assert.equal(passesLocation({ liked: false, playlistIds: ["a"] }, "intersection"), false);
    assert.equal(
      passesLocation({ liked: true, playlistIds: ["a"] }, "intersection", "missing"),
      false,
    );
  });
});
