/* Build a 1200×630 share card for a post.
 *
 * What a link looks like when it is pasted into KakaoTalk or a message: the
 * post's cover photograph, darkened at the foot, with the date, the title and
 * the mark laid over it. Made at build time so writing a new post never means
 * opening an image editor.
 *
 * The five cards that already exist were composed by hand in a browser. This
 * only runs for a post that has no card of its own, so those stay as they are.
 *
 * Fonts are the reason this is more than a crop: a build machine has no
 * Fraunces, so the two files this needs live in src/fonts and are handed to
 * sharp directly.
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const W = 1200;
const H = 630;
const ROOT = path.join(__dirname, "..");
const FONTS = path.join(ROOT, "src", "fonts");
const FRAUNCES = path.join(FONTS, "Fraunces_400Regular.ttf");
const MONO = path.join(FONTS, "JetBrainsMono_400Regular.ttf");

const PAPER = "#FBFAF6";
const esc = (s) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Pango lays out one line at a time and gives back a transparent image the
   size of the text. Composing them by hand keeps control of where each sits. */
async function line(text, { font, fontfile, size, colour, spacing = 0, italic = false, width }) {
  const style = italic ? ' style="italic"' : "";
  const letter = spacing ? ` letter_spacing="${Math.round(spacing * 1024)}"` : "";
  const markup = `<span foreground="${colour}"${style}${letter}>${esc(text)}</span>`;
  return sharp({
    text: {
      text: markup,
      // Both are needed: the file puts the font within reach, the name picks
      // it. Give only the file and Pango quietly falls back to whatever the
      // machine has, which is how this first came out in the wrong typeface.
      font,
      fontfile,
      rgba: true,
      dpi: Math.round(size * 72 / 16), // sharp sizes text by dpi; 16px is its base
      width: width || W - 128,
      align: "left"
    }
  })
    .png()
    .toBuffer();
}

/* Two lines at most: a long title wrapped by hand at a sensible word so the
   break does not land somewhere that reads badly. */
function wrap(title, limit = 34) {
  if (title.length <= limit) return [title];
  const words = title.split(" ");
  let first = "";
  for (const w of words) {
    if ((first + " " + w).trim().length > limit) break;
    first = (first + " " + w).trim();
  }
  const rest = title.slice(first.length).trim();
  return rest ? [first, rest] : [first];
}

async function buildCard({ photo, meta, title, out }) {
  const base = await sharp(photo)
    .rotate()
    .resize(W, H, { fit: "cover", position: "attention" })
    .toBuffer();

  // A dark wash rising from the foot, so light text stays readable whatever
  // the photograph happens to be doing down there.
  const wash = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
       <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
         <stop offset="38%" stop-color="#2B2E2C" stop-opacity="0"/>
         <stop offset="62%" stop-color="#2B2E2C" stop-opacity="0.34"/>
         <stop offset="100%" stop-color="#2B2E2C" stop-opacity="0.88"/>
       </linearGradient></defs>
       <rect width="${W}" height="${H}" fill="url(#g)"/>
     </svg>`
  );

  const lines = wrap(title);
  const mark = await line("I am the Seouler", { font: "Fraunces", fontfile: FRAUNCES, size: 22, colour: PAPER });
  const kicker = await line((meta || "").toUpperCase(), {
    font: "JetBrains Mono", fontfile: MONO, size: 14, colour: "#C8CFC9", spacing: 3.6
  });
  const titles = [];
  for (const t of lines) {
    titles.push(await line(t, { font: "Fraunces", fontfile: FRAUNCES, size: 48, colour: PAPER }));
  }

  /* The mark sits on whatever the top of the photograph happens to be — pale
     sky, a white wall — so it gets its own small shadow to lean on. Without
     this it disappears on bright pictures, which is exactly what happened the
     first time. */
  const halo = Buffer.from(
    `<svg width="${W}" height="200" xmlns="http://www.w3.org/2000/svg">
       <defs><linearGradient id="h" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0%" stop-color="#2B2E2C" stop-opacity="0.42"/>
         <stop offset="100%" stop-color="#2B2E2C" stop-opacity="0"/>
       </linearGradient></defs>
       <rect width="${W}" height="200" fill="url(#h)"/>
     </svg>`
  );

  const layers = [
    { input: wash, top: 0, left: 0 },
    { input: halo, top: 0, left: 0 },
    { input: mark, top: 44, left: 64 }
  ];

  // Stack from the bottom up so the block always sits the same distance from
  // the foot whether the title took one line or two.
  let y = H - 52;
  for (let i = titles.length - 1; i >= 0; i--) {
    const m = await sharp(titles[i]).metadata();
    y -= m.height;
    layers.push({ input: titles[i], top: y, left: 64 });
  }
  const km = await sharp(kicker).metadata();
  layers.push({ input: kicker, top: y - km.height - 14, left: 64 });

  await sharp(base)
    .composite(layers)
    .jpeg({ quality: 86, progressive: true, mozjpeg: true })
    .toFile(out);
}

/* Called once per build. Only writes cards that are not already there, so a
   hand-made one is never overwritten. */
async function ensureCards(posts, { ogDir, photoDir, force = false } = {}) {
  fs.mkdirSync(ogDir, { recursive: true });
  const made = [];
  for (const post of posts) {
    const slug = (post.url || "").replace(/^\/|\.html$/g, "");
    if (!slug) continue;
    const out = path.join(ogDir, `og-${slug}.jpg`);
    if (!force && fs.existsSync(out)) continue;

    const cover = post.data.card && post.data.card.cover;
    if (!cover) continue;
    const photo = path.join(photoDir, path.basename(cover));
    if (!fs.existsSync(photo)) continue;

    await buildCard({
      photo,
      meta: post.data.meta_en || "",
      title: post.data.title_en || "",
      out
    });
    made.push(`og-${slug}.jpg`);
  }
  return made;
}

module.exports = { ensureCards, buildCard };
