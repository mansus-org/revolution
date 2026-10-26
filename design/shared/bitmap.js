// 1-bit drawing shared by every page: the R, the Я, the five category signs,
// and the dither that stands in for grey. Exposed as window.Bitmap.
window.Bitmap = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Letterforms, drawn cell by cell. "#" is ink.
  const R = [
    "######..",
    "##...##.",
    "##....##",
    "##....##",
    "##...##.",
    "######..",
    "##.##...",
    "##..##..",
    "##..##..",
    "##...##.",
    "##...##.",
    "##....##",
    "##....##",
  ];
  const OPEN = [
    "..##", ".##.", ".##.", "##..", "##..", "##..", "##..", "##..",
    "##..", "##..", "##..", "##..", ".##.", ".##.", "..##",
  ];

  // The category notation. Every sign is built from parts of the R:
  // its bowl, its stem, its leg, or the stroke of a line of text.
  const GLYPHS = {
    // the bowl on its own, before it has a stem
    ideas: [
      "#####..",
      ".....#.",
      ".....##",
      ".....##",
      ".....#.",
      "#####..",
      ".......",
    ],
    // the stem carrying floors
    architecture: [
      "##.....",
      "#######",
      "##.....",
      "#######",
      "##.....",
      "#######",
      "##.....",
    ],
    // the stem and the leg, the part that pushes
    ideology: [
      "##.....",
      "##.....",
      "##.....",
      "####...",
      "##.##..",
      "##..##.",
      "##...##",
    ],
    // lines of text, read downwards
    essays: [
      "#.#.#.#",
      "#.#.#.#",
      "#.#.#..",
      "#.#.#..",
      "#...#..",
      "#......",
      "#......",
    ],
    // rings spreading out from one corner
    influences: [
      "#.#.#..",
      "..#.#..",
      "###.#..",
      "....#..",
      "#####..",
      ".......",
      ".......",
    ],
  };

  const mirror = (rows) => rows.map((r) => [...r].reverse().join(""));
  const CLOSE = mirror(OPEN);
  const YA = mirror(R);

  // Place letters side by side on one grid, letters shorter than the
  // parentheses sit one row down.
  function compose(parts) {
    const h = Math.max(...parts.map((p) => p.rows.length));
    const lines = Array.from({ length: h }, () => "");
    parts.forEach(({ rows, gap = 0 }) => {
      const w = rows[0].length;
      const top = Math.floor((h - rows.length) / 2);
      for (let y = 0; y < h; y++) {
        const r = rows[y - top];
        lines[y] += (r !== undefined ? r : ".".repeat(w)) + ".".repeat(gap);
      }
    });
    return lines;
  }

  function cellsToPath(rows) {
    let d = "";
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === "#") d += `M${x} ${y}h1v1h-1z`;
      }
    });
    return d;
  }

  let uid = 0;
  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // Ordered dither, emitted as real squares on a sub-grid (no SVG patterns,
  // so there are no tiling seams). "half" is a checkerboard, "ghost" 1 in 4.
  function ditherPath(rows, sub, mode) {
    const n = Math.round(1 / sub);
    let d = "";
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== "#") continue;
        for (let i = 0; i < n; i++) {
          for (let k = 0; k < n; k++) {
            const gx = x * n + k, gy = y * n + i;
            const on = mode === "ghost" ? gx % 2 === 0 && gy % 2 === 0 : (gx + gy) % 2 === 0;
            if (on) d += `M${gx * sub} ${gy * sub}h${sub}v${sub}h-${sub}z`;
          }
        }
      }
    });
    return d;
  }

  function makeSvg(w, h) {
    return el("svg", {
      viewBox: `0 0 ${w} ${h}`,
      "shape-rendering": "crispEdges",
      focusable: "false",
      "aria-hidden": "true",
    });
  }

  // Draws ink over a ghost. With `sweep`, the ink arrives row by row, the
  // way an e-ink panel repaints: half-tone first, then solid.
  function drawBitmap(host, ink, ghost, { sweep = false, sub = 0.25 } = {}) {
    const w = ink[0].length;
    const h = ink.length;
    const svg = makeSvg(w, h);
    const id = ++uid;
    svg.append(el("defs", {}));
    if (ghost) svg.append(el("path", { d: ditherPath(ghost, sub, "ghost"), fill: "currentColor" }));

    const inkPath = cellsToPath(ink);
    if (sweep && !reduceMotion) {
      const clip = el("clipPath", { id: `sweep${id}` });
      const bar = el("rect", { x: 0, y: 0, width: w, height: 0 });
      clip.append(bar);
      svg.querySelector("defs").append(clip);
      svg.append(el("path", { d: ditherPath(ink, sub, "half"), fill: "currentColor" }));
      svg.append(el("path", { d: inkPath, fill: "currentColor", "clip-path": `url(#sweep${id})` }));
      let row = 0;
      const tick = () => {
        row += 1;
        bar.setAttribute("height", row);
        if (row < h) setTimeout(tick, 55);
      };
      setTimeout(tick, 250);
    } else {
      svg.append(el("path", { d: inkPath, fill: "currentColor" }));
    }
    host.replaceChildren(svg);
  }

  const blank = (rows) => rows.map((r) => ".".repeat(r.length));

  // Title bitmaps: (Я) over a ghost of (R), and the reverse.
  const TITLES = {
    front: [compose([{ rows: OPEN, gap: 1 }, { rows: YA, gap: 1 }, { rows: CLOSE }]),
            compose([{ rows: OPEN, gap: 1 }, { rows: R, gap: 1 }, { rows: CLOSE }])],
  };
  TITLES.back = [TITLES.front[1], TITLES.front[0]];

  // Any page can ask for a bitmap with markup alone:
  //   data-bitmap="front|back"  the title, (Я) or (R) with its ghost
  //   data-sweep                paint it in row by row
  //   data-glyph="ideas"        a category sign, crisp
  //   data-misprint             the sign doubled by a dithered, offset copy
  document.querySelectorAll("[data-bitmap]").forEach((host) => {
    const [ink, ghost] = TITLES[host.dataset.bitmap];
    drawBitmap(host, ink, ghost, { sweep: host.hasAttribute("data-sweep") });
  });

  document.querySelectorAll("[data-glyph]").forEach((g) => {
    const rows = GLYPHS[g.dataset.glyph];
    if (!g.hasAttribute("data-misprint")) {
      drawBitmap(g, rows, null, { sub: 0.5 });
      return;
    }
    const ghost = document.createElement("span");
    const ink = document.createElement("span");
    ghost.className = "misprint__ghost";
    ink.className = "misprint__ink";
    drawBitmap(ghost, blank(rows), rows, { sub: 0.25 });
    drawBitmap(ink, rows, null, { sub: 0.5 });
    g.replaceChildren(ghost, ink);
  });

  return { GLYPHS, reduceMotion, drawBitmap, blank };
})();
