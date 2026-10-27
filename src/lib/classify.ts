export const BUCKETS = ["trap", "modern_rap", "deutschrap", "other", "unknown"] as const;

export type Bucket = (typeof BUCKETS)[number];
export type RuleBucket = "trap" | "modern_rap" | "deutschrap";
export type OverrideBucket = "trap" | "modern_rap" | "deutschrap" | "other";
export type TagSource = "spotify" | "lastfm" | "demo";
export type ClassSource = TagSource | "override" | "none";

export type Rule = {
  bucket: RuleBucket;
  phrase: string;
};

export const DEFAULT_RULES: Rule[] = [
  { bucket: "trap", phrase: "trap" },
  { bucket: "trap", phrase: "southern hip hop" },
  { bucket: "trap", phrase: "southern hip-hop" },
  { bucket: "trap", phrase: "atl hip hop" },
  { bucket: "trap", phrase: "atlanta hip hop" },
  { bucket: "trap", phrase: "dirty south" },
  { bucket: "trap", phrase: "rage rap" },
  { bucket: "trap", phrase: "pluggnb" },
  { bucket: "trap", phrase: "plugg" },
  { bucket: "trap", phrase: "latin trap" },
  { bucket: "modern_rap", phrase: "drill" },
  { bucket: "modern_rap", phrase: "uk drill" },
  { bucket: "modern_rap", phrase: "nyc drill" },
  { bucket: "modern_rap", phrase: "chicago drill" },
  { bucket: "modern_rap", phrase: "melodic rap" },
  { bucket: "modern_rap", phrase: "emo rap" },
  { bucket: "modern_rap", phrase: "cloud rap" },
  { bucket: "deutschrap", phrase: "deutschrap" },
  { bucket: "deutschrap", phrase: "german hip hop" },
  { bucket: "deutschrap", phrase: "german hip-hop" },
  { bucket: "deutschrap", phrase: "german rap" },
];

const RULE_BUCKETS = new Set<RuleBucket>(["trap", "modern_rap", "deutschrap"]);
const OVERRIDE_BUCKETS = new Set<OverrideBucket>(["trap", "modern_rap", "deutschrap", "other"]);

export function isRuleBucket(value: string): value is RuleBucket {
  return RULE_BUCKETS.has(value as RuleBucket);
}

export function isOverrideBucket(value: string): value is OverrideBucket {
  return OVERRIDE_BUCKETS.has(value as OverrideBucket);
}

export function normalizeGenreText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[-_–—/]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function phraseMatches(tag: string, phrase: string): boolean {
  const hay = normalizeGenreText(tag);
  const needle = normalizeGenreText(phrase);
  if (!hay || !needle) return false;
  const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(needle)}(?:\\s|$)`, "u");
  return pattern.test(hay);
}

export type ClassifyInput = {
  tags?: string[] | null;
  override?: OverrideBucket | null;
  tagSource?: TagSource | null;
};

export type ClassifyResult = {
  bucket: Bucket;
  source: ClassSource;
  matchedPhrase: string | null;
};

export function classify(input: ClassifyInput, rules: Rule[]): ClassifyResult {
  if (input.override && isOverrideBucket(input.override)) {
    return { bucket: input.override, source: "override", matchedPhrase: null };
  }

  const tags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  if (tags.length === 0) {
    return { bucket: "unknown", source: "none", matchedPhrase: null };
  }

  type Hit = { bucket: RuleBucket; phrase: string; length: number };
  const hits: Hit[] = [];
  for (const rule of rules) {
    if (!isRuleBucket(rule.bucket)) continue;
    const phrase = rule.phrase.trim();
    if (!phrase) continue;
    if (!tags.some((tag) => phraseMatches(tag, phrase))) continue;
    hits.push({
      bucket: rule.bucket,
      phrase,
      length: normalizeGenreText(phrase).length,
    });
  }

  if (hits.length === 0) {
    return {
      bucket: "other",
      source: input.tagSource ?? "none",
      matchedPhrase: null,
    };
  }

  const deutschrap = hits.filter((hit) => hit.bucket === "deutschrap");
  const pool = deutschrap.length > 0 ? deutschrap : hits;
  pool.sort((a, b) => b.length - a.length || a.phrase.localeCompare(b.phrase, "de"));
  const best = pool[0];
  return {
    bucket: best.bucket,
    source: input.tagSource ?? "none",
    matchedPhrase: best.phrase,
  };
}
