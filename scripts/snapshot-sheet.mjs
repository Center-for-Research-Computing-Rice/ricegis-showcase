// Copies the current Google Sheet into index.html, so the page shows up-to-date
// content instantly and still works if Google is unreachable. Run by update-site.bat.

import fs from 'node:fs/promises';
import { loadAll } from '../js/sheet-data.js';

const PAGE = 'index.html';

const fetchText = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

function replaceBlock(html, key, content, indent) {
  const re = new RegExp(`(<!-- ${key}:start[^>]*-->)[\\s\\S]*?(\\s*<!-- ${key}:end -->)`);
  if (!re.test(html)) throw new Error(`Couldn't find <!-- ${key}:start --> in ${PAGE}`);
  const body = content.split('\n').map((l) => indent + l).join('\n');
  return html.replace(re, (_, a, b) => `${a}\n${body}${b.replace(/^\s*\n/, '\n')}`);
}

console.log('Updating schedule & presenters from the Google Sheet…');
let out;
try {
  out = await loadAll(fetchText);
} catch (e) {
  out = {};
}

let html = await fs.readFile(PAGE, 'utf8');
const done = [];
for (const [key, indent] of [['schedule', '          '], ['presenters', '          '], ['partners', '          ']]) {
  if (out[key]) {
    html = replaceBlock(html, key, out[key], indent);
    done.push(key);
  } else {
    console.log(`  ✖ ${key}: couldn't read the sheet (offline?). Kept the previous version.`);
  }
}
await fs.writeFile(PAGE, html);
if (done.length) console.log(`  ✔ Updated: ${done.join(', ')}`);
