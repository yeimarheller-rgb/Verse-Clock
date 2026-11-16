import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIntelRecord,lootBadge} from '../src/intel-schema.js';
const base={id:'sample',name:'Ejemplo',system:'Nyx',type:'Estación',patch:'4.10.3',evidence:{grade:'unverified',url:''},loot:{level:'unknown'}};
test('sin evidencia no genera marca verde',()=>assert.equal(lootBadge(base).color,'neutral'));
test('no permite botín confirmado sin evidencia',()=>assert.equal(validateIntelRecord({...base,loot:{level:'confirmed',item:'Objeto'}}).valid,false));
test('marca verde exige ítem y fuente',()=>assert.equal(lootBadge({...base,evidence:{grade:'official',url:'https://example.org/source'},loot:{level:'confirmed',item:'Objeto documentado'}}).color,'green'));
test('encuentro dinámico no admite coordenadas inventadas',()=>assert.equal(validateIntelRecord({...base,dynamicEncounter:true,coordinates:{x:1,y:2,z:3}}).valid,false));
