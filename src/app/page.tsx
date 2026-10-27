/**
 * THESIS: A printed departure sheet for tracks leaving the library. The page is the board, not a dashboard of metric cards and not a dark LED split-flap.
 * OWN-WORLD: Cool paper #f7f7f5, ink #121212, hairline rules, one red #EB0000 for the bar, the departure mark, and the remove action. Barlow Condensed for titles, Barlow for the rest. Square corners.
 * STORY: See liked songs that also sit in owned playlists and match trap or modern rap, confirm where they leave, undo the last batch.
 * FIRST VIEWPORT: Station header with name and Zürich clock. Logged out: one sentence, two actions, three sample rows. Signed in: filter strip and the departure table immediately.
 * FORM: Swiss paper timetable, pinned by the brief.
 */
import { ReiheApp } from "@/components/reihe-app";

export default function Home() {
  return <ReiheApp />;
}
