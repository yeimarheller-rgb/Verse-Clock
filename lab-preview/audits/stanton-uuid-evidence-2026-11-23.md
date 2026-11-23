# Stanton 90+ — UUID evidence checkpoint (2026-11-23)

Scope: LAB only, branch lab/tactical-atlas. No application UI or production modifications.

## Reproducible inputs
- atlas-enriched.json blob: 5db15310aac5a9a190d1fc790eaef08158e8211f
- stanton-intel.json blob: 8a5e02c494a3d305d9fe24ae7c44d406037f026e
- stanton.js blob: c2ade5884c925691cd728f29672955d270e3ed84

## Independent raw-data inspection
- 949 Stanton System inventory rows, 949 unique source UUIDs.
- 781 intel records, 690 UUID matches in the inventory.
- 663 matching UUIDs contain at least one candidate documented claim with a recognized field, nonempty text and a source URL.
- 1,169 such claims across matching UUIDs (raw prevalidation).
- These counts are NOT an execution of stantonCoverage() on the merged visible atlas and are NOT semantically certified.
- 855/949 required for 90%; candidate shortfall is 192, not a certified shortfall.

## Source-specificity red flags
Source reuse among candidate documented claims:
- GitHub scunpacked starmap.json: 123 citations.
- Star Citizen Wiki Onyx_Facility: 120 citations.
- GitHub scunpacked starmap_positions.json: 112 citations.
- ParaMed_Medical_Device: 22 citations.
- Pancea_MedGel_Canister: 22 citations.
These sources may be useful for catalog, class or general item information, but do not independently prove local NPCs, missions, loot, access or ship services for every UUID citing them.

## Blocking defect and next steps
stantonCoverage() currently checks URL structure through httpsSource(), not that the source establishes the claim at the particular UUID. mergeStanton() can similarly mark services confirmed. Before changing the semantic validator, establish a backward-compatible per-claim attestation strategy and audit a representative geographic batch (Hurston, Crusader, microTech, ArcCorp and moons). Require a location-specific source or a traceable per-UUID extraction, with patch and uncertainty. Preserve unverified claims as visible but not certified.

No new certified UUIDs, no tests or deployment claimed by this checkpoint. The previously approved Chromium UI and production remain unchanged. Pyro expansion remains gated on independent 90% certification.
