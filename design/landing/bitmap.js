(() => {
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

  // Title bitmaps: (Я) over a ghost of (R), and the reverse at the end.
  const YA = mirror(R);
  const front = compose([{ rows: OPEN, gap: 1 }, { rows: YA, gap: 1 }, { rows: CLOSE }]);
  const frontGhost = compose([{ rows: OPEN, gap: 1 }, { rows: R, gap: 1 }, { rows: CLOSE }]);
  const fHost = document.querySelector('[data-bitmap="front"]');
  const bHost = document.querySelector('[data-bitmap="back"]');
  if (fHost) drawBitmap(fHost, front, frontGhost, { sweep: true });
  if (bHost) drawBitmap(bHost, frontGhost, front);

  document.querySelectorAll("[data-glyph]").forEach((g) => {
    drawBitmap(g, GLYPHS[g.dataset.glyph], null, { sub: 0.5 });
  });

  // Language
  const root = document.documentElement;
  const langButtons = document.querySelectorAll("[data-set-lang]");
  let lang = "en";
  try {
    const saved = localStorage.getItem("revolution-lang");
    if (saved === "en" || saved === "es") lang = saved;
  } catch (e) { /* storage blocked: stay in English */ }

  // Index
  const data = JSON.parse(document.getElementById("catalogue").textContent);
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panel = document.getElementById("panel");
  const nameEl = panel.querySelector(".cat-name");
  const list = panel.querySelector(".entries");
  const inkHost = panel.querySelector(".sigil__ink");
  const ghostHost = panel.querySelector(".sigil__ghost");
  const EMPTY = {
    en: "Nothing here yet. We are still arguing about the first one.",
    es: "Aquí no hay nada todavía. Seguimos discutiendo el primero.",
  };
  const SAMPLE = { en: "Sample entries, not published yet.", es: "Entradas de ejemplo, aún sin publicar." };
  let current = "ideas";
  // The dial is a loop, so the first page still carries a ghost of the last one.
  let previous = "influences";

  function renderPanel() {
    const cat = data[current];
    nameEl.textContent = cat.name[lang];
    list.replaceChildren();
    if (cat.entries.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = EMPTY[lang];
      list.append(li);
    } else {
      cat.entries.forEach((e) => {
        const li = document.createElement("li");
        li.textContent = e[lang];
        list.append(li);
      });
      const note = document.createElement("li");
      note.className = "sample";
      note.textContent = SAMPLE[lang];
      list.append(note);
    }
    fitName();
    drawBitmap(inkHost, GLYPHS[current], null, { sub: 1 / 4 });
    if (previous && previous !== current) {
      const blank = GLYPHS[previous].map((r) => ".".repeat(r.length));
      drawBitmap(ghostHost, blank, GLYPHS[previous], { sub: 1 / 4 });
    } else {
      ghostHost.replaceChildren();
    }
  }

  // The category name is set to fill its column, capped by the size of the sign.
  function fitName() {
    nameEl.style.fontSize = "100px";
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    const natural = range.getBoundingClientRect().width;
    const room = nameEl.clientWidth;
    const cap = panel.querySelector(".sigil").clientHeight * 0.75;
    nameEl.style.fontSize = Math.min(cap, (100 * room) / natural) + "px";
  }
  window.addEventListener("resize", fitName);
  document.fonts && document.fonts.ready.then(fitName);

  // Full-panel flash before the new page settles, like an e-ink full refresh.
  function select(cat, focus) {
    if (cat === current) return;
    previous = current;
    current = cat;
    tabs.forEach((t) => {
      const on = t.dataset.cat === cat;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panel.setAttribute("aria-labelledby", `tab-${cat}`);
    if (reduceMotion) return renderPanel();
    panel.classList.add("flash");
    setTimeout(() => {
      renderPanel();
      panel.classList.remove("flash");
    }, 110);
  }

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t.dataset.cat, false));
    t.addEventListener("keydown", (ev) => {
      let j = null;
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") j = (i + 1) % tabs.length;
      if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") j = (i - 1 + tabs.length) % tabs.length;
      if (ev.key === "Home") j = 0;
      if (ev.key === "End") j = tabs.length - 1;
      if (j !== null) {
        ev.preventDefault();
        select(tabs[j].dataset.cat, true);
      }
    });
  });

  function setLang(next) {
    lang = next;
    root.lang = next;
    root.dataset.lang = next;
    langButtons.forEach((b) => b.setAttribute("aria-pressed", b.dataset.setLang === next));
    try { localStorage.setItem("revolution-lang", next); } catch (e) { /* ignore */ }
    renderPanel();
  }
  langButtons.forEach((b) => b.addEventListener("click", () => setLang(b.dataset.setLang)));

  panel.setAttribute("aria-labelledby", `tab-${current}`);
  setLang(lang);
})();
