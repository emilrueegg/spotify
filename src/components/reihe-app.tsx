"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArtistDialog, ConfirmRemove, RulesDialog } from "@/components/board-dialogs";
import { Gate } from "@/components/gate";
import { ReviewBoard } from "@/components/review-board";
import { Button } from "@/components/ui/button";
import type { Bucket } from "@/lib/classify";
import { DEFAULT_BUCKETS, filterTracks, type LocationMode } from "@/lib/filter";
import { formatZurich } from "@/lib/labels";
import type { LibraryArtist, LibraryPlaylist, LibraryTrack, SessionResponse } from "@/lib/library-types";

const AUTH_ERRORS: Record<string, string> = {
  config: "Spotify ist nicht eingerichtet.",
  access_denied: "Anmeldung abgebrochen.",
  state: "Die Anmeldung ist abgelaufen. Bitte erneut versuchen.",
  token: "Spotify hat den Code nicht eingelöst. Redirect-URI und Geheimnis prüfen.",
};

type LibraryResponse = {
  tracks: LibraryTrack[];
  playlists: LibraryPlaylist[];
  syncedAt: number | null;
};

function useZurichClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    const start = window.setTimeout(update, 0);
    const id = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, []);
  if (!now) return { time: "––:––:––", day: "Zürich" };
  const formatted = formatZurich(now);
  return { time: formatted.time, day: `Zürich · ${formatted.day}` };
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error || "Die Anfrage ist fehlgeschlagen.";
}

export function ReiheApp() {
  const clock = useZurichClock();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [library, setLibrary] = useState<LibraryResponse | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [location, setLocation] = useState<LocationMode>("intersection");
  const [buckets, setBuckets] = useState<Bucket[]>(DEFAULT_BUCKETS);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removePending, setRemovePending] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [artist, setArtist] = useState<LibraryArtist | null>(null);

  async function loadSession(): Promise<SessionResponse> {
    const response = await fetch("/api/session");
    const body = (await response.json()) as SessionResponse;
    setSession(body);
    return body;
  }

  async function loadLibrary() {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const response = await fetch("/api/library");
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as LibraryResponse;
      setLibrary(body);
      setSelected([]);
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Bibliothek nicht geladen.");
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => {
    const fehler = new URLSearchParams(window.location.search).get("fehler");
    const notice = window.setTimeout(() => {
      if (fehler) setAuthError(AUTH_ERRORS[fehler] ?? "Anmeldung fehlgeschlagen.");
    }, 0);
    if (fehler) window.history.replaceState({}, "", "/");
    let cancelled = false;
    fetch("/api/session")
      .then(async (response) => {
        const body = (await response.json()) as SessionResponse;
        if (cancelled) return;
        setSession(body);
        if (!body.authenticated) return;
        setLibraryLoading(true);
        const libraryResponse = await fetch("/api/library");
        if (!libraryResponse.ok) throw new Error(await readError(libraryResponse));
        const libraryBody = (await libraryResponse.json()) as LibraryResponse;
        if (cancelled) return;
        setLibrary(libraryBody);
        setLibraryLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLibraryLoading(false);
        setAuthError(error instanceof Error ? error.message : "Die Sitzung konnte nicht gelesen werden.");
      });
    return () => {
      cancelled = true;
      window.clearTimeout(notice);
    };
  }, []);

  const visible = useMemo(
    () =>
      filterTracks(library?.tracks ?? [], {
        location,
        buckets,
        playlistId,
        query,
      }),
    [library, location, buckets, playlistId, query],
  );
  const selectedTracks = visible.filter((track) => selected.includes(track.id));

  function changeFilter(update: () => void) {
    update();
    setSelected([]);
  }

  async function loadDemo() {
    setDemoBusy(true);
    setAuthError(null);
    try {
      const response = await fetch("/api/demo", { method: "POST" });
      if (!response.ok) throw new Error(await readError(response));
      await loadSession();
      await loadLibrary();
      setLocation("intersection");
      setBuckets(DEFAULT_BUCKETS);
      setPlaylistId(null);
      setQuery("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Beispieldaten fehlgeschlagen.");
    } finally {
      setDemoBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession((current) =>
      current
        ? { ...current, authenticated: false, demo: false, displayName: null, hasUndo: false }
        : current,
    );
    setLibrary(null);
    setSelected([]);
    setPhase(null);
  }

  async function runSync() {
    setSyncing(true);
    setPhase("Abgleich startet");
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      if (!response.ok || !response.body) throw new Error(await readError(response));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed = "";
      let last = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { phase: string; message: string };
          last = event.message;
          setPhase(event.message);
          if (event.phase === "error") failed = event.message;
        }
      }
      if (failed) throw new Error(failed);
      toast.success(last || "Abgleich fertig.");
      await loadSession();
      await loadLibrary();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Abgleich fehlgeschlagen.";
      setPhase(message);
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  }

  async function confirmRemove(input: { unlike: boolean; playlistIds: string[] }) {
    setRemovePending(true);
    try {
      const response = await fetch("/api/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackIds: selectedTracks.map((track) => track.id),
          unlike: input.unlike,
          playlistIds: input.playlistIds,
        }),
      });
      const body = (await response.json()) as { error?: string; message?: string; partial?: boolean };
      if (!response.ok) throw new Error(body.error || "Entfernen fehlgeschlagen.");
      if (body.partial) toast.error(body.message || "Nur ein Teil ist draussen.");
      else toast.success(body.message || "Entfernt. Rückgängig ist möglich.");
      setConfirmOpen(false);
      await loadSession();
      await loadLibrary();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Entfernen fehlgeschlagen.");
    } finally {
      setRemovePending(false);
    }
  }

  async function undo() {
    try {
      const response = await fetch("/api/undo", { method: "POST" });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || "Rückgängig fehlgeschlagen.");
      toast.success(body.message || "Zurückgenommen.");
      await loadSession();
      await loadLibrary();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rückgängig fehlgeschlagen.");
    }
  }

  const signedIn = session?.authenticated === true;

  return (
    <div className="flex h-dvh flex-col bg-[#f7f7f5] text-[#121212]">
      <header className="shrink-0 border-b border-[#121212]">
        <div className="h-1 bg-[#EB0000]" />
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-3">
            <span className="grid size-8 place-items-center bg-[#EB0000] font-condensed text-lg leading-none font-semibold text-white">
              R
            </span>
            <div>
              <p className="text-xs text-[#3f3f3f]">
                {!session ? "Zürich" : signedIn ? session.displayName || "Bibliothek" : "Nicht angemeldet"}
              </p>
              <h1 className="font-condensed text-[1.75rem] leading-none font-semibold">Reihe</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 sm:justify-end">
            <p className="text-right">
              <span className="block text-xs text-[#3f3f3f]">{clock.day}</span>
              <span className="block font-condensed text-2xl leading-none tabular-nums">{clock.time}</span>
            </p>
            {signedIn ? (
              <nav className="flex flex-wrap items-center gap-1">
                <Button
                  variant="ghost"
                  onClick={() => void runSync()}
                  disabled={session?.demo || syncing}
                  title={session?.demo ? "Im Beispielmodus gibt es keinen Spotify-Abgleich." : undefined}
                >
                  {syncing ? "Abgleich…" : "Abgleich"}
                </Button>
                <Button variant="ghost" onClick={() => setRulesOpen(true)}>
                  Regeln
                </Button>
                <Button variant="ghost" onClick={() => void logout()}>
                  Abmelden
                </Button>
              </nav>
            ) : null}
          </div>
        </div>
      </header>
      {session?.demo ? (
        <p data-testid="banner-demo" className="border-b border-[#EB0000] px-4 py-2 text-sm">
          Beispieldaten. Nichts davon liegt bei Spotify. Entfernen und Rückgängig bleiben auf diesem Rechner.
        </p>
      ) : null}
      {phase ? (
        <p role="status" className="border-b border-[#d4d4ce] px-4 py-2 text-sm text-[#3f3f3f]">
          {phase}
        </p>
      ) : null}
      {!session ? (
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="mb-3 h-4 max-w-3xl bg-[#ececea] motion-safe:animate-pulse" />
          ))}
        </div>
      ) : !signedIn ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <Gate
            configured={session.configured}
            redirectUri={session.redirectUri}
            busy={demoBusy}
            error={authError}
            onDemo={() => void loadDemo()}
          />
        </div>
      ) : (
        <>
          <ReviewBoard
            tracks={visible}
            total={library?.tracks.length ?? 0}
            playlists={library?.playlists ?? []}
            location={location}
            buckets={buckets}
            playlistId={playlistId}
            query={query}
            selected={selected}
            loading={libraryLoading && !library}
            error={libraryError}
            demo={session.demo}
            genresAvailable={session.genresAvailable}
            lastfm={session.lastfm}
            onLocation={(value) => changeFilter(() => setLocation(value))}
            onBuckets={(value) => changeFilter(() => setBuckets(value))}
            onPlaylist={(value) => changeFilter(() => setPlaylistId(value))}
            onQuery={(value) => changeFilter(() => setQuery(value))}
            onToggle={(id) =>
              setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
            }
            onToggleVisible={() => {
              const ids = visible.map((track) => track.id);
              const all = ids.length > 0 && ids.every((id) => selected.includes(id));
              setSelected(all ? [] : ids);
            }}
            onArtist={setArtist}
            onRetry={() => void loadLibrary()}
          />
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#121212] px-4 py-3">
            <p className="text-sm">
              {visible.length} Titel
              <span className="text-[#3f3f3f]"> · {selectedTracks.length} gewählt</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" data-testid="undo" disabled={!session.hasUndo} onClick={() => void undo()}>
                Rückgängig
              </Button>
              <Button
                data-testid="remove"
                disabled={selectedTracks.length === 0}
                className="bg-[#EB0000] text-white hover:bg-[#c80000]"
                onClick={() => setConfirmOpen(true)}
              >
                {selectedTracks.length === 0 ? "Nehmen" : `${selectedTracks.length} nehmen`}
              </Button>
            </div>
          </footer>
          <ConfirmRemove
            key={confirmOpen ? selectedTracks.map((track) => track.id).join(",") : "closed"}
            open={confirmOpen}
            pending={removePending}
            tracks={selectedTracks}
            onOpenChange={setConfirmOpen}
            onConfirm={(input) => void confirmRemove(input)}
          />
          <RulesDialog
            open={rulesOpen}
            onOpenChange={setRulesOpen}
            onSaved={() => {
              toast.success("Regeln gespeichert.");
              void loadLibrary();
            }}
          />
          <ArtistDialog
            artist={artist}
            onOpenChange={(open) => {
              if (!open) setArtist(null);
            }}
            onSaved={() => {
              toast.success("Korrektur gespeichert.");
              void loadLibrary();
            }}
          />
        </>
      )}
    </div>
  );
}
