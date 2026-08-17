const markdownIt = require("markdown-it");
const { eleventyImageTransformPlugin } = require("@11ty/eleventy-img");
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
  return `<figure class="shot"><img src="${esc(src)}" alt="${esc(alt)}" sizes="(max-width: 780px) 92vw, 660px" loading="lazy"></figure>`;
};

/* Photos written into a post body:  ![alt](/photos/x.jpg "one line")
   The alt is what a screen reader says; the optional title is the line that
   shows in the gallery. It stays out of the essay itself on purpose.      */
function parsePhotos(markdown) {
  const found = [];
  const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
  let match;
  while ((match = pattern.exec(markdown || ""))) {
    found.push({ alt: match[1], src: match[2], caption: match[3] || "" });
  }
  return found;
}

/* "Mar 2025 · Origin" -> "Origin". This is the word on the gallery's filter
   buttons, so keep the part after the dot short when writing a post.      */
function shortLabel(data) {
  const meta = (data.meta_en || "").split("·").pop().trim();
  return meta || (data.title_en || "").split(/[,—]/)[0].trim();
}

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

  /* The photographs come off a phone at 1200–1600px. The gallery shows them
     about 316px wide, so sending the originals meant 7.7MB for one page and
     several seconds of blank screen. Every <img> in the built pages is
     rewritten here into a set of sizes the browser can choose from.        */
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    extensions: "html",
    // avif files come out about half the size of webp, but take roughly
    // thirty times as long to make — four minutes between pressing save and
    // seeing the change, against a couple of hundred kilobytes a reader will
    // never notice. Worth turning back on once posts stop needing edits.
    formats: ["webp", "jpeg"],
    widths: [400, 800, 1400, "auto"],
    defaultAttributes: { loading: "lazy", decoding: "async" },
    sharpJpegOptions: { quality: 82, mozjpeg: true },
    urlPath: "/img/",
    outputDir: "./_site/img/"
  });

  eleventyConfig.addPassthroughCopy({ "src/photos": "photos" });
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


  /* Every photo on the site belongs to a post: either it sits in the body, or
     it is one of the extras that did not fit. The gallery is all of them,
     newest post first, each still knowing where it came from.               */
  eleventyConfig.addCollection("galleryPhotos", (api) => {
    const posts = api
      .getFilteredByGlob("src/posts/*.md")
      .sort((a, b) => b.date - a.date);

    const out = [];
    for (const post of posts) {
      const d = post.data;
      const url = (post.url || "").replace(/\.html$/, "");
      const label = shortLabel(d);
      const en = parsePhotos(d.body_en);
      const ko = parsePhotos(d.body_ko);

      en.forEach((photo, i) => {
        const twin = ko[i] && ko[i].src === photo.src ? ko[i] : ko.find((k) => k.src === photo.src);
        out.push({
          image: photo.src,
          alt: photo.alt,
          caption_en: photo.caption,
          caption_ko: twin ? twin.caption : "",
          postUrl: url,
          postTitle: d.title_en,
          label
        });
      });

      for (const extra of d.extras || []) {
        if (!extra || !extra.image) continue;
        out.push({
          image: extra.image,
          alt: extra.alt || "",
          caption_en: extra.caption_en || "",
          caption_ko: extra.caption_ko || "",
          postUrl: url,
          postTitle: d.title_en,
          label
        });
      }
    }
    return out;
  });

  // The distinct filter buttons across the top of the gallery.
  eleventyConfig.addCollection("galleryLabels", (api) => {
    const seen = [];
    for (const post of api
      .getFilteredByGlob("src/posts/*.md")
      .sort((a, b) => b.date - a.date)) {
      const label = shortLabel(post.data);
      if (label && !seen.includes(label)) seen.push(label);
    }
    return seen;
  });

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
