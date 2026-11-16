import test from 'node:test';import assert from 'node:assert/strict';import {validateOrbitalPOI,serviceMatches} from '../src/orbital-poi.js';
const base={id:'station',name:'Station',system:'Stanton',type:'lagrange-station',source:'source-url',services:{refinery:'unknown'}};
test('estación válida sin datos inventados',()=>assert.equal(validateOrbitalPOI(base).valid,true));
test('refinería desconocida no cuenta como confirmada',()=>assert.equal(serviceMatches(base,'refinery'),false));
test('rechaza ciclos solares de superficie en órbita',()=>assert.equal(validateOrbitalPOI({...base,sunrise:'06:00'}).valid,false));
