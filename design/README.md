# (Я)Evolution, design draft

A visual draft for review, not the production site. Three pages, linked to each other:

- `landing/index.html`: the front page, the letter turning around.
- `articles/index.html`: the contents.
- `articles/currency-that-expires.html`: one article opened, to judge long text.

Plain HTML, CSS and a little script, Google Fonts only, no build step. Shared pieces live in
`shared/`: `base.css` (palette, type, chrome), `bitmap.js` (the R, the Я, the five signs and the
dither) and `lang.js` (the EN/ES switch, remembered across pages).

Screenshots in `screenshots/`, desktop at 1440 wide and mobile at 390 wide:
`revolution-landing-*`, `revolution-articles-*` (contents) and `revolution-article-*`.

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

## Contents and article pages

The client said v2 reminded them of personal zines, so these two pages push the paste-up further
while staying 1-bit: strips look stuck down by hand, black edges fray into dither like a tired
photocopier, and every grey is still made of pixels. Dials: ENERGY 2 / RHYTHM 2 / MOTION 1. The
reading page is calmer than the landing on purpose.

**Contents.** The word "Contents" fills its column next to the (Я), as the category names do on the
landing. Each entry is a strip: category word and sign on the left, the title running into a
leader of pixel dots, and the issue number set huge on the right like a page number in a zine's
contents. Strips sit a few pixels off each other, as if glued by hand. The newest issue is a cut-out
pasted on top, inked solid and a little crooked. The landing's keys are back as a filter. Pressing
one does the e-ink full refresh, and entries from other categories stay in place as checkerboard
ghosts (inert and hidden from screen readers) instead of disappearing. Press the lit key again, or
the (Я) key, to bring everything back.

**Article.** Body text is Anybody at width 102, weight 400, 17 to 19 px, line height 1.6, on a 66ch
measure. That is 14.2:1 ink on paper. The boldness is kept to the edges:

- the category sign printed twice, the second pass slipping off register;
- an ultra-condensed title, a wide light dek and the issue number standing on its side;
- section numbers hanging in the left margin over a heavy rule;
- margin notes left of the text on wide screens, boxed in the flow on phones;
- a pull quote as an inked cut-out stuck across the margin, with a toner fray;
- a figure drawn by the page and dithered to 1-bit with a Bayer matrix, labelled as a placeholder;
- tables and blockquotes ruled with pixel dots;
- code set in the same family at width 80, because there is only one typeface;
- the running head "EVOLUTION 08" up the right edge.

The page ends with the R facing the reader, "Maybe you do.", the article's "Needs" list and links
back to the contents and the front page.

Bullets are single square pixels. The "Needs" line is a rubber stamp: a black label next to a boxed
phrase. The dither tiles (checkerboard and one in four) are CSS conic-gradient patterns at 2 px
cells. They are used as halftone texture, never as a colour gradient.

**Content.** Entries, dates and reading times are samples, and the page says so. Every entry opens
the same sample article. The article is draft copy for layout review. Its history (Gesell, Wörgl
1932, the Keynes line from chapter 23 of the *General Theory*) is real and kept to what the
standard accounts agree on. The scheme's numbers are the proposal's own, not claims. The body is
English only. In Spanish the page says so and keeps the chrome, title and dek translated.

## Not done yet

- No call to action link: there is no confirmed contact or submission address to point at.
- Real wordmark and real entries to be supplied by Mansus.
- Only one article page exists; the other contents entries all open it.
- The article body has no Spanish translation yet.
- The figure is a generated placeholder; the real image would go through the same 1-bit treatment.
