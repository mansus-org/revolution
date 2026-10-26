# (R)Evolution — landing page design draft

A visual draft for review, not the production site. Open `landing/index.html` in a browser
(plain HTML/CSS, a few lines of vanilla JS, Google Fonts only). Screenshots:
`screenshots/desktop.png` (1440 wide) and `screenshots/mobile.png` (390 wide).

## Direction

An old iPod crossed with a reMarkable tablet, as designed by someone who has only read about both.
Paper-white e-ink, carbon black, thin rules, huge type. The literary calm of the Mansus site
(handwritten wordmark, spaced uppercase nav, serif body, lots of air) pushed bigger and stranger.

## Type

- **Instrument Serif**: display. The title runs edge to edge (`22.4vw`), and the same face sets
  entry titles, the manifesto lede and the call to action.
- **Newsreader**: reading text. An optical-size serif that reads well at e-reader sizes. Justified
  on desktop like the Mansus site, ragged-right on phones.
- **JetBrains Mono**: all UI labels, the status bar, metadata and the iPod menu, in spaced uppercase.
- **Mrs Saint Delafield**: the handwritten "Mansus" mark, a nod to the existing signature wordmark.
  Swap in the real logo SVG for production.

## Palette

Two inks. Paper `#f3f2ec`, ink `#0b0b0b`, plus one secondary grey `#4a4a47` for marginalia
(about 8:1 contrast on paper). No colours, gradients, shadows or images. Emphasis comes from
inversion: the selected menu row and the whole "maybe you do" section flip to white on black,
the way an e-ink screen refreshes.

## Grid

A 12-part grid with fluid gutters (`clamp(20px, 4vw, 64px)`). Section labels sit in a narrow left
column (`§ 00`, `§ 01` … `§ ∞`), content in the wide middle, marginal notes on the right.
Everything collapses to one column under 640px. Hard 1–2px rules separate the sections.

## The mirrored R

The title is `(R)Evolution` in the markup. The R is wrapped in a span with
`display: inline-block; transform: scaleX(-1)`, so it looks like Я without using a Cyrillic
character. The `<h1>` carries `aria-label="(R)Evolution"` and the visual span is `aria-hidden`,
so screen readers and search engines read the plain word. A margin note ("Fig. 1 — The R faces
back") acknowledges it.

## Odd details

- An e-reader status bar: page `001 / ∞`, Madrid coordinates and a battery glyph.
- The index is an iPod Classic split screen: a menu on the left, a preview on the right, and a
  working click wheel (prev/next/menu/select) beside it. Hovering or focusing an item selects it.
- Categories are numbered 01, 02, 03, 05, 08 (Fibonacci); entries are № 007, 013, 031.
- Each entry ends with a mono "→ Needs:" line listing what it would take to build it.
