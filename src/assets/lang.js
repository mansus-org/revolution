// EN/ES switch, shared by every page. The choice is remembered across pages.
// Pages that render text from script subscribe with Lang.onChange(fn).
window.Lang = (() => {
  const root = document.documentElement;
  const buttons = document.querySelectorAll("[data-set-lang]");
  const listeners = [];
  let current = "en";
  try {
    const saved = localStorage.getItem("revolution-lang");
    if (saved === "en" || saved === "es") current = saved;
  } catch (e) { /* storage blocked: stay in English */ }

  function set(next) {
    current = next;
    root.lang = next;
    root.dataset.lang = next;
    buttons.forEach((b) => b.setAttribute("aria-pressed", b.dataset.setLang === next));
    try { localStorage.setItem("revolution-lang", next); } catch (e) { /* ignore */ }
    listeners.forEach((fn) => fn(next));
  }
  buttons.forEach((b) => b.addEventListener("click", () => set(b.dataset.setLang)));
  set(current);

  return {
    get current() { return current; },
    onChange(fn) { listeners.push(fn); fn(current); },
  };
})();
