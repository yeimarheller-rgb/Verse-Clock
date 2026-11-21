import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {atlasKey, atlasSystem, mergeTacticalAtlas} from '../lab-preview/src/tactical-atlas.js';
import {inStantonZone, mergeStanton, stantonBodies, stantonCoverage, stantonSections, traceStantonParents} from '../lab-preview/src/stanton.js';

const read = name => JSON.parse(readFileSync(new URL('../lab-preview/data/'+name+'.json', import.meta.url)));
const catalogue=read('wiki-atlas');
const raw=traceStantonParents(catalogue.locations.filter(row=>atlasSystem(row.system)==='Stanton'));
const byKey=new Map([...catalogue.locations,...read('atlas-poi-seed').locations].map(row=>[atlasKey(row),{...row,system:atlasSystem(row.system)}]));
mergeTacticalAtlas(byKey,read('atlas-services'),catalogue.version);
const baseline=stantonCoverage(raw,traceStantonParents([...byKey.values()]));
const stanton=read('stanton-intel');
mergeStanton(byKey,stanton);
const visible=traceStantonParents([...byKey.values()]);
const at=name=>byKey.get(atlasKey({system:'Stanton',name}));

test('Stanton keeps raw denominator and credits only located, sourced evidence',()=>{
 const c=stantonCoverage(raw,visible);
 assert.equal(c.total,raw.length);
 assert.equal(c.geographic,new Set(raw.filter(row=>raw.filter(other=>atlasKey(row)===atlasKey(other)).length===1).map(atlasKey)).size);
 assert.ok(c.operational>baseline.operational);
 assert.deepEqual(stantonBodies.filter(body=>!at(body)?.stantonIntel?.environment),[]);
 assert.equal(stanton.locations.filter(row=>!at(row.name)).length,0);
 for(const row of stanton.locations)for(const claim of row.claims){
  assert.ok(claim.sources.length);
  for(const url of claim.sources)assert.equal(new URL(url).protocol,'https:');
 }
 console.log('Stanton baseline:',JSON.stringify(baseline),'updated:',JSON.stringify(c));
});

test('rearm coverage requires site evidence and does not infer from landing',()=>{
 assert.equal(at('Everus Harbor').services.rearm,'confirmed');
 assert.equal(at('Shubin Mining Facility SCD-1').services.rearm,'confirmed');
 assert.equal(at('Seraphim Station').services.rearm,undefined);
 assert.equal(at('Covalex Distribution Centre S1DC06').services?.rearm,undefined);
 assert.ok(stantonSections(at('Covalex Distribution Centre S1DC06')).every(section=>section.status.includes('Otra versión')));
 assert.ok(inStantonZone(at('Shubin Mining Facility SCD-1'),'Crusader'));
 assert.ok(inStantonZone(at('Shubin Mining Facility SCD-1'),'Daymar'));
 assert.ok(!inStantonZone(at('Shubin Mining Facility SCD-1'),'only:Crusader'));
 assert.ok(!inStantonZone(at('Everus Harbor'),'Daymar'));
});
