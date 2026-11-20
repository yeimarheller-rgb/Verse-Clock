import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildCommodityIndex} from '../tools/atlas-commodities-core.mjs';

const catalog={version:'4.10.3-LIVE.TEST',locations:[
 {id:'UUID-A',name:'Outpost',parent:'Daymar',system:'Stanton'},
 {id:'UUID-B',name:'Outpost',parent:'Cellin',system:'Stanton'}
]};
test('exact UUID join: same name in two places cannot leak resources',()=>{
 const d=buildCommodityIndex(catalog,[{
  uuid:'resource-1',name:'Test mineral',kind:'mineable',
  locations:[{uuid:'UUID-B',name:'Outpost',entries:[{resource_kind:'ore'}]}]
 }],'2026-11-20T00:00:00Z');
 assert.equal(d.counts.linkedLocations,1);
 assert.equal(d.locations[0].id,'UUID-B');
 assert.equal(d.locations[0].resources[0].name,'Test mineral');
 assert.equal(d.locations.find(x=>x.id==='UUID-A'),undefined);
});
test('reject unlinked commodity, unknown UUID and inventory-like commodity',()=>{
 const d=buildCommodityIndex(catalog,[
 {uuid:'unlinked',name:'Test component',kind:null,locations:[{uuid:'UUID-A'}]},
 {uuid:'unknown',name:'Test plant',kind:'harvestable',locations:[{uuid:'nonexistent'}]},
 {uuid:'duplicate',name:'Test mineral',kind:'mineable',locations:[{uuid:'UUID-B'},{uuid:'UUID-B'}]}
 ]);
 assert.equal(d.counts.linkedLocations,1);
 assert.equal(d.counts.unmatchedLocationLinks,1);
 assert.equal(d.counts.resourceLinks,1);
});
test('reject malformed or versionless catalog',()=>{
 assert.throws(()=>buildCommodityIndex({locations:[]},[]));
});

test('published resource index references only exact catalog UUIDs on the same patch',async()=>{
 const {readFile}=await import('node:fs/promises');
 const [catalog,linked]=await Promise.all([
  readFile('lab-preview/data/wiki-atlas.json','utf8').then(JSON.parse),
  readFile('lab-preview/data/atlas-commodities.json','utf8').then(JSON.parse)
 ]);
 const ids=new Set(catalog.locations.map(l=>l.id));
 assert.equal(linked.version,catalog.version);
 assert.equal(linked.counts.linkedLocations,linked.locations.length);
 assert.ok(linked.locations.length>0,'Nonempty verified resource index');
 for(const location of linked.locations){
  assert.ok(ids.has(location.id),'Commodity cannot attach to unknown location '+location.id);
  for(const resource of location.resources){
   assert.equal(resource.source.locationUuid,location.id);
   assert.equal(resource.source.version,catalog.version);
   assert.ok(resource.name);
  }
 }
});
