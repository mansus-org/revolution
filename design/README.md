# (Я)Evolution, landing page design draft

A visual draft for review, not the production site. Open `landing/index.html` in a browser.
Plain HTML, CSS and one small script (`landing/bitmap.js`), Google Fonts only, no build step.
Screenshots: `screenshots/revolution-landing-desktop.png` (1440 wide) and
`screenshots/revolution-landing-mobile.png` (390 wide).

This replaces the first draft (iPod menu, serif newspaper layout), which the client rejected.

## The idea

The whole page is one letter turning around.

At the top, a giant 1-bit (Я) has just repainted, the way an e-ink screen does, and the R it
used to be still shows through as a dithered ghost. That is Mansus keeping the ideas: they face
away. At the bottom the same bitmap faces the reader again, (R) with a ghost of the Я, next to
"Maybe you do." The ideas now belong to whoever builds them. The layout mirrors with the letter:
the `EVOLUTION` spine reads up the right edge at the top and down the left edge at the bottom,
and text that sat right of the letter moves to its left.

Design read: a publisher's landing page for readers and would-be builders, in an alien 1-bit
e-ink language. Dials: ENERGY 3 / RHYTHM 3 / MOTION 2.

## How the brief became principles

- **iPod: one object, one control.** The middle of the page is a single surface with a single
  control: five square keys. Pressing one refreshes the whole surface. No cards, no lists of
  sections, no chrome beyond the name and the language switch.
- **E-ink: paper grey, refresh, ghosting, dithering.** Two inks only. Changing category flashes
  the panel black for one frame and repaints, and the previous sign stays behind as a ghost.
  The title bitmap paints row by row on load (half-tone first, then solid).
- **Alien: notation, proportions, reading direction.** The categories have their own signs, all
  built from parts of the R on a 7×7 grid: Ideas is the bowl with no stem, Architecture the stem
  carrying floors, Ideology the stem and the leg, Essays lines of text read downwards, Influences
  rings spreading from a corner. Type swings between ultra-condensed black and ultra-wide light
  in the same family, and the title runs on its side.

## Decisions, one line each

- **Palette:** paper `#e4e2db` and ink `#141414` (14.2:1). Grey only ever appears as dither, the
  way e-ink makes grey.
- **Typeface:** Anybody, one variable family. Its width axis (50 to 150) gives non-human
  proportions without mixing faces: width 50 / weight 900 for display, width 150 / weight 330
  for statements, around width 112 for reading. Nothing handwritten, nothing serif, nothing mono.
- **Bitmaps:** the Я, R, parentheses and the five signs are drawn cell by cell in `bitmap.js`
  and rendered as crisp SVG. The dither is made of real squares on a sub-grid, so it stays
  1-bit at any size.
- **Category name:** set to fill its column whatever the word, so every category reads at a
  different size, like a page that reflows.
- **Layout:** front and back faces mirror each other around the bitmap. The index uses its own
  narrower sign column so the name has room.
- **Motion:** two moments only, both e-ink behaviour: the title painting in once, and the panel
  flash on change. Both are off under `prefers-reduced-motion`.
- **Mansus mark:** the word "mansus" in Anybody width 150 / weight 860. A placeholder for the
  real wordmark, deliberately not a script imitation.
- **Language:** EN/ES switch, remembered in `localStorage`. Only the active language is rendered
  and announced.

## Content

The statement, categories and the "maybe you do" line are real copy for review. The entries are
samples and say so on the page ("Sample entries, not published yet."). Empty categories show
an empty state instead of filler.

## Accessibility

- The `<h1>` carries the plain text "(R)Evolution"; the bitmap and spine are `aria-hidden`.
- The category keys are a proper tablist: arrow keys, Home and End move between them, each key
  has a text name in both languages, and the panel is a labelled tabpanel.
- All controls are at least 44×44 px (56 on phones, 64 on desktop) with a 3px ink focus ring.

## Not done yet

- No call to action link: there is no confirmed contact or submission address to point at.
- Real wordmark and real entries to be supplied by Mansus.
