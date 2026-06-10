#!/usr/bin/env python3
"""
Build/maintain two Notion databases — Stephen King books and Disney/Pixar films —
populated with a cover image, release year, a "Done" checkbox, and a "Date finished".

Data:  curated title/year lists in ./data/*.json (authoritative; edit freely).
Covers: fetched per-title at run time —
        - books  -> Open Library  (no key needed)
        - movies -> TMDB          (free "Chave da API" / v3 API key)

Modes:
    python populate_notion.py --dry-run   # resolve covers only -> covers_preview.json
    python populate_notion.py             # FIRST run: create both DBs + fill them
    python populate_notion.py --update    # LATER runs: add only NEW titles to existing DBs

After the first run the two database IDs are saved to .notion_state.json, which
--update reads. See CLAUDE.md for the full maintenance workflow.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"
STATE_FILE = HERE / ".notion_state.json"


# --------------------------------------------------------------------------- #
# .env loader                                                                 #
# --------------------------------------------------------------------------- #
def load_dotenv():
    env_path = HERE / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))
    print(f"  state saved -> {STATE_FILE}")


# --------------------------------------------------------------------------- #
# Cover lookups                                                               #
# --------------------------------------------------------------------------- #
def get_book_cover(title, author="Stephen King"):
    try:
        r = requests.get(
            "https://openlibrary.org/search.json",
            params={"title": title, "author": author, "limit": 5, "fields": "cover_i,title"},
            timeout=20,
        )
        r.raise_for_status()
        for doc in r.json().get("docs", []):
            if doc.get("cover_i"):
                return f"https://covers.openlibrary.org/b/id/{doc['cover_i']}-L.jpg"
    except requests.RequestException as e:
        print(f"    ! Open Library error for {title!r}: {e}", file=sys.stderr)
    return None


def get_movie_poster(title, year, api_key):
    try:
        r = requests.get(
            "https://api.themoviedb.org/3/search/movie",
            params={"api_key": api_key, "query": title, "year": year},
            timeout=20,
        )
        r.raise_for_status()
        results = r.json().get("results", [])
        for res in sorted(results, key=lambda x: not x.get("release_date", "").startswith(str(year))):
            if res.get("poster_path"):
                return f"https://image.tmdb.org/t/p/w500{res['poster_path']}"
    except requests.RequestException as e:
        print(f"    ! TMDB error for {title!r}: {e}", file=sys.stderr)
    return None


# --------------------------------------------------------------------------- #
# Notion helpers                                                              #
# --------------------------------------------------------------------------- #
def notion_headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def create_database(token, parent_page_id, title, category_label, category_options):
    body = {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": title}}],
        "properties": {
            "Name": {"title": {}},
            "Year": {"number": {"format": "number"}},
            category_label: {"select": {"options": [{"name": o} for o in category_options]}},
            "Done": {"checkbox": {}},
            "Date finished": {"date": {}},
            "Cover URL": {"url": {}},
        },
    }
    r = requests.post(f"{NOTION_API}/databases", headers=notion_headers(token), json=body, timeout=30)
    if r.status_code >= 300:
        sys.exit(f"Failed to create database {title!r}: {r.status_code} {r.text}")
    db_id = r.json()["id"]
    print(f"  created database {title!r} -> {db_id}")
    return db_id


def get_existing_titles(token, db_id):
    """Return the set of 'Name' values already present in a database."""
    titles, cursor = set(), None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        r = requests.post(f"{NOTION_API}/databases/{db_id}/query",
                          headers=notion_headers(token), json=body, timeout=30)
        if r.status_code >= 300:
            sys.exit(f"Failed to query database {db_id}: {r.status_code} {r.text}")
        data = r.json()
        for page in data["results"]:
            title_prop = page["properties"].get("Name", {}).get("title", [])
            if title_prop:
                titles.add(title_prop[0]["plain_text"])
        if not data.get("has_more"):
            break
        cursor = data["next_cursor"]
    return titles


def add_row(token, db_id, name, year, category_label, category_value, cover_url):
    properties = {
        "Name": {"title": [{"text": {"content": name}}]},
        "Year": {"number": year},
        category_label: {"select": {"name": category_value}},
        "Done": {"checkbox": False},
    }
    if cover_url:
        properties["Cover URL"] = {"url": cover_url}
    body = {"parent": {"database_id": db_id}, "properties": properties}
    if cover_url:
        body["cover"] = {"type": "external", "external": {"url": cover_url}}
    r = requests.post(f"{NOTION_API}/pages", headers=notion_headers(token), json=body, timeout=30)
    if r.status_code >= 300:
        print(f"    ! Failed to add {name!r}: {r.status_code} {r.text}", file=sys.stderr)
        return False
    return True


# --------------------------------------------------------------------------- #
# Cover resolution                                                            #
# --------------------------------------------------------------------------- #
def resolve_covers(items, kind, tmdb_key):
    total = len(items)
    for i, item in enumerate(items, 1):
        item["cover"] = (
            get_book_cover(item["title"]) if kind == "book"
            else get_movie_poster(item["title"], item["year"], tmdb_key)
        )
        print(f"  [{i:>3}/{total}] {'ok ' if item['cover'] else 'MISS'} {item['title']} ({item['year']})")
        time.sleep(0.25)
    missing = [it["title"] for it in items if not it["cover"]]
    if missing:
        print(f"  -> {len(missing)} without a cover: {', '.join(missing)}")
    return items


def fill_rows(token, db_id, items, label_key):
    added = 0
    for it in items:
        if add_row(token, db_id, it["title"], it["year"], label_key, it[label_key.lower()], it["cover"]):
            added += 1
        time.sleep(0.34)  # Notion ~3 req/s
    return added


# --------------------------------------------------------------------------- #
# Main                                                                        #
# --------------------------------------------------------------------------- #
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Resolve covers only; write covers_preview.json; don't touch Notion.")
    parser.add_argument("--update", action="store_true",
                        help="Add only NEW titles to the existing databases (from .notion_state.json).")
    args = parser.parse_args()

    load_dotenv()
    tmdb_key = os.environ.get("TMDB_API_KEY")
    token = os.environ.get("NOTION_TOKEN")
    parent = os.environ.get("NOTION_PARENT_PAGE_ID")

    books = json.loads((HERE / "data" / "stephen_king.json").read_text())   # uses "category"
    movies = json.loads((HERE / "data" / "disney.json").read_text())        # uses "studio"

    if not tmdb_key:
        sys.exit("TMDB_API_KEY is required (the 'Chave da API' from themoviedb.org).")

    state = load_state()

    # ---- UPDATE MODE: diff against what's already in Notion -------------- #
    if args.update:
        if not token:
            sys.exit("NOTION_TOKEN is required for --update.")
        if "king_db" not in state or "disney_db" not in state:
            sys.exit("No .notion_state.json found. Do a first full run before --update.")

        existing_books = get_existing_titles(token, state["king_db"])
        existing_movies = get_existing_titles(token, state["disney_db"])
        new_books = [b for b in books if b["title"] not in existing_books]
        new_movies = [m for m in movies if m["title"] not in existing_movies]

        print(f"New books to add: {len(new_books)} | New movies to add: {len(new_movies)}")
        if not new_books and not new_movies:
            print("Nothing new. Notion is already up to date.")
            return

        if new_movies:
            print("\nResolving posters for new films...")
            resolve_covers(new_movies, "movie", tmdb_key)
            print(f"Adding {len(new_movies)} films...")
            fill_rows(token, state["disney_db"], new_movies, "Studio")
        if new_books:
            print("\nResolving covers for new books...")
            resolve_covers(new_books, "book", tmdb_key)
            print(f"Adding {len(new_books)} books...")
            fill_rows(token, state["king_db"], new_books, "Category")
        print("\nUpdate complete.")
        return

    # ---- DRY RUN -------------------------------------------------------- #
    print(f"Stephen King: {len(books)} | Disney/Pixar: {len(movies)}\n")
    print("Resolving Disney/Pixar posters (TMDB)...")
    resolve_covers(movies, "movie", tmdb_key)
    print("\nResolving Stephen King covers (Open Library)...")
    resolve_covers(books, "book", tmdb_key)

    if args.dry_run:
        out = HERE / "covers_preview.json"
        out.write_text(json.dumps({"books": books, "movies": movies}, indent=2))
        print(f"\nDry run complete. Review -> {out}")
        return

    # ---- FIRST FULL RUN: create + fill --------------------------------- #
    if not token or not parent:
        sys.exit("NOTION_TOKEN and NOTION_PARENT_PAGE_ID are required to write to Notion.")
    if state.get("king_db"):
        sys.exit("State file already exists — use --update instead of re-creating databases.")

    print("\nCreating Notion databases...")
    state["king_db"] = create_database(token, parent, "Stephen King — Books", "Category",
                                       ["Novel", "Dark Tower", "Bachman", "Collection"])
    state["disney_db"] = create_database(token, parent, "Disney & Pixar — Films", "Studio",
                                        ["Disney Animation", "Pixar"])
    save_state(state)

    print("\nAdding Stephen King books...")
    fill_rows(token, state["king_db"], books, "Category")
    print("Adding Disney/Pixar films...")
    fill_rows(token, state["disney_db"], movies, "Studio")

    print("\nDone. In each database in Notion:")
    print("  1. Add a Gallery view -> Card preview = Page cover.")
    print("  2. Click the 'Done' column footer -> Calculate -> Percent checked  (= your progress %).")


if __name__ == "__main__":
    main()
