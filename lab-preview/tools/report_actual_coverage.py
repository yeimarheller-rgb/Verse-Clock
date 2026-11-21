#!/usr/bin/env python3
"""Quality gate for VERSE CLOCK LAB. Reads atlas-meta.json without modifying production."""
import json
import sys
from pathlib import Path

def assess(meta):
    counts = meta["counts"]
    total = counts["total"]
    operational = counts["verifiedOperationalExcludingCommodityAssociations"]
    resource_only = counts["resourceAssociationsOnly"]
    if total <= 0 or operational > total or resource_only > counts["actionable"]:
        raise ValueError("inconsistent atlas counters")
    categories = ("withPve", "withPvp", "withMissions", "withLoot", "withWeapons", "withTrade", "withHazards", "withServices")
    return {
        "catalog_total": total,
        "operational_without_commodity_only": operational,
        "operational_percent": round(100 * operational / total, 2),
        "resource_associations_only": resource_only,
        "hathor_research_entries": meta.get("researchSummary", {}).get("hathor"),
        "category_presence_not_completeness": {k: counts[k] for k in categories},
        "warnings": ["Resource associations are not confirmed deposits or loot",
                     "Field presence is not proof of completeness or LIVE verification"]
    }

def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "lab-preview/data/atlas-meta.json")
    print(json.dumps(assess(json.loads(path.read_text(encoding="utf-8"))), indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
