# Disney & Stephen King Notion Tracker

Builds two Notion databases — **Stephen King — Books** and **Disney & Pixar — Films** —
each populated with cover image, release year, a `Done` checkbox, and a `Date finished`
field. A per-database progress percentage comes from the `Done` column footer.

- **Lists** are curated and authoritative in [`data/stephen_king.json`](data/stephen_king.json)
  (~80 entries: novels, Dark Tower, Bachman, collections) and
  [`data/disney.json`](data/disney.json) (~92 entries: Disney Animation canon + Pixar features).
  Edit these freely — they drive everything.
- **Covers** are fetched per title at run time: books via Open Library (no key),
  movies via TMDB (free key).

## Setup (≈2 minutes)

1. **Notion integration token**
   - Go to https://www.notion.so/my-integrations → **New integration** → copy the
     "Internal Integration Secret" (starts with `secret_` / `ntn_`).
2. **Parent page + share it with the integration**
   - Create a Notion page (e.g. "Trackers"). Open it → top-right **•••** →
     **Connections** → add your integration.
   - Copy the page ID: it's the 32-char hex string in the page URL
     (`notion.so/Trackers-`**`<THIS PART>`**).
3. **TMDB API key**
   - https://www.themoviedb.org → sign up → Settings → API → request a key (instant, free).

## Run

```bash
pip install -r requirements.txt
cp .env.example .env        # then fill in the three values
python populate_notion.py --dry-run   # optional: resolve covers only, writes covers_preview.json
python populate_notion.py             # FIRST run: creates + fills the two Notion databases
python populate_notion.py --update    # LATER runs: adds only NEW titles to the existing DBs
```

The first run saves the two database IDs to `.notion_state.json`. After that, to add
newly released books/movies you just append them to the `data/*.json` files and run
`--update` — it adds only what's missing. See [CLAUDE.md](CLAUDE.md) for the full
maintenance workflow (written so Claude can do it for you on request).

`--dry-run` writes `covers_preview.json` so you can eyeball every resolved cover URL
(and spot any `MISS`) before anything is written to Notion.

## After it runs (two one-time clicks per database in Notion)

1. Add a **Gallery** view → **•••** → *Card preview* = **Page cover**, *Card size* = Small.
   You now have a poster wall.
2. Click the **Done** column's footer → **Calculate** → **Percent checked**.
   That number is your live progress (e.g. "20%"); it climbs as you tick boxes.
3. Optionally **Group** the gallery by `Category` / `Studio` for sub-sections, each with
   its own percent-checked footer.

## Notes
- Re-running creates *new* databases (it doesn't dedupe). Run once; tweak data and the
  rows by hand afterward, or delete the old databases before re-running.
- A handful of obscure titles may resolve no cover (`MISS`); paste a cover into that
  page's Notion cover manually — quick for the few that miss.
