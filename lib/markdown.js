// markdown-it additions that turn plain markdown into the article design's markup.
//
//   ## Heading            numbered automatically: <span class="h-num">2</span><span class="h-text">…
//   [^1]                  reference to margin note 1
//   ::: note 1            margin note 1 (left of the text on wide screens)
//   ::: pull              pull quote, the inked cut-out
//   ::: figure Fig. 1     figure: an optional ![alt](src) line, then the caption.
//                         Images are dithered to 1-bit by articles.js; with no image
//                         the page draws its placeholder picture.
//                         `![alt](src){colour}` keeps the picture as it is, undithered.
//                         `![alt](src){colour wide}` is the same at the full column
//                         width, linked to the file: for diagrams with small text.
//   ::: gallery Fig. 2    a row of undithered pictures (phone screenshots): several
//                         ![label](src) lines, then the caption. Scrolls sideways on phones.
//   ```ledger rule        fenced code; the info string becomes the label strip
//   > -- Someone, Book    a blockquote paragraph starting with "-- " is the attribution

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function boxes(md) {
  md.block.ruler.before(
    "fence",
    "mansus_box",
    (state, startLine, endLine, silent) => {
      const first = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine]);
      const m = first.match(/^:::\s*(note|pull|figure|gallery)\b\s*(.*)$/);
      if (!m) return false;
      if (silent) return true;
      const body = [];
      let line = startLine + 1;
      for (; line < endLine; line++) {
        const text = state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
        if (text.trim() === ":::") break;
        body.push(text);
      }
      const token = state.push("mansus_box", "", 0);
      token.info = m[1];
      token.meta = { params: m[2].trim(), body: body.join("\n").trim() };
      token.block = true;
      token.map = [startLine, line + 1];
      state.line = line + 1;
      return true;
    },
    { alt: ["paragraph", "reference", "blockquote", "list"] }
  );

  md.renderer.rules.mansus_box = (tokens, idx, options, env) => {
    const { info, meta } = tokens[idx];
    if (info === "note") {
      const n = esc(meta.params || "*");
      return `<aside class="note" id="note-${n}"><span class="n">${n}</span>${md.renderInline(meta.body, env)}</aside>\n`;
    }
    if (info === "pull") {
      return `<blockquote class="pull">\n${md.render(meta.body, env)}</blockquote>\n`;
    }
    if (info === "gallery") {
      const lines = meta.body.split("\n");
      const shots = lines.map((l) => l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/)).filter(Boolean);
      const caption = lines.filter((l) => !/^!\[/.test(l)).join(" ").trim();
      const label = meta.params ? `<b>${md.renderInline(meta.params, env)}</b>` : "";
      const items = shots
        .map((m) => `<li><img src="${esc(m[2])}" alt="${esc(m[1])}"><span>${esc(m[1])}</span></li>`)
        .join("\n          ");
      return `<figure class="figure figure--gallery">
      <div class="figure__frame">
        <ul class="gallery">
          ${items}
        </ul>
      </div>
      <figcaption>${label}${md.renderInline(caption, env)}</figcaption>
    </figure>\n`;
    }
    // figure
    const lines = meta.body.split("\n");
    const img = lines[0] && lines[0].match(/^!\[([^\]]*)\]\(([^)\s]+)\)(\{colour( wide)?\})?\s*$/);
    const caption = (img ? lines.slice(1) : lines).join(" ").trim();
    const label = meta.params ? `<b>${md.renderInline(meta.params, env)}</b>` : "";
    const wide = img && img[4];
    const tag = img && `<img src="${esc(img[2])}" alt="${esc(img[1])}"${img[3] ? "" : " data-dither"}>`;
    const picture = img
      ? wide ? `<a href="${esc(img[2])}">${tag}</a>` : tag
      : `<canvas data-dither width="400" height="225" role="img" aria-label="${esc(caption.replace(/[*_`]/g, ""))}"></canvas>\n        <span class="placeholder-tag">[IMAGE] placeholder</span>`;
    return `<figure class="figure${wide ? " figure--wide" : ""}">
      <div class="figure__frame">
        ${picture}
      </div>
      <figcaption>${label}${md.renderInline(caption, env)}</figcaption>
    </figure>\n`;
  };
}

// [^1] becomes a superscript link to note 1.
function noteRefs(md) {
  md.inline.ruler.before("link", "mansus_noteref", (state, silent) => {
    const m = state.src.slice(state.pos).match(/^\[\^([\w-]+)\](?!:)/);
    if (!m) return false;
    if (!silent) {
      const n = esc(m[1]);
      const t = state.push("html_inline", "", 0);
      t.content = `<sup><a href="#note-${n}" id="ref-${n}" aria-label="Note ${n}">${n}</a></sup>`;
    }
    state.pos += m[0].length;
    return true;
  });
}

// Every h2 carries its number in the margin.
function headings(md) {
  const count = (tokens, idx) =>
    tokens.slice(0, idx + 1).filter((t) => t.type === "heading_open" && t.tag === "h2").length;
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    if (tokens[idx].tag !== "h2") return self.renderToken(tokens, idx, options);
    return `<h2><span class="h-num">${count(tokens, idx)}</span><span class="h-text">`;
  };
  md.renderer.rules.heading_close = (tokens, idx, options, env, self) => {
    if (tokens[idx].tag !== "h2") return self.renderToken(tokens, idx, options);
    return `</span></h2>\n`;
  };
}

// Fenced code: the info string is a label, not a language.
function fences(md) {
  md.renderer.rules.fence = (tokens, idx) => {
    const { info, content } = tokens[idx];
    const label = info.trim() ? `<span class="label">${esc(info.trim())}</span>` : "";
    return `<pre>${label}<code>${esc(content.replace(/\n$/, ""))}</code></pre>\n`;
  };
}

// Tables scroll inside their own box on phones.
function tables(md) {
  md.renderer.rules.table_open = () => `<div class="table-wrap">\n<table>\n`;
  md.renderer.rules.table_close = () => `</table>\n</div>\n`;
}

// In a blockquote, a paragraph that starts with "-- " is the attribution.
function attributions(md) {
  md.core.ruler.push("mansus_attribution", (state) => {
    let depth = 0;
    const t = state.tokens;
    for (let i = 0; i < t.length; i++) {
      if (t[i].type === "blockquote_open") depth++;
      if (t[i].type === "blockquote_close") depth--;
      if (depth > 0 && t[i].type === "paragraph_open" && t[i + 1] && t[i + 1].type === "inline") {
        const inline = t[i + 1];
        if (!inline.content.startsWith("-- ")) continue;
        t[i].tag = "footer";
        t[i + 2].tag = "footer";
        const firstText = inline.children.find((c) => c.type === "text");
        if (firstText) firstText.content = firstText.content.replace(/^-- /, "");
      }
    }
  });
}

export default function mansusMarkdown(md) {
  md.set({ html: true, typographer: false });
  md.use(boxes).use(noteRefs).use(headings).use(fences).use(tables).use(attributions);
}
