import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const d=JSON.parse(readFileSync(new URL('../data/mission-pools-v2.json',import.meta.url)));
test('probabilidades marcadas como supuestas, no garantizadas',()=>{for(const m of d.missions){assert.equal(m.blueprintReward.selectionModel,'uniform-assumed');assert.equal(m.blueprintReward.runtimeModifiersPossible,true);assert.equal(m.blueprintReward.items.reduce((n,x)=>n+x.nominalChancePercent,0),100)}});
test('cada recompensa conserva su nombre individual',()=>{for(const m of d.missions)assert.equal(new Set(m.blueprintReward.items.map(x=>x.name)).size,m.blueprintReward.items.length)});
