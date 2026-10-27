"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_RULES,
  isRuleBucket,
  normalizeGenreText,
  type OverrideBucket,
  type Rule,
  type RuleBucket,
} from "@/lib/classify";
import { BUCKET_LABEL, SOURCE_LABEL } from "@/lib/labels";
import type { LibraryArtist, LibraryTrack } from "@/lib/library-types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const OVERRIDE_OPTIONS: { id: OverrideBucket; label: string }[] = [
  { id: "trap", label: "Trap" },
  { id: "modern_rap", label: "Moderner Rap" },
  { id: "deutschrap", label: "Deutschrap" },
  { id: "other", label: "Behalten" },
];

export function ConfirmRemove({
  open,
  pending,
  tracks,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  tracks: LibraryTrack[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: { unlike: boolean; playlistIds: string[] }) => void;
}) {
  const [unlike, setUnlike] = useState(false);
  const [fromPlaylists, setFromPlaylists] = useState(false);
  const [playlistIds, setPlaylistIds] = useState<string[]>([]);

  const playlists = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const track of tracks) {
      track.playlistIds.forEach((id, index) => {
        const current = map.get(id) ?? { name: track.playlistNames[index] ?? id, count: 0 };
        current.count += 1;
        map.set(id, current);
      });
    }
    return [...map.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [tracks]);

  const likedCount = tracks.filter((track) => track.liked).length;
  const unlikeWorks = unlike && likedCount > 0;
  const chosenPlaylists = fromPlaylists ? playlistIds : [];
  const playlistHits = tracks.filter((track) => track.playlistIds.some((id) => chosenPlaylists.includes(id))).length;
  const playlistWorks = fromPlaylists && chosenPlaylists.length > 0 && playlistHits > 0;
  const canConfirm = !pending && (unlikeWorks || playlistWorks);

  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialogContent className="max-w-lg rounded-none sm:max-w-lg">
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle className="font-condensed text-xl">Aus der Bibliothek nehmen</AlertDialogTitle>
          <AlertDialogDescription className="text-left text-[#3f3f3f]">
            {tracks.length} Titel gewählt. Spotify löscht sie nicht aus dem Katalog. Nichts passiert,
            solange beide Aktionen aus sind.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-3 text-sm">
          <label className="flex items-start gap-3">
            <Checkbox
              data-testid="confirm-unlike"
              checked={unlike}
              onCheckedChange={(checked) => setUnlike(checked === true)}
            />
            <span>
              Aus Lieblingssongs nehmen
              <span className="mt-0.5 block text-xs text-[#3f3f3f]">{likedCount} der gewählten Titel sind geliked.</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <Checkbox
              data-testid="confirm-playlists"
              checked={fromPlaylists}
              onCheckedChange={(checked) => setFromPlaylists(checked === true)}
            />
            <span>Aus den gewählten eigenen Playlists nehmen</span>
          </label>
          {fromPlaylists ? (
            <ScrollArea className="h-40 border border-[#d4d4ce]">
              <div className="grid gap-2 p-3">
                {playlists.length === 0 ? (
                  <p className="text-xs text-[#3f3f3f]">Keiner der Titel liegt in einer eigenen Playlist.</p>
                ) : (
                  playlists.map((playlist) => (
                    <label key={playlist.id} className="flex items-center gap-3">
                      <Checkbox
                        checked={playlistIds.includes(playlist.id)}
                        onCheckedChange={(checked) => {
                          setPlaylistIds((current) =>
                            checked === true
                              ? [...current, playlist.id]
                              : current.filter((id) => id !== playlist.id),
                          );
                        }}
                      />
                      <span>
                        {playlist.name}
                        <span className="text-[#3f3f3f]"> · {playlist.count}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          ) : null}
        </div>
        <AlertDialogFooter className="rounded-none bg-transparent">
          <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
          <Button
            data-testid="confirm-submit"
            disabled={!canConfirm}
            type="button"
            className="bg-[#EB0000] text-white hover:bg-[#c80000]"
            onClick={() => onConfirm({ unlike, playlistIds: chosenPlaylists })}
          >
            {pending ? "Entferne…" : "Entfernen"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RulesDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [phrase, setPhrase] = useState("");
  const [bucket, setBucket] = useState<RuleBucket>("trap");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/rules")
      .then(async (response) => {
        const body = (await response.json()) as { rules?: Rule[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Regeln nicht geladen.");
        if (!cancelled) setRules(body.rules ?? []);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Regeln nicht geladen.");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function save(next: Rule[]) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: next }),
      });
      const body = (await response.json()) as { rules?: Rule[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Speichern fehlgeschlagen.");
      setRules(body.rules ?? next);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  function addPhrase() {
    const trimmed = phrase.trim();
    if (!trimmed) return;
    const key = normalizeGenreText(trimmed);
    if (rules.some((rule) => rule.bucket === bucket && normalizeGenreText(rule.phrase) === key)) {
      setError("Diese Regel gibt es schon.");
      return;
    }
    setRules((current) => [...current, { bucket, phrase: trimmed }]);
    setPhrase("");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-none sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-condensed text-xl">Regeln</DialogTitle>
          <DialogDescription className="text-[#3f3f3f]">
            Ganze Wörter. Der längste Treffer gilt. Deutschrap gewinnt immer, damit er ausgeblendet
            bleibt, bis du ihn einschaltest. «rap» und «hip hop» allein sind absichtlich nicht dabei.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-64 border border-[#d4d4ce]">
          <ul className="divide-y divide-[#d4d4ce]">
            {rules.map((rule, index) => (
              <li key={`${rule.bucket}-${rule.phrase}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>
                  <span className="text-[#3f3f3f]">{BUCKET_LABEL[rule.bucket]}</span>
                  <span className="mx-2 text-[#d4d4ce]">/</span>
                  {rule.phrase}
                </span>
                <button
                  type="button"
                  className="text-xs text-[#3f3f3f] underline-offset-2 hover:text-[#121212] hover:underline"
                  onClick={() => setRules((current) => current.filter((_, item) => item !== index))}
                >
                  Entfernen
                </button>
              </li>
            ))}
            {rules.length === 0 ? <li className="px-3 py-3 text-sm text-[#3f3f3f]">Keine Regeln.</li> : null}
          </ul>
        </ScrollArea>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            placeholder="Neue Phrase"
            aria-label="Neue Phrase"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addPhrase();
              }
            }}
          />
          <select
            aria-label="Gattung der Regel"
            value={bucket}
            onChange={(event) => {
              if (isRuleBucket(event.target.value)) setBucket(event.target.value);
            }}
            className="h-8 border border-[#c8c8c0] bg-transparent px-2 text-sm"
          >
            <option value="trap">Trap</option>
            <option value="modern_rap">Moderner Rap</option>
            <option value="deutschrap">Deutschrap</option>
          </select>
          <Button type="button" variant="outline" onClick={addPhrase}>
            Hinzufügen
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-[#9d0000]">
            {error}
          </p>
        ) : null}
        <DialogFooter className="rounded-none bg-transparent">
          <Button type="button" variant="outline" disabled={pending} onClick={() => save(DEFAULT_RULES.map((rule) => ({ ...rule })))}>
            Standard
          </Button>
          <Button type="button" disabled={pending} onClick={() => save(rules)}>
            {pending ? "Speichere…" : "Regeln speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ArtistDialog({
  artist,
  onOpenChange,
  onSaved,
}: {
  artist: LibraryArtist | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(override: OverrideBucket | null) {
    if (!artist) return;
    setPending(override ?? "reset");
    setError(null);
    try {
      const response = await fetch(`/api/artists/${encodeURIComponent(artist.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Korrektur fehlgeschlagen.");
      onSaved();
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Korrektur fehlgeschlagen.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={artist !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-condensed text-xl">{artist?.name}</DialogTitle>
          <DialogDescription className="text-[#3f3f3f]">
            {artist ? `${BUCKET_LABEL[artist.bucket]} · ${SOURCE_LABEL[artist.source]}` : ""}
            {artist?.matchedPhrase ? ` · Regel «${artist.matchedPhrase}»` : ""}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm leading-6">
          {artist && artist.tags.length > 0 ? `Tags: ${artist.tags.join(", ")}` : "Keine Tags."}
        </p>
        <div className="flex flex-wrap gap-2">
          {OVERRIDE_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={artist?.override === option.id ? "default" : "outline"}
              aria-pressed={artist?.override === option.id}
              disabled={pending !== null}
              onClick={() => save(option.id)}
            >
              {pending === option.id ? "Speichere…" : option.label}
            </Button>
          ))}
          <Button type="button" variant="ghost" disabled={pending !== null || !artist?.override} onClick={() => save(null)}>
            {pending === "reset" ? "Speichere…" : "Zurücksetzen"}
          </Button>
        </div>
        <p className="text-xs leading-5 text-[#3f3f3f]">
          Behalten zählt als Anderes und verschwindet aus der Standardreihe. Die Korrektur bleibt an
          diesem Künstler, auch wenn die Regeln sich ändern.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-[#9d0000]">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
