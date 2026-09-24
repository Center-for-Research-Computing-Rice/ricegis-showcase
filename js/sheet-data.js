// Reads the published Google Sheet and turns it into HTML.
// Used by the live page (js/sheets.js) and by the snapshot step in update-site.bat.

const SHEET = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTOg7GZlev22QZYsbwlrG-FG9ppWY0D0Trm6pyqU7ocaZ7h9yeVcwbLSvI6flsDKwS90pJ14Mqds62q/pub';

// Tab IDs ("gid") from File → Share → Publish to web.
export const TABS = {
  schedule: 0,
  presenters: 1994788442,
  partners: 182194715,
};

export const tabUrl = (key) => `${SHEET}?gid=${TABS[key]}&single=true&output=csv`;

// Accepted column names (case and spacing don't matter).
const COLUMNS = {
  start: ['start', 'start time', 'from'],
  end: ['end', 'end time', 'to'],
  type: ['type', 'session', 'kind'],
  title: ['title', 'talk', 'talk title'],
  presenter: ['presenter', 'presenters', 'speaker', 'speakers'],
  details: ['details', 'description', 'notes'],
  visible: ['visible', 'show', 'published'],
  name: ['name', 'full name'],
  role: ['role', 'category'],
  department: ['department', 'dept', 'organization', 'affiliation'],
  photo: ['photo', 'image', 'headshot', 'picture'],
  link: ['link', 'url', 'website', 'profile'],
  bio: ['bio', 'about', 'biography'],
  logo: ['logo', 'logo_image', 'logo image', 'image'],
};

/* ---------- CSV ---------- */

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// CSV text → array of objects keyed by our field names, hidden rows removed.
export function readTab(text) {
  const [header = [], ...body] = parseCsv(text);
  const norm = (s) => s.trim().toLowerCase().replace(/[\s_]+/g, ' ');
  const index = {};
  for (const [field, names] of Object.entries(COLUMNS)) {
    const i = header.findIndex((h) => names.includes(norm(h)));
    if (i >= 0) index[field] = i;
  }
  return body
    .map((cells) => {
      const o = {};
      for (const [field, i] of Object.entries(index)) o[field] = (cells[i] || '').trim();
      return o;
    })
    .filter((o) => Object.values(o).some(Boolean))
    .filter((o) => !/^(no|n|false|0|hide|hidden)$/i.test(o.visible || ''));
}

/* ---------- helpers ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const initials = (name) => name.replace(/\b(Dr|Prof)\.?\s+/gi, '').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// "8:45 AM" → "08:45" (for the live "Now" marker)
function to24h(t) {
  const m = /^(\d{1,2}):(\d{2})\s*([ap])?\.?m?\.?$/i.exec((t || '').trim());
  if (!m) return '';
  let h = +m[1];
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function timeRange(start, end) {
  const s = (start || '').trim(), e = (end || '').trim();
  if (!e) return s;
  const sp = /\s*([AP]M)$/i.exec(s), ep = /\s*([AP]M)$/i.exec(e);
  // "9:00 AM – 9:35 AM" → "9:00 – 9:35 AM"
  const left = sp && ep && sp[1].toUpperCase() === ep[1].toUpperCase() ? s.slice(0, sp.index) : s;
  return `${left} – ${e}`;
}

// Picks the colored label from the words in the Type (or Title) column.
const CATEGORIES = [
  [/undergrad/i, 'student', 'Undergrad', true],
  [/grad/i, 'student', 'Grad student', true],
  [/round ?table|panel|discussion/i, 'panel', 'Round table', false],
  [/opening|welcome|breakfast|check.?in|registration/i, 'break', 'Welcome', false],
  [/lunch/i, 'break', 'Lunch', false],
  [/\bbreaks?\b|partner|networking/i, 'break', 'Break', false],
  [/compet|contest|gallery/i, 'contest', 'Contest', false],
  [/closing|final|remarks|wrap/i, 'break', 'Closing', false],
  [/present|talk|keynote|speaker|lecture/i, 'talk', 'Talk', true],
];
function categorize(type, title) {
  for (const [re, cls, label, person] of CATEGORIES) {
    if (re.test(type) || (!type && re.test(title))) return { cls, label, person };
  }
  return { cls: 'break', label: type || 'Session', person: false };
}

const splitNames = (s) => (s || '').split(/\s*(?:;|&|\band\b|\n)\s*/).filter(Boolean);

/* ---------- renderers (return HTML strings) ---------- */

export function renderSchedule(rows, presenters = []) {
  const byName = new Map(presenters.map((p) => [p.name.toLowerCase(), p]));
  return rows.map((r) => {
    const cat = categorize(r.type, r.title);
    const heading = r.title || r.type || 'Session';
    const names = splitNames(r.presenter);
    const tbd = cat.person && !r.title && !names.length ? ' <span class="tbd">TBD</span>' : '';
    const who = names.map((n) => {
      const p = byName.get(n.toLowerCase());
      const dept = p?.department ? ` · ${esc(p.department)}` : '';
      return p ? `<a href="#${slug(p.name)}">${esc(p.name)}</a>${dept}` : esc(n);
    }).join('<br>');
    const sub = r.title && r.type && r.type !== r.title && !cat.person ? esc(r.type) : '';
    return `<li data-start="${to24h(r.start)}" data-end="${to24h(r.end)}"><time>${esc(timeRange(r.start, r.end))}</time><div>` +
      `<span class="tag tag-${cat.cls}">${esc(cat.label)}</span><h3>${esc(heading)}${tbd}</h3>` +
      (who ? `<p class="who">${who}</p>` : '') +
      (r.details ? `<p>${esc(r.details)}</p>` : sub ? `<p>${sub}</p>` : '') +
      `</div></li>`;
  }).join('\n');
}

const ROLE_ORDER = ['faculty', 'staff', 'research', 'grad', 'undergrad', 'panel', 'partner'];
const roleRank = (role) => {
  const r = (role || '').toLowerCase();
  const i = ROLE_ORDER.findIndex((k) => (k === 'grad' ? /^grad|graduate/.test(r) : r.includes(k)));
  return i < 0 ? ROLE_ORDER.length : i;
};

export function renderPresenters(people, schedule = []) {
  const talks = new Map();
  for (const r of schedule) {
    for (const n of splitNames(r.presenter)) if (r.title) talks.set(n.toLowerCase(), r.title);
  }
  return [...people]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => roleRank(a.p.role) - roleRank(b.p.role) || a.i - b.i)
    .map(({ p }) => {
      const photo = safeUrl(p.photo);
      const link = safeUrl(p.link);
      const avatar = photo
        ? `<img class="avatar" src="${esc(photo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="72" height="72">`
        : `<div class="avatar avatar-initials" aria-hidden="true">${esc(initials(p.name))}</div>`;
      const name = link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name);
      const talk = talks.get(p.name.toLowerCase());
      const long = (p.bio || '').length > 160;
      return `<article class="person" id="${slug(p.name)}">${avatar}` +
        (p.role ? `<p class="person-role">${esc(p.role)}</p>` : '') +
        `<h3>${name}</h3>` +
        (p.department ? `<p class="role">${esc(p.department)}</p>` : '') +
        (talk ? `<p class="talk">${esc(talk)}</p>` : '') +
        (p.bio ? `<p class="bio${long ? ' is-clamped' : ''}">${esc(p.bio)}</p>` : '') +
        (long ? `<button type="button" class="bio-toggle" aria-expanded="false">Read more</button>` : '') +
        `</article>`;
    }).join('\n');
}

export function renderPartners(partners) {
  return partners.map((p) => {
    const logo = safeUrl(p.logo);
    const link = safeUrl(p.link);
    const inner = logo
      ? `<img src="${esc(logo)}" alt="${esc(p.name)}" loading="lazy" decoding="async">`
      : `<span>${esc(p.name)}</span>`;
    return `<li class="logo-tile">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" title="${esc(p.name)}">${inner}</a>` : inner}</li>`;
  }).join('\n');
}

// Fetch all tabs and render. Returns { schedule, presenters, partners } HTML (null for a tab that failed).
export async function loadAll(fetchText) {
  const keys = Object.keys(TABS);
  const texts = await Promise.all(keys.map((k) => fetchText(tabUrl(k)).catch(() => null)));
  return renderFromTexts(Object.fromEntries(keys.map((k, i) => [k, texts[i]])));
}

export function renderFromTexts(texts) {
  const data = {};
  for (const [k, t] of Object.entries(texts)) data[k] = t == null ? null : readTab(t);
  const people = data.presenters || [];
  return {
    schedule: data.schedule && data.schedule.length ? renderSchedule(data.schedule, people) : null,
    presenters: data.presenters && data.presenters.length ? renderPresenters(people, data.schedule || []) : null,
    partners: data.partners && data.partners.length ? renderPartners(data.partners) : null,
  };
}
