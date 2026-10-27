"use client";

import { Button } from "@/components/ui/button";

const SAMPLE = [
  {
    time: "3:24",
    title: "Mask Off",
    album: "FUTURE",
    artist: "Future",
    place: "Liebling · Nachtzug",
    genre: "Trap",
    mark: true,
    state: "sichtbar",
  },
  {
    time: "2:37",
    title: "Roller",
    album: "Treppenhaus",
    artist: "Apache 207",
    place: "Liebling · Küche",
    genre: "Deutschrap",
    mark: false,
    state: "ausgeblendet",
  },
  {
    time: "4:54",
    title: "N.Y. State of Mind",
    album: "Illmatic",
    artist: "Nas",
    place: "Liebling · Alt & gut",
    genre: "Anderes",
    mark: false,
    state: "ausgeblendet",
  },
];

export function Gate({
  configured,
  redirectUri,
  busy,
  error,
  onDemo,
}: {
  configured: boolean;
  redirectUri: string;
  busy: boolean;
  error: string | null;
  onDemo: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <p className="max-w-[68ch] text-base leading-6">
        Reihe liest Lieblingssongs und eigene Playlists, markiert Trap und modernen Rap in der
        Schnittmenge und nimmt sie erst nach Bestätigung heraus.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {configured ? (
          <Button asChild>
            <a href="/api/auth/login">Mit Spotify anmelden</a>
          </Button>
        ) : (
          <Button disabled>Mit Spotify anmelden</Button>
        )}
        <Button variant="outline" data-testid="load-demo" onClick={onDemo} disabled={busy}>
          {busy ? "Lade Beispiel…" : "Beispieldaten laden"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[#9d0000]">
          {error}
        </p>
      ) : null}
      {configured ? null : (
        <div className="max-w-[68ch] text-sm leading-6 text-[#3f3f3f]">
          <p>
            Spotify ist noch nicht eingerichtet. Im Dashboard eine App anlegen, Redirect-URI{" "}
            <span className="text-[#121212]">{redirectUri}</span> eintragen und{" "}
            <span className="text-[#121212]">SPOTIFY_CLIENT_ID</span> sowie{" "}
            <span className="text-[#121212]">SPOTIFY_CLIENT_SECRET</span> in{" "}
            <span className="text-[#121212]">.env.local</span> setzen. Neue Apps im Development
            Mode brauchen Spotify Premium. Der Client-Secret bleibt auf diesem Rechner.
          </p>
        </div>
      )}
      <div>
        <p className="mb-2 text-sm text-[#3f3f3f]">Darstellung, keine Bibliothek. So liest sich eine Zeile.</p>
        <div className="overflow-x-auto border-y border-[#121212]">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#d4d4ce] text-xs text-[#3f3f3f]">
                <th className="px-3 py-2 font-medium">Dauer</th>
                <th className="px-3 py-2 font-medium">Titel</th>
                <th className="px-3 py-2 font-medium">Künstler</th>
                <th className="px-3 py-2 font-medium">Liegt in</th>
                <th className="px-3 py-2 font-medium">Gattung</th>
                <th className="px-3 py-2 font-medium">Stand</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE.map((row) => (
                <tr key={row.title} className="border-b border-[#d4d4ce] last:border-b-0">
                  <td className="px-3 py-2 font-condensed text-base tabular-nums">
                    <span className="mr-2 inline-flex items-center">
                      <span
                        className={row.mark ? "size-1.5 bg-[#EB0000]" : "size-1.5 border border-[#bdbdb6]"}
                      />
                    </span>
                    {row.time}
                  </td>
                  <td className="px-3 py-2">
                    <span className="block font-condensed text-[17px] leading-none font-semibold">{row.title}</span>
                    <span className="mt-1 block text-xs text-[#3f3f3f]">{row.album}</span>
                  </td>
                  <td className="px-3 py-2 text-sm">{row.artist}</td>
                  <td className="px-3 py-2 text-sm">{row.place}</td>
                  <td className="px-3 py-2 text-sm">{row.genre}</td>
                  <td className="px-3 py-2 text-sm">{row.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-[68ch] text-sm leading-6 text-[#3f3f3f]">
          Die Schnittmenge ist geliked und liegt in einer eigenen Playlist. Deutschrap bleibt aussen,
          bis der Schalter an ist. Anderes und Unbekannt sind nie vorausgewählt. Spotify löscht keine
          Katalogtitel: Herausnehmen heisst aus Lieblingssongs und aus eigenen Playlists. Die letzte
          Aktion lässt sich in der Sitzung zurücknehmen.
        </p>
      </div>
    </div>
  );
}
