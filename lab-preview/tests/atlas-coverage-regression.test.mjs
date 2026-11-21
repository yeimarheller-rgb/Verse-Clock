import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const meta = JSON.parse(readFileSync(new URL('../data/atlas-meta.json', import.meta.url), 'utf8'));
const c = meta.counts;
const dimensions = ['withPve','withPvp','withMissions','withLoot','withWeapons','withTrade','withHazards','withServices'];

test('atlas metadata reconciles geographic and actionable coverage', () => {
  assert.equal(c.total, meta.catalogTotal);
  assert.equal(c.total, c.actionable + c.geographicOnly);
  assert.equal(c.total, Object.values(meta.systems).reduce((sum, s) => sum + s.total, 0));
  assert.equal(c.actionable, Object.values(meta.systems).reduce((sum, s) => sum + s.actionable, 0));
  for (const key of dimensions) {
    assert.ok(Number.isInteger(c[key]) && c[key] >= 0 && c[key] <= c.total, key);
  }
});

test('atlas gaps are explicitly reported rather than silently treated as verified', () => {
  const gaps = Object.fromEntries(dimensions.filter(key => c[key] === 0).map(key => [key, 0]));
  const hathor = meta.researchSummary?.hathor ?? null;
  process.stdout.write(JSON.stringify({ catalogTotal: c.total, actionable: c.actionable, geographicOnly: c.geographicOnly, zeroCoverage: gaps, hathorResearch: hathor }) + '\n');
  assert.ok(hathor === null || (Number.isInteger(hathor) && hathor >= 0));
});

test('curated tactical records retain traceable provenance and unique location keys', () => {
  const seed = JSON.parse(readFileSync(new URL('../data/atlas-poi-seed.json', import.meta.url), 'utf8'));
  const seen = new Set();
  for (const poi of seed.locations) {
    const key = [poi.system, poi.name].map(x => String(x || '').trim().toLowerCase()).join('|');
    assert.ok(poi.system && poi.name, 'location must have a system and name');
    assert.ok(!seen.has(key), 'duplicate curated location: ' + key);
    seen.add(key);
    assert.ok(poi.patch && poi.verification, 'missing patch/verification: ' + key);
    const sources = [...(poi.sourceUrls || []), ...(poi.tacticalIntel?.sources || [])];
    assert.ok(sources.length > 0, 'missing evidence source: ' + key);
    for (const url of sources) {
      assert.match(url, /^https:\/\/[^\s/]+(?:\/[^\s]*)?$/, 'invalid evidence URL: ' + key);
    }
    for (const [service, status] of Object.entries(poi.services || {})) {
      assert.ok(['reported', 'confirmed', 'unverified'].includes(status), 'unknown service evidence state: ' + key + ' / ' + service);
    }
  }
});

test('tactical evidence coverage is separated from commodity associations', () => {
  const quality = JSON.parse(readFileSync(new URL('../data/atlas-quality.json', import.meta.url), 'utf8'));
  const domains = ['missions','pve','pvp','loot','weapons','trade','hazards'];
  const records = quality.records;
  assert.equal(records.length, c.total, 'quality report must cover the complete catalog');
  for (const domain of domains) {
    const reported = records.filter(p => p.flags[domain]).length;
    const linked = records.filter(p => (p.evidence[domain] || []).some(e =>
      e.kind === 'location-api' || (e.kind === 'curated' && e.sourceUrls?.length)
    )).length;
    assert.equal(quality.tacticalCoverage[domain].reported, reported, domain + ' reported count');
    assert.equal(quality.tacticalCoverage[domain].sourceLinked, linked, domain + ' source-linked count');
    assert.ok(linked <= reported, domain + ' source-linked exceeds reported');
  }
  const tacticalAny = records.filter(p => domains.some(domain =>
    (p.evidence[domain] || []).some(e =>
      e.kind === 'location-api' || (e.kind === 'curated' && e.sourceUrls?.length)
    )
  )).length;
  assert.equal(quality.tacticalCoverageAny, tacticalAny);
  assert.equal(c.resourceAssociationsOnly + c.verifiedOperationalExcludingCommodityAssociations <= c.actionable, true);
  assert.equal(quality.counts.total, c.total);
});


test('Hathor aliases remain discoverable even without literal Hathor names', () => {
  const seed = JSON.parse(readFileSync(new URL('../data/atlas-poi-seed.json', import.meta.url), 'utf8'));
  const aliases = seed.locations.filter(p => /^(Attritus|Lamina|Ruptura|Vivere) (OLP|PAF-(I|II|III))$/i.test(p.name));
  assert.equal(aliases.length, 16, 'expected four Hathor families, each with OLP and three PAFs');
  assert.equal(meta.researchSummary.hathorCurated, aliases.length);
  assert.equal(meta.researchSummary.hathorCuratedMatched + meta.researchSummary.hathorCuratedUnmatched, aliases.length);
});
