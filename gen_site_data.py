#!/usr/bin/env python3
"""Build docs/data.json for the GitHub Pages site from covers_preview.json,
merging Brazilian titles from data/titles_pt.json."""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
src = json.loads((HERE / "covers_preview.json").read_text())
pt = json.loads((HERE / "data" / "titles_pt.json").read_text())

GROUP_PT = {
    "Disney Animation": "Animação Disney",
    "Pixar": "Pixar",
    "Novel": "Romance",
    "Dark Tower": "A Torre Negra",
    "Bachman": "Bachman",
    "Collection": "Coletânea",
}


def slug(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def build(items, group_key, kind):
    out = []
    for it in items:
        out.append({
            "id": f"{kind}:{slug(it['title'])}-{it['year']}",
            "title": pt.get(it["title"], it["title"]),   # pt-BR primary
            "title_en": it["title"],
            "year": it["year"],
            "group": GROUP_PT.get(it[group_key], it[group_key]),
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
print(f"docs/data.json: {len(data['movies'])} filmes, {len(data['books'])} livros")
