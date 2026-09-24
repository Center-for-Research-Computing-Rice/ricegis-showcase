// Makes web-ready images and updates index.html. You don't need to edit anything:
//
//   images/hero/     photos for the top slideshow
//   images/gallery/  photos for the Gallery section (hidden when empty)
//   images/site/     icons & workshop images used at fixed spots on the page
//   images/web/      generated output (AVIF + WebP + JPEG/PNG at several widths)
//
// Photos show in filename order, so prefix with numbers to reorder (1-..., 2-..., up to 3 digits).
// Gallery captions come from the filename: "2025-poster-session.jpg" → "2025 poster session".
//
// Run: double-click update-site.bat, or `npm run images` (`npm run images:force` redoes all).

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const FOLDERS = ['hero', 'gallery', 'site'];
const OUT = 'images/web';
const PAGE = 'index.html';
const WIDTHS = [480, 800, 1200, 1600, 2400];
const INPUT = /\.(jpe?g|png|webp|tiff?|avif|heic)$/i;
const force = process.argv.includes('--force');

const QUALITY = {
  avif: { quality: 55, effort: 5 },
  webp: { quality: 78, effort: 5 },
  jpeg: { quality: 80, mozjpeg: true, progressive: true },
  png: { compressionLevel: 9, palette: true, quality: 90 },
};

const kb = (bytes) => `${Math.round(bytes / 1024).toLocaleString()} KB`;
const outName = (folder, name) => (folder === 'site' ? name : `${folder}-${name}`);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const caption = (name) => name.replace(/^\d{1,3}[-_ ]+/, '').replace(/[-_]+/g, ' ').trim();
const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function mtime(file) {
  try { return (await fs.stat(file)).mtimeMs; } catch { return 0; }
}

async function processImage(folder, file) {
  const src = path.join('images', folder, file);
  const name = outName(folder, slug(path.parse(file).name));
  const input = sharp(src).rotate(); // respect camera orientation
  const meta = await input.metadata();
  const [w, h] = meta.orientation >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
  const fallback = meta.hasAlpha ? 'png' : 'jpeg';
  const ext = fallback === 'jpeg' ? 'jpg' : 'png';

  const widths = [...new Set([...WIDTHS.filter((x) => x < w), Math.min(w, WIDTHS.at(-1))])];
  const outFiles = widths.flatMap((x) => ['avif', 'webp', ext].map((e) => `${name}-${x}.${e}`));

  const img = { folder, file, name, w, h, widths, ext, outFiles, fresh: true };
  const newest = await mtime(path.join(OUT, `${name}-${widths.at(-1)}.${ext}`));
  if (!force && newest >= (await mtime(src))) return img;

  img.fresh = false;
  for (const width of widths) {
    const resized = input.clone().resize({ width, withoutEnlargement: true });
    for (const [fmt, e] of [['avif', 'avif'], ['webp', 'webp'], [fallback, ext]]) {
      await resized.clone()[fmt](QUALITY[fmt]).toFile(path.join(OUT, `${name}-${width}.${e}`));
    }
  }
  const before = (await fs.stat(src)).size;
  const after = (await fs.stat(path.join(OUT, `${name}-${Math.min(widths.at(-1), 1600)}.avif`))).size;
  console.log(`  ✔ ${folder}/${file}  ${kb(before)} → ${kb(after)}`);
  return img;
}

function picture(img, { cls = '', alt = '', sizes = '100vw', eager = false, indent = '' }) {
  const set = (e) => img.widths.map((x) => `images/web/${img.name}-${x}.${e} ${x}w`).join(', ');
  const fallback = img.widths[Math.min(3, img.widths.length - 1)];
  const load = eager ? 'fetchpriority="high"' : 'loading="lazy"';
  return [
    `<picture${cls ? ` class="${cls}"` : ''}>`,
    `  <source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`,
    `  <source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`,
    `  <img src="images/web/${img.name}-${fallback}.${img.ext}" srcset="${set(img.ext)}" sizes="${sizes}"`,
    `       width="${img.w}" height="${img.h}" alt="${escAttr(alt)}" ${load} decoding="async">`,
    `</picture>`,
  ].map((l) => indent + l).join('\n');
}

function heroHtml(imgs) {
  return imgs.map((img, i) =>
    picture(img, { cls: i === 0 ? 'hero-slide is-active' : 'hero-slide', eager: i === 0, indent: '        ' })
  ).join('\n');
}

function galleryHtml(imgs) {
  const sizes = '(max-width: 640px) calc(100vw - 32px), (max-width: 960px) calc(50vw - 28px), 370px';
  return imgs.map((img) => {
    const text = caption(path.parse(img.file).name);
    const full = `images/web/${img.name}-${img.widths.at(-1)}.${img.ext}`;
    return [
      `          <figure class="gallery-item">`,
      `            <a href="${full}" data-lightbox>`,
      picture(img, { alt: text, sizes, indent: '              ' }),
      `            </a>`,
      `            <figcaption>${escAttr(text)}</figcaption>`,
      `          </figure>`,
    ].join('\n');
  }).join('\n');
}

function replaceBlock(html, key, content) {
  const re = new RegExp(`(<!-- ${key}:start[^>]*-->)[\\s\\S]*?(\\s*<!-- ${key}:end -->)`);
  if (!re.test(html)) throw new Error(`Couldn't find <!-- ${key}:start --> in ${PAGE}`);
  return html.replace(re, (_, a, b) => `${a}${content ? '\n' + content : ''}${b.replace(/^\s*\n/, '\n')}`);
}

// ---- run ----
await fs.mkdir(OUT, { recursive: true });
console.log('Updating images…');

const all = {};
for (const folder of FOLDERS) {
  await fs.mkdir(path.join('images', folder), { recursive: true });
  const files = (await fs.readdir(path.join('images', folder)))
    .filter((f) => INPUT.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  all[folder] = [];
  for (const f of files) {
    try {
      all[folder].push(await processImage(folder, f));
    } catch (e) {
      console.log(`  ✖ ${folder}/${f} skipped — couldn't read it. Save it as JPG or PNG and try again.`);
    }
  }
}

// Remove generated files whose original was deleted.
const keep = new Set(Object.values(all).flat().flatMap((i) => i.outFiles));
let removed = 0;
for (const f of await fs.readdir(OUT)) {
  if (!keep.has(f)) { await fs.unlink(path.join(OUT, f)); removed++; }
}

// Write the slideshow and gallery into the page.
let html = await fs.readFile(PAGE, 'utf8');
html = replaceBlock(html, 'hero', heroHtml(all.hero));
html = replaceBlock(html, 'gallery', galleryHtml(all.gallery));
html = html.replace(/(<section class="section[^"]*" id="gallery")( hidden)?/, `$1${all.gallery.length ? '' : ' hidden'}`);
html = html.replace(/(<a href="#gallery"[^>]*?)( hidden)?>/, `$1${all.gallery.length ? '' : ' hidden'}>`);
await fs.writeFile(PAGE, html);

const changed = Object.values(all).flat().filter((i) => !i.fresh).length;
console.log(`\nDone. Slideshow: ${all.hero.length} photo(s) · Gallery: ${all.gallery.length} photo(s)` +
  (changed ? ` · ${changed} new/updated` : ' · nothing new') + (removed ? ` · cleaned up ${removed} old file(s)` : ''));
