// La fase visual debe derivar del motor: coherente con isDay y con el orden amanecer → día → atardecer → noche.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {compute} from '../src/engine.js';import {sunState,palette} from '../src/scene.js';
const {locations}=JSON.parse(readFileSync(new URL('../data/locations.json',import.meta.url),'utf8'));
const T=Date.UTC(2026,10,4,21,39,0);
test('día/noche visual coincide con isDay del motor (lejos del horizonte)',()=>{for(const p of locations){for(let k=0;k<24;k++){const r=compute(p,T+k*397e3);if(r.polar)continue;const s=sunState(p,r);
 if(s.phase==='day')assert.equal(r.isDay,true,p.name);if(s.phase==='night')assert.equal(r.isDay,false,p.name)}}});
test('secuencia en Lorville: amanecer → día → atardecer → noche',()=>{const p=locations.find(l=>l.name==='Lorville');const seq=[];
 for(let m=0;m<p.lengthOfDayDays*1440;m+=1){const ph=sunState(p,compute(p,T+m*6e4)).phase;if(seq.at(-1)!==ph)seq.push(ph)}
 if(seq[0]===seq.at(-1))seq.pop();const s=seq.join('>');assert.ok((s+'>'+s).includes('sunrise>day>sunset>night'),s)});
test('paleta válida en todo el rango',()=>{for(let e=-1;e<=1;e+=0.05)for(const side of [-1,1]){const P=palette(e,side,'Hurston');for(const k of ['top','mid','hor','far','near','sun'])assert.match(P[k],/^#[0-9a-f]{6}$/)}});
