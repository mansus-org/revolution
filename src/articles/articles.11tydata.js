import { readFileSync } from "node:fs";

// Defaults for every file in src/articles/.
export default {
  layout: "layouts/article.njk",
  eleventyComputed: {
    // draft: true keeps a file out of the build entirely
    permalink: (data) => (data.draft ? false : `/articles/${data.page.fileSlug}/`),
    eleventyExcludeFromCollections: (data) => !!data.draft,
    // reading_time in front matter wins; otherwise ~200 words a minute
    minutes: (data) => {
      if (data.reading_time) return data.reading_time;
      const raw = readFileSync(data.page.inputPath, "utf8").replace(/^---[\s\S]*?\n---/, "");
      const words = raw.replace(/[#>*_`|:\[\]()!-]/g, " ").split(/\s+/).filter(Boolean).length;
      return Math.max(1, Math.round(words / 200));
    },
  },
};
