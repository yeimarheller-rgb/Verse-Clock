// Tests del motor. Los valores REF salen de ejecutar el código original de VerseTime (ver relevo en Notion).
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {compute} from '../src/engine.js';
const {locations}=JSON.parse(readFileSync(new URL('../data/locations.json',import.meta.url),'utf8'));
const get=n=>locations.find(l=>l.name===n);
const T=Date.UTC(2026,10,4,21,39,0);
// Valores de referencia obtenidos ejecutando el código original de VerseTime en el mismo instante UTC.
const REF={
 'HDSF-Elbridge':{local:9935.7822354165,rise:951.5343232510827,set:5923.070681429506},
 'Lorville':{local:54232.30756699682,rise:5182.2677379251745,set:1465.722031562148},
 'Dupree Industrial Manufacturing Facility':{local:63228.563383232344,rise:4445.585092495562,set:343.17847496975276},
};
for(const [n,r] of Object.entries(REF)) test(`${n} = VerseTime (±1 ms)`,()=>{const o=compute(get(n),T);
 assert.ok(Math.abs(o.localTimeSeconds-r.local)<1e-3);assert.ok(Math.abs(o.nextStarriseInSeconds-r.rise)<1e-3);assert.ok(Math.abs(o.nextStarsetInSeconds-r.set)<1e-3)});
test('punto observado en el juego: HDSF-Elbridge amanece 22:54 Madrid (04/11/2026)',()=>{
 const o=compute(get('HDSF-Elbridge'),T);const m=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(Date.parse(o.nextStarriseUtc));
 assert.equal(m,'22:54')});
test('ciclo polar: sin cuenta atrás inventada',()=>{const p=locations.find(l=>l.riseSetAngle===null);assert.ok(p);const o=compute(p,T);assert.equal(o.polar,true);assert.equal(o.nextStarriseUtc,null)});
test('eventos siempre en el futuro y dentro de un día (margen VerseTime 90 s)',()=>{for(const p of locations){const o=compute(p,T);if(o.polar)continue;
 for(const s of [o.nextStarriseInSeconds,o.nextStarsetInSeconds]){assert.ok(s>=-90,p.name);assert.ok(s<=p.lengthOfDayDays*86400+1,p.name)}}});
