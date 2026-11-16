import test from 'node:test';
import assert from 'node:assert/strict';
import {securityFor, FACTIONS} from '../src/security.js';
test('facciones catalogadas sin inferir hostilidad automática',()=>{assert.ok(FACTIONS['Citizens for Prosperity']);assert.equal(securityFor({name:'Bunker desconocido',type:'Bunker'}).threat,'Desconocido')});
test('centro con hostilidad reportada',()=>{const r=securityFor({name:'Dupree Industrial Manufacturing Facility'});assert.equal(r.threat,'Alto');assert.equal(r.faction,'No confirmada');assert.equal(r.source.grade,'Reporte comunitario')});
test('acceso público no significa ausencia de amenazas',()=>{const r=securityFor({name:'Sakura Sun Goldenrod Workcenter'});assert.equal(r.threat,'Condicional')});
test('misión independiente del propietario',()=>{const r=securityFor({name:'Bloom'}, {contractor:'Citizens for Prosperity',enemy:'XenoThreat'});assert.equal(r.faction,'No confirmada');assert.equal(r.mission.enemy,'XenoThreat')});
