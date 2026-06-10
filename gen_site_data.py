#!/usr/bin/env python3
"""Build docs/data.json for the GitHub Pages site from covers_preview.json."""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
src = json.loads((HERE / "covers_preview.json").read_text())


def slug(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def build(items, group_key, kind):
    out = []
    for it in items:
        out.append({
            "id": f"{kind}:{slug(it['title'])}-{it['year']}",
            "title": it["title"],
            "year": it["year"],
            "group": it[group_key],
            "cover": it.get("cover") or "",
        })
    out.sort(key=lambda x: (x["year"], x["title"]))
    return out


data = {
    "movies": build(src["movies"], "studio", "movie"),
    "books": build(src["books"], "category", "book"),
}

docs = HERE / "docs"
docs.mkdir(exist_ok=True)
(docs / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
print(f"docs/data.json: {len(data['movies'])} movies, {len(data['books'])} books")
