"use client";

import { useState } from "react";
import { CoverMark } from "@/components/cover-mark";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { Bucket } from "@/lib/classify";
import { BUCKET_LABEL, formatDuration, LOCATION_OPTIONS, SOURCE_LABEL } from "@/lib/labels";
import type { LocationMode } from "@/lib/filter";
import type { LibraryArtist, LibraryPlaylist, LibraryTrack } from "@/lib/library-types";

const GENRE_TOGGLES: Bucket[] = ["trap", "modern_rap", "deutschrap", "other", "unknown"];

export function ReviewBoard({
  tracks,
  total,
  playlists,
  location,
  buckets,
  playlistId,
  query,
  selected,
  loading,
  error,
  demo,
  genresAvailable,
  lastfm,
  onLocation,
  onBuckets,
  onPlaylist,
  onQuery,
  onToggle,
  onToggleVisible,
  onArtist,
  onRetry,
}: {
  tracks: LibraryTrack[];
  total: number;
  playlists: LibraryPlaylist[];
  location: LocationMode;
  buckets: Bucket[];
  playlistId: string | null;
  query: string;
  selected: string[];
  loading: boolean;
  error: string | null;
  demo: boolean;
  genresAvailable: boolean | null;
  lastfm: boolean;
  onLocation: (location: LocationMode) => void;
  onBuckets: (buckets: Bucket[]) => void;
  onPlaylist: (playlistId: string | null) => void;
  onQuery: (query: string) => void;
  onToggle: (id: string) => void;
  onToggleVisible: () => void;
  onArtist: (artist: LibraryArtist) => void;
  onRetry: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selectedSet = new Set(selected);
  const allSelected = tracks.length > 0 && tracks.every((track) => selectedSet.has(track.id));
  const someSelected = tracks.some((track) => selectedSet.has(track.id));
  const playlistName = playlists.find((playlist) => playlist.id === playlistId)?.name ?? "Alle Playlists";

  function toggleBucket(bucket: Bucket, on: boolean) {
    onBuckets(on ? [...new Set([...buckets, bucket])] : buckets.filter((item) => item !== bucket));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div className="border-b border-[#d4d4ce] px-4 py-2 md:hidden">
        <Button variant="outline" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
          {filtersOpen ? "Filter schliessen" : "Filter"}
        </Button>
      </div>
      <aside className={`${filtersOpen ? "block" : "hidden"} w-full shrink-0 border-[#d4d4ce] px-4 py-4 md:block md:w-60 md:overflow-auto md:border-r`}>
        <fieldset>
          <legend className="text-sm font-semibold">Ort</legend>
          <div className="mt-2 grid gap-1">
            {LOCATION_OPTIONS.map((option) => (
              <label key={option.id} className="flex items-start gap-2 py-1 text-sm">
                <input
                  type="radio"
                  name="ort"
                  className="mt-1 accent-[#121212]"
                  checked={location === option.id}
                  onChange={() => onLocation(option.id)}
                />
                <span>
                  <span className="block">{option.label}</span>
                  <span className="block text-xs text-[#3f3f3f]">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Separator className="my-4" />
        <fieldset>
          <legend className="text-sm font-semibold">Gattung</legend>
          <div className="mt-2 grid gap-2">
            {GENRE_TOGGLES.map((bucket) => (
              <div key={bucket} className="flex items-center justify-between gap-3">
                <label htmlFor={`gattung-${bucket}`} className="text-sm">
                  {BUCKET_LABEL[bucket]}
                </label>
                <Switch
                  id={`gattung-${bucket}`}
                  data-testid={`toggle-${bucket}`}
                  checked={buckets.includes(bucket)}
                  onCheckedChange={(checked) => toggleBucket(bucket, checked === true)}
                />
              </div>
            ))}
          </div>
        </fieldset>
        <Separator className="my-4" />
        <div>
          <p className="text-sm font-semibold">Playlist</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="mt-2 w-full justify-between">
                <span className="truncate">{playlistName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-72 w-56 overflow-y-auto rounded-none">
              <DropdownMenuItem onSelect={() => onPlaylist(null)}>Alle Playlists</DropdownMenuItem>
              {playlists.map((playlist) => (
                <DropdownMenuItem key={playlist.id} onSelect={() => onPlaylist(playlist.id)}>
                  {playlist.name}
                  <span className="ml-auto text-xs text-[#3f3f3f]">{playlist.count}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-4">
          <label htmlFor="suche" className="text-sm font-semibold">
            Suche
          </label>
          <Input
            id="suche"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Titel, Künstler, Playlist"
            className="mt-2"
          />
        </div>
        {!demo && genresAvailable === false ? (
          <p className="mt-4 text-xs leading-5 text-[#3f3f3f]">
            Spotify hat das Genre-Feld nicht geliefert.
            {lastfm
              ? " Fehlende Künstler gehen an Last.fm."
              : " Ohne Last.fm-Schlüssel bleiben sie unbekannt, bis du sie korrigierst."}
          </p>
        ) : null}
      </aside>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left md:min-w-[960px]">
          <thead className="sticky top-0 z-10 bg-[#f7f7f5]">
            <tr className="border-b border-[#121212] text-xs text-[#3f3f3f]">
              <th className="w-10 px-3 py-2 font-medium">
                <Checkbox
                  aria-label="Sichtbare Titel auswählen"
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={() => onToggleVisible()}
                  disabled={tracks.length === 0}
                />
              </th>
              <th className="w-12 px-2 py-2 font-medium">
                <span className="sr-only">Cover</span>
              </th>
              <th className="w-16 px-2 py-2 font-medium">Dauer</th>
              <th className="px-2 py-2 font-medium">Titel</th>
              <th className="hidden px-2 py-2 font-medium md:table-cell">Künstler</th>
              <th className="hidden px-2 py-2 font-medium md:table-cell">Liegt in</th>
              <th className="hidden px-2 py-2 font-medium md:table-cell">Gattung</th>
              <th className="hidden px-2 py-2 font-medium md:table-cell">Quelle</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }, (_, index) => (
                <tr key={index} className="border-b border-[#d4d4ce]">
                  <td colSpan={8} className="px-3 py-3">
                    <span className="block h-4 max-w-xl bg-[#ececea] motion-safe:animate-pulse" />
                  </td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={8} className="px-3 py-8">
                  <p role="alert" className="text-sm text-[#9d0000]">
                    {error}
                  </p>
                  <Button variant="outline" className="mt-3" onClick={onRetry}>
                    Erneut laden
                  </Button>
                </td>
              </tr>
            ) : tracks.length === 0 ? (
              <tr>
                <td colSpan={8} className="max-w-xl px-3 py-8 text-sm leading-6">
                  {total === 0
                    ? demo
                      ? "Die Beispieldaten sind leer."
                      : "Noch keine Bibliothek. Starte den Abgleich."
                    : "Keine Titel für diese Auswahl. Die Schnittmenge zeigt nur Songs, die geliked sind und in einer eigenen Playlist liegen, und nur die eingeschalteten Gattungen."}
                </td>
              </tr>
            ) : (
              tracks.map((track) => {
                const on = selectedSet.has(track.id);
                const place = [track.liked ? "Liebling" : null, ...track.playlistNames].filter(Boolean).join(" · ");
                const primary =
                  track.artists.find((item) => item.source === "override" && item.bucket === track.bucket) ??
                  track.artists.find((item) => item.bucket === track.bucket) ??
                  track.artists[0];
                return (
                  <tr
                    key={track.id}
                    data-testid={`track-${track.id}`}
                    className={`border-b border-[#d4d4ce] ${on ? "bg-[#f6e8e6]" : "hover:bg-[#ececea]"}`}
                    onClick={() => onToggle(track.id)}
                  >
                    <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        aria-label={`${track.name} auswählen`}
                        checked={on}
                        onCheckedChange={() => onToggle(track.id)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <CoverMark id={track.id} imageUrl={track.imageUrl} />
                    </td>
                    <td className="px-2 py-2 font-condensed text-base tabular-nums">
                      <span
                        className={`mr-2 inline-block size-1.5 align-middle ${
                          track.bucket === "trap" || track.bucket === "modern_rap"
                            ? "bg-[#EB0000]"
                            : "border border-[#bdbdb6]"
                        }`}
                      />
                      {formatDuration(track.durationMs)}
                    </td>
                    <td className="px-2 py-2">
                      <span className="block font-condensed text-[17px] leading-tight font-semibold">{track.name}</span>
                      {track.album ? <span className="mt-0.5 block text-xs text-[#3f3f3f]">{track.album}</span> : null}
                      <span
                        className="mt-1 block text-xs leading-5 text-[#3f3f3f] md:hidden"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {track.artists.length === 0
                          ? "—"
                          : track.artists.map((artist, index) => (
                              <span key={artist.id}>
                                {index > 0 ? ", " : null}
                                <button type="button" className="underline-offset-2 hover:underline" onClick={() => onArtist(artist)}>
                                  {artist.name}
                                </button>
                              </span>
                            ))}
                        {" · "}
                        {place || "—"}
                        {" · "}
                        {BUCKET_LABEL[track.bucket]}
                        {" · "}
                        {primary ? SOURCE_LABEL[primary.source] : "—"}
                      </span>
                    </td>
                    <td className="hidden px-2 py-2 text-sm md:table-cell" onClick={(event) => event.stopPropagation()}>
                      {track.artists.length === 0 ? (
                        "—"
                      ) : (
                        track.artists.map((artist, index) => (
                          <span key={artist.id}>
                            {index > 0 ? ", " : null}
                            <button
                              type="button"
                              className="underline-offset-2 hover:underline"
                              onClick={() => onArtist(artist)}
                            >
                              {artist.name}
                            </button>
                          </span>
                        ))
                      )}
                    </td>
                    <td className="hidden max-w-56 px-2 py-2 text-sm md:table-cell" title={place}>
                      <span className="line-clamp-2">{place || "—"}</span>
                    </td>
                    <td className="hidden px-2 py-2 text-sm md:table-cell" title={primary?.matchedPhrase ?? undefined}>
                      {BUCKET_LABEL[track.bucket]}
                    </td>
                    <td className="hidden px-2 py-2 text-sm md:table-cell">{primary ? SOURCE_LABEL[primary.source] : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
