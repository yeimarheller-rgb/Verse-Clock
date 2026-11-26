#!/usr/bin/env python3
"""Fetch Star Citizen Wiki location records into a review-only JSON snapshot.

Never overwrites curated atlas or production. Stdlib only.
Usage: python3 lab-preview/tools/import_wiki_locations.py --version 4.10.3-LIVE.13165946 --limit 100
"""
import argparse
import datetime as dt
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://api.star-citizen.wiki"
OUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "imports" / "wiki-locations-review.json"


def fetch(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "VerseClockLab/0.1 (source-audit)"})
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)


def records(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        if "data" not in payload or not isinstance(payload["data"], list):
            raise ValueError("Expected paginated API response with data array")
        return payload["data"]
    raise ValueError("Unexpected API response")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True, help="Explicit API game version, never inferred from LIVE")
    parser.add_argument("--limit", type=int, default=100, help="Maximum number of records to fetch")
    parser.add_argument("--output", type=pathlib.Path, default=OUT)
    args = parser.parse_args()
    if args.limit < 1 or args.limit > 10000:
        parser.error("--limit must be between 1 and 10000")
    if not args.version.strip():
        parser.error("--version must not be empty")
    collected = []
    page = 1
    while len(collected) < args.limit:
        query = urllib.parse.urlencode({"version": args.version, "page": page})
        url = BASE + "/locations?" + query
        payload = fetch(url)
        batch = records(payload)
        if not batch:
            break
        for item in batch[: args.limit - len(collected)]:
            if not isinstance(item, dict):
                continue
            collected.append({
                "sourceId": item.get("uuid") or item.get("id"),
                "name": item.get("name"),
                "sourcePatch": args.version,
                "sourceUrl": url,
                "retrievedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
                "verification": "api-catalog-not-live-confirmed",
                "evidenceScope": "location-listed",
                "raw": item,
            })
        meta = payload.get("meta", {}) if isinstance(payload, dict) else {}
        last = meta.get("last_page")
        if last is not None and page >= int(last):
            break
        page += 1
        if page > 100:
            raise RuntimeError("Safety stop after 100 pages")
    result = {
        "source": BASE + "/locations",
        "version": args.version,
        "reviewOnly": True,
        "count": len(collected),
        "records": collected,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Review-only snapshot: {len(collected)} records -> {args.output}")


if __name__ == "__main__":
    main()
