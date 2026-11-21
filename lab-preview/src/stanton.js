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
 pve:'PvE',pvp:'PvP',missions:'Misiones',loot:'Botín',weapons:'Armas',trade:'Comercio',
 repair:'Reparación',refuel:'Repostaje',rearm:'Rearme',hazards:'Peligros ambientales',
 logistics:'Clínica, hangar, refinería o carga',access:'Acceso y navegación',
};
const iconsByField={
 pve:'pve',pvp:'pvp',missions:'mission',loot:'loot',weapons:'weapons',trade:'trade',
 repair:'repair',refuel:'refuel',rearm:'rearm',hazards:'danger',logistics:'hangar',access:'landing',
};
export function mergeStanton(byKey, data) {
 if(data?.schemaVersion!==1)return;
 for(const row of data.locations){
  const key=atlasKey({system:'Stanton',name:row.name});
  const original=byKey.get(key);
  if(!original)continue;
  const services={...original.services};
  for(const claim of row.claims){
   if(claim.status==='documented')for(const service of claim.services||[])services[service]='confirmed';
  }
  byKey.set(key,{...original,services,stantonIntel:{...row,checkedAt:data.checkedAt}});
 }
}
export function stantonSections(p) {
 const sections=(p.stantonIntel?.claims||[]).map(claim=>({
  title:claim.title||stantonFields[claim.field], icons:[iconsByField[claim.field]],
  text:claim.text, status:statusText[claim.status]+(claim.patch?' · fuente '+claim.patch:''),
  sources:claim.sources.map(url=>({url,name:new URL(url).hostname})),
 }));
 if(p.stantonIntel?.reviewNote)sections.push({title:p.stantonIntel.reviewedWithoutEvidence.length>1?'Servicios de nave':'Rearme',icons:['rearm'],text:p.stantonIntel.reviewNote,
  status:'Investigado sin corroboración LIVE',sources:[{url:p.stantonIntel.reviewSource,name:'Star Citizen Wiki'}]});
 return sections;
}

export function stantonCoverage(raw, visible, zone='Stanton'){
 const catalog=raw.filter(p=>inStantonZone(p,zone));
 const matches=new Map(visible.filter(p=>inStantonZone(p,zone)).map(p=>[atlasKey(p),p]));
 const counts=Object.fromEntries(Object.keys(stantonFields).map(key=>[key,0]));
 const sources={documented:0,reported:0,historical:0};
 let geographic=0,operational=0,reviewedAll=0;
 for(const row of catalog){
  const key=atlasKey(row),p=matches.get(key);
  if(!p||isStantonPlaceholder(row))continue;
  geographic++;
  const facts=new Set();
  const grades=new Set();
  for(const claim of p.stantonIntel?.claims||[]){
   if(!claim.sources.length)continue;
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
  if(Object.keys(counts).every(field=>facts.has(field)||p.stantonIntel?.reviewedWithoutEvidence?.includes(field)))reviewedAll++;
  for(const field of facts)counts[field]++;
  for(const grade of grades)sources[grade]++;
 }
 return {total:catalog.length,geographic,operational,reviewedAll,counts,sources};
}
