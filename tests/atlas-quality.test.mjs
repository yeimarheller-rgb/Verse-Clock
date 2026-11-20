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
assert.equal(a.researchQueue.length,a.researchSummary.total);
assert.equal(a.seedOnlyResearchQueue.length,a.seedOnlyCounts.total);
for(const item of a.seedOnlyResearchQueue){assert.ok(item.name&&item.system);assert.ok(item.missingDomains.every(d=>['missions','pve','pvp','loot','weapons','trade','hazards','services'].includes(d)));assert.ok(item.reason.includes('no exact API catalog match'));}
assert.equal(new Set(a.researchQueue.map(x=>x.id)).size,a.researchQueue.length);
for(const item of a.researchQueue){
 assert.ok(a.records.some(r=>r.id===item.id),'unknown research target');
 assert.ok(item.missingDomains.every(d=>a.records.find(r=>r.id===item.id).flags[d]===false),'incorrect missing domain');
 assert.ok(Number.isFinite(item.score),'missing priority score');
}
assert.ok(a.researchQueue.every((x,i,arr)=>i===0||arr[i-1].score>=x.score),'research queue not sorted');
console.log('Atlas quality audit validated:',c.total,'locations,',c.actionable,'with operational evidence');
