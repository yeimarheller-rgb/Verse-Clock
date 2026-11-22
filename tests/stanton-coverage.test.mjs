import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {atlasKey, atlasSystem, mergeTacticalAtlas} from '../lab-preview/src/tactical-atlas.js';
import {identifyStantonVariants,inStantonZone,isStantonPlaceholder, mergeStanton, stantonBodies, stantonCoverage, stantonFields, stantonSections, traceStantonParents} from '../lab-preview/src/stanton.js';

const read = name => JSON.parse(readFileSync(new URL('../lab-preview/data/'+name+'.json', import.meta.url)));
const catalogue=read('wiki-atlas');
const catalogueRows=identifyStantonVariants(catalogue.locations);
const raw=traceStantonParents(catalogueRows.filter(row=>atlasSystem(row.system)==='Stanton'));
const byKey=new Map(read('atlas-poi-seed').locations.map(row=>[atlasKey(row),row]));
for(const row of catalogueRows.filter(row=>!isStantonPlaceholder(row))){
 const key=atlasKey(row);
 byKey.set(key,{...row,system:atlasSystem(row.system),...byKey.get(key),source:row.source});
}
const details=read('atlas-enriched');
const enrichedByUuid=new Map(details.locations.map(row=>[row.id,row]));
for(const p of byKey.values()){
 const detail=enrichedByUuid.get(p.source?.uuid);
 if(detail&&details.version===catalogue.version)Object.assign(p,{
  missions:detail.missions,resources:detail.resources,nearbyLocations:detail.nearbyLocations,intelDetailSource:detail.source,
 });
}
mergeTacticalAtlas(byKey,read('atlas-services'),catalogue.version);
const baseline=stantonCoverage(raw,traceStantonParents([...byKey.values()]));
const stanton=read('stanton-intel');
mergeStanton(byKey,stanton);
const visible=traceStantonParents([...byKey.values()]);
const at=name=>byKey.get(atlasKey({system:'Stanton',name}));
const atId=new Map(visible.filter(row=>row.source?.uuid).map(row=>[row.source.uuid,row]));

test('Stanton keeps raw denominator and credits only located, sourced evidence',()=>{
 const c=stantonCoverage(raw,visible);
 assert.equal(c.total,raw.length);
 assert.equal(c.geographic,raw.filter(row=>!isStantonPlaceholder(row)).length);
 const repeated=raw.filter(row=>row.name==='MT OpCenter TLI-4');
 assert.ok(repeated.length>1);
 assert.equal(new Set(repeated.map(atlasKey)).size,repeated.length);
 assert.ok(repeated.every(row=>byKey.get(atlasKey(row))?.id===row.id));
 assert.ok(c.operational>baseline.operational);
 const euterpe=stantonCoverage(raw,visible,'Euterpe');
 assert.ok(euterpe.counts.hazards>=1);
 assert.ok(stantonCoverage(raw,visible,'only:microTech').counts.hazards>=1, 'microTech retains sourced hazards as locations are enriched');
 assert.deepEqual(stantonBodies.filter(body=>!at(body)?.stantonIntel?.environment),[]);
 assert.equal(stanton.locations.filter(row=>!(row.uuid?atId.get(row.uuid):at(row.name))).length,0);
 for(const row of stanton.locations)for(const claim of row.claims){
  assert.ok(Object.hasOwn(stantonFields,claim.field),row.name+': categoría desconocida '+claim.field);
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
 assert.ok(stantonSections(at('Covalex Distribution Centre S1DC06')).filter(section=>section.title!=='Acceso público indicado').every(section=>section.status.includes('Otra versión')));
 assert.ok(inStantonZone(at('Shubin Mining Facility SCD-1'),'Crusader'));
 assert.ok(inStantonZone(at('Shubin Mining Facility SCD-1'),'Daymar'));
 assert.ok(!inStantonZone(at('Shubin Mining Facility SCD-1'),'only:Crusader'));
 assert.ok(!inStantonZone(at('Everus Harbor'),'Daymar'));
 assert.ok(inStantonZone(at('HUR-L1 Green Glade Station'),'Hurston'));
 assert.ok(inStantonZone(at('HUR-L1 Green Glade Station'),'lagrange'));
});

test('UUID binds the Hurston batch to the inventory and excludes historical and malformed facts',()=>{
 const indexed=new Map(raw.map(row=>[row.id,row]));
 assert.equal(indexed.size,raw.length);
 assert.equal(enrichedByUuid.size,details.locations.length);
 for(const row of raw)assert.equal(enrichedByUuid.get(row.id)?.source.uuid,row.id);
 const batch=stanton.locations.filter(row=>row.uuid);
 assert.ok(batch.length>=14);
 assert.equal(new Set(batch.map(row=>row.uuid)).size,batch.length);
 for(const row of batch){
  assert.equal(indexed.get(row.uuid)?.name,row.name);
  assert.equal(atId.get(row.uuid)?.stantonIntel.uuid,row.uuid);
 }
 const clinic=at('HUR-L4 Melodic Fields Clinic');
 const c=stantonCoverage([indexed.get(clinic.id)],[clinic]);
 assert.equal(c.counts.trade,1);
 assert.equal(c.counts.logistics,0);
 assert.equal(c.counts.repair,0);
 assert.equal(c.counts.hazards,0);
 const mismatched={...clinic,id:'different',source:{uuid:'different'}};
 assert.equal(stantonCoverage([indexed.get(clinic.id)],[mismatched]).operational,0);
 const noEvidence={...clinic,stantonIntel:{claims:[
  {field:'trade',status:'documented',text:'Sin fuente válida',sources:['https://starcitizen.tools/']},
  {field:'missions',status:'historical',text:'Otra versión',sources:['https://starcitizen.tools/Evict_Illegal_Occupants']},
 ]}};
 assert.equal(stantonCoverage([indexed.get(clinic.id)],[noEvidence]).operational,0);
 for(const name of ['Covalex Distribution Centre S1DC06','Dupree Industrial Manufacturing Facility',
  'Greycat Stanton I Production Complex-B','HDPC-Cassillo','HDPC-Farnesway']){
  const p=at(name);
  const access=p.stantonIntel.claims.filter(c=>c.field==='access');
  assert.equal(access.length,1,name);
  assert.equal(access[0].patch,'4.10.3-LIVE.13165946',name);
  assert.equal(stantonCoverage([indexed.get(p.stantonIntel.uuid)],[p]).counts.access,1,name);
  assert.equal(p.services?.repair,undefined,name);
 }
});

test('historical Ghost Hollow claims do not increase operational mission coverage',()=>{
 const p=at('Ghost Hollow');
 const claim=p.stantonIntel.claims.find(c=>c.title?.includes('créditos CCB'));
 assert.equal(claim?.field,'missions');
 assert.equal(claim?.status,'historical');
 const eventOnly={...p,stantonIntel:{claims:[claim]}};
 const inventory=raw.filter(row=>row.id===p.source.uuid);
 assert.equal(stantonCoverage(inventory,[eventOnly]).counts.missions,0);
});

test('the Hurston logistics batch keeps historical ASOP and uncertain ship support out of current coverage',()=>{
 const cases=[
  ['Barton Flats Aid Shelter','access'],
  ['Sakura Sun Magnolia Workcenter','logistics'],
  ['Reclamation & Disposal Orinth','trade'],
 ];
 for(const [name,field] of cases){
  const site=at(name);
  const inventory=raw.filter(row=>row.id===site.stantonIntel.uuid);
  const result=stantonCoverage(inventory,[site]);
  assert.equal(result.counts[field],1,name);
  assert.equal(result.counts.repair,0,name);
  assert.equal(result.counts.refuel,0,name);
  assert.equal(result.counts.rearm,0,name);
  if(name==='Barton Flats Aid Shelter')assert.equal(result.counts.logistics,0);
 }
});

test('the FPS mining batch credits resources only from current, matching location UUIDs',()=>{
 const index=read('atlas-commodities');
 assert.equal(index.version,catalogue.version);
 const byId=new Map(index.locations.map(row=>[row.id,row]));
 for(const name of ['Gonzo','Ludlow','HDMS-Lathan',"Adair's Retreat",'Dunboro','Paradise Cove']){
  const site=at(name);
  const id=site.stantonIntel.uuid;
  const claim=site.stantonIntel.claims.find(row=>row.field==='resources');
  assert.equal(claim.patch,index.version);
  for(const gem of claim.resourceNames){
   const source=byId.get(id)?.resources.find(resource=>resource.name===gem&&resource.kind==='mineable')?.source;
   assert.equal(source?.locationUuid,id,name+' '+gem);
   assert.equal(source?.version,index.version);
  }
  const result=stantonCoverage(raw.filter(row=>row.id===id),[{...site,stantonIntel:{claims:[claim]}}]);
  assert.equal(result.counts.resources,1,name);
  assert.equal(result.counts.loot,0,name);
 }
});

test('orbital mining links bind to distinct UUIDs and do not credit hidden markers',()=>{
 const index=read('atlas-commodities');
 const mineralsById=new Map(index.locations.map(site=>[site.id,site.resources]));
 const orbitals=stanton.locations.filter(row=>row.claims.some(c=>c.title==='Prospección con nave minera'));
 assert.ok(orbitals.length>=45);
 const rawById=new Map(raw.map(site=>[site.id,site]));
 for(const row of orbitals){
  const site=rawById.get(row.uuid);
  assert.equal(site?.type,'Asteroid',row.name);
  assert.equal(mineralsById.get(row.uuid)?.[0]?.source.locationUuid,row.uuid);
  assert.ok(row.claims.every(c=>c.patch===catalogue.version&&c.sources.includes('https://api.star-citizen.wiki/locations/'+row.uuid)));
 }
 const twins=raw.filter(site=>site.name==='Mining Base #XJZ-JR2');
 assert.ok(twins.length>1);
 assert.equal(twins.filter(site=>atId.get(site.id)?.stantonIntel?.claims.some(c=>c.field==='resources')).length,1);
 const excluded=raw.find(site=>site.name==='CRU L1');
 assert.equal(atId.get(excluded.id)?.stantonIntel?.claims.some(c=>c.field==='access')||false,false);
});

test('Lagrange resource evidence stays on the regional UUID and never creates direct navigation',()=>{
 const regions=stanton.locations.filter(row=>row.claims.some(c=>c.title==='Campo minero regional'));
 assert.equal(regions.length,20);
 const index=read('atlas-commodities');
 const local=new Map(index.locations.map(row=>[row.id,row.resources]));
 for(const row of regions){
  const region=atId.get(row.uuid);
  const claim=row.claims.find(c=>c.title==='Campo minero regional');
  assert.equal(region?.type,'Asteroid',row.name);
  assert.equal(claim.patch,index.version);
  assert.ok(claim.resourceNames.length);
  assert.ok(claim.resourceNames.every(name=>local.get(row.uuid)?.some(r=>r.name===name&&r.source.locationUuid===row.uuid)));
  assert.equal(row.claims.some(c=>c.field==='access'),row.name==='CRU L3',row.name);
  for(const station of claim.destinations||[])assert.equal(at(station)?.type,'Manmade',station);
 }
});

test('medical destinations are matched to the site UUID and do not imply ship support',()=>{
 const names=['ARC-L1 Wide Forest Clinic','MIC-L1 Shallow Frontier Clinic','CRU-L4 Shallow Fields Clinic','Green Imperial Medical'];
 for(const name of names){
  const site=at(name);
  const claim=site.stantonIntel.claims.find(c=>c.title==='Hospital y regeneración');
  assert.equal(claim.patch,catalogue.version);
  assert.deepEqual(claim.destinations,[site.parent]);
  const record=raw.find(row=>row.id===site.stantonIntel.uuid);
  const result=stantonCoverage([record],[site]);
  assert.equal(result.counts.logistics,1,name);
  assert.equal(result.counts.repair+result.counts.refuel+result.counts.rearm,0,name);
 }
});

test('documented pharmacy stock resolves to the clinic UUID without implying ship maintenance',()=>{
 const pharmacies=stanton.locations.filter(row=>row.claims.some(claim=>claim.title==='Farmacia y MedGel para naves'));
 assert.ok(pharmacies.length>=22);
 for(const row of pharmacies){
  const site=atId.get(row.uuid);
  const record=raw.find(location=>location.id===row.uuid);
  const claim=row.claims.find(claim=>claim.title==='Farmacia y MedGel para naves');
  assert.equal(site?.name,row.name);
  assert.deepEqual(claim.destinations,[record.parent],row.name);
  assert.ok(claim.sources.includes('https://api.star-citizen.wiki/locations/'+row.uuid),row.name);
  assert.equal(claim.patch,'4.10.3',row.name);
  assert.match(claim.text,/ParaMed Medical Device.*Pancea MedGel Canister/);
  const result=stantonCoverage([record],[{...site,stantonIntel:{claims:[claim]}}]);
  assert.equal(result.counts.trade,1,row.name);
  for(const field of ['logistics','repair','refuel','rearm'])assert.equal(result.counts[field],0,row.name);
 }
 const gateway=at('Magnus Gateway Clinic');
 const pharmacy=gateway.stantonIntel.claims.find(claim=>claim.field==='trade');
 assert.match(pharmacy.text,/Nyx Gateway \(Stanton\)/);
 assert.deepEqual(pharmacy.destinations,['Nyx Gateway']);
});

test('Lyria and Calliope loot is tied to exact location links and its own build',()=>{
 const sites=stanton.locations.filter(row=>['Lyria','Calliope'].includes(row.body)&&row.claims.some(claim=>claim.field==='loot'&&claim.sources.some(url=>url.startsWith('https://loot-verse.com/#place-'))));
 assert.equal(sites.length,42);
 const links=new Set();
 for(const row of sites){
  const record=raw.find(location=>location.id===row.uuid);
  const site=atId.get(row.uuid);
  const loot=row.claims.find(claim=>claim.field==='loot');
  assert.equal(record?.name,row.name);
  assert.equal(record.parent,row.body,row.name);
  assert.equal(loot.patch,catalogue.version,row.name);
  assert.ok(loot.sources.includes('https://api.star-citizen.wiki/api/locations/'+row.uuid),row.name);
  links.add(loot.sources.find(url=>url.startsWith('https://loot-verse.com/#place-')));
  assert.equal(stantonCoverage([record],[site]).counts.loot,1,row.name);
 }
 assert.equal(links.size,sites.length);
 const oldOnly=at('Shubin Processing Facility SPMC-1');
 const record=raw.find(location=>location.id===oldOnly.stantonIntel.uuid);
 assert.equal(stantonCoverage([record],[oldOnly]).operational,0);
 const spmc14=at('Shubin Processing Facility SPMC-14');
 const generic={...spmc14,stantonIntel:{claims:[{field:'loot',status:'documented',text:'Sin lugar específico',sources:['https://loot-verse.com/#places']}]}};
 assert.equal(stantonCoverage(raw.filter(location=>location.id===spmc14.stantonIntel.uuid),[generic]).operational,0);
});

test('Hurston Paladin loot resolves to seven distinct sites and the right container type',()=>{
 const containers=new Map([
  ["Cutter's Rig",['Metal loot crate','Weapon case']],
  ["Finn's Folly",['Metal loot crate']],
  ['Ludlow',['Metal loot crate']],
  ["Maker's Point",['Metal loot crate']],
  ["Picker's Field",['Weapon case']],
  ['Reclamation & Disposal Orinth',['Weapon case']],
  ['Zephyr',['Metal loot crate','Weapon case']],
 ]);
 const sites=stanton.locations.filter(row=>row.claims.some(claim=>claim.title==='Casco Paladin'));
 assert.equal(sites.length,containers.size);
 for(const row of sites){
  const site=atId.get(row.uuid);
  const record=raw.find(location=>location.id===row.uuid);
  const loot=row.claims.find(claim=>claim.title==='Casco Paladin');
  assert.equal(record?.name,row.name);
  assert.equal(record?.parent,'Hurston');
  assert.equal(loot.patch,catalogue.version);
  assert.deepEqual([...loot.text.matchAll(/Metal loot crate|Weapon case/g)].map(m=>m[0]),containers.get(row.name));
  assert.ok(loot.sources.includes('https://api.star-citizen.wiki/api/locations/'+row.uuid));
  assert.equal(stantonCoverage([record],[site]).counts.loot,1,row.name);
 }
 const baier=at('HDRSO-Baier');
 assert.ok(baier.stantonIntel.claims.some(claim=>claim.field==='access'));
 assert.ok(baier.stantonIntel.claims.some(claim=>claim.field==='loot'&&claim.text.includes('XDL Monocular Rangefinder')));
 assert.ok(baier.stantonIntel.claims.every(claim=>!claim.text.includes('Paladin')));
});

test('HDRSO outposts receive only their own versioned loot and access evidence',()=>{
 const entries=stanton.locations.filter(row=>row.claims.some(c=>c.title==='Cajas de equipo HDRSO'));
 const spots={Bardie:16,Bersch:20,Bowes:20,Brel:11,Cronshaw:13,Foster:16,Franz:20,Giblin:11,Hosley:20,Malloy:20,Marling:11,McKuen:20,Newman:11,Olliff:13,Pearce:20};
 assert.equal(entries.length,Object.keys(spots).length);
 for(const entry of entries){
  const {name,uuid,claims}=entry;
  const count=spots[name.slice('HDRSO-'.length)];
  const record=raw.find(r=>r.id===uuid);
  assert.equal(record?.name,name);
  assert.equal(record.parent,'Hurston');
  assert.ok(claims.every(c=>c.patch===catalogue.version&&c.sources.includes('https://api.star-citizen.wiki/api/locations/'+uuid)&&c.sources.includes('https://loot-verse.com/#place-stanton1-ugf-'+name.toLowerCase())));
  assert.match(claims.find(c=>c.field==='loot').text,new RegExp(count+' puntos'));
  const coverage=stantonCoverage([record],[atId.get(uuid)]);
  assert.equal(coverage.operational,1,name);
  assert.equal(coverage.counts.access,1,name);
  assert.equal(coverage.counts.loot,1,name);
  assert.equal(coverage.counts.weapons,count===11?0:1,name);
  assert.equal(coverage.counts.pve+coverage.counts.pvp+coverage.counts.missions,0,name);
 }
});
