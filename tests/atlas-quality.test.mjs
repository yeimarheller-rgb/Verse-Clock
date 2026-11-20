import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const a=JSON.parse(await readFile('lab-preview/data/atlas-quality.json','utf8'));
const c=a.counts;assert.equal(c.total,c.actionable+c.geographicOnly);assert.equal(c.total,Object.values(a.systems).reduce((n,s)=>n+s.total,0));
for(const field of ['withMissions','withResources','withServices','withPve','withPvp','withLoot','withWeapons','withTrade','withHazards'])assert.ok(c[field]>=0&&c[field]<=c.total,field);
assert.equal(a.records.length,c.total);
assert.ok(c.resourceAssociationsOnly>=0&&c.resourceAssociationsOnly<=c.actionable);
assert.ok(c.verifiedOperationalExcludingCommodityAssociations>=0&&c.verifiedOperationalExcludingCommodityAssociations<=c.actionable);
assert.equal(c.verifiedOperationalExcludingCommodityAssociations+c.resourceAssociationsOnly,c.actionable);

for(const rec of a.records){assert.ok(rec.evidence&&typeof rec.evidence==='object','missing evidence map');for(const [domain,refs] of Object.entries(rec.evidence)){assert.equal(rec.flags[domain],true,'evidence without flag: '+domain);assert.ok(Array.isArray(refs)&&refs.length,'empty evidence: '+domain);for(const ref of refs){assert.ok(['location-api','commodity-api','curated','untraced'].includes(ref.kind),'unknown evidence kind');if(ref.kind==='location-api')assert.ok(ref.url.includes(encodeURIComponent(rec.id)),'location source mismatch');}}}
assert.ok(a.evidenceCoverage.traced<=c.actionable);
console.log('Atlas quality audit validated:',c.total,'locations,',c.actionable,'with operational evidence');
