# Reihe

Lokale Next.js-App, die deine Spotify-Lieblingssongs und die Playlists, die dir gehören, gegeneinander hält. Trap und moderner Rap in dieser Schnittmenge landen in der Reihe. Deutschrap bleibt aus, bis du ihn einschaltest. Nichts wird gelöscht, bevor du es bestätigst. Die letzte Aktion lässt sich in der Sitzung zurücknehmen.

Spotify kann Katalogtitel nicht löschen. „Nehmen“ heisst: aus den Lieblingssongs nehmen (`DELETE /me/library`) und/oder aus eigenen Playlists nehmen (`DELETE /playlists/{id}/items`). Gefolgte Playlists und kollaborative Playlists, die dir nicht gehören, sind aussen vor.

## Starten

```bash
npm install
npm run dev
```

Öffnen: [http://127.0.0.1:3847](http://127.0.0.1:3847)

Dieselbe Adresse als Host benutzen, die in der Redirect-URI steht. `localhost` und `127.0.0.1` teilen sich keine Cookies.

Tests:

```bash
npm test
```

Die Datenbank liegt in `data/library.db` (gitignored, SQLite, WAL).

## Beispieldaten

Ohne Spotify-Zugang auf **Beispieldaten laden**. Die Bibliothek ist synthetisch, läuft aber durch denselben Klassifikator wie ein echter Abgleich. Ein roter Hinweis bleibt sichtbar. Entfernen und Rückgängig gehen nur an die lokale Datenbank.

## Spotify verbinden

Neue Apps im Development Mode brauchen ein Spotify-Konto mit **Premium**. Ohne Premium antwortet die API nicht. Development Mode lässt nur wenige Nutzer zu, liefert oft kein `artist.genres` und hat keine Audio-Features. Der Batch-Endpunkt `GET /artists` ist entfernt.

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) öffnen und eine App anlegen.
2. Redirect-URI exakt eintragen: `http://127.0.0.1:3847/api/auth/callback`
3. `.env.local` anlegen (Vorlage: `.env.example`):

```bash
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3847/api/auth/callback
LASTFM_API_KEY=
```

4. Dev-Server neu starten, dann **Mit Spotify anmelden** und **Abgleich**.

Der Client-Secret bleibt auf dem Server. Im Browser liegt nur eine httpOnly-Session-ID; Tokens stehen in SQLite. Scopes: `user-read-private`, `user-library-read`, `user-library-modify`, `playlist-read-private`, `playlist-read-collaborative`, `playlist-modify-public`, `playlist-modify-private`.

Beim ersten Künstler prüft der Abgleich, ob `genres` im Objekt vorkommt. Fehlt der Schlüssel, werden keine weiteren Spotify-Genre-Abrufe gemacht. Mit `LASTFM_API_KEY` füllt Last.fm (`artist.getTopTags`) die Lücke. Pro Künstler lässt sich die Gattung korrigieren. Die Regeln (ganze Wörter, längste Phrase, Deutschrap gewinnt) stehen unter **Regeln**. „rap“ und „hip hop“ allein sind absichtlich keine Regeln.

## Grenzen

- Premium ist für neue Development-Mode-Apps Pflicht.
- Keine Katalog-Löschung, keine Audio-Features, kein Künstler-Batch.
- Nur eigene Playlists. Kollaborative Playlists ohne dich als Owner bleiben draussen.
- Rückgängig gilt für die letzte Aktion der laufenden Sitzung, nicht nach dem Abmelden.
- Bei HTTP 429 wartet der Abgleich auf `Retry-After`. Ein 401 erneuert das Token einmal.
