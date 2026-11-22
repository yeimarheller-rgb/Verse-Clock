import test from 'node:test';
import assert from 'node:assert/strict';
import {stantonCoverage} from '../src/stanton.js';

const uuid='11111111-1111-4111-8111-111111111111';
const raw=[{id:uuid,name:'Audited facility',system:'Stanton',parent:'Hurston'}];
const claim=(status,sources=['https://starcitizen.tools/Hurston'])=>({
 field:'access',status,text:'Acceso individual documentado',sources
});
const visible=claims=>[{...raw[0],stantonIntel:{uuid,claims}}];

test('documentedLocal requires UUID-linked documented HTTPS evidence',()=>{
 assert.equal(stantonCoverage(raw,visible([claim('documented')])).documentedLocal,1);
 assert.equal(stantonCoverage(raw,visible([claim('reported')])).documentedLocal,0);
 assert.equal(stantonCoverage(raw,visible([claim('historical')])).documentedLocal,0);
 assert.equal(stantonCoverage(raw,visible([claim('documented',['http://example.org/a'])])).documentedLocal,0);
 assert.equal(stantonCoverage(raw,[{...raw[0],stantonIntel:{uuid:'other',claims:[claim('documented')]}}]).documentedLocal,0);
});
test('inherited service evidence cannot certify documentedLocal',()=>{
 const inherited=[{...raw[0],serviceIntel:{services:['repair'],trade:[]}}];
 const result=stantonCoverage(raw,inherited);
 assert.equal(result.documentedLocal,0);
 assert.equal(result.operational,1);
});
