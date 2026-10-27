import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classify, DEFAULT_RULES } from "../src/lib/classify.ts";
import { buildDemoSnapshot } from "../src/lib/demo-data.ts";
import { DEFAULT_BUCKETS, filterTracks, trackBucket, type FilterTrack } from "../src/lib/filter.ts";

function classifiedDemo(): FilterTrack[] {
  const snapshot = buildDemoSnapshot();
  const byArtist = new Map(
    snapshot.artists.map((artist) => [
      artist.id,
      classify({ tags: artist.tags, tagSource: artist.tagSource }, DEFAULT_RULES),
    ]),
  );
  const playlistsByTrack = new Map<string, { id: string; name: string }[]>();
  for (const playlist of snapshot.playlists) {
    for (const trackId of playlist.trackIds) {
      const list = playlistsByTrack.get(trackId) ?? [];
      list.push({ id: playlist.id, name: playlist.name });
      playlistsByTrack.set(trackId, list);
    }
  }
  return snapshot.tracks.map((track) => {
    const credits = track.artistIds.map((id, position) => ({
      bucket: byArtist.get(id)?.bucket ?? "unknown",
      position,
    }));
    const playlists = playlistsByTrack.get(track.id) ?? [];
    return {
      id: track.id,
      name: track.name,
      album: track.album,
      liked: track.liked,
      playlistIds: playlists.map((playlist) => playlist.id),
      playlistNames: playlists.map((playlist) => playlist.name),
      artistNames: track.artistIds.map(
        (id) => snapshot.artists.find((artist) => artist.id === id)?.name ?? id,
      ),
      bucket: trackBucket(credits),
    };
  });
}

describe("demo library through the real classifier", () => {
  const rows = classifiedDemo();

  it("shows only the trap and modern rap intersection by default", () => {
    const shown = filterTracks(rows, { location: "intersection", buckets: DEFAULT_BUCKETS }).map(
      (row) => row.id,
    );
    assert.deepEqual(shown.sort(), [
      "trk_band4band",
      "trk_dior",
      "trk_doja",
      "trk_life",
      "trk_maskoff",
      "trk_mobamba",
      "trk_sicko",
      "trk_sky",
      "trk_titi",
      "trk_xo",
    ]);
  });

  it("hides deutschrap until the toggle, including trap tags on a german rap artist", () => {
    assert.equal(rows.find((row) => row.id === "trk_blaeulich")?.bucket, "deutschrap");
    const hidden = filterTracks(rows, { location: "intersection", buckets: DEFAULT_BUCKETS }).some(
      (row) => row.bucket === "deutschrap" || row.bucket === "other" || row.bucket === "unknown",
    );
    assert.equal(hidden, false);
    const opened = filterTracks(rows, {
      location: "intersection",
      buckets: [...DEFAULT_BUCKETS, "deutschrap"],
    }).map((row) => row.id);
    for (const id of ["trk_roller", "trk_primo", "trk_blaeulich"]) {
      assert.equal(opened.includes(id), true);
    }
    assert.equal(opened.includes("trk_beautiful"), false);
    assert.equal(opened.includes("trk_cherry"), false);
  });

  it("keeps liked-only and playlist-only trap out of the intersection", () => {
    const intersection = new Set(
      filterTracks(rows, { location: "intersection", buckets: ["trap"] }).map((row) => row.id),
    );
    assert.equal(intersection.has("trk_fein"), false);
    assert.equal(intersection.has("trk_fukumean"), false);
    const liked = filterTracks(rows, { location: "liked", buckets: ["trap"] }).map((row) => row.id);
    assert.equal(liked.includes("trk_fein"), true);
    assert.equal(liked.includes("trk_fukumean"), false);
    const playlists = filterTracks(rows, { location: "playlists", buckets: ["trap"] }).map(
      (row) => row.id,
    );
    assert.equal(playlists.includes("trk_fukumean"), true);
    assert.equal(playlists.includes("trk_fein"), false);
  });

  it("leaves boom bap and the untagged artist out of the default cut", () => {
    assert.equal(rows.find((row) => row.id === "trk_nystate")?.bucket, "other");
    assert.equal(rows.find((row) => row.id === "trk_godsplan")?.bucket, "other");
    assert.equal(rows.find((row) => row.id === "trk_tape")?.bucket, "unknown");
  });
});
