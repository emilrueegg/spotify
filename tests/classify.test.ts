import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classify, DEFAULT_RULES, phraseMatches, type Rule } from "../src/lib/classify.ts";

const rules = DEFAULT_RULES;

describe("phrase matching", () => {
  it("matches whole words and ignores bare rap and hip hop rules", () => {
    assert.equal(phraseMatches("trap", "trap"), true);
    assert.equal(phraseMatches("trapdoor", "trap"), false);
    assert.equal(phraseMatches("extrapolate", "trap"), false);
    assert.equal(phraseMatches("pluggnb", "plugg"), false);
    assert.equal(phraseMatches("pluggnb", "pluggnb"), true);
    assert.equal(phraseMatches("uk drill", "drill"), true);
    assert.equal(phraseMatches("Southern Hip-Hop", "southern hip hop"), true);
    assert.equal(
      rules.some((rule) => rule.phrase === "rap" || rule.phrase === "hip hop"),
      false,
    );
  });
});

describe("classify", () => {
  it("maps trap, modern rap, and deutschrap keywords", () => {
    assert.equal(classify({ tags: ["atl hip hop"], tagSource: "spotify" }, rules).bucket, "trap");
    assert.equal(classify({ tags: ["uk drill"], tagSource: "lastfm" }, rules).bucket, "modern_rap");
    assert.equal(classify({ tags: ["german hip-hop"], tagSource: "demo" }, rules).bucket, "deutschrap");
  });

  it("lets the longest phrase win inside a bucket", () => {
    const result = classify({ tags: ["uk drill"], tagSource: "lastfm" }, rules);
    assert.equal(result.bucket, "modern_rap");
    assert.equal(result.matchedPhrase, "uk drill");
    const latin = classify({ tags: ["latin trap"], tagSource: "demo" }, rules);
    assert.equal(latin.matchedPhrase, "latin trap");
  });

  it("forces deutschrap even when a longer trap phrase also matches", () => {
    const result = classify(
      { tags: ["southern hip hop", "german hip hop"], tagSource: "demo" },
      rules,
    );
    assert.equal(result.bucket, "deutschrap");
    assert.equal(result.matchedPhrase, "german hip hop");
    const mixed = classify({ tags: ["german rap", "trap"], tagSource: "demo" }, rules);
    assert.equal(mixed.bucket, "deutschrap");
  });

  it("does not treat bare rap or hip hop as a match", () => {
    assert.equal(classify({ tags: ["rap"], tagSource: "spotify" }, rules).bucket, "other");
    assert.equal(classify({ tags: ["hip hop", "boom bap"], tagSource: "lastfm" }, rules).bucket, "other");
    assert.equal(classify({ tags: ["trapdoor"], tagSource: "demo" }, rules).bucket, "other");
  });

  it("distinguishes unknown from other", () => {
    assert.deepEqual(classify({ tags: null, tagSource: null }, rules), {
      bucket: "unknown",
      source: "none",
      matchedPhrase: null,
    });
    assert.equal(classify({ tags: [], tagSource: "lastfm" }, rules).bucket, "unknown");
    const other = classify({ tags: ["jazz rap"], tagSource: "spotify" }, rules);
    assert.equal(other.bucket, "other");
    assert.equal(other.source, "spotify");
  });

  it("lets a user override win", () => {
    const kept = classify(
      { tags: ["trap", "atl hip hop"], tagSource: "spotify", override: "other" },
      rules,
    );
    assert.equal(kept.bucket, "other");
    assert.equal(kept.source, "override");
    assert.equal(kept.matchedPhrase, null);
  });

  it("ignores empty custom rules and still prefers deutschrap", () => {
    const custom: Rule[] = [
      { bucket: "trap", phrase: "   " },
      { bucket: "deutschrap", phrase: "deutschrap" },
      { bucket: "trap", phrase: "cloud rap extra" },
    ];
    const result = classify({ tags: ["deutschrap cloud"], tagSource: "demo" }, custom);
    assert.equal(result.bucket, "deutschrap");
  });
});
