import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractTrack } from "../src/lib/parse-item.ts";

const track = {
  type: "track",
  id: "abc",
  uri: "spotify:track:abc",
  name: "Mask Off",
  duration_ms: 204000,
  album: { name: "FUTURE", images: [{ url: "https://i.scdn.co/image/small", width: 64 }] },
  artists: [{ id: "art", name: "Future" }],
};

describe("extractTrack", () => {
  it("reads the new playlist item shape and the legacy track shape", () => {
    assert.equal(extractTrack({ item: track })?.name, "Mask Off");
    assert.equal(extractTrack({ track })?.id, "abc");
    assert.equal(extractTrack({ item: null, track })?.name, "Mask Off");
  });

  it("skips nulls, booleans, episodes, and local files", () => {
    assert.equal(extractTrack({ item: null }), null);
    assert.equal(extractTrack({ item: true }), null);
    assert.equal(extractTrack({ item: { ...track, type: "episode" } }), null);
    assert.equal(extractTrack({ is_local: true, item: track }), null);
    assert.equal(extractTrack({ item: { ...track, is_local: true } }), null);
    assert.equal(extractTrack({ item: { ...track, uri: "spotify:local:abc" } }), null);
  });
});
