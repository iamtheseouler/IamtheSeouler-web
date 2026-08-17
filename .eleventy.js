const markdownIt = require("markdown-it");
const { imageSize } = require("image-size");
const fs = require("fs");
const path = require("path");

/* Photos are written into the page with their real pixel size so the browser
   can hold the space open before the file arrives — otherwise the page jumps
   around as each one loads. Measured once per build and remembered.        */
const sizeCache = new Map();
function sizeAttrs(src) {
  if (!src || !src.startsWith("/")) return "";
  if (sizeCache.has(src)) return sizeCache.get(src);
  let attrs = "";
  try {
    const { width, height } = imageSize(
      fs.readFileSync(path.join(__dirname, src.slice(1)))
    );
    if (width && height) attrs = ` width="${width}" height="${height}"`;
  } catch (error) {
    // A photo that is not on disk yet simply goes out without a size.
  }
  sizeCache.set(src, attrs);
  return attrs;
}

/* ------------------------------------------------------------------
   The Seouler — Eleventy config

   Posts are written as markdown with two bodies (EN / KO). This file
   turns that markdown into exactly the HTML the hand-built pages used:

     ![alt](/photos/x.jpg)   ->  <figure class="shot"><img ...></figure>
     ### 1. Section title    ->  <h3><span class="num">1.</span>Title</h3>

   Keep these two rules in sync with src/css/site.css.
------------------------------------------------------------------- */

const md = markdownIt({
  html: true,        // allow inline <br>, <em> etc. inside paragraphs
  breaks: false,
  linkify: false,
  typographer: false // never rewrite the author's punctuation
});

// Images become <figure class="shot"> instead of an inline <img>.
md.renderer.rules.image = function (tokens, idx) {
  const token = tokens[idx];
  const src = token.attrGet("src") || "";
  const alt = token.content || "";
  const esc = md.utils.escapeHtml;
  return `<figure class="shot"><img src="${esc(src)}" alt="${esc(alt)}"${sizeAttrs(src)} loading="lazy"></figure>`;
};

// A paragraph that holds nothing but one image should not be wrapped in <p>.
function isLoneImage(tokens, idx) {
  const inline = tokens[idx + 1];
  if (!inline || inline.type !== "inline") return false;
  const kids = inline.children || [];
  return kids.length === 1 && kids[0].type === "image";
}
md.renderer.rules.paragraph_open = (tokens, idx, opts, env, self) =>
  isLoneImage(tokens, idx) ? "" : self.renderToken(tokens, idx, opts);
md.renderer.rules.paragraph_close = (tokens, idx, opts, env, self) =>
  tokens[idx - 2] && isLoneImage(tokens, idx - 2) ? "" : self.renderToken(tokens, idx, opts);

module.exports = function (eleventyConfig) {
  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addPassthroughCopy({ photos: "photos" });
  eleventyConfig.addPassthroughCopy({ "src/css": "css" });

  // /admin is the CMS. It is copied through untouched — Eleventy must not try
  // to read the curly braces in its config as template syntax.
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  eleventyConfig.ignores.add("src/admin/**");

  /* Render a post body.
     lang === "ko" adds the .kr class the Korean panel needs.       */
  eleventyConfig.addFilter("storyBody", function (markdown, lang) {
    if (!markdown) return "";
    let html = md.render(markdown);
    const krClass = lang === "ko" ? ' class="kr"' : "";
    html = html.replace(
      /<h3>\s*(\d+\.)\s*/g,
      `<h3${krClass}><span class="num">$1</span>`
    );
    if (lang === "ko") html = html.replace(/<h3>(?!<span)/g, '<h3 class="kr">');
    return html;
  });

  // Newest first, by the `date` field in each post's front matter.
  eleventyConfig.addCollection("journal", (api) =>
    api.getFilteredByGlob("src/posts/*.md").sort((a, b) => b.date - a.date)
  );

  /* Which post gets the big slot on the home page: whichever is flagged
     `card.feature`, otherwise simply the newest.                        */
  eleventyConfig.addFilter("featured", (posts) =>
    posts.find((p) => p.data.card && p.data.card.feature) || posts[0]
  );
  eleventyConfig.addFilter("except", (posts, post) =>
    posts.filter((p) => !post || p.url !== post.url)
  );

  // Strip the .html so links stay on the clean URLs Vercel already serves.
  eleventyConfig.addFilter("clean", (url) => (url || "").replace(/\.html$/, ""));

  // ` width="…" height="…"` for a photo, or nothing if it cannot be measured.
  eleventyConfig.addFilter("size", sizeAttrs);

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"]
  };
};
