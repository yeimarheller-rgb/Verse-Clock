import test from 'node:test';
import assert from 'node:assert/strict';
import {stantonCoverage,mergeStanton} from '../src/stanton.js';

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


test('generic planetary source is NOT certified local evidence',()=>{
 const result=stantonCoverage(raw,visible([claim('documented')]));
 assert.equal(result.documentedLocal,1); // legacy candidate metric remains unchanged
 assert.equal(result.certifiedLocal,0);
});

test('per-UUID reviewed evidence certifies only the matching facility',()=>{
 const source='https://starcitizen.tools/Hurston';
 const attested={...claim('documented',[source]),localEvidence:{uuid,scope:'location',reviewed:true,patch:'4.10.3 LIVE',source}};
 assert.equal(stantonCoverage(raw,visible([attested])).certifiedLocal,1);
 const mismatched={...attested,localEvidence:{...attested.localEvidence,uuid:'wrong'}};
 assert.equal(stantonCoverage(raw,visible([mismatched])).certifiedLocal,0);
 const noPatch={...attested,localEvidence:{...attested.localEvidence,patch:''}};
 assert.equal(stantonCoverage(raw,visible([noPatch])).certifiedLocal,0);
});

test('generic evidence does not automatically confirm repair services',()=>{
 const original={...raw[0],services:{},stantonIntel:{uuid,claims:[{...claim('documented'),services:['repair']}]}};
 const map=new Map([['facility',original]]);
 const data={schemaVersion:1,locations:[{uuid,claims:[{...claim('documented'),services:['repair']}]}]};
 mergeStanton(map,data,null);
 assert.notEqual(map.get('facility').services.repair,'confirmed');
 assert.equal(stantonCoverage(raw,[original]).certifiedLocal,0);
});
