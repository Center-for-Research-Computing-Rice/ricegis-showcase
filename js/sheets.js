// Fills the schedule, presenters and partners from the Google Sheet.
// The HTML already in index.html is a snapshot, so the page still works if Google is unreachable.

import { TABS, tabUrl, renderFromTexts } from './sheet-data.js';

const CACHE_KEY = 'rice-gis-sheet-v1';
const targets = {
  schedule: document.querySelector('[data-sheet="schedule"]'),
  presenters: document.querySelector('[data-sheet="presenters"]'),
  partners: document.querySelector('[data-sheet="partners"]'),
};

function apply(html) {
  let changed = false;
  for (const [key, el] of Object.entries(targets)) {
    if (el && html[key] && el.innerHTML.trim() !== html[key].trim()) {
      el.innerHTML = html[key];
      changed = true;
    }
  }
  if (changed) document.dispatchEvent(new CustomEvent('sheet:updated'));
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// 1) Last copy this visitor saw (instant), 2) fresh copy from Google.
try {
  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  if (cached && cached.texts) apply(renderFromTexts(cached.texts));
} catch { /* storage unavailable */ }

const keys = Object.keys(TABS);
Promise.all(keys.map((k) => fetchText(tabUrl(k)).catch(() => null))).then((list) => {
  const texts = Object.fromEntries(keys.map((k, i) => [k, list[i]]));
  apply(renderFromTexts(texts));
  if (list.every((t) => t != null)) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), texts })); } catch { /* ignore */ }
  }
});

// "Read more" opens a bio dialog so the people grid layout stays put.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.bio-toggle');
  if (!btn) return;
  const card = btn.closest('.person');
  const dialog = document.querySelector('.bio-dialog');
  if (!card || !dialog?.showModal) return;

  const setText = (sel, text) => {
    const el = dialog.querySelector(sel);
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  };

  setText('[data-bio-role]', card.querySelector('.person-role')?.textContent.trim());
  setText('[data-bio-name]', card.querySelector('h3')?.textContent.trim());
  setText('[data-bio-job]', card.querySelector('.job-title')?.textContent.trim());
  setText('[data-bio-dept]', card.querySelector('.role')?.textContent.trim());
  setText('[data-bio-text]', card.querySelector('.bio')?.textContent.trim());

  const profile = dialog.querySelector('[data-bio-link]');
  const href = card.querySelector('h3 a')?.href;
  if (profile) {
    if (href) { profile.href = href; profile.hidden = false; }
    else { profile.hidden = true; profile.removeAttribute('href'); }
  }
  dialog.showModal();
});

document.querySelector('.bio-dialog-close')?.addEventListener('click', () => {
  document.querySelector('.bio-dialog')?.close();
});
document.querySelector('.bio-dialog')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});
