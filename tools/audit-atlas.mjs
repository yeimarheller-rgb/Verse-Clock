// Atlas-wide evidence audit. No synthetic gameplay intelligence.
import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('lab-preview/data/wiki-atlas.json','utf8'));
const seed=JSON.parse(await readFile('lab-preview/data/atlas-poi-seed.json','utf8'));
let enriched={locations:[],version:null};try{enriched=JSON.parse(await readFile('lab-preview/data/atlas-enriched.json','utf8'))}catch{}
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
for(const p of catalog.locations){const s=seeds.get(key(p))||{},d=details.get(p.id)||{};const flags={consulted:!!d.checkedAt,curated:!!s.id,missions:!!d.missions?.length||!!s.missions?.length,resources:!!d.resources?.length||!!s.tacticalIntel?.resources?.length||!!commodityResources.get(p.id)?.length,nearby:!!d.nearbyLocations?.length,services:!!p.amenities?.length||Object.values(s.services||{}).some(x=>['reported','confirmed'].includes(x)),pve:!!s.tacticalIntel?.threats?.length||!!s.security?.pve,pvp:!!s.security?.pvp||!!s.pvp,loot:!!s.lootIntel?.categories?.length||!!s.tacticalIntel?.weapons?.length,weapons:!!s.tacticalIntel?.weapons?.length||!!s.tacticalIntel?.armor?.length,trade:!!s.commodities?.length||!!s.shops?.length,hazards:!!s.tacticalIntel?.threats?.length||!!s.hazards?.length,sources:!!s.sourceUrls?.length||!!p.source?.uuid};const operationalFields=['missions','resources','services','pve','pvp','loot','weapons','trade','hazards'];const actionable=operationalFields.filter(k=>flags[k]).length;
 const confirmedResource=!!d.resources?.length||!!s.tacticalIntel?.resources?.length;
 const operationalWithoutCommodity=operationalFields.some(k=>k==='resources'?confirmedResource:flags[k]);
 if(operationalWithoutCommodity)counts.verifiedOperationalExcludingCommodityAssociations++;
 if(!operationalWithoutCommodity&&!!commodityResources.get(p.id)?.length)counts.resourceAssociationsOnly++;counts.total++;if(!systems[p.system])systems[p.system]={total:0,actionable:0,geographicOnly:0};systems[p.system].total++;for(const [k,v] of Object.entries(flags))if(v){const map={consulted:'consulted',curated:'curated',missions:'withMissions',resources:'withResources',nearby:'withNearby',services:'withServices',pve:'withPve',pvp:'withPvp',loot:'withLoot',weapons:'withWeapons',trade:'withTrade',hazards:'withHazards',sources:'withSources'};counts[map[k]]++}if(actionable){counts.actionable++;systems[p.system].actionable++}else{counts.geographicOnly++;systems[p.system].geographicOnly++}records.push({id:p.id,name:p.name,system:p.system,parent:p.parent||null,type:p.type||null,flags,actionableDomains:actionable})}
// Report curated records absent from the API as separate records; never silently discard them.
const seedOnlyCounts={total:seedOnly.length,withTacticalIntel:seedOnly.filter(p=>!!p.tacticalIntel).length,withLoot:seedOnly.filter(p=>!!p.lootIntel).length,withServices:seedOnly.filter(p=>Object.values(p.services||{}).some(x=>['reported','confirmed'].includes(x))).length};
if(counts.total!==catalog.locations.length||counts.actionable+counts.geographicOnly!==counts.total)throw Error('Inconsistent atlas audit totals');
const report={seedOnlyCounts,seedOnly:seedOnly.map(p=>({name:p.name,system:p.system,id:p.id})),schemaVersion:1,version:catalog.version,generatedAt:new Date().toISOString(),definition:'Actionable includes resource associations from the commodity API, which are NOT confirmed mineable deposits or loot. verifiedOperationalExcludingCommodityAssociations excludes commodity-only evidence; it is not live server confirmation.',counts,systems,topGaps:records.filter(x=>!x.actionableDomains&&/station|bunker|facility|outpost|cave|lab|mine|settlement|distribution|depot/i.test(x.type+' '+x.name)).slice(0,150),records};
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
 counts:report.counts,systems:report.systems,seedOnlyCounts:report.seedOnlyCounts,
 qualityGeneratedAt:report.generatedAt
};
await writeFile('lab-preview/data/atlas-meta.json',JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify({version:report.version,counts,systems},null,2));
