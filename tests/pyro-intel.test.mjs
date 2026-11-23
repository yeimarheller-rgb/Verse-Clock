import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyCatalogIntel} from '../lab-preview/src/catalog-intel.js';
import {identifyCatalogVariants} from '../lab-preview/src/stanton.js';
import {atlasKey, mergeTacticalAtlas} from '../lab-preview/src/tactical-atlas.js';

const read=name=>JSON.parse(readFileSync(new URL('../lab-preview/data/'+name+'.json',import.meta.url)));
const catalogue=read('wiki-atlas');
const snapshot=read('pyro-intel');
const rows=identifyCatalogVariants(catalogue.locations,'Pyro');
const pyro=rows.filter(row=>row.system==='Pyro System');

test('the Pyro inventory uses unique UUIDs and distinguishes map evidence from tactical claims',()=>{
 const byKey=new Map(pyro.map(row=>[atlasKey(row),row]));
 assert.equal(byKey.size,586);
 assert.equal(applyCatalogIntel(byKey,rows,snapshot,'outdated','Pyro'),null);
 assert.deepEqual(applyCatalogIntel(byKey,rows,snapshot,catalogue.version,'Pyro'),{
  total:586,reviewed:586,counts:{jump:127,visible:103,hidden:57,unplaced:295,technical:4},
 });
 const reviewed=[...byKey.values()].filter(row=>row.catalogIntel);
 assert.equal(reviewed.length,586);
 const hubs=reviewed.filter(row=>row.name.startsWith('Lazarus Transport Hub'));
 const sites=new Map(pyro.map(row=>[row.id,row]));
 assert.equal(hubs.length,6);
 for(const hub of hubs){
  const id=hub.catalogIntel.sections[0].destinations[0].uuid;
  assert.equal(sites.get(id).name,hub.name.replace('Transport Hub','Complex'));
  assert.equal(snapshot.records[id],'hidden');
  assert.equal(hub.services?.repair,undefined);
 }
 assert.ok(Object.keys(snapshot.details).every(id=>sites.has(id)));
 assert.equal(Object.keys(snapshot.parentReferences).length,220);
 for(const [child,parent] of Object.entries(snapshot.parentReferences)){
  assert.equal(snapshot.records[child],'unplaced');
  assert.equal(sites.get(child).parent,sites.get(parent).name);
  const marker=byKey.get(atlasKey(sites.get(child))).catalogIntel.marker;
  assert.equal(marker.parentUuid,parent);
  assert.match(marker.text,/carece de posición/);
 }
});

test('Pyro loot preserves the distinction between exterior salvage and location spawns',()=>{
 const byKey=new Map(pyro.map(row=>[atlasKey(row),row]));
 applyCatalogIntel(byKey,rows,snapshot,catalogue.version,'Pyro');
 const sections=name=>byKey.get(atlasKey({system:'Pyro',name})).catalogIntel.sections;
 const salvage=sections("Chawla's Beach").find(s=>s.title.includes('salvamento al aire libre'));
 assert.match(salvage.text,/XL-1.*restos abandonados/);
 assert.match(salvage.status,/pendientes de comprobar/);
 assert.ok(!sections('Rustville').some(s=>s.text.includes('XL-1')));
 assert.equal(sections('RAB-ALPHA')[0].icons[0],'loot');
 assert.equal(sections('PYAM-FARSTAT-1-3')[0].icons[0],'landing');
});

test('reported Pyro ship services attach to the exact station and do not confer rearm',()=>{
 const byKey=new Map(rows.map(row=>[atlasKey(row),row]));
 const services=read('atlas-services');
 mergeTacticalAtlas(byKey,services,catalogue.version);
 const get=(system,name)=>byKey.get(atlasKey({system,name}));
 const patch=get('Pyro','Patch City');
 assert.equal(patch.services.repair,'reported');
 assert.equal(patch.services.refuel,'reported');
 assert.equal(patch.services.rearm,undefined);
 assert.equal(patch.serviceIntel.id,34);
 assert.equal(get('Pyro','Nyx Gateway').serviceIntel.id,55);
 assert.notEqual(get('Stanton','Nyx Gateway').serviceIntel.id,55);
});

test('Pyro body dossiers link to documented landing services without claiming ground repairs',()=>{
 const byKey=new Map(pyro.map(row=>[atlasKey(row),{...row,system:'Pyro'}]));
 mergeTacticalAtlas(byKey,read('atlas-services'),catalogue.version);
 applyCatalogIntel(byKey,rows,snapshot,catalogue.version,'Pyro');
 const get=name=>byKey.get(atlasKey({system:'Pyro',name}));
 const vatra=get('Vatra');
 const seers=get("Seer's Canyon");
 assert.equal(vatra.catalogIntel.sections[0].destinations[0].uuid,seers.id);
 assert.equal(seers.services.repair,'reported');
 assert.equal(seers.services.rearm,undefined);
 assert.match(seers.catalogIntel.sections.find(s=>s.title.includes('Vehículos terrestres')).text,/pendiente/);
 assert.equal(get("Jackson's Swap").services.repair,undefined);
});

test('Nyx keeps both BRK-204 variants and routes to the correct Levski hospital',()=>{
 const snapshot=read('nyx-intel');
 const nyx=identifyCatalogVariants(catalogue.locations,'Nyx').filter(row=>row.system==='Nyx System');
 const byKey=new Map(nyx.map(row=>[atlasKey(row),row]));
 assert.equal(byKey.size,482);
 assert.deepEqual(applyCatalogIntel(byKey,nyx,snapshot,catalogue.version,'Nyx'),{
  total:482,reviewed:482,counts:{jump:18,visible:1,hidden:93,unplaced:369,technical:1},
 });
 const levski=byKey.get(atlasKey({system:'Nyx',name:'Levski'}));
 const hospital=levski.catalogIntel.sections.find(s=>s.title==='Hospital de Levski').destinations[0].uuid;
 assert.equal(nyx.find(row=>row.id===hospital).parent,'Levski');
 const variants=[...byKey.values()].filter(row=>row.name==='QV Breaker Station BRK-204');
 const [placed,unplaced]=variants.sort((a,b)=>snapshot.records[a.id]==='jump'?-1:1);
 assert.equal(snapshot.records[placed.id],'jump');
 assert.equal(snapshot.records[unplaced.id],'unplaced');
 assert.equal(unplaced.catalogIntel.sections[0].destinations[0].uuid,placed.id);
});

test('Nyx applies QV resource, danger and Vanduul loot only to the matching station families',()=>{
 const snapshot=read('nyx-intel');
 const nyx=identifyCatalogVariants(catalogue.locations,'Nyx').filter(row=>row.system==='Nyx System');
 const byKey=new Map(nyx.map(row=>[atlasKey(row),row]));
 applyCatalogIntel(byKey,nyx,snapshot,catalogue.version,'Nyx');
 const labels=[
  ['QV Breaker Station','Sadaryx · minería a mano',82],
  ['QV Extraction Station','Peligro crítico · defensas láser anticapital',50],
  ['QV Logistics Station','Botín Vanduul · Testudo y materiales',291],
 ];
 for(const [family,title,count] of labels){
  const matched=[...byKey.values()].filter(row=>row.catalogIntel.sections.some(section=>section.title===title));
  assert.equal(matched.length,count);
  assert.ok(matched.every(row=>row.name===family||row.name.startsWith(family+' ')));
 }
});
