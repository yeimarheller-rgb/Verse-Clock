import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const a=JSON.parse(await readFile('lab-preview/data/atlas-quality.json','utf8'));
const c=a.counts;assert.equal(c.total,c.actionable+c.geographicOnly);assert.equal(c.total,Object.values(a.systems).reduce((n,s)=>n+s.total,0));
for(const field of ['withMissions','withResources','withServices','withPve','withPvp','withLoot','withWeapons','withTrade','withHazards'])assert.ok(c[field]>=0&&c[field]<=c.total,field);
assert.equal(a.records.length,c.total);
assert.ok(c.resourceAssociationsOnly>=0&&c.resourceAssociationsOnly<=c.actionable);
assert.ok(c.verifiedOperationalExcludingCommodityAssociations>=0&&c.verifiedOperationalExcludingCommodityAssociations<=c.actionable);
assert.equal(c.verifiedOperationalExcludingCommodityAssociations+c.resourceAssociationsOnly,c.actionable);

console.log('Atlas quality audit validated:',c.total,'locations,',c.actionable,'with operational evidence');
