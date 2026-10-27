---
name: Reihe
description: Printed Swiss departure board for tracks leaving a Spotify library.
colors:
  paper: "#f7f7f5"
  paper-sunk: "#ececea"
  ink: "#121212"
  ink-soft: "#3f3f3f"
  rule: "#d4d4ce"
  rule-strong: "#121212"
  sbb: "#EB0000"
  sbb-ink: "#ffffff"
  danger-wash: "#f6e8e6"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.01em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.005em"
  body:
    fontFamily: "Barlow, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0"
  label:
    fontFamily: "Barlow, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  none: "0px"
spacing:
  row-y: "6px"
  row-x: "12px"
  panel: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  button-remove:
    backgroundColor: "{colors.sbb}"
    textColor: "{colors.sbb-ink}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  button-quiet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  row-selected:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
---

## Overview

Reihe is an operate tool: a paper departure sheet for songs leaving a library. The sheet is the interface. A 4px red bar, a condensed destination line, and hairline rules carry the Swiss timetable reference. The red is SBB red `#EB0000` and is reserved for the bar, the departure mark on trap and modern-rap rows, and the remove action.

Scene: one person, evening, Zürich, cool white paper under a desk lamp. Light mode is the material, not a preference.

## Colors

Paper `#f7f7f5` is the page. Sunk paper `#ececea` is hover, skeleton, and the filter well. Ink `#121212` is text, the primary button, and the strong rule. Soft ink `#3f3f3f` is secondary text (still above 4.5:1 on paper). Rules are `#d4d4ce`. Red is not used for body text except the short departure mark and the enabled “Nehmen” label on the red button (white on `#EB0000`).

No second accent, no dark theme, no gradient.

## Typography

Barlow for UI and reading. Barlow Condensed for the wordmark, track titles, and the clock. Durations and the clock use tabular figures. Sizes stay on a short scale: 12px labels, 14px body, 17px titles, 28px wordmark. German copy is sentence case. Column headers are labels, not tracked eyebrows on every block.

## Layout

The first viewport is the board. Header (mark, name, Zürich clock, actions), then a left filter strip and a scrolling table, then a footer that keeps the count and the remove action on screen. Logged out, the same sheet shows one sentence, the two entry actions, and three sample rows of the mechanism.

Desktop: filters in a 15rem column. Mobile: filters collapse; the table keeps one line per track and scrolls sideways. Sticky column header. More space between filter groups than between a label and its control.

## Elevation & Depth

Flat paper. Dialogs sit one step up with a 12px offset shadow, blur 40px, ink at 12% opacity. No glass, no blur on the page, no glowing edges. Dropdowns use the same offset shadow.

## Shapes

Corners are square (`0`). Switches stay the standard pill because that is the control, not a decoration. Checks are 1px-radius squares. The red bar is a hard rectangle. Covers without art are an 8×8 generative ink grid from the track id, with at most one red cell.

## Components

- Header: red bar, red square with “R”, condensed “Reihe”, clock in Europe/Zurich, text buttons.
- Table row: checkbox, cover, duration, title and album, artists, “Liebling” plus playlist names, genre, source. Trap and modern rap get a 6px red square; other buckets get a hairline square.
- Filter strip: location radios, genre switches, playlist menu, search. Not cards.
- Remove: red button with the count. Dialog offers two unchecked actions (Liked Songs, chosen owned playlists) and lists playlists only after the second action is on.
- Rules and artist override: plain dialogs, same paper, text buttons.
- Demo banner: one full-width line under the header, red rule, no icon tile.
- Buttons: ink fill for the main entry, outline for secondary, red fill only for removal.

## Do's and Don'ts

- Do keep the review log denser than any explanation.
- Do require a checked action before removal.
- Do label synthetic data as Beispieldaten.
- Don't ship metric cards, icon grids, gradient text, glass panels, or a left border as a callout.
- Don't use cream paper, a display serif, or a dark neon board.
- Don't preselect Deutschrap, Anderes, or Unbekannt.
- Don't copy the SBB logo. The red and the sheet are the reference, not the trademark.
