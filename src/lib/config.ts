export const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-library-read",
  "user-library-modify",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
] as const;

export const DEFAULT_REDIRECT_URI = "http://127.0.0.1:3847/api/auth/callback";

export function appConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI;
  const lastfmKey = process.env.LASTFM_API_KEY?.trim() ?? "";
  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: clientId.length > 0 && clientSecret.length > 0,
    lastfmKey,
    lastfm: lastfmKey.length > 0,
  };
}
