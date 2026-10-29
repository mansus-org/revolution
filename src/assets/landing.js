// The landing's one control: five keys, one panel.
(() => {
  const { GLYPHS, reduceMotion, drawBitmap, blank } = window.Bitmap;

  const data = JSON.parse(document.getElementById("catalogue").textContent);
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panel = document.getElementById("panel");
  const nameEl = panel.querySelector(".cat-name");
  const descEl = panel.querySelector(".cat-desc");
  const list = panel.querySelector(".entries");
  const inkHost = panel.querySelector(".sigil__ink");
  const ghostHost = panel.querySelector(".sigil__ghost");
  const EMPTY = {
    en: "Nothing here yet. We are still arguing about the first one.",
    es: "Aquí no hay nada todavía. Seguimos discutiendo el primero.",
  };
  const SAMPLE = { en: "Sample entries, not published yet.", es: "Entradas de ejemplo, aún sin publicar." };
  let lang = "en";
  let current = "ideas";
  // The dial is a loop, so the first page still carries a ghost of the last one.
  let previous = "influences";

  function renderPanel() {
    const cat = data[current];
    nameEl.textContent = cat.name[lang];
    descEl.textContent = cat.desc[lang];
    list.replaceChildren();
    if (cat.entries.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = EMPTY[lang];
      list.append(li);
    } else {
      cat.entries.forEach((e) => {
        const li = document.createElement("li");
        if (e.url) {
          const a = document.createElement("a");
          a.href = e.url;
          a.textContent = e[lang];
          li.append(a);
        } else {
          li.textContent = e[lang];
        }
        list.append(li);
      });
      if (cat.entries.some((e) => e.sample)) {
        const note = document.createElement("li");
        note.className = "sample";
        note.textContent = SAMPLE[lang];
        list.append(note);
      }
    }
    fitName();
    drawBitmap(inkHost, GLYPHS[current], null, { sub: 1 / 4 });
    if (previous && previous !== current) {
      drawBitmap(ghostHost, blank(GLYPHS[previous]), GLYPHS[previous], { sub: 1 / 4 });
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

  panel.setAttribute("aria-labelledby", `tab-${current}`);
  window.Lang.onChange((next) => {
    lang = next;
    renderPanel();
  });
})();
