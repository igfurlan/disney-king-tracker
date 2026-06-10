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

**Progress indicator:** intentionally NOT on the page. Charts are paid (blank on Free)
and a board/grouped view looked bad. A true progress *bar* on Free needs a
relation+rollup hack displayed via the "Show as bar" toggle, which the API cannot set
(and breaks when items are added) — so it was removed. If the user wants a quick %,
the free option is the `Done` column's *Percent checked* footer on a table in the
toggle (one-time UI click). Don't re-add chart views unless the user upgrades to Plus.

## Adding new books or movies later (the normal task)
The user will say something like "Stephen King released a new book" or "add the
new Pixar movie." Do this:

1. **Append** the new entry/entries to the right JSON file in `data/`. Match the
   existing shape exactly:
   - Book: `{"title": "New Title", "year": 2026, "category": "Novel"}`
   - Movie: `{"title": "New Title", "year": 2026, "studio": "Pixar"}`
   Keep valid JSON (commas, no trailing comma on the last element).
2. Ensure `.env` has `NOTION_TOKEN` and `TMDB_API_KEY` (both already present).
3. Re-resolve covers (regenerates `covers_preview.json` with the new titles):
   ```bash
   python populate_notion.py --dry-run
   ```
4. Add the new rows to the LIVE databases — `populate_existing.py` is **idempotent**:
   it queries each database and adds only titles not already present.
   ```bash
   python populate_existing.py
   ```
5. Report what was added and flag any `MISS` (no cover found) so the user can paste
   a cover manually on that Notion page.

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
- `data/*.json` — curated lists (source of truth).
- `populate_notion.py` — create / `--update` / `--dry-run`.
- `.notion_state.json` — created after first run; holds the two database IDs. Do not
  delete; do not commit secrets.
- `.env` — secrets (gitignored). `.env.example` is the template.
