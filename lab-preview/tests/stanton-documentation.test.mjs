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

test('documentedLocal counts unique inventory UUIDs, not duplicate rows',()=>{
 const repeated=[raw[0],{...raw[0]}];
 assert.equal(stantonCoverage(repeated,visible([claim('documented')])).documentedLocal,1);
});


test('documentedLocal rejects unknown fields, blank text and missing sources',()=>{
 const cases=[
  {field:'unrecognized',status:'documented',text:'Specific claim',sources:['https://starcitizen.tools/Hurston']},
  {field:'access',status:'documented',text:'   ',sources:['https://starcitizen.tools/Hurston']},
  {field:'access',status:'documented',text:'Specific claim',sources:[]},
  {field:'access',status:'documented',text:'Specific claim',sources:['https://example.org/']},
 ];
 for(const item of cases)assert.equal(stantonCoverage(raw,visible([item])).documentedLocal,0);
});

test('documentedLocal remains geographically scoped',()=>{
 const local=visible([claim('documented')]);
 assert.equal(stantonCoverage(raw,local,'Hurston').documentedLocal,1);
 assert.equal(stantonCoverage(raw,local,'Crusader').documentedLocal,0);
});


test('coverage denominator counts unique inventory UUIDs',()=>{
 const repeated=[raw[0],{...raw[0]}];
 const result=stantonCoverage(repeated,visible([claim('documented')]));
 assert.equal(result.total,1);
 assert.equal(result.documentedLocal,1);
 assert.equal(result.geographic,1);
});
