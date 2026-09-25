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

// Show "Read more" only when the clamped bio actually overflows.
function syncBioToggles(root = document) {
  root.querySelectorAll('.person').forEach((card) => {
    const bio = card.querySelector('.bio');
    const btn = card.querySelector('.bio-toggle');
    if (!bio || !btn || card.classList.contains('is-reading')) return;

    bio.classList.add('is-clamped');
    // Force layout, then compare — +1px tolerance for subpixel rounding.
    const overflows = bio.scrollHeight > bio.clientHeight + 1;
    btn.hidden = !overflows;
    if (!overflows) bio.classList.remove('is-clamped');
  });
}

function closeReadingCard(card) {
  const bio = card.querySelector('.bio');
  const btn = card.querySelector('.bio-toggle');

  // Reset while still overflow:auto — leftover scrollTop makes line-clamp
  // show the middle of the bio instead of the start.
  if (bio) {
    bio.scrollTop = 0;
    bio.scrollTo(0, 0);
    const text = bio.textContent;
    bio.textContent = text;
  }

  card.classList.remove('is-reading');
  card.style.height = '';
  if (bio) {
    bio.classList.add('is-clamped');
    bio.scrollTop = 0;
  }
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = 'Read more';
  }
}

// "Read more" keeps the card the same size: hide the photo, scroll the bio inside.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.bio-toggle');
  if (!btn) return;
  const card = btn.closest('.person');
  const bio = card?.querySelector('.bio');
  if (!card || !bio) return;

  const closing = btn.getAttribute('aria-expanded') === 'true';
  if (closing) {
    closeReadingCard(card);
    syncBioToggles(card);
    return;
  }

  document.querySelectorAll('.person.is-reading').forEach((other) => {
    if (other !== card) closeReadingCard(other);
  });

  card.style.height = `${card.offsetHeight}px`;
  card.classList.add('is-reading');
  bio.classList.remove('is-clamped');
  bio.scrollTop = 0;
  btn.setAttribute('aria-expanded', 'true');
  btn.textContent = 'Show less';
});

function scheduleBioSync() {
  requestAnimationFrame(() => syncBioToggles());
}
scheduleBioSync();
document.addEventListener('sheet:updated', scheduleBioSync);
window.addEventListener('resize', scheduleBioSync);
if (document.fonts?.ready) document.fonts.ready.then(scheduleBioSync);
