// Contents and article pages: the category filter, the fitted title,
// the 1-bit figure and the word count.
(() => {
  const { reduceMotion } = window.Bitmap;
  let lang = window.Lang.current;

  // ---------- "Contents" is set to fill its column ----------
  const title = document.querySelector(".contents-title");
  function fitTitle() {
    if (!title) return;
    const word = title.querySelector(`[lang="${lang}"]`);
    title.style.fontSize = "100px";
    const natural = word.getBoundingClientRect().width;
    title.style.fontSize = (100 * title.clientWidth) / natural + "px";
  }
  window.addEventListener("resize", fitTitle);
  document.fonts && document.fonts.ready.then(fitTitle);

  // ---------- filter: the other entries stay behind as ghosts ----------
  const keys = [...document.querySelectorAll("[data-filter]")];
  const entries = [...document.querySelectorAll(".entry[data-cat]")];
  const list = document.querySelector(".contents");
  const status = document.querySelector(".filter__status");
  const NAMES = {
    ideas: { en: "Ideas", es: "Ideas" },
    architecture: { en: "Architecture", es: "Arquitectura" },
    ideology: { en: "Ideology", es: "Ideología" },
    essays: { en: "Essays", es: "Ensayos" },
    influences: { en: "Influences", es: "Influencias" },
  };
  let filter = "all";

  function writeStatus() {
    if (!status) return;
    const total = entries.length;
    if (filter === "all") {
      status.textContent = lang === "es" ? `Todo: ${total} entradas.` : `Everything: ${total} entries.`;
      return;
    }
    const n = entries.filter((e) => e.dataset.cat === filter).length;
    const name = NAMES[filter][lang];
    if (n === 0) {
      status.textContent = lang === "es"
        ? `${name}: nada todavía. Seguimos discutiendo el primero.`
        : `${name}: nothing yet. We are still arguing about the first one.`;
      return;
    }
    status.textContent = lang === "es" ? `${name}: ${n} de ${total}.` : `${name}: ${n} of ${total}.`;
  }

  function paint() {
    entries.forEach((e) => {
      const off = filter !== "all" && e.dataset.cat !== filter;
      e.classList.toggle("is-ghost", off);
      e.inert = off;
      if (off) e.setAttribute("aria-hidden", "true");
      else e.removeAttribute("aria-hidden");
    });
    keys.forEach((k) => k.setAttribute("aria-pressed", k.dataset.filter === filter));
    writeStatus();
  }

  function choose(next) {
    // pressing the lit key again turns everything back on
    next = next === filter ? "all" : next;
    if (next === filter) return;
    filter = next;
    if (reduceMotion || !list) return paint();
    // full refresh, as on the landing: black for a beat, then the new state
    list.classList.add("flash");
    setTimeout(() => {
      paint();
      list.classList.remove("flash");
    }, 110);
  }
  keys.forEach((k) => k.addEventListener("click", () => choose(k.dataset.filter)));

  // ---------- figure: a placeholder picture, dithered to 1-bit on the page ----------
  // A stamped note lying on a table under a low lamp. Drawn as a brightness
  // field, then thresholded with a 4x4 Bayer matrix into the two inks.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const INK = [0x14, 0x14, 0x14], PAPER = [0xe4, 0xe2, 0xdb];

  function scene(x, y, w, h) {
    // lamp from the upper left
    const k = w / 320; // pixel sizes below are tuned for a 320-cell-wide picture
    const lx = x / w - 0.15, ly = y / h - 0.05;
    let v = 0.92 - Math.hypot(lx, ly * 1.3) * 0.62;
    // the note, turned a few degrees
    const a = -0.07, cx = w * 0.47, cy = h * 0.54;
    const u = (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a);
    const t = (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a);
    const nw = w * 0.36, nh = h * 0.33;
    // shadow under the note
    if (Math.abs(u - 5 * k) < nw && Math.abs(t - 6 * k) < nh) v -= 0.25;
    if (Math.abs(u) < nw && Math.abs(t) < nh) {
      v = 0.86 - Math.hypot(lx, ly) * 0.35;
      // border and the big printed numeral area
      if (Math.abs(u) > nw - 5 * k || Math.abs(t) > nh - 5 * k) v = 0.15;
      else if (Math.abs(u) > nw - 9 * k || Math.abs(t) > nh - 9 * k) v = 0.8;
      // twelve stamp boxes on the right half, eight already stuck down
      const bx = u - nw * 0.08, by = t + nh * 0.72;
      const cw = (nw * 0.82) / 4, ch = (nh * 1.42) / 3;
      const col = Math.floor(bx / cw), row = Math.floor(by / ch);
      if (bx > 0 && col < 4 && by > 0 && row < 3) {
        const fx = bx - col * cw, fy = by - row * ch;
        const edge = fx < 2 * k || fy < 2 * k || fx > cw - 3 * k || fy > ch - 3 * k;
        const stamped = row * 4 + col < 8;
        if (edge) v = 0.1;
        else if (stamped) v = 0.42 + 0.18 * Math.sin(fx * 0.9 / k) * Math.sin(fy * 0.7 / k);
      }
      // a large printed figure on the left half
      const gx = u + nw * 0.62, gy = t;
      if (Math.abs(gx) < nw * 0.22 && Math.abs(gy) < nh * 0.55) {
        const ring = Math.abs(Math.hypot(gx / (nw * 0.2), gy / (nh * 0.5)) - 0.75);
        if (ring < 0.16) v = 0.12;
      }
    }
    return Math.max(0, Math.min(1, v));
  }

  // One dither cell is a whole number of CSS pixels (3, or 2 on phones), so the pattern never
  // gets resampled into uneven blocks.
  const cellFor = (cv) => (cv.parentElement.clientWidth < 600 ? 2 : 3);
  function dither(cv) {
    const w = Math.max(80, Math.floor(cv.parentElement.clientWidth / cellFor(cv)));
    const h = Math.round((w * 9) / 16);
    if (cv.width === w && cv.height === h && cv.dataset.done) return;
    cv.width = w;
    cv.height = h;
    cv.dataset.done = "1";
    cv.style.width = w * cellFor(cv) + "px";
    const ctx = cv.getContext("2d");
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const threshold = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
        const c = scene(x, y, w, h) > threshold ? PAPER : INK;
        const i = (y * w + x) * 4;
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const canvases = document.querySelectorAll("canvas[data-dither]");
  canvases.forEach(dither);
  window.addEventListener("resize", () => canvases.forEach(dither));

  // ---------- word count, measured rather than typed ----------
  const prose = document.querySelector(".prose");
  const countHost = document.querySelector("[data-wordcount]");
  function writeCount() {
    if (!prose || !countHost) return;
    const words = prose.textContent.trim().split(/\s+/).length;
    const rounded = Math.round(words / 10) * 10;
    const min = Math.max(1, Math.round(words / 200));
    countHost.textContent = lang === "es"
      ? `${rounded.toLocaleString("es")} palabras, ${min} min`
      : `${rounded.toLocaleString("en")} words, ${min} min`;
  }

  window.Lang.onChange((next) => {
    lang = next;
    fitTitle();
    writeStatus();
    writeCount();
  });
  paint();
})();
