#!/usr/bin/env python3
"""Transform covers_preview.json into Notion create-pages `pages` arrays."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
data = json.loads((HERE / "covers_preview.json").read_text())

def build(items, label_key):
    pages = []
    for it in items:
        props = {
            "Name": it["title"],
            "Year": it["year"],
            label_key: it[label_key.lower()],
            "Cover URL": it["cover"],
        }
        page = {"properties": props}
        if it["cover"]:
            page["cover"] = it["cover"]
        pages.append(page)
    return pages

movies = build(data["movies"], "Studio")
books = build(data["books"], "Category")

(HERE / "pages_movies.json").write_text(json.dumps(movies, ensure_ascii=False))
(HERE / "pages_books.json").write_text(json.dumps(books, ensure_ascii=False))
print(f"movies: {len(movies)}  books: {len(books)}")
