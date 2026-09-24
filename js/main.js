(function () {
  'use strict';

  // Event times are in Houston (Central Standard Time, UTC-6 in November).
  var SHOWCASE_START = new Date('2026-11-17T08:45:00-06:00');
  var SHOWCASE_DATE = '2026-11-17';
  var KRAFT_HALL = [29.715875, -95.402425];
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  var navLinks = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]:not(.btn)'));
  toggle.addEventListener('click', function () {
    var open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    }
  });

  /* ---------- In-page links when embedded in an iframe ---------- */
  // Full-height cross-origin embeds can't scroll the host page without a parent
  // script. Instead, jump links focus that section under the nav (hide the rest).
  function isEmbedded() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }

  if (isEmbedded()) {
    document.documentElement.classList.add('is-embedded');

    var focusBar = document.createElement('div');
    focusBar.className = 'embed-focus-bar';
    focusBar.hidden = true;
    focusBar.innerHTML = '<p>Viewing <strong data-embed-label></strong></p>' +
      '<button type="button" class="btn btn-sm btn-outline" data-embed-show-all>Show full page</button>';
    var headerEl = document.querySelector('.site-header');
    if (headerEl) headerEl.insertAdjacentElement('afterend', focusBar);

    var embedBlocks = Array.prototype.slice.call(
      document.querySelectorAll('main > .hero, main > .section')
    );

    function focusLabel(el) {
      if (!el) return 'Full page';
      if (el.classList.contains('hero')) return 'Home';
      var h = el.querySelector('h2');
      return (h && h.textContent.trim()) || el.id || 'Section';
    }

    function setEmbedFocus(id) {
      var showAll = !id || id === 'top' || id === 'main';
      var target = showAll ? null : document.getElementById(id);
      if (target && !target.matches('.hero, .section')) {
        target = target.closest('.hero, .section');
      }
      // Don't focus an intentionally hidden block (empty gallery).
      if (target && target.hidden) target = null;
      showAll = showAll || !target;

      document.documentElement.classList.toggle('embed-focus', !showAll);
      embedBlocks.forEach(function (block) {
        block.classList.toggle('is-embed-active', !showAll && block === target);
      });
      focusBar.hidden = showAll;
      if (!showAll) {
        focusBar.querySelector('[data-embed-label]').textContent = focusLabel(target);
        navLinks.forEach(function (a) {
          a.classList.toggle('is-current', a.getAttribute('href') === '#' + target.id);
        });
        document.dispatchEvent(new CustomEvent('embed:focus', { detail: { id: target.id } }));
      } else {
        navLinks.forEach(function (a) { a.classList.remove('is-current'); });
        document.dispatchEvent(new CustomEvent('embed:focus', { detail: { id: null } }));
      }
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-embed-show-all]')) {
        e.preventDefault();
        try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { /* ignore */ }
        setEmbedFocus(null);
        return;
      }
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href === '#') return;
      var id = href.slice(1);
      if (id !== 'top' && id !== 'main' && !document.getElementById(id)) return;
      e.preventDefault();
      try { history.replaceState(null, '', '#' + id); } catch (err2) { /* ignore */ }
      setEmbedFocus(id);
    });

    if (location.hash.length > 1) {
      var bootId = location.hash.slice(1);
      requestAnimationFrame(function () { setEmbedFocus(bootId); });
    }
  }

  /* ---------- Highlight current section in nav ---------- */
  if ('IntersectionObserver' in window && !document.documentElement.classList.contains('is-embedded')) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function (a) {
      var target = document.querySelector(a.getAttribute('href'));
      if (target) io.observe(target);
    });
  }

  /* ---------- Hero slideshow ---------- */
  var slides = document.querySelectorAll('.hero-slide');
  var dotsWrap = document.querySelector('.hero-dots');
  var current = 0;
  var timer = null;

  function showSlide(i) {
    slides[current].classList.remove('is-active');
    dotsWrap.children[current].setAttribute('aria-selected', 'false');
    current = (i + slides.length) % slides.length;
    slides[current].classList.add('is-active');
    dotsWrap.children[current].setAttribute('aria-selected', 'true');
  }
  function startTimer() {
    if (reduceMotion || slides.length < 2) return;
    clearInterval(timer);
    timer = setInterval(function () { showSlide(current + 1); }, 6000);
  }
  Array.prototype.forEach.call(slides, function (_, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', 'Photo ' + (i + 1));
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.addEventListener('click', function () { showSlide(i); startTimer(); });
    dotsWrap.appendChild(b);
  });
  startTimer();

  /* ---------- Countdown ---------- */
  var cd = document.getElementById('countdown');
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    var diff = SHOWCASE_START - new Date();
    if (diff <= 0) { cd.classList.add('is-done'); return false; }
    var mins = Math.floor(diff / 60000);
    cd.querySelector('[data-unit="days"]').textContent = Math.floor(mins / 1440);
    cd.querySelector('[data-unit="hours"]').textContent = pad(Math.floor(mins / 60) % 24);
    cd.querySelector('[data-unit="minutes"]').textContent = pad(mins % 60);
    return true;
  }
  if (tick()) setInterval(tick, 30000);

  /* ---------- "Now" marker on the schedule (event day only) ---------- */
  function houstonNow() {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date()).reduce(function (o, p) { o[p.type] = p.value; return o; }, {});
    return { date: parts.year + '-' + parts.month + '-' + parts.day, time: parts.hour + ':' + parts.minute };
  }
  function markNow() {
    var now = houstonNow();
    document.querySelectorAll('.timeline li').forEach(function (li) {
      var on = now.date === SHOWCASE_DATE && now.time >= li.dataset.start && now.time < li.dataset.end;
      li.classList.toggle('is-now', on);
    });
  }
  markNow();
  setInterval(markNow, 60000);
  document.addEventListener('sheet:updated', markNow);

  /* ---------- Add to calendar (.ics) ---------- */
  var LOCATION = 'Kraft Hall 130, Rice University, 6100 Main St, Houston, TX 77005';
  var EVENTS = {
    showcase: [
      { title: '2026 Rice GIS Showcase', start: '20261117T144500Z', end: '20261117T213000Z',
        desc: 'Presentations, round table, and map competition. Breakfast and lunch provided.' }
    ],
    workshops: [
      { title: 'GIS Day Workshop I: Introduction to ArcGIS Online', start: '20261118T160000Z', end: '20261118T173000Z' },
      { title: 'GIS Day Workshop II: Creating StoryMaps', start: '20261118T183000Z', end: '20261118T200000Z' },
      { title: 'GIS Day Workshop III: Experience Builder', start: '20261118T203000Z', end: '20261118T220000Z' }
    ]
  };
  function esc(s) { return String(s || '').replace(/([,;\\])/g, '\\$1'); }
  function buildIcs(list) {
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rice GIS Showcase//EN', 'CALSCALE:GREGORIAN'];
    list.forEach(function (ev, i) {
      lines.push('BEGIN:VEVENT',
        'UID:rice-gis-2026-' + ev.start + '-' + i + '@rice.edu',
        'DTSTAMP:' + stamp,
        'DTSTART:' + ev.start,
        'DTEND:' + ev.end,
        'SUMMARY:' + esc(ev.title),
        'LOCATION:' + esc(LOCATION),
        'DESCRIPTION:' + esc(ev.desc || 'https://rice.edu'),
        'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
  document.querySelectorAll('[data-ics]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.dataset.ics;
      var blob = new Blob([buildIcs(EVENTS[key])], { type: 'text/calendar' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rice-gis-' + key + '-2026.ics';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    });
  });

  /* ---------- Placeholder links do nothing ---------- */
  document.querySelectorAll('a.is-placeholder').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  /* ---------- Gallery lightbox ---------- */
  var box = document.querySelector('.lightbox');
  if (box && box.showModal) {
    var boxImg = box.querySelector('img');
    var boxCap = box.querySelector('.lightbox-caption');
    document.addEventListener('click', function (e) {
      var link = e.target.closest('[data-lightbox]');
      if (!link) return;
      e.preventDefault();
      var thumb = link.querySelector('img');
      boxImg.src = link.href;
      boxImg.alt = thumb ? thumb.alt : '';
      boxCap.textContent = thumb ? thumb.alt : '';
      box.showModal();
    });
    box.querySelector('.lightbox-close').addEventListener('click', function () { box.close(); });
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
  }

  /* ---------- Visit map ---------- */
  if (window.L) {
    var map = L.map('map', { scrollWheelZoom: false, maxZoom: 20 }).setView(KRAFT_HALL, 17);

    // OpenStreetMap's own tiles: updated within minutes of edits, so campus buildings are current.
    var streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20, maxNativeZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20, maxNativeZoom: 19,
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
    });
    L.control.layers({ 'Map': streets, 'Satellite': satellite }, null, { collapsed: false }).addTo(map);

    // Kraft Hall footprint (OpenStreetMap relation 15661103), with its inner courtyard.
    L.polygon([
      [[29.715866, -95.402872], [29.715588, -95.402728], [29.715875, -95.401977], [29.716161, -95.402118]],
      [[29.71583, -95.402697], [29.716034, -95.402158], [29.715989, -95.402133], [29.715979, -95.402211],
       [29.71594, -95.402191], [29.715966, -95.40212], [29.715935, -95.402104], [29.715725, -95.402647],
       [29.715737, -95.402652], [29.715774, -95.402597], [29.715825, -95.40264], [29.715815, -95.402691]]
    ], { color: '#00205b', weight: 2, fillColor: '#e8a33b', fillOpacity: 0.45, interactive: false }).addTo(map);
    var pin = L.divIcon({
      className: '',
      html: '<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43s15-15.2 15-26A15 15 0 0 0 2 17c0 10.8 15 26 15 26z" fill="#00205b" stroke="#fff" stroke-width="2"/><circle cx="17" cy="17" r="5.5" fill="#e8a33b"/></svg>',
      iconSize: [34, 44], iconAnchor: [17, 43], popupAnchor: [0, -38]
    });
    L.marker(KRAFT_HALL, { icon: pin, title: 'Kraft Hall' }).addTo(map)
      .bindPopup('<strong>Kraft Hall, Room 130</strong><br>2026 Rice GIS Showcase')
      .openPopup();
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    document.addEventListener('embed:focus', function (e) {
      if (e.detail && e.detail.id === 'visit') setTimeout(function () { map.invalidateSize(); }, 50);
    });
  }
})();
