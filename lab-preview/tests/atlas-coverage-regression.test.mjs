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

test('Hathor OLP and PAF cards preserve different mission and loot scopes', () => {
 const seed = JSON.parse(readFileSync(new URL('../data/atlas-poi-seed.json', import.meta.url), 'utf8'));
 const hathor = seed.locations.filter(p => /^hathor-(attritus|lamina|ruptura|vivere)-(olp|paf-(i|ii|iii))$/i.test(p.id));
 assert.equal(hathor.length,16);
 assert.equal(hathor.filter(p => /-olp$/.test(p.id)).length,4);
 assert.equal(hathor.filter(p => /-paf-/.test(p.id)).length,12);
 for(const p of hathor){
  assert.ok(p.tacticalIntel?.steps?.length >= 4, p.id+' needs actionable activity steps');
  assert.ok(p.operationalNotes?.missionContext, p.id+' needs mission scope');
  assert.ok(p.operationalNotes?.failureRisks?.length, p.id+' needs documented failure risks');
  assert.ok(p.lootIntel?.categories?.length, p.id+' needs loot scope');
  assert.ok(p.lootIntel?.caveat, p.id+' needs loot caveat');
  assert.ok(p.sourceUrls?.length, p.id+' needs sources');
 }
 const ui = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
 for(const field of ['op.missionContext','op.failureRisks','p.lootIntel.categories','p.lootIntel.caveat']){
  assert.ok(ui.includes(field),field+' must render in the UI');
 }
});

test('Hurston repair guidance never upgrades old API service listings to verified LIVE repairs', () => {
  const seed = JSON.parse(readFileSync(new URL('../data/atlas-poi-seed.json', import.meta.url), 'utf8'));
  const names = ['HDMS-Edmond', 'HDMS-Hadley', 'HDMS-Oparei'];
  for (const name of names) {
    const poi = seed.locations.find(p => p.system === 'Stanton' && p.parent === 'Hurston' && p.name === name);
    assert.ok(poi, name + ': missing from curated atlas');
    assert.equal(poi.verification, 'api-catalog-prior-patch', name);
    assert.match(poi.patch, /4\.9\.0/, name + ': source patch missing');
    assert.equal(poi.services.vehicleServices, 'reported', name);
    assert.notEqual(poi.repairIntel.ship.status, 'confirmed', name + ': ship repair falsely confirmed');
    assert.notEqual(poi.repairIntel.groundVehicle.status, 'confirmed', name + ': ground repair falsely confirmed');
    assert.ok(poi.repairIntel.sources?.length, name + ': service source missing');
    assert.match(poi.repairIntel.note, /4\.10\.3/, name + ': current-patch caveat missing');
  }
  for (const poi of seed.locations.filter(p => p.system === 'Stanton' && p.parent === 'Hurston' && /^HDSF-/.test(p.name))) {
    assert.notEqual(poi.repairIntel?.ship?.status, 'confirmed', poi.name + ': undocumented repair');
    assert.ok(poi.sourceUrls?.length, poi.name + ': missing identification provenance');
  }
});


test('Hathor PAF mission evidence is patch-scoped and rendered without guaranteeing assignment', () => {
 const seed=JSON.parse(readFileSync(new URL('../data/atlas-poi-seed.json', import.meta.url),'utf8'));
 const paf=seed.locations.filter(p=>p.type==='planetary-alignment-facility');
 assert.equal(paf.length,12);
 for(const p of paf){
  const m=p.operationalNotes?.missionEvidence4103;
  assert.ok(m,p.id+' missing mission evidence');
  assert.equal(m.sourcePatch,'4.10.3-LIVE.13165946');
  assert.match(m.locationScope,/no garantiza/i);
  assert.ok(p.sourceUrls.includes(m.source));
 }
 const ui=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 assert.ok(ui.includes('op.missionEvidence4103'));
});


test('station and gateway records do not silently assert verified repair or live stock', () => {
 const seed=JSON.parse(readFileSync(new URL('../data/atlas-poi-seed.json',import.meta.url),'utf8'));
 const stations=seed.locations.filter(p=>['station','orbital-station','gateway'].includes(p.type));
 assert.ok(stations.length>=20,'station coverage unexpectedly reduced');
 for(const p of stations){
  assert.ok(p.sourceUrls?.length,p.id+': no location provenance');
  assert.notEqual(p.repairIntel?.ship?.status,'confirmed',p.id+': unproven LIVE repair');
  assert.notEqual(p.repairIntel?.groundVehicle?.status,'confirmed',p.id+': unproven LIVE vehicle repair');
  assert.ok(!p.services || !Object.values(p.services).includes('confirmed'),p.id+': unproven LIVE service');
 }
});
