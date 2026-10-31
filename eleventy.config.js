import { HtmlBasePlugin } from "@11ty/eleventy";
import mansusMarkdown from "./lib/markdown.js";

export default function (eleventyConfig) {
  // Links are written root-relative ("/articles/") and rewritten for the
  // GitHub Pages project path by the base plugin.
  eleventyConfig.addPlugin(HtmlBasePlugin);

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Article images: src/articles/images/x.png is linked as /articles/images/x.png
  eleventyConfig.addPassthroughCopy("src/articles/images");
  eleventyConfig.amendLibrary("md", (md) => md.use(mansusMarkdown));

  // Published articles, newest first (date, then issue number).
  eleventyConfig.addCollection("articles", (api) =>
    api
      .getFilteredByGlob("src/articles/*.md")
      .filter((item) => !item.data.draft)
      .sort((a, b) => b.date - a.date || (b.data.number || 0) - (a.data.number || 0))
  );

  // The cut-out on the contents page: the entry marked `lead: true`, else the newest.
  eleventyConfig.addFilter("leadFirst", (items) => {
    const lead = items.find((i) => i.data.lead) || items[0];
    return lead ? [lead, ...items.filter((i) => i !== lead)] : [];
  });

  eleventyConfig.addFilter("pad2", (n) => String(n ?? "").padStart(2, "0"));
  eleventyConfig.addFilter("isoDate", (d) => d.toISOString().slice(0, 10));
  eleventyConfig.addFilter("dotDate", (d) =>
    [d.getUTCDate(), d.getUTCMonth() + 1].map((x) => String(x).padStart(2, "0")).join(".") + "." + d.getUTCFullYear()
  );
  eleventyConfig.addFilter("category", (key, categories) => categories.find((c) => c.key === key));
  eleventyConfig.addFilter("anySample", (items) => items.some((i) => i.data.sample));

  // The landing panel is filled by landing.js from this JSON.
  eleventyConfig.addFilter("catalogue", function (items, categories) {
    const url = eleventyConfig.getFilter("url");
    const out = {};
    for (const c of categories) {
      out[c.key] = {
        name: { en: c.en, es: c.es },
        desc: { en: c.desc_en, es: c.desc_es },
        entries: items
          .filter((i) => i.data.category === c.key)
          .map((i) => ({
            en: i.data.title,
            es: i.data.title_es || i.data.title,
            url: url(i.url),
            sample: !!i.data.sample,
          })),
      };
    }
    return JSON.stringify(out, null, 2).replace(/</g, "\\u003c");
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: false, // article bodies are plain markdown; braces in code stay literal
    htmlTemplateEngine: "njk",
    pathPrefix: process.env.PATH_PREFIX || "/revolution/",
  };
}
