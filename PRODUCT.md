# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person, in German, at a desk in Zürich in the evening (Europe/Zurich). They are scanning their own Spotify library for a long stretch and deciding what leaves.

## Product Purpose

Reihe reads that person’s Liked Songs and playlists they own, classifies artists, and removes matching tracks from Liked Songs and/or those playlists only after an explicit confirmation. Success is a reviewed cut with an in-session undo, never a silent delete.

## Positioning

The mechanism is the intersection: a track is liked and also sits in at least one owned playlist, and its artist bucket is trap or modern rap. Deutschrap stays hidden until a separate toggle. Unknown and other are never preselected. Spotify cannot delete catalog tracks; removal is unlike and/or remove-from-owned-playlist.

## Operating Context

Local Next.js app on the person’s machine. Spotify Authorization Code flow, client secret and tokens stay on the server (httpOnly session id, tokens in SQLite). Optional Last.fm tags when Spotify omits `artist.genres`. A demo path seeds a synthetic library into the same database and classifier. No credentials are required to try the review loop.

## Capabilities and Constraints

- Default review set: liked ∩ owned playlist ∩ (trap or modern rap). Location can switch to liked only, owned playlists only, or the union.
- Genre buckets: trap, modern rap, deutschrap, other (tags present, no rule), unknown (no genre data). User override per artist wins.
- Keyword rules are editable, match whole words, longest phrase wins. Any deutschrap match forces deutschrap.
- Bare “rap” and “hip hop” are not rules.
- Followed playlists the user does not own, and collaborative playlists they do not own, are out of scope.
- New Spotify Development Mode apps need Spotify Premium, at most a small user cap, and often omit genres. Audio features and the artist batch endpoint are unavailable. Probe one artist; if `genres` is absent, skip Spotify genre fetches.
- Undo restores the last removal batch for the current session only.
- Demo removals never call Spotify.

## Brand Commitments

The product name is Reihe. The interface is German. The user pinned the visual system: a printed Swiss departure board (cool paper, ink, one red). See DESIGN.md.

## Evidence on Hand

No live Spotify account is configured in this environment. Demonstration rows are synthetic and labeled as such. Real public artist names may appear inside that labeled demo library. Do not invent listening statistics, follower counts, or a claim that a removal reached Spotify.

## Product Principles

- Nothing leaves the library without an explicit choice of where it leaves.
- Deutschrap and weak evidence stay out of the default cut.
- The dense review log is the product.
- Demo and live data share one classifier so the sample is not a fake result list.
- Say what Spotify will not do: catalog tracks remain in the catalog.

## Accessibility & Inclusion

Long scanning session: keyboard-reachable controls, named actions, visible focus, and text contrast that holds on paper. The UI language is German.
