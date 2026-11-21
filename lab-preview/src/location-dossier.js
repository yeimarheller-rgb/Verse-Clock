import {envFor, SOURCE} from './environment.js';
import {securityFor} from './security.js';
import {lootFor} from './loot.js';
import {normalize, serviceNames, tacticalSections} from './tactical-atlas.js';
import {stantonSections} from './stanton.js';

export const dossierGroups = {
  security:['Seguridad y peligros','danger'],
  combat:['PvE y PvP','pvp'],
  missions:['Misiones y actividades','mission'],
  loot:['Botín, armas y recursos','loot'],
  services:['Servicios y comercio','repair'],
  navigation:['Acceso y navegación','landing'],
};
export const shipServices = {repair:'Reparación de nave',refuel:'Repostaje',rearm:'Rearme'};
const serviceLabels={...serviceNames,...shipServices};
const iconGroup={
  danger:'security', pve:'combat', pvp:'combat', contested:'combat', valakkar:'combat',
  mission:'missions', mining:'missions', loot:'loot', weapons:'loot', cave:'loot',
  repair:'services', rearm:'services', refuel:'services', trade:'services', commodity:'services',
  hangar:'services', landing:'navigation',
};
const meaningful = v => v && !/^(sin datos|no confirmad[ao]|sin verificar|según misión \/ sin datos|desconocido)$/i.test(v);
const textOf = row => typeof row === 'string' ? row : [
  row?.name||row?.label||row?.title, row?.detail||row?.description||row?.location,
  row?.confidence||row?.status, row?.patch||row?.source?.version,
].filter(Boolean).join(' · ');

export function locationDossier(p,{environment,body,solar,operations=false}={}){
  const groups=new Map();
  const sources=new Map();
  const seen=new Set();
  const addSources=(entries=[])=>entries.flatMap(entry=>{
    const url=typeof entry==='string'?entry:entry?.url;
    if(!/^https:\/\//i.test(url||''))return [];
    if(!sources.has(url))sources.set(url,{url,label:entry.name||new URL(url).hostname,index:sources.size+1});
    return [sources.get(url).index];
  });
  const add=(group,text,{title,status,sources:refs,destinations}={})=>{
    const indexes=[...new Set(addSources(refs))];
    if(!text)return;
    const key=normalize(text).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    if(seen.has(key))return;
    seen.add(key);
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push({title,text,status,sources:indexes,destinations});
  };
  const sections=[...tacticalSections(p),...stantonSections(p)];
  const isHathor=Boolean(p.hathor);
  const isContested=sections.some(s=>s.icons?.includes('contested'));
  const tactical=p.tacticalIntel, lootIntel=p.lootIntel;
  const hasMaintenance=p.stantonIntel?.claims.some(c=>c.services?.length);
  const serviceIntel=p.serviceIntel;
  const services=new Map();
  for(const key of Object.keys(serviceLabels)){
    const state=p.services?.[key];
    if(meaningful(state)||operations&&key in shipServices)services.set(key,{label:serviceLabels[key],state:state||'unknown'});
  }
  const directTerminals=new Set(p.stantonIntel?.claims.map(claim=>claim.terminalId).filter(Boolean));
  for(const section of sections){
    if(section.title==='Comercio'&&serviceIntel?.trade?.length&&serviceIntel.trade.every(([id])=>directTerminals.has(id))){
      addSources(section.sources);
      continue;
    }
    if(!section.icons?.length){
      const text=[serviceIntel?.padTypes&&'Plataformas registradas: '+serviceIntel.padTypes.replaceAll(',',', '),
        !hasMaintenance&&serviceIntel?.services.some(key=>key in shipServices)&&'Abre Servicios de aterrizaje desde el asiento de piloto tras aterrizar.'].filter(Boolean).join('. ');
      add('services',text,{sources:section.sources});
      continue;
    }
    const group=iconGroup[section.icons[0]]||'navigation';
    let text=section.text;
    if(isHathor&&group==='loot'&&tactical?.weapons){
      text='Posibles en los contenedores de las salas de seguridad: '+tactical.weapons.join(' · ')+'.';
    }
    if(hasMaintenance&&section.title?.match(/^(Mantenimiento de nave|Rearme y repostaje)$/)){
      text='Abre Servicios de aterrizaje desde el asiento de piloto tras aterrizar.';
    }
    add(group,text,section);
  }
  const knownEnvironment=p.stantonIntel?.environment||environment;
  if(environment&&!p.stantonIntel?.environment)add('security',environment.text,{title:'Entorno del cuerpo · '+body,sources:environment.sources});
  const visualEnv=envFor({body});
  if(!knownEnvironment&&visualEnv.tags.length)add('security',visualEnv.tags.map(t=>t.label).join(' · '),{title:'Entorno regional',sources:['https://starcitizen.tools/']});
  if(meaningful(visualEnv.gravity.label)&&visualEnv.gravity.key!=='unknown'){
    add('navigation','Gravedad regional: '+visualEnv.gravity.label+'. '+visualEnv.gravity.hint,{status:SOURCE.gravity,sources:['https://scminer.rocks/data/ore-by-location']});
  }
  if(!isHathor&&!isContested){
    const sec=securityFor(p);
    const refs=sec.source?[{url:sec.source.url,name:sec.source.source}]:[];
    if(sec.source){
      if(!p.stantonIntel?.claims.some(c=>c.field==='access')&&meaningful(sec.access))add('navigation',sec.access,{sources:refs});
      if(!p.stantonIntel?.claims.some(c=>c.field==='pve')&&!tactical?.threats?.length&&meaningful(sec.pve))add('combat',sec.pve,{title:'PvE',sources:refs,status:sec.source.build});
      if(!p.stantonIntel?.claims.some(c=>c.field==='pvp')&&meaningful(sec.pvp))add('combat',sec.pvp,{title:'PvP',sources:refs,status:sec.source.build});
      if(!meaningful(sec.pve)&&!meaningful(sec.pvp))add('security',sec.notes,{status:sec.source.build,sources:refs});
    }
    const loot=lootFor(p);
    if(!tactical?.weapons&&!tactical?.resources&&!lootIntel&&loot.source)add('loot',loot.summary,{sources:[loot.source]});
  }
  const faction=p.operator||p.affiliation;
  if(faction)add('security',faction,{title:'Operador o afiliación'});
  if(p.jurisdiction&&normalize(p.jurisdiction)!==normalize(faction))add('security',p.jurisdiction,{title:'Jurisdicción'});

  const tacticalRefs=tactical?.sources||[];
  const list=(group,title,entries,refs)=>add(group,(entries||[]).map(textOf).filter(Boolean).join(' · '),{title,sources:refs});
  if(tactical){
    if(!isHathor)list('combat','Amenazas',tactical.threats,tacticalRefs);
    if(!isHathor)list('loot','Armas posibles',tactical.weapons,tacticalRefs);
    list('loot','Armaduras posibles',tactical.armor,tacticalRefs);
    list('loot','Componentes posibles',tactical.components,tacticalRefs);
    if(!isHathor)list('loot','Recursos',tactical.resources,tacticalRefs);
    list('missions','Preparación',tactical.requirements,tacticalRefs);
    if(!isHathor){
      const steps=(tactical.steps||[]).map((step,index)=>(index+1)+'. '+step).join('\n');
      add('missions',steps,{title:tactical.title,sources:tacticalRefs,status:tactical.caveat});
    }
  }
  if(lootIntel&&!isHathor){
    list('loot','Objetos y materiales',lootIntel.categories,lootIntel.sources);
    add('loot',lootIntel.mining,{sources:lootIntel.sources,status:lootIntel.caveat});
    add('missions',lootIntel.solo,{title:'En solitario',sources:lootIntel.sources});
    add('missions',lootIntel.org,{title:'En grupo',sources:lootIntel.sources});
  }
  for(const [group,title,rows] of [
    ['missions','Actividades y contratos',[...(p.activities||[]),...(p.missions||[])]],
    ['loot','Botín específico',p.lootItems],['loot','Recursos catalogados',p.resources],
    ['services','Mercancías',p.commodities],['services','Tiendas',p.shops],
    ['combat','Enemigos catalogados',p.npcs],['navigation','Instalaciones vinculadas',p.nearbyLocations],
    ['navigation','Consejos tácticos',p.tacticalTips],
  ]){
    const refs=(rows||[]).map(r=>r?.source?.url);
    list(group,title,[...new Set((rows||[]).map(textOf).filter(Boolean))],refs);
  }
  if(!serviceIntel)list('services','Equipamiento y servicios registrados',p.amenities);
  if((p.missionCount||0)>0&&!p.missions?.length&&!p.activities?.length&&!groups.has('missions'))add('missions',p.missionCount+' referencias de contrato en catálogo. Disponibilidad por verificar.');
  if(p.hathor?.linked.length)add('navigation','Instalaciones de la serie '+p.hathor.group,{destinations:p.hathor.linked});
  if(solar)add('navigation',solar,{title:'Navegación solar'});
  addSources([...(p.sourceUrls||[]),...(tacticalRefs||[]),...(lootIntel?.sources||[])]);
  const version=p.source?.version||p.patch||p.intelDetailSource?.version;
  const review=p.stantonIntel?.checkedAt||p.serviceIntel?.checkedAt||p.intelCheckedAt?.slice(0,10);
  const versionLabel=[version&&'Datos '+version, review&&'Consulta '+review].filter(Boolean).join(' · ');
  return {groups,services,sources:[...sources.values()],versionLabel};
}
