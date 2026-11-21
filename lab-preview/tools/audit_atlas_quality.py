#!/usr/bin/env python3
"""Read-only atlas coverage audit. No inferred tactical facts."""
import json
import sys
from pathlib import Path

FIELDS = ("pve", "pvp", "missions", "loot", "weapons", "trade", "hazards")
EMPTY = (None, "", [], {}, False)

def main(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    print("catalogTotal:", data.get("catalogTotal"))
    print("enrichedCount (not a quality metric):", data.get("enrichedCount"))
    print("declared coverage:", json.dumps(data.get("coverage", {}), ensure_ascii=False))
    records = next((data[k] for k in ("locations", "entries", "items", "records") if isinstance(data.get(k), list)), None)
    if records is None:
        print("BLOCKED: record array schema not identified; no quality claims", file=sys.stderr)
        return 2
    print("records inspected:", len(records))
    counts = {k: 0 for k in FIELDS}
    weak = []
    for i, item in enumerate(records):
        if not isinstance(item, dict):
            weak.append({"index": i, "reason": "non-object"})
            continue
        tactical = 0
        for key in FIELDS:
            value = item.get(key)
            if value not in EMPTY:
                counts[key] += 1
                tactical += 1
        if tactical == 0:
            weak.append({"index": i, "name": item.get("name") or item.get("label") or item.get("id"), "reason": "no direct tactical fields"})
    print("direct field presence (not fact verification):", json.dumps(counts))
    print("records with no direct tactical fields:", len(weak))
    print("sample:", json.dumps(weak[:25], ensure_ascii=False))
    print("NOTE: nested schemas require an explicit mapping; presence is not source verification.")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "lab-preview/data/atlas-enriched.json"))
