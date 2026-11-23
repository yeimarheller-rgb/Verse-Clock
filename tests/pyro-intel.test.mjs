import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyPyroIntel} from '../lab-preview/src/pyro.js';
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
 assert.equal(applyPyroIntel(byKey,rows,snapshot,'outdated'),null);
 assert.deepEqual(applyPyroIntel(byKey,rows,snapshot,catalogue.version),{
  total:586,reviewed:586,counts:{jump:127,visible:103,hidden:57,unplaced:295,technical:4},
 });
 const reviewed=[...byKey.values()].filter(row=>row.pyroIntel);
 assert.equal(reviewed.length,586);
 const hubs=reviewed.filter(row=>row.name.startsWith('Lazarus Transport Hub'));
 const sites=new Map(pyro.map(row=>[row.id,row]));
 assert.equal(hubs.length,6);
 for(const hub of hubs){
  const id=hub.pyroIntel.sections[0].destinations[0].uuid;
  assert.equal(sites.get(id).name,hub.name.replace('Transport Hub','Complex'));
  assert.equal(snapshot.records[id],'hidden');
  assert.equal(hub.services?.repair,undefined);
 }
 assert.equal(Object.keys(snapshot.details).length,22);
 assert.equal(Object.keys(snapshot.parentReferences).length,220);
 for(const [child,parent] of Object.entries(snapshot.parentReferences)){
  assert.equal(snapshot.records[child],'unplaced');
  assert.equal(sites.get(child).parent,sites.get(parent).name);
  const marker=byKey.get(atlasKey(sites.get(child))).pyroIntel.marker;
  assert.equal(marker.parentUuid,parent);
  assert.match(marker.text,/carece de posición/);
 }
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
