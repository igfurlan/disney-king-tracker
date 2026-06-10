#!/usr/bin/env python3
"""Fill the 'Poster' (Files & media) property on every row with its cover image,
so gallery card previews render the actual image."""
import json
import os
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
API = "https://api.notion.com/v1"
VER = "2022-06-28"
DBS = ["63911c4f41564168a417149554ec934c", "ed34c550235e420f8d76016c2ac5c415"]

for line in (HERE / ".env").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

H = {"Authorization": f"Bearer {os.environ['NOTION_TOKEN']}",
     "Notion-Version": VER, "Content-Type": "application/json"}

data = json.loads((HERE / "covers_preview.json").read_text())
cover_of = {it["title"]: it["cover"] for it in data["movies"] + data["books"]}

done = 0
for db in DBS:
    cursor = None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        r = requests.post(f"{API}/databases/{db}/query", headers=H, json=body, timeout=30)
        r.raise_for_status()
        d = r.json()
        for p in d["results"]:
            t = p["properties"].get("Name", {}).get("title", [])
            if not t:
                continue
            title = t[0]["plain_text"]
            cover = cover_of.get(title)
            if not cover:
                continue
            payload = {"properties": {"Poster": {"files": [
                {"name": (title[:90] or "cover"), "type": "external", "external": {"url": cover}}]}}}
            pr = requests.patch(f"{API}/pages/{p['id']}", headers=H, json=payload, timeout=30)
            done += 1 if pr.status_code < 300 else 0
            if pr.status_code >= 300:
                print("ERR", title, pr.status_code, pr.text[:200])
            time.sleep(0.34)
        if not d.get("has_more"):
            break
        cursor = d["next_cursor"]
print(f"Posters set on {done} rows.")
