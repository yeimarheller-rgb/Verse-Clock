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
