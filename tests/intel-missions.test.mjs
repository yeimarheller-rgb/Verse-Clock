import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateIntelRecord,lootBadge} from '../src/intel-schema.js';
const data=JSON.parse(readFileSync(new URL('../data/intel-missions-4.10.3.json',import.meta.url),'utf8'));
test('registros Nyx válidos y con evidencia',()=>{for(const r of data.records) assert.deepEqual(validateIntelRecord(r),{valid:true,errors:[]},r.id)});
test('verde solo con fuente de datos y objeto específico',()=>{for(const r of data.records) if(lootBadge(r).color==='green') assert.ok(r.evidence.url && r.loot.item)});
test('sin coordenadas inventadas para misiones dinámicas',()=>{for(const r of data.records) assert.ok(!r.coordinates)});
