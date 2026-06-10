#!/usr/bin/env python3
"""Populate the two existing (MCP-created) Notion databases from covers_preview.json
using the NOTION_TOKEN integration. Idempotent: skips titles already present."""
import json
import os
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
API = "https://api.notion.com/v1"
VER = "2022-06-28"

DISNEY_DB = "63911c4f41564168a417149554ec934c"
KING_DB = "ed34c550235e420f8d76016c2ac5c415"

# load .env
for line in (HERE / ".env").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

TOKEN = os.environ["NOTION_TOKEN"]
H = {"Authorization": f"Bearer {TOKEN}", "Notion-Version": VER, "Content-Type": "application/json"}


def existing_titles(db_id):
    titles, cursor = set(), None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        r = requests.post(f"{API}/databases/{db_id}/query", headers=H, json=body, timeout=30)
        r.raise_for_status()
        d = r.json()
        for p in d["results"]:
            t = p["properties"].get("Name", {}).get("title", [])
            if t:
                titles.add(t[0]["plain_text"])
        if not d.get("has_more"):
            return titles
        cursor = d["next_cursor"]


def add_row(db_id, name, year, label_key, label_val, cover):
    props = {
        "Name": {"title": [{"text": {"content": name}}]},
        "Year": {"number": year},
        label_key: {"select": {"name": label_val}},
        "Done": {"checkbox": False},
    }
    if cover:
        props["Cover URL"] = {"url": cover}
        # Poster (Files & media) is what the gallery card previews render.
        props["Poster"] = {"files": [{"name": name[:90] or "cover",
                                      "type": "external", "external": {"url": cover}}]}
    body = {"parent": {"database_id": db_id}, "properties": props}
    if cover:
        body["cover"] = {"type": "external", "external": {"url": cover}}
    r = requests.post(f"{API}/pages", headers=H, json=body, timeout=30)
    if r.status_code >= 300:
        print(f"  ! {name}: {r.status_code} {r.text}", file=sys.stderr)
        return False
    return True


def run(db_id, items, label_key):
    have = existing_titles(db_id)
    added = 0
    for it in items:
        if it["title"] in have:
            continue
        ok = add_row(db_id, it["title"], it["year"], label_key, it[label_key.lower()], it["cover"])
        added += 1 if ok else 0
        print(f"  [{added}] {it['title']} ({it['year']})")
        time.sleep(0.34)
    return added


def main():
    data = json.loads((HERE / "covers_preview.json").read_text())
    print("Disney/Pixar:")
    m = run(DISNEY_DB, data["movies"], "Studio")
    print("Stephen King:")
    b = run(KING_DB, data["books"], "Category")
    print(f"\nDone. Added {m} films, {b} books.")


if __name__ == "__main__":
    main()
