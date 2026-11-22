import {atlasKey, atlasSystem, normalize, tacticalSections} from './tactical-atlas.js';

export const stantonGroups = {
 Hurston: ['Hurston','Aberdeen','Arial','Ita','Magda'],
 Crusader: ['Crusader','Cellin','Daymar','Yela'],
 ArcCorp: ['ArcCorp','Lyria','Wala'],
 microTech: ['microTech','Calliope','Clio','Euterpe'],
};
export const stantonBodies=Object.values(stantonGroups).flat();
const knownBodies=new Map(stantonBodies.map(name=>[normalize(name),name]));

export function stantonBody(p) {
 if(atlasSystem(p.system)!=='Stanton')return '';
 const namedBody=knownBodies.get(normalize(p.name));
 if(namedBody)return namedBody;
 for(const value of [p.stantonResolvedBody,p.stantonIntel?.body,p.serviceIntel?.body,p.parent,p.body,p.name]){
  const key=normalize(value);
  if(knownBodies.has(key))return knownBodies.get(key);
  const orbital=/^(hur|cru|arc|mic)[ -]?l\d(?:$| )/.exec(key)?.[1];
  if(orbital)return {hur:'Hurston',cru:'Crusader',arc:'ArcCorp',mic:'microTech'}[orbital];
 }
 return '';
}

export function inStantonZone(p, zone) {
 if(!zone)return true;
 const body=stantonBody(p);
 return atlasSystem(p.system)==='Stanton' && (zone==='Stanton' || (zone==='unassigned'&&!body) ||
  (zone==='lagrange'&&/^(hur|cru|arc|mic)[ -]?l\d(?:$| )/i.test(p.parent+'') || zone==='lagrange'&&/^(hur|cru|arc|mic)[ -]?l\d(?:$| )/i.test(p.name)) ||
  zone==='only:'+body || zone===body || stantonGroups[zone]?.includes(body));
}

export const isStantonPlaceholder=p=>atlasSystem(p.system)==='Stanton'&&/^<=\s*(uninitialized|placeholder)\s*=>$/i.test(p.name);

export function identifyStantonVariants(rows) {
 const names=new Map();
 for(const p of rows){
  if(atlasSystem(p.system)!=='Stanton')continue;
  const key=normalize(p.name);
  names.set(key,(names.get(key)||0)+1);
 }
 return rows.map(p=>atlasSystem(p.system)==='Stanton'&&names.get(normalize(p.name))>1&&p.id
  ? {...p,catalogVariant:p.id} : p);
}

export function traceStantonParents(rows) {
 const byName=new Map();
 for(const p of rows){
  if(atlasSystem(p.system)!=='Stanton')continue;
  const key=normalize(p.name);
  byName.set(key,byName.has(key)?null:p);
 }
 return rows.map(p=>{
  if(atlasSystem(p.system)!=='Stanton'||stantonBody(p))return p;
  const seen=new Set([normalize(p.name)]);
  let parent=normalize(p.parent);
  while(parent&&!seen.has(parent)){
   seen.add(parent);
   const node=byName.get(parent);
   if(!node)break;
   const body=stantonBody(node);
   if(body)return {...p,stantonResolvedBody:body};
   parent=normalize(node.parent);
  }
  return p;
 });
}

const statusText={
 documented:'Documentado · funcionamiento LIVE sin prueba en partida',
 historical:'Otra versión · funcionamiento actual pendiente',
 reported:'Reportado · funcionamiento LIVE sin prueba en partida',
};
export const stantonFields={
 pve:'PvE',pvp:'PvP',missions:'Misiones',loot:'Botín',resources:'Recursos',weapons:'Armas',trade:'Comercio',
 repair:'Reparación',refuel:'Repostaje',rearm:'Rearme',hazards:'Peligros ambientales',
 logistics:'Clínica, hangar, refinería o carga',access:'Acceso y navegación',
};
const iconsByField={
 pve:'pve',pvp:'pvp',missions:'mission',loot:'loot',resources:'loot',weapons:'weapons',trade:'trade',
 repair:'repair',refuel:'refuel',rearm:'rearm',hazards:'danger',logistics:'hangar',access:'landing',
};
const locationUuid=p=>p.source?.uuid||p.id;
const httpsSource=value=>{
 try {
  const url=new URL(value);
  const lootLocation=url.origin==='https://loot-verse.com'&&/^#place-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.hash);
  return url.protocol==='https:'&&(Boolean(url.pathname.slice(1))||lootLocation);
 }
 catch { return false; }
};

const catalogReviewMessages={
 technical:'Registro técnico sin identidad de juego. Excluido de la cobertura operativa.',
 hidden:'La posición extraída corresponde a un marcador oculto. El acceso, las actividades y los servicios locales siguen pendientes de evidencia.',
 unplacedEventPlatform:'Plataforma del evento temporal RSI Discovery Month. El registro se conserva como referencia del catálogo.',
 unplaced:'Este UUID carece de una posición en la extracción revisada. Su presencia y su uso en partida siguen pendientes de evidencia local.',
 placed:'La extracción confirma la posición de este marcador. Sus actividades y servicios locales siguen pendientes de evidencia.',
};

export function stantonCatalogReview(p, review){
 if(!review?.version||review.version!==p.source?.version||!httpsSource(review.positionSource))return null;
 const state=review.records?.[locationUuid(p)];
 if(!Object.hasOwn(catalogReviewMessages,state))return null;
 return {state,text:catalogReviewMessages[state],source:review.positionSource,checkedAt:review.checkedAt};
}

export function mergeStanton(byKey, data) {
 if(data?.schemaVersion!==1)return;
 const byUuid=new Map([...byKey].flatMap(([key,p])=>atlasSystem(p.system)==='Stanton'&&locationUuid(p)?[[locationUuid(p),key]]:[]));
 for(const row of data.locations){
  const key=row.uuid?byUuid.get(row.uuid):atlasKey({system:'Stanton',name:row.name});
  const original=byKey.get(key);
  if(!original)continue;
  const services={...original.services};
  for(const claim of row.claims){
   if(claim.status==='documented'&&claim.sources?.every(httpsSource)&&claim.sources.length)for(const service of claim.services||[])services[service]='confirmed';
  }
  byKey.set(key,{...original,services,stantonIntel:{...row,checkedAt:row.checkedAt||data.checkedAt}});
 }
 for(const [uuid,key] of byUuid){
  if(!Object.hasOwn(data.catalogReview?.records||{},uuid))continue;
  const location=byKey.get(key);
  const review=stantonCatalogReview(location,data.catalogReview);
  if(review)byKey.set(key,{...location,stantonCatalogReview:review});
 }
}
export function stantonSections(p) {
 const sections=(p.stantonIntel?.claims||[]).map(claim=>({
  title:claim.title||stantonFields[claim.field], icons:[iconsByField[claim.field]],
  text:claim.text, destinations:claim.destinations, status:statusText[claim.status]+(claim.patch?' · fuente '+claim.patch:''),
  sources:claim.sources.map(url=>({url,name:new URL(url).hostname})),
 }));
 if(p.stantonIntel?.reviewNote)sections.push({title:p.stantonIntel.reviewedWithoutEvidence.length>1?'Servicios de nave':'Rearme',icons:['rearm'],text:p.stantonIntel.reviewNote,
  status:'Investigado sin corroboración LIVE',sources:[{url:p.stantonIntel.reviewSource,name:'Star Citizen Wiki'}]});
 return sections;
}

export const isStantonTemporaryEvent=(p,review)=>
 atlasSystem(p.system)==='Stanton'&&p.name==='RSI Event Platform'&&
 stantonCatalogReview(p,review)?.state==='unplacedEventPlatform';

export function stantonCoverage(raw, visible, zone='Stanton', review){
 const inventory=[...new Map(raw.filter(p=>inStantonZone(p,zone)).map(p=>[locationUuid(p),p])).values()];
 const catalog=inventory.filter(p=>!isStantonTemporaryEvent(p,review));
 const matches=new Map(visible.filter(p=>inStantonZone(p,zone)&&locationUuid(p)).map(p=>[locationUuid(p),p]));
 const counts=Object.fromEntries(Object.keys(stantonFields).map(key=>[key,0]));
 const sources={documented:0,reported:0,historical:0};
 let geographic=0,enriched=0,operational=0,reviewedAll=0,documentedLocal=0;
 const countedDocumentedUuids=new Set();
 for(const row of catalog){
  const p=matches.get(locationUuid(row));
  if(!p||isStantonPlaceholder(row))continue;
  geographic++;
  if(p.stantonIntel||p.serviceIntel||p.hathor||
   (p.intelDetailSource?.uuid===locationUuid(row)&&[p.missions,p.resources,p.nearbyLocations].some(items=>items?.length)))enriched++;
  const facts=new Set();
  const grades=new Set();
  for(const claim of p.stantonIntel?.claims||[]){
   if(!(claim.field in stantonFields)||!(claim.status in statusText)||!claim.text?.trim()||!claim.sources?.length||!claim.sources.every(httpsSource))continue;
   grades.add(claim.status);
   if(claim.status!=='historical'){facts.add(claim.field);for(const service of claim.services||[])facts.add(service);}
  }
  if(p.serviceIntel){
   for(const field of ['repair','refuel','rearm'])if(p.serviceIntel.services.includes(field))facts.add(field);
   if(p.serviceIntel.tradeTerminal||p.serviceIntel.trade?.length)facts.add('trade');
   if(p.serviceIntel.services.some(field=>['clinic','cargo','refinery'].includes(field)))facts.add('logistics');
   grades.add('reported');
  }
  if(p.hathor){
   if(tacticalSections(p).length)for(const field of ['pve','pvp','missions','loot','access'])facts.add(field);
   if(!p.name.endsWith('OLP'))facts.add('weapons');
   grades.add('reported');
  }
  if(facts.size)operational++;
  // Independent local-evidence metric: never infer coverage from inherited services or Hathor.
  // Reported/historical claims remain visible but do not certify documented local coverage.
  if(!countedDocumentedUuids.has(locationUuid(row))&&p.stantonIntel?.uuid===locationUuid(row)&&p.stantonIntel.claims?.some(claim=>
   claim.status==='documented'&&claim.field in stantonFields&&claim.text?.trim()&&
   claim.sources?.length&&claim.sources.every(httpsSource))){
   documentedLocal++;
   countedDocumentedUuids.add(locationUuid(row));
  }
  if(Object.keys(counts).every(field=>facts.has(field)||p.stantonIntel?.reviewedWithoutEvidence?.includes(field)))reviewedAll++;
  for(const field of facts)counts[field]++;
  for(const grade of grades)sources[grade]++;
 }
 return {total:catalog.length,catalogTotal:inventory.length,excludedTemporary:inventory.length-catalog.length,
  geographic,enriched,operational,documentedLocal,reviewedAll,counts,sources};
}
