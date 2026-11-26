import test from 'node:test';
import assert from 'node:assert/strict';
import {stantonCoverage,mergeStanton,hasStantonLocalAttestation} from '../src/stanton.js';

const uuid='11111111-1111-4111-8111-111111111111';
const version='4.10.3-LIVE.13165946';
const pin='https://github.com/StarCitizenWiki/scunpacked-data/blob/3cc8072b24df2a2d71eb6207708e2039f909b342/';
const raw=[{id:uuid,name:'Audited facility',system:'Stanton',parent:'Hurston',source:{uuid,version}}];
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

test('local evidence requires the field, exact UUID, pinned proof, patch, date and uncertainty',()=>{
 const source=pin+'starmap_positions.json';
 const localEvidence={uuid,field:'access',scope:'location',reviewed:true,patch:version,source,
  reviewedAt:'2026-11-23',locator:uuid,proof:'position',sourceDetail:'hidden=false; qt_valid=true'};
 const attested={...claim('documented',[source]),uncertainty:'Funcionamiento pendiente en sesión.',patch:version,localEvidence};
 const summarize=item=>stantonCoverage(raw,[{...raw[0],stantonIntel:{uuid,claims:[item],certifiedClaims:[item]}}]);
 assert.equal(summarize(attested).certifiedCounts.access,1);
 for(const change of [{uuid:'wrong'},{patch:''},{field:'rearm'},{locator:''},{reviewedAt:'2026-02-30'},{source:'https://starcitizen.tools/Hurston'}]){
  assert.equal(summarize({...attested,localEvidence:{...localEvidence,...change}}).certifiedLocal,0);
 }
 assert.equal(summarize({...attested,uncertainty:''}).certifiedLocal,0);
 assert.equal(hasStantonLocalAttestation(attested,uuid,'different-build'),false);
});

test('generic URLs do not confirm repair, refuel or rearm even with self-declared proof',()=>{
 const original={...raw[0],services:{}};
 const map=new Map([['facility',original]]);
 const data={schemaVersion:1,locations:[{uuid,claims:[{...claim('documented'),
  services:['repair','refuel','rearm'],localEvidence:{uuid,reviewed:true}}]}]};
 mergeStanton(map,data,null);
 assert.deepEqual(map.get('facility').services,{});
 assert.equal(stantonCoverage(raw,[map.get('facility')]).certifiedLocal,0);
});
