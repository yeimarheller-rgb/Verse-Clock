import test from 'node:test';import assert from 'node:assert/strict';import {securityFor} from '../src/security.js';import {lootFor} from '../src/loot.js';
for(const name of ['Hathor OLP Attritus','OLP-Lamina','PAF-1','Ruptura','Vivere'])test('Hathor '+name,()=>{const s=securityFor({name,type:'Orbital laser platform'});assert.equal(s.threat,'Alto');assert.match(s.pvp,/Alto/);assert.match(lootFor({name}).summary,/componentes militares/)});
test('un lugar sin evidencia no se declara PvP alto',()=>assert.equal(securityFor({name:'Unknown',type:'station'}).pvp,'Sin datos'));
