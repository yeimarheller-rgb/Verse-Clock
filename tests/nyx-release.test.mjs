import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {applyNyxI, canReleaseNyxI, isNyxI} from '../lab-preview/src/nyx-release.js';
import {atlasKey} from '../lab-preview/src/tactical-atlas.js';

const prepared=JSON.parse(readFileSync(new URL('../lab-preview/data/nyx-i-5.0.json',import.meta.url)));

test('Nyx I opens on verified 5.x LIVE and stays closed for PTU and the 4.10 atlas',()=>{
 assert.equal(canReleaseNyxI({code:'4.10.3-LIVE.13165946',channel:'live'}),false);
 assert.equal(canReleaseNyxI({code:'5.0.0-PTU.13248297',channel:'ptu'}),false);
 assert.equal(canReleaseNyxI({code:'5.0.0-LIVE.99999999',channel:'ptu'}),false);
 assert.equal(canReleaseNyxI({code:'5.0.0-LIVE.99999999',channel:'live'}),true);
 assert.equal(canReleaseNyxI(null,'5.0.0-LIVE.99999999'),true);
 assert.equal(canReleaseNyxI(null,'5.0.0-PTU.13248297'),false);
 assert.equal(isNyxI({system:'Nyx System',name:'Site',parent:'Nyx 1'}),true);
 assert.equal(isNyxI({system:'Nyx',name:'Nyx II'}),false);
});

test('Nyx I preserves a real LIVE destination and displays sourced PTU findings as provisional',()=>{
 const live={name:'Liberated Stronghold Linton',system:'Nyx',parent:'Nyx I',
  id:prepared.locations.find(row=>row.name==='Liberated Stronghold Linton').id,services:{repair:'reported'}};
 const byKey=new Map([[atlasKey(live),live]]);
 applyNyxI(byKey,prepared);
 assert.equal(byKey.size,491);
 const fort=byKey.get(atlasKey(live));
 assert.deepEqual(fort.services,live.services);
 assert.match(fort.nyxReleaseSections[1].text,/370 puntos/);
 assert.match(fort.nyxReleaseSections[1].status,/5\.0\.0-PTU\.13248297/);
 assert.equal(prepared.locations.filter(row=>row.loot).length,44);
 assert.equal(prepared.locations.filter(row=>row.beds).length,10);
 assert.ok([...byKey.values()].every(p=>!p.services?.refuel));
});
