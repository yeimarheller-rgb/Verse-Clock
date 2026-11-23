import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {atlasKey,atlasSystem,mergeTacticalAtlas} from '../lab-preview/src/tactical-atlas.js';
import {mergeStanton} from '../lab-preview/src/stanton.js';
import {locationDossier} from '../lab-preview/src/location-dossier.js';

const read=name=>JSON.parse(readFileSync(new URL('../lab-preview/data/'+name+'.json',import.meta.url)));
const wiki=read('wiki-atlas');
const map=new Map(read('atlas-poi-seed').locations.map(p=>[atlasKey(p),p]));
for(const row of wiki.locations){
 const key=atlasKey(row);
 map.set(key,{...row,...map.get(key),system:atlasSystem(row.system),source:row.source});
}
mergeTacticalAtlas(map,read('atlas-services'),wiki.version);
mergeStanton(map,read('stanton-intel'),null,read('stanton-certified-evidence'));

const model=(name,system='Stanton',options={})=>locationDossier(map.get(atlasKey({name,system})),options);
const text=(dossier,domain)=>dossier.groups.get(domain)?.map(fact=>fact.text).join('\n')||'';

test('a Hathor PAF has one account of the hazards, one weapon list and its route sources',()=>{
 const dossier=model('Ruptura PAF-I');
 const facts=[...dossier.groups.values()].flat().map(fact=>fact.text);
 const all=facts.join(' ');
 assert.equal((all.match(/Valakkar juveniles/g)||[]).length,1);
 assert.equal((all.match(/S71 Justified/g)||[]).length,1);
 assert.match(all,/XL Purchase Order/);
 assert.doesNotMatch(all,/Carinite/);
 assert.ok(dossier.sources.some(source=>source.url.includes('Planetary_alignment_facilities')));
 assert.equal(new Set(dossier.sources.map(source=>source.url)).size,dossier.sources.length);
});

test('operations changes emphasis without duplicating services or tactical claims',()=>{
 const seraphim=model('Seraphim Station','Stanton',{operations:true});
 assert.equal(seraphim.services.get('repair').state,'reported');
 assert.equal(seraphim.services.get('rearm').state,'confirmed');
 assert.doesNotMatch(text(seraphim,'services'),/Reparación de nave/);
 const everus=model('Everus Harbor');
 assert.equal(everus.services.get('rearm').state,'confirmed');
 assert.equal((text(everus,'services').match(/asiento de piloto/g)||[]).length,1);
 const ghost=model('Ghost Hollow');
 assert.match(text(ghost,'combat'),/Nine Tails/);
 assert.match(text(ghost,'missions'),/Remove Illegal Occupants/);
 const checkmate=model('Checkmate','Pyro');
 assert.equal(checkmate.groups.get('combat').length,1);
 assert.match(text(checkmate,'loot'),/Placas 1, 2 y 3/);
});

test('a terminal with a direct sourced record replaces the older general catalog description',()=>{
 const rappel=model('Rappel');
 assert.match(text(rappel,'services'),/RAPPE, ID 274/);
 assert.doesNotMatch(text(rappel,'services'),/UEX #274/);
 assert.ok(rappel.sources.some(source=>source.url.includes('/terminals/info/name/scrap-commodities-rappel')));
});
