// Atlas-wide evidence audit. No synthetic gameplay intelligence.
// Generic risk advisories do not establish PvE encounters; weapon references do not establish loot drops.
import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('lab-preview/data/wiki-atlas.json','utf8'));
const seed=JSON.parse(await readFile('lab-preview/data/atlas-poi-seed.json','utf8'));
const enriched=JSON.parse(await readFile('lab-preview/data/atlas-enriched.json','utf8'));
if(enriched.version!==catalog.version||!Array.isArray(enriched.locations)||enriched.locations.length!==catalog.locations.length)throw Error('Atlas enrichment missing, stale, or incomplete: refusing to publish misleading coverage');
const catalogIds=new Set(catalog.locations.map(p=>p.id));
if(new Set(enriched.locations.map(p=>p.id)).size!==catalogIds.size||enriched.locations.some(p=>!catalogIds.has(p.id)))throw Error('Atlas enrichment IDs differ from catalog');
let commodities={locations:[],version:null};try{commodities=JSON.parse(await readFile('lab-preview/data/atlas-commodities.json','utf8'))}catch{}
const normalizedSystem=s=>String(s||'').replace(/\s+system$/i,'').trim().toLocaleLowerCase('es');
const key=p=>[normalizedSystem(p.system),p.name||''].join('|').toLocaleLowerCase('es');
const seeds=new Map(seed.locations.map(p=>[key(p),p]));
const catalogKeys=new Set(catalog.locations.map(key));
const seedOnly=seed.locations.filter(p=>!catalogKeys.has(key(p)));

const details=new Map((enriched.version===catalog.version?enriched.locations:[]).map(p=>[p.id,p]));
const commodityResources=new Map((commodities.version===catalog.version?commodities.locations:[]).map(p=>[p.id,p.resources||[]]));
const counts={resourceAssociationsOnly:0,verifiedOperationalExcludingCommodityAssociations:0,total:0,consulted:0,curated:0,withMissions:0,withResources:0,withNearby:0,withServices:0,withPve:0,withPvp:0,withLoot:0,withSources:0,withWeapons:0,withTrade:0,withHazards:0,actionable:0,geographicOnly:0};
const systems={};const records=[];
for(const p of catalog.locations){const s=seeds.get(key(p))||{},d=details.get(p.id)||{};const flags={consulted:!!d.checkedAt,curated:!!s.id,missions:!!d.missions?.length||!!s.missions?.length,resources:!!d.resources?.length||!!s.tacticalIntel?.resources?.length||!!commodityResources.get(p.id)?.length,nearby:!!d.nearbyLocations?.length,services:!!p.amenities?.length||Object.values(s.services||{}).some(x=>['reported','confirmed'].includes(x)),pve:!!s.security?.pve,pvp:!!s.security?.pvp||!!s.pvp,loot:!!s.lootIntel?.categories?.length,weapons:!!s.tacticalIntel?.weapons?.length||!!s.tacticalIntel?.armor?.length,trade:!!s.commodities?.length||!!s.shops?.length,hazards:!!s.tacticalIntel?.threats?.length||!!s.hazards?.length,sources:!!s.sourceUrls?.length||!!p.source?.uuid};const operationalFields=['missions','resources','services','pve','pvp','loot','weapons','trade','hazards'];const actionable=operationalFields.filter(k=>flags[k]).length;
 const confirmedResource=!!d.resources?.length||!!s.tacticalIntel?.resources?.length;
 const operationalWithoutCommodity=operationalFields.some(k=>k==='resources'?confirmedResource:flags[k]);
 if(operationalWithoutCommodity)counts.verifiedOperationalExcludingCommodityAssociations++;
 if(!operationalWithoutCommodity&&!!commodityResources.get(p.id)?.length)counts.resourceAssociationsOnly++;counts.total++;if(!systems[p.system])systems[p.system]={total:0,actionable:0,geographicOnly:0};systems[p.system].total++;for(const [k,v] of Object.entries(flags))if(v){const map={consulted:'consulted',curated:'curated',missions:'withMissions',resources:'withResources',nearby:'withNearby',services:'withServices',pve:'withPve',pvp:'withPvp',loot:'withLoot',weapons:'withWeapons',trade:'withTrade',hazards:'withHazards',sources:'withSources'};counts[map[k]]++}if(actionable){counts.actionable++;systems[p.system].actionable++}else{counts.geographicOnly++;systems[p.system].geographicOnly++}const evidence={};
 for(const domain of operationalFields){if(!flags[domain])continue;const refs=[];
 if(domain==='missions'&&d.missions?.length)refs.push({kind:'location-api',url:'https://api.star-citizen.wiki/api/locations/'+encodeURIComponent(p.id),version:catalog.version,claim:'mission association'});
 if(domain==='resources'&&d.resources?.length)refs.push({kind:'location-api',url:'https://api.star-citizen.wiki/api/locations/'+encodeURIComponent(p.id),version:catalog.version,claim:'resource association, not verified deposit'});
 if(domain==='resources'&&commodityResources.get(p.id)?.length)refs.push({kind:'commodity-api',version:catalog.version,claim:'commodity location association, not verified deposit'});
 if(domain==='services'&&p.amenities?.length)refs.push({kind:'location-api',url:'https://api.star-citizen.wiki/api/locations/'+encodeURIComponent(p.id),version:catalog.version,claim:'catalog amenity, availability unverified'});
 if(s&&Object.keys(s).length&&((domain==='missions'&&s.missions?.length)||(domain==='resources'&&s.tacticalIntel?.resources?.length)||(domain==='services'&&Object.values(s.services||{}).some(x=>['reported','confirmed'].includes(x)))||(domain==='pve'&&s.security?.pve)||(domain==='pvp'&&(s.security?.pvp||s.pvp))||(domain==='loot'&&s.lootIntel?.categories?.length)||(domain==='weapons'&&(s.tacticalIntel?.weapons?.length||s.tacticalIntel?.armor?.length))||(domain==='trade'&&(s.commodities?.length||s.shops?.length))||(domain==='hazards'&&(s.tacticalIntel?.threats?.length||s.hazards?.length)))){
 const urls=(s.sourceUrls||[]).filter(u=>typeof u==='string'&&/^https:\/\//.test(u));refs.push({kind:urls.length?'curated':'curated-unverified',sourceUrls:urls,claim:urls.length?'curated record; independently verify underlying evidence':'curated claim without a source URL; NOT independently traced'});
 }
 evidence[domain]=refs.length?refs:[{kind:'untraced',claim:'domain flagged but no evidence path'}];
 }
 records.push({id:p.id,name:p.name,system:p.system,parent:p.parent||null,type:p.type||null,flags,actionableDomains:actionable,evidence})}
// Reproducible research queue, not gameplay claims: prioritise missing tactical domains at named installations.
const priorityPattern=/hathor|station|distribution|facility|outpost|bunker|settlement|depot|laboratory|lab|mining|mine|refinery|port|gateway/i;
const priorityScore=p=>{
 const name=(p.name+' '+(p.type||'')).toLowerCase();
 const focus=/hathor/i.test(name)?100:/station|gateway|port|refinery/i.test(name)?70:/distribution|facility|outpost|bunker|settlement|depot|lab/i.test(name)?55:/mine|mining/i.test(name)?35:0;
 const missing=['missions','pve','pvp','loot','weapons','trade','hazards','services'].filter(d=>!p.flags[d]);
 return {score:focus+missing.length,missing};
};
const researchQueue=records.filter(p=>priorityPattern.test(p.name+' '+(p.type||''))).map(p=>{
 const q=priorityScore(p);
 return {id:p.id,name:p.name,system:p.system,type:p.type,score:q.score,missingDomains:q.missing,existingEvidence:p.evidence};
}).sort((a,b)=>b.score-a.score||a.system.localeCompare(b.system)||a.name.localeCompare(b.name));
const isHathor=p=>/hathor|^(attritus|lamina|ruptura|vivere)\s+(olp|paf-(?:i|ii|iii))$/i.test(String(p.name||''));
const hathorCurated=seed.locations.filter(isHathor);
const researchSummary={total:researchQueue.length,hathor:researchQueue.filter(isHathor).length,hathorCurated:hathorCurated.length,hathorCuratedMatched:hathorCurated.filter(p=>catalogKeys.has(key(p))).length,hathorCuratedUnmatched:hathorCurated.filter(p=>!catalogKeys.has(key(p))).length,stations:researchQueue.filter(p=>/station|gateway|port/i.test(p.name+' '+p.type)).length,withoutPvp:researchQueue.filter(p=>p.missingDomains.includes('pvp')).length};

// Report curated records absent from the API as separate records; never silently discard them.
const seedOnlyCounts={total:seedOnly.length,withTacticalIntel:seedOnly.filter(p=>!!p.tacticalIntel).length,withLoot:seedOnly.filter(p=>!!p.lootIntel).length,withServices:seedOnly.filter(p=>Object.values(p.services||{}).some(x=>['reported','confirmed'].includes(x))).length};
const seedOnlyResearchQueue=seedOnly.map(p=>{
 const domains={
  missions:!!p.missions?.length,pve:!!p.security?.pve,
  pvp:!!p.security?.pvp||!!p.pvp,loot:!!p.lootIntel?.categories?.length,
  weapons:!!p.tacticalIntel?.weapons?.length,trade:!!p.commodities?.length||!!p.shops?.length,
  hazards:!!p.tacticalIntel?.threats?.length||!!p.hazards?.length,
  services:Object.values(p.services||{}).some(x=>['reported','confirmed'].includes(x))
 };
 const missingDomains=Object.entries(domains).filter(([,v])=>!v).map(([k])=>k);
 return {id:p.id||null,name:p.name,system:p.system,sourceUrls:(p.sourceUrls||[]).filter(u=>typeof u==='string'&&u.startsWith('https://')),missingDomains,score:(/hathor/i.test(p.name)?100:/station|gateway|port/i.test(p.name)?70:50)+missingDomains.length,reason:'curated-only: no exact API catalog match; preserve separately and investigate identity'};
}).sort((x,y)=>y.score-x.score||x.name.localeCompare(y.name));

if(counts.total!==catalog.locations.length||counts.actionable+counts.geographicOnly!==counts.total)throw Error('Inconsistent atlas audit totals');
// A fetched location detail is NOT equivalent to tactical coverage. Count each domain separately.
const tacticalDomains=['missions','pve','pvp','loot','weapons','trade','hazards'];
const tacticalCoverage=Object.fromEntries(tacticalDomains.map(domain=>[domain,{
  reported:records.filter(p=>p.flags[domain]).length,
  sourceLinked:records.filter(p=>(p.evidence[domain]||[]).some(e=>e.kind==='location-api'||(e.kind==='curated'&&e.sourceUrls?.length))).length,
  apiLinked:records.filter(p=>(p.evidence[domain]||[]).some(e=>e.kind==='location-api')).length
}]));
const tacticalCoverageAny=records.filter(p=>tacticalDomains.some(domain=>(p.evidence[domain]||[]).some(e=>e.kind==='location-api'||(e.kind==='curated'&&e.sourceUrls?.length)))).length;
const evidenceCoverage={traced:records.filter(p=>Object.values(p.evidence).some(refs=>refs.some(r=>!['untraced','curated-unverified'].includes(r.kind)))).length,untraced:records.filter(p=>Object.values(p.evidence).some(refs=>refs.every(r=>['untraced','curated-unverified'].includes(r.kind)))).length};
const report={tacticalCoverage,tacticalCoverageAny,researchSummary,researchQueue,seedOnlyResearchQueue, evidenceCoverage,seedOnlyCounts,seedOnly:seedOnly.map(p=>({name:p.name,system:p.system,id:p.id})),schemaVersion:1,version:catalog.version,generatedAt:new Date().toISOString(),definition:'Actionable includes resource associations from the commodity API, which are NOT confirmed mineable deposits or loot. verifiedOperationalExcludingCommodityAssociations excludes commodity-only evidence; it is not live server confirmation.',counts,systems,topGaps:records.filter(x=>!x.actionableDomains&&/station|bunker|facility|outpost|cave|lab|mine|settlement|distribution|depot/i.test(x.type+' '+x.name)).slice(0,150),records};
await writeFile('lab-preview/data/atlas-quality.json',JSON.stringify(report,null,2)+'\n');
// Lightweight manifest for the browser: the full per-location audit remains available for offline inspection.
const meta={
 schemaVersion:1,version:catalog.version,
 generatedAt:enriched.generatedAt||report.generatedAt,
 commodityGeneratedAt:commodities.version===catalog.version?(commodities.generatedAt||null):null,
 commodityCoverage:commodities.version===catalog.version?(commodities.counts||{}):{},
 enrichedGeneratedAt:enriched.generatedAt||null,
 catalogTotal:report.counts.total,
 enrichedCount:enriched.version===catalog.version?enriched.locations.length:0,
 coverage:enriched.version===catalog.version?(enriched.coverage||{}):{},
 counts:report.counts,tacticalCoverage:report.tacticalCoverage,tacticalCoverageAny:report.tacticalCoverageAny,systems:report.systems,researchSummary:report.researchSummary,seedOnlyResearchTotal:report.seedOnlyResearchQueue.length,seedOnlyCounts:report.seedOnlyCounts,
 qualityGeneratedAt:report.generatedAt
};
await writeFile('lab-preview/data/atlas-meta.json',JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify({version:report.version,counts,systems},null,2));
