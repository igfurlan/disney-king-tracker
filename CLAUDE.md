# Instructions for Claude — maintaining this tracker

This project keeps two Notion databases in sync with curated lists:
**Stephen King — Books** and **Disney & Pixar — Films**. Each row has a cover
image, release year, a `Done` checkbox, and a `Date finished` date. The user ticks
boxes in Notion; the per-database progress % is the `Done` column's "Percent
checked" footer.

## Golden rules
- The **curated JSON lists are the source of truth**: `data/stephen_king.json`
  (key `category`: Novel | Dark Tower | Bachman | Collection) and
  `data/disney.json` (key `studio`: Disney Animation | Pixar).
- **Never re-run the full create flow** once `.notion_state.json` exists — it would
  create duplicate databases. The script refuses to, but don't force it.
- The script **never reads or writes the user's other Notion pages** — the
  integration only sees the parent page that was shared with it. Don't change that.
- Covers are fetched live: books via Open Library (no key), movies via TMDB
  (env `TMDB_API_KEY` = the "Chave da API" / v3 key).

## Deployed Notion IDs (already built — June 2026)
The trackers are LIVE in Notion. They were created via the Notion MCP and populated
with the `ntn_` integration token (which has access to them). IDs:
- Parent page: `37bee1be-13e0-8169-b721-e8292fd568f2`
  (https://app.notion.com/p/37bee1be13e08169b721e8292fd568f2)
- Disney & Pixar — Films: database `63911c4f41564168a417149554ec934c`,
  data source `444be640-e9f7-4044-ad84-8514cc9d3e7e`
- Stephen King — Books: database `ed34c550235e420f8d76016c2ac5c415`,
  data source `3d43b8f0-8eb6-4c1f-bf4b-28d3c58681e9`

Both databases have a `Poster` (Files & media) property — this is what the gallery
card previews render (a plain URL property shows as a link, not an image). The parent
page presents: a welcome callout, a collapsed "Source databases" toggle, then a
**poster gallery** for each collection (card cover = `Poster`, showing
Name/Year/Done/Date finished). `populate_existing.py` sets `Poster` on every new row
automatically, so new additions appear in the galleries with no extra step.

**Progress indicator:** each collection's home-page database has a **📊 Progresso**
table view (created via `notion-create-view`). The free progress bar is the `Done`
column's **Percent checked** footer on that view — it reads straight from the table,
updates as rows are added, and renders as a bar. This is the only thing the user must
toggle by hand: the API **cannot** set view footers or the "Show as bar" display toggle.
Do NOT try to add a relation+rollup hack (fragile, breaks when rows are added) or a
chart view (charts are paid — blank on Free) unless the user upgrades to Plus.

**Language: Brazilian Portuguese.** Every Notion row's `Name` is the Brazilian release
title. `data/titles_pt.json` maps English → BR titles (keys are exact English titles;
`_comment`-prefixed keys are ignored). `rename_notion_pt.py` renames rows from English
to BR (idempotent — only touches rows whose current name is a known English key). The
GitHub Pages site (`gen_site_data.py`) merges the same map: each item gets `title`
(pt-BR), `title_en`, `year`, `group` (translated via `GROUP_PT`), `cover`.

## Adding new books or movies later (the normal task)
The user will say something like "Stephen King released a new book" or "add the
new Pixar movie." Do this:

1. **Append** the new entry/entries to the right JSON file in `data/`. Match the
   existing shape exactly (titles in `data/*.json` stay **English** — they're the
   matching key everywhere):
   - Book: `{"title": "New Title", "year": 2026, "category": "Novel"}`
   - Movie: `{"title": "New Title", "year": 2026, "studio": "Pixar"}`
   Keep valid JSON (commas, no trailing comma on the last element).
2. **Add the Brazilian title** to `data/titles_pt.json` keyed by the exact English
   title: `"New Title": "Título em Português"`. If you're unsure of the official BR
   title, keep English and flag it for the user to confirm.
3. Ensure `.env` has `NOTION_TOKEN` and `TMDB_API_KEY` (both already present).
4. Re-resolve covers (regenerates `covers_preview.json` with the new titles):
   ```bash
   python populate_notion.py --dry-run
   ```
5. Add the new rows to the LIVE databases — `populate_existing.py` is **idempotent**:
   it queries each database and adds only titles not already present.
   ```bash
   python populate_existing.py
   ```
6. **Rename the new rows to their BR titles** (idempotent — only renames known English
   names, so safe even though older rows are already in Portuguese):
   ```bash
   python rename_notion_pt.py
   ```
7. **Regenerate the GitHub Pages data** so the new title shows on the live site, then
   commit `docs/data.json`:
   ```bash
   python gen_site_data.py
   ```
8. Report what was added and flag any `MISS` (no cover found) and any title left in
   English (no confirmed BR title) so the user can fix it.

> `populate_existing.py` has the two database IDs hard-coded (see above) and skips
> existing titles, so it's safe to re-run. Do NOT run `python populate_notion.py`
> without a flag — that path creates brand-new databases and is not what we use here.

## Other tasks the user might ask for
- **Preview before writing:** `python populate_notion.py --dry-run` resolves all
  covers and writes `covers_preview.json` without touching Notion. Good for sanity-
  checking new entries' covers/years first.
- **Correct a year / title:** edit the JSON. Note: editing JSON does NOT update rows
  already in Notion (update mode only *adds* missing titles, it doesn't patch). For a
  correction, either fix the single row by hand in Notion, or ask before writing a
  patch routine.
- **Remove an entry:** delete the line from JSON AND delete the row in Notion by hand
  (the script never deletes Notion rows).
- **Scope debates** (e.g. whether a Gwendy collaboration or `Cycle of the Werewolf`
  counts as a King novel): these are the user's call — confirm, then edit JSON.

## First-run setup (only if Notion was never populated)
Needs `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`, `TMDB_API_KEY`. See README.md. Then:
```bash
python populate_notion.py        # creates both DBs, fills them, writes .notion_state.json
```
Afterwards remind the user to, per database: add a Gallery view (Card preview = Page
cover) and set the `Done` column footer to "Percent checked".

## Files
- `data/*.json` — curated lists (source of truth; titles in **English**).
- `data/titles_pt.json` — English → Brazilian title map (the pt-BR layer). `_comment`
  keys are ignored. A few uncertain BR titles are flagged in its `_comment`.
- `populate_notion.py` — create / `--update` / `--dry-run`.
- `populate_existing.py` — idempotently add missing rows to the LIVE DBs (IDs hard-coded).
- `set_posters.py` — set the `Poster` file property by matching title → cover.
- `rename_notion_pt.py` — rename rows English → BR (idempotent). Run after adding rows.
- `gen_site_data.py` — build `docs/data.json` for the GitHub Pages site (merges
  `titles_pt.json`).
- `docs/` — the GitHub Pages site (`index.html`, `styles.css`, `app.js`, `data.json`),
  pt-BR, served from `main` → `/docs`. Repo is **public** (required for Pages on Free);
  secrets live only in the gitignored `.env`. Optional `docs/assets/*.gif` can back the
  per-tab animated scenes via the `--scene-gif` CSS var (see README).
- `.notion_state.json` — created after first run; holds the two database IDs. Do not
  delete; do not commit secrets.
- `.env` — secrets (gitignored). `.env.example` is the template.
