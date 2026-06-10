# Disney & Stephen King Tracker

**🌐 Live web app:** https://igfurlan.github.io/disney-king-tracker/ — a dark, cinematic
GitHub Pages site (in [`docs/`](docs/)), **in Brazilian Portuguese**, with:

- **Filmes / Livros** tabs (Disney & Pixar films, Stephen King books).
- A **poster grid**; each card shows the **Brazilian title**, the **release year on its
  own line**, the **original (English) title** below it, an always-visible **done-toggle**
  (✓ in the poster corner), and a **date-finished** picker that appears once marked.
- Animated **progress ring + bar** per tab, with per-group counts.
- **Search / filter (Todos·Concluídos·Pendentes) / sort**, milestone confetti, and a
  **themed animated background per tab** (drifting film reels & stars on Filmes; books,
  candle, key, quill & moon on Livros).
- **localStorage** persistence with **export/import** JSON backup.

Regenerate its data with `python gen_site_data.py` — it reads `covers_preview.json` and
merges Brazilian titles from [`data/titles_pt.json`](data/titles_pt.json), writing
`docs/data.json` (each item carries `title` = pt-BR, `title_en`, `year`, `group`, `cover`).

> **Swapping in a real GIF background:** the floating-icon scenes are pure CSS (no
> copyright issues, fast). To use an actual looping GIF instead, drop a file in
> `docs/assets/` and set the `--scene-gif` CSS var on the matching layer in
> `docs/styles.css`, e.g. `.scene-movies { --scene-gif: url("assets/movies.gif"); }`
> (and `.scene-books { … }`). The icons stay as a subtle overlay on top.

---

## Notion version

Builds two Notion databases — **Stephen King — Books** and **Disney & Pixar — Films** —
each populated with cover image, release year, a `Done` checkbox, and a `Date finished`
field. A per-database progress percentage comes from the `Done` column footer.

**Now in Brazilian Portuguese:** every row's `Name` has been renamed to the title as
published in Brazil (run [`rename_notion_pt.py`](rename_notion_pt.py) — idempotent, it
only renames rows whose current name matches a known English title in
[`data/titles_pt.json`](data/titles_pt.json)).

**Progress bar (free-plan friendly):** each collection's home-page database now has a
**📊 Progresso** table view. Notion's free **"Percent checked"** column footer on that
view renders as a live progress bar that reads straight from the table — no paid charts,
no fragile relations, and it updates automatically as you add rows. Enabling the footer
is the one step the API can't do for you (see the one-time clicks below).

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

## After it runs (one-time clicks per collection in Notion)

1. **Poster wall** — already set up: each collection shows a gallery whose card preview
   is the `Poster` file. (If you add one yourself: **•••** → *Card preview* = **Page
   cover**, *Card size* = Small.)
2. **Progress bar** — open the **📊 Progresso** table view on the collection, click the
   **Done** column's footer → **Calculate** → **Percent checked**. Notion shows it as a
   live progress bar that climbs as you tick boxes. This is the free-plan progress
   component; the table view is created for you by `notion-create-view`, but enabling the
   footer is a manual click (the API can't set view footers).
3. Optionally **Group** a gallery by `Category` / `Studio` for sub-sections, each with
   its own percent-checked footer.

## Notes
- Re-running creates *new* databases (it doesn't dedupe). Run once; tweak data and the
  rows by hand afterward, or delete the old databases before re-running.
- A handful of obscure titles may resolve no cover (`MISS`); paste a cover into that
  page's Notion cover manually — quick for the few that miss.
