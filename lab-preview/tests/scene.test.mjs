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

import {photoWeights} from '../src/scene.js';
test('fotos: pesos suman 1 y la foto dominante coincide con la fase',()=>{const p=locations.find(l=>l.name==='Lorville');
 for(let m=0;m<p.lengthOfDayDays*1440;m+=1){const st=sunState(p,compute(p,T+m*6e4));const w=photoWeights(st);
  const sum=w.night+w.sunrise+w.day+w.sunset;assert.ok(Math.abs(sum-1)<1e-9);
  const top=Object.entries(w).sort((a,b)=>b[1]-a[1])[0][0];
  if(st.elevation>0.4)assert.equal(top,'day');if(st.elevation<-0.25)assert.equal(top,'night');
  if(Math.abs(st.elevation)<0.05)assert.equal(top,st.side<0?'sunrise':'sunset')}});
test('fotos: transición continua (sin saltos > 25 % por minuto en Lorville)',()=>{const p=locations.find(l=>l.name==='Lorville');let prev=null;
 for(let m=0;m<p.lengthOfDayDays*1440;m+=1){const w=photoWeights(sunState(p,compute(p,T+m*6e4)));if(prev)for(const k in w)assert.ok(Math.abs(w[k]-prev[k])<0.25,`${k} @${m}`);prev=w}});
