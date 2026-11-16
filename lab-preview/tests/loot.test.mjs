import test from 'node:test';
import assert from 'node:assert/strict';
import {lootFor} from '../src/loot.js';
test('Hathor: no convertir reportes en loot confirmado',()=>{const r=lootFor({name:'Hathor Orbital Laser Platform'});assert.equal(r.level,'reported')});
test('desconocido: no se muestra marca verde',()=>assert.equal(lootFor({name:'Ubicación no catalogada'}).level,'unknown'));
