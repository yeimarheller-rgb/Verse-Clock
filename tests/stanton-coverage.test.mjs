import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {atlasKey, atlasSystem, mergeTacticalAtlas} from '../lab-preview/src/tactical-atlas.js';
import {identifyStantonVariants,inStantonZone,isStantonPlaceholder, isStantonTemporaryEvent, mergeStanton, stantonBodies, stantonCatalogReview, stantonCoverage, stantonFields, stantonSections, traceStantonParents} from '../lab-preview/src/stanton.js';

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
 assert.equal(c.counts.logistics,1);
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
 assert.ok(sites.length>=42);
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

test('the Clio, Euterpe, Hurston and Wala batch resolves distinct documented local claims',()=>{
 const onyx=['B','C'].flatMap(letter=>Array.from({length:10},(_,i)=>'Onyx Facility S4'+letter+(i+1)));
 const hdrso=['Sheppard','Sims','Stott','Tillman','Walker','Wyatt'].map(name=>'HDRSO-'+name);
 const wala=['066','078','087','108'].map(number=>'ArcCorp Security Post '+number);
 const names=[...onyx,...hdrso,...wala];
 const urls=new Set();
 for(const name of names){
  const site=at(name);
  assert.ok(site?.stantonIntel?.uuid,name);
  const {uuid,claims}=site.stantonIntel;
  const record=raw.find(row=>row.id===uuid);
  assert.equal(record?.name,name);
  assert.equal(record.parent,site.stantonIntel.body);
  const loot=claims.find(c=>c.field==='loot');
  urls.add(loot.sources.find(url=>url.startsWith('https://loot-verse.com/#place-')));
  assert.ok(claims.every(c=>c.status==='documented'&&c.patch===catalogue.version&&c.sources.includes('https://api.star-citizen.wiki/api/locations/'+uuid)),name);
  const coverage=stantonCoverage([record],[site]);
  assert.equal(coverage.documentedLocal,1,name);
  assert.equal(coverage.operational,1,name);
  assert.equal(coverage.counts.access+coverage.counts.loot,2,name);
  assert.equal(coverage.counts.weapons,['HDRSO-Sims','ArcCorp Security Post 108'].includes(name)?0:1,name);
 }
 assert.equal(urls.size,30);
 assert.ok(!urls.has(undefined));
});

test('Stanton Onyx and security evidence is independent for all 110 UUIDs in the batch',()=>{
 const onyxNames=['S1A','S1B','S1C','S1D','S2A','S2B','S2C','S3B'].flatMap(prefix=>
  Array.from({length:10},(_,i)=>'Onyx Facility '+prefix+(i+1)));
 const onyx=onyxNames.map(name=>at(name)?.stantonIntel);
 const posts=stanton.locations.filter(row=>row.claims.some(claim=>claim.title==='Cajas de equipo y puntos de botín'));
 assert.equal(posts.length,30);
 assert.ok(onyx.every(Boolean));
 const sources=new Set();
 const ids=new Set();
 for(const entry of [...onyx,...posts]){
  const record=raw.find(row=>row.id===entry.uuid);
  assert.equal(record?.name,entry.name);
  assert.equal(record.parent,entry.body);
  const site=atId.get(entry.uuid);
  assert.ok(site);
  const loot=entry.claims.find(claim=>claim.field==='loot');
  const link=loot.sources.find(url=>url.startsWith('https://loot-verse.com/#place-'));
  assert.ok(link,entry.name);
  sources.add(link);
  ids.add(entry.uuid);
  assert.ok(entry.claims.every(claim=>claim.patch===catalogue.version&&claim.status==='documented'&&
   claim.sources.includes('https://api.star-citizen.wiki/api/locations/'+entry.uuid)),entry.name);
  const coverage=stantonCoverage([record],[site]);
  assert.equal(coverage.operational,1,entry.name);
  assert.equal(coverage.documentedLocal,1,entry.name);
  assert.equal(coverage.counts.access+coverage.counts.loot,2,entry.name);
  assert.equal(coverage.counts.pvp+coverage.counts.pve+coverage.counts.missions+coverage.counts.repair,0,entry.name);
 }
 assert.equal(ids.size,110);
 assert.equal(sources.size,110);
});

test('private claims document restrictions for distinct UUIDs without inferring mining or direct travel',()=>{
 const title='Concesión privada sin destino de salto directo';
 const claims=stanton.locations.filter(entry=>entry.claims.some(row=>row.title===title));
 assert.equal(claims.length,160);
 assert.equal(new Set(claims.map(entry=>entry.uuid)).size,claims.length);
 for(const entry of claims){
  const record=raw.find(row=>row.id===entry.uuid);
  const site=atId.get(entry.uuid);
  const claim=entry.claims.find(row=>row.title===title);
  assert.equal(record?.name,entry.name);
  assert.equal(record?.parent,entry.body);
  assert.equal(claim.patch,catalogue.version);
  assert.deepEqual(claim.sources,['https://api.star-citizen.wiki/api/locations/'+entry.uuid]);
  assert.equal(claim.resourceNames,undefined);
  const coverage=stantonCoverage([record],[site]);
  assert.equal(coverage.counts.access,1,entry.name);
  assert.equal(coverage.counts.resources+coverage.counts.loot+coverage.counts.missions,0,entry.name);
 }
});

test('Kareah loot, assigned resources and the Euterpe racing activity remain separate',()=>{
 const kareah=at('Security Post Kareah');
 assert.ok(kareah.stantonIntel.claims.some(claim=>claim.field==='loot'&&claim.text.includes('69 puntos')));
 const base=atId.get('d6a51101-0480-4e80-8de2-5c6452879298');
 const assigned=read('atlas-commodities').locations.find(row=>row.id===base.stantonIntel.uuid).resources;
 const resources=base.stantonIntel.claims.find(claim=>claim.field==='resources').resourceNames;
 assert.ok(resources.length);
 assert.ok(resources.every(name=>assigned.some(item=>item.name===name&&item.kind==='mineable'&&item.source.locationUuid===base.stantonIntel.uuid&&item.source.version===catalogue.version)));
 const circuit=at('The Icebreaker');
 assert.ok(circuit.stantonIntel.claims.some(claim=>claim.field==='missions'&&claim.text.includes('20,3 km')));
});

test('ECN repeaters count current access separately from older contract evidence',()=>{
 const antennas=stanton.locations.filter(row=>row.claims.some(claim=>claim.title==='Cobertura de comunicaciones ECN'));
 assert.equal(antennas.length,16);
 assert.equal(new Set(antennas.map(row=>row.body)).size,16);
 for(const row of antennas){
  const record=raw.find(entry=>entry.id===row.uuid);
  const access=row.claims.find(claim=>claim.field==='access');
  assert.equal(record?.parent,row.body);
  assert.equal(access.patch,catalogue.version);
  assert.ok(access.sources.includes('https://api.star-citizen.wiki/api/locations/'+row.uuid));
  assert.equal(row.claims.find(claim=>claim.field==='missions')?.status,'historical');
  const coverage=stantonCoverage([record],[atId.get(row.uuid)]);
  assert.equal(coverage.documentedLocal,1,row.name);
  assert.equal(coverage.counts.access,1,row.name);
  assert.equal(coverage.counts.missions+coverage.counts.repair+coverage.counts.refuel+coverage.counts.rearm,0,row.name);
 }
});

test('Stanton additions bind the expo, wreck access, and identified Yela loot to distinct local records',()=>{
 const tobin=at('Tobin Center').stantonIntel;
 assert.equal(tobin.body,'New Babbage');
 assert.equal(tobin.claims.find(claim=>claim.field==='missions').patch,catalogue.version);
 assert.match(tobin.claims.find(claim=>claim.field==='access').text,/segunda parada/);
 const gundo=at('Covalex Shipping Hub Gundo').stantonIntel;
 assert.equal(gundo.body,'Daymar');
 assert.match(gundo.claims.find(claim=>claim.field==='access').text,/EVA/);
 const xx=at('NT-999-XX').stantonIntel,xxii=at('NT-999-XXII').stantonIntel;
 assert.notEqual(xx.uuid,xxii.uuid);
 const link=row=>row.claims.find(claim=>claim.field==='loot').sources[0];
 assert.notEqual(link(xx),link(xxii));
 for(const row of [xx,xxii]){
  assert.equal(row.body,'Yela');
  const record=raw.find(entry=>entry.id===row.uuid);
  assert.equal(stantonCoverage([record],[atId.get(row.uuid)]).counts.loot,1,row.name);
 }
});

test('current starmap claims preserve outpost variants and hospital scope',()=>{
 const route='Marcador de salto en el cuerpo padre';
 const entries=stanton.locations.filter(row=>row.claims.some(c=>c.title===route));
 assert.equal(entries.length,45);
 for(const row of entries){
  const inventory=raw.find(p=>p.id===row.uuid);
  const claim=row.claims.find(c=>c.title===route);
  const local=stantonCoverage([inventory],[atId.get(row.uuid)]);
  assert.equal(claim.patch,catalogue.version);
  assert.deepEqual(claim.destinations,[inventory.parent]);
  assert.ok(claim.sources.includes('https://api.star-citizen.wiki/api/locations/'+row.uuid));
  assert.ok(claim.sources.some(url=>url.endsWith('/starmap_positions.json')));
  assert.equal(local.counts.access,1,row.name);
  assert.equal(local.counts.missions+local.counts.loot+local.counts.repair,0,row.name);
 }
 for(const [name,length] of [['MT OpCenter TLI-4',12],['Prospect Point',2]]){
  const variants=raw.filter(row=>row.name===name);
  assert.equal(variants.length,length);
  const documented=variants.filter(row=>atId.get(row.id)?.stantonIntel?.claims.some(c=>c.title===route));
  assert.equal(documented.length,1);
  assert.ok(variants.filter(row=>row!==documented[0]).every(row=>!atId.get(row.id)?.stantonIntel));
 }
 const clinic=at('ARC-L3 Modern Express Clinic');
 const metrics=stantonCoverage(raw.filter(row=>row.id===clinic.id),[clinic]);
 assert.equal(metrics.documentedLocal,1);
 assert.equal(metrics.counts.logistics,1);
 assert.equal(metrics.counts.rearm+metrics.counts.refuel+metrics.counts.repair,0);
 assert.equal(at('Tobin Center').type,'Centro de exposiciones');
});

test('every Stanton UUID has operational evidence or an explicit catalog disposition',()=>{
 const version=stanton.catalogReview.version;
 assert.equal(version,catalogue.version);
 assert.equal(raw.length,949);
 assert.equal(Object.keys(stanton.catalogReview.records).length,141);
 const reasons=new Map();
 for(const row of raw){
  const site=atId.get(row.id);
  const metrics=stantonCoverage([row],site?[site]:[]);
  const review=stantonCatalogReview(row,stanton.catalogReview);
  assert.equal(metrics.operational+Number(Boolean(review)),1,row.id);
  if(!review)continue;
  assert.equal(review.state==='technical',isStantonPlaceholder(row),row.id);
  reasons.set(review.state,(reasons.get(review.state)||0)+1);
  if(site)assert.deepEqual(site.stantonCatalogReview,review);
  assert.equal(stantonCatalogReview({...row,source:{...row.source,version:'4.10.2'}},stanton.catalogReview),null);
 }
 assert.deepEqual(Object.fromEntries(reasons),{technical:26,hidden:8,unplaced:43,unplacedEventPlatform:63,placed:1});
 for(const [name,destination] of [['Stanton - Magnus Jump Point','Nyx Gateway'],['Stanton - Terra Jump Point','Terra Gateway']]){
  const row=at(name);
  assert.deepEqual(row.stantonIntel.claims[0].destinations,[destination]);
  assert.match(row.stantonIntel.claims[0].uncertainty,/pendiente/);
 }
});

test('station approaches identify placed pockets without supplying local services or resources',()=>{
 const approaches=stanton.locations.filter(row=>row.claims.some(c=>c.title?.startsWith('Referencia de aproximación en el sector ')));
 assert.equal(approaches.length,18);
 for(const row of approaches){
  const site=atId.get(row.uuid);
  const [claim]=row.claims;
  const [stationName]=claim.destinations;
  const station=at(stationName);
  assert.ok(station?.source?.uuid,stationName);
  assert.ok(claim.sources.includes('https://api.star-citizen.wiki/api/locations/'+station.source.uuid));
  assert.match(claim.text,/carece de salto directo/);
  const c=stantonCoverage(raw.filter(p=>p.id===row.uuid),[site]);
  assert.equal(c.counts.access,1);
  assert.equal(c.counts.resources+c.counts.repair+c.counts.refuel+c.counts.rearm,0);
 }
 const wreck=at('Stanton-Pyro Jump Point Wreck Site');
 assert.deepEqual(wreck.stantonIntel.claims[0].destinations,['Pyro Gateway']);
 assert.match(wreck.stantonIntel.claims[0].text,/632 km/);
 assert.equal(at('CRU L2-B').stantonCatalogReview.state,'hidden');
});

test('Echo Isle documents a conditional Ruto mission without inferring terminal stock or ship services',()=>{
 const site=at('Echo Isle');
 const claim=site.stantonIntel.claims[0];
 assert.equal(claim.field,'missions');
 assert.equal(claim.patch,catalogue.version);
 assert.match(claim.text,/posible destino/);
 assert.ok(claim.sources.some(url=>url.endsWith('/contracts/16a9aa88-de61-4e2b-8581-3638724fc5c1.json')));
 const metric=stantonCoverage(raw.filter(row=>row.id===site.source.uuid),[site]);
 assert.equal(metric.counts.missions,1);
 assert.equal(metric.counts.trade+metric.counts.repair+metric.counts.rearm+metric.counts.refuel,0);
});

test('Stanton target excludes only the reviewed RSI event platform UUIDs',()=>{
 const scoped=stantonCoverage(raw,visible,'Stanton',stanton.catalogReview);
 const full=stantonCoverage(raw,visible);
 const platforms=raw.filter(row=>isStantonTemporaryEvent(row,stanton.catalogReview));
 assert.equal(platforms.length,63);
 assert.equal(scoped.catalogTotal,949);
 assert.equal(scoped.excludedTemporary,63);
 assert.equal(scoped.total,886);
 assert.equal(scoped.operational,808);
 assert.equal(scoped.operational,full.operational);
 assert.equal(scoped.documentedLocal,663);
 assert.deepEqual(scoped.counts,full.counts);
 assert.ok(raw.filter(isStantonPlaceholder).every(row=>!isStantonTemporaryEvent(row,stanton.catalogReview)));
 assert.ok(platforms.every(row=>!isStantonTemporaryEvent({...row,source:{...row.source,version:'other'}},stanton.catalogReview)));
 assert.ok(platforms.every(row=>!isStantonTemporaryEvent({...row,name:'Permanent outpost'},stanton.catalogReview)));
 for(const zone of ['Hurston','Crusader','ArcCorp','microTech']){
  const metrics=stantonCoverage(raw,visible,zone,stanton.catalogReview);
  assert.equal(metrics.excludedTemporary,platforms.filter(row=>inStantonZone(row,zone)).length,zone);
 }
 console.log('Stanton active scope:',JSON.stringify(scoped));
});

test('site-specific Stanton review notes provide context without counting operational coverage',()=>{
 const notes=stanton.catalogReview.notes;
 const named=Object.entries(stanton.catalogReview.records)
  .filter(([,state])=>['unplaced','hidden','placed'].includes(state)).map(([id])=>id);
 assert.deepEqual(Object.keys(notes).sort(),named.sort());
 for(const [id,note] of Object.entries(notes)){
  const row=raw.find(p=>p.id===id);
  const site=atId.get(id);
  assert.equal(site.stantonCatalogReview.text,note.text);
  assert.equal(site.stantonCatalogReview.noteSource,note.source);
  if(note.destinationUuid){
   assert.notEqual(id,note.destinationUuid);
   const destination=atId.get(note.destinationUuid);
   assert.ok(destination,note.destinationUuid);
   assert.notEqual(destination.stantonCatalogReview?.state,'hidden');
   assert.notEqual(destination.stantonCatalogReview?.state,'unplaced');
  }
  assert.equal(stantonCoverage([row],[site],'Stanton',stanton.catalogReview).operational,0);
 }
 const green=raw.find(p=>p.id==='b190f52c-0b30-4482-b6ed-897eb7b4cdf8');
 assert.match(stantonCatalogReview(green,stanton.catalogReview).text,/Ellis III/);
 const badReview={...stanton.catalogReview,notes:{[green.id]:{text:'Unsafe note',source:'http://example.org/source'}}};
 assert.equal(stantonCatalogReview(green,badReview).noteSource,undefined);
 assert.notEqual(stantonCatalogReview(green,badReview).text,'Unsafe note');
 const tli4='0751fdb9-c6da-40c8-b924-f217c2c0c68f';
 const outpost54='af133812-bbf1-4d3f-adfa-90d5aec5ea50';
 assert.equal(Object.values(notes).filter(note=>note.destinationUuid===tli4).length,11);
 assert.equal(Object.values(notes).filter(note=>note.destinationUuid===outpost54).length,3);
 assert.equal(notes['8a55463e-e472-4871-833b-dc0747af7b7d'].destinationUuid,'f903ba70-e567-4b71-9062-26c8f58dcd99');
});

test('placed orbital mining and regional markers keep visibility separate from direct quantum access',()=>{
 const placed=stanton.locations.flatMap(row=>row.claims
  .filter(c=>c.title==='Marcador visible sin salto directo')
  .map(claim=>({row,claim})));
 assert.equal(placed.length,46);
 for(const {row,claim} of placed){
  assert.equal(claim.status,'documented');
  assert.match(claim.text,/sin salto cuántico directo|carece de configuración para el salto cuántico directo/);
  assert.ok(claim.sources.some(url=>url.endsWith('/starmap_positions.json')));
  assert.ok(claim.sources.some(url=>url.endsWith('/starmap.json')));
  if(row.name!=='CRU L3')assert.match(claim.text,/privada y exige autorización/);
 }
});
