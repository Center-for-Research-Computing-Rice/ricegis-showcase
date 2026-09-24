# 2026 Rice GIS Showcase website

Static site (HTML/CSS/JS). Host the folder on GitHub Pages or a Rice web server.

```
index.html          page content
css/styles.css      styles (Rice Blue #00205B, colors in :root)
js/main.js          nav, slideshow, countdown, "Now" marker, calendar files, gallery viewer, map
js/sheet-data.js    reads the Google Sheet (tab IDs at the top) and builds the HTML
js/sheets.js        loads the sheet into the live page
update-site.bat     double-click to refresh photos + the saved copy of the sheet
```

## Schedule, presenters & partners → Google Sheet

Edit the sheet; the website shows changes within ~5 minutes (Google's publishing delay). Nothing to run or upload.

**Schedule tab:** one row per time slot, **in the order they should appear**.

| Column | Notes |
|---|---|
| start / end | e.g. `9:00 AM` |
| type | Free text. Words in it pick the colored label: *grad*, *undergrad*, *presenter/talk*, *round table/panel*, *lunch*, *break*, *competition/contest*, *opening/breakfast*, *final/closing* |
| title | Talk title. If empty, the `type` text is shown (with "TBD" on talk slots) |
| presenter | Must match a name on the Presenters tab to link to their card. Several people: `Name One & Name Two` |
| details | Optional second line |
| visible | `no` hides the row. Blank or `yes` shows it |

**Presenters tab:** name, role, department, photo, link, bio, visible.
Cards are grouped Faculty → Staff → Grad → Undergrad, in sheet order within each group. A presenter's talk title is taken from the Schedule row that lists them. No photo → their initials are shown. Long bios get a "Read more" button.

**Partners tab:** name, logo_image, link, visible. No logo → the name is shown.

Photo and logo links must be public, permanent `https://` image URLs. Avoid links with `token=` (they expire) and Google Drive links (they don't display on websites).

**If Google is unreachable**, the page shows the copy saved inside `index.html`. Double-click `update-site.bat` now and then (and before publishing the site) to refresh that copy. It also makes the page appear instantly with the right content.

Adding a tab or re-publishing can change a tab's ID. If a section stops updating, get the tab's link from File → Share → Publish to web and update `TABS` at the top of `js/sheet-data.js`.

## Adding photos

1. Drop photos into a folder:
   - `images/hero/` → the rotating slideshow at the top
   - `images/gallery/` → a Gallery section (it appears automatically once it has photos)
2. Double-click **`update-site.bat`**.

Removing a photo works the same way: delete it, double-click again.

- **Order:** filename order. Start names with a number: `1-keynote.jpg`, `2-posters.jpg`.
- **Captions:** from the filename: `3-poster-session.jpg` → "poster session".
- Any size; JPG or PNG (export iPhone HEIC photos as JPG first). A 6 MB photo becomes ~90 KB.
- Needs [Node.js](https://nodejs.org). The first run takes a minute to set up.

`images/site/` holds icons and workshop pictures; `images/web/` is generated. Leave both alone. When publishing, upload everything **except** `node_modules/`.

## Still to fill in

Search `index.html` for `PLACEHOLDER`:

| Where | What's needed |
|---|---|
| Workshops → Workshop III | Registration URL (replace `href="#"`, remove `is-placeholder` and `aria-disabled`) |
| Visit | Parking details, accessibility/accommodation contact |
| Footer | Contact email |

## Notes

- Calendar downloads use `EVENTS` in `js/main.js` (UTC times; CST = UTC−6). They don't read the sheet, so update them if the day's start/end changes.
- Map: Leaflet with OpenStreetMap street tiles and an Esri World Imagery satellite option. Kraft Hall's footprint comes from OpenStreetMap (relation 15661103); the pin is at 29.715875, −95.402425.
