import {applyNyxI, canReleaseNyxI, fetchCurrentLive, isNyxI} from './nyx-release.js';
import {applyCatalogIntel} from './catalog-intel.js';
import {dossierGroups,locationDossier} from './location-dossier.js';
import {identifyCatalogVariants,inStantonZone,isStantonPlaceholder,isStantonTemporaryEvent,mergeStanton,stantonBody,stantonCoverage,stantonFields,stantonGroups,stantonSections,traceStantonParents} from './stanton.js';
import {tacticalIcon,tacticalIcons,tacticalStates} from './tactical-icons.js';
// VERSE CLOCK 1.5 — interfaz. Datos: src/engine.js + data/locations.json. Escena: src/scene.js.
import { compute } from './engine.js';
import { sunState, buildScene, paintScene, photoWeights } from './scene.js';
import { coords, fmtCoords, nearestQT, compass } from './nav.js';
import { validateIntelRecord, lootBadge } from './intel-schema.js';
import { atlasKey, atlasSystem, mergeTacticalAtlas, normalize, tacticalSections, tacticalTags } from './tactical-atlas.js';

const $ = id => document.getElementById(id);
const madridTime = new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const PHASE = { day: 'Día', night: 'Noche', sunrise: 'Amanecer', sunset: 'Atardecer', polar: 'Ciclo polar' };
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// ?t=2026-11-04T21:39:00Z simula otro instante (para revisar fases). Se avisa en pantalla.
const initialDestination = new URLSearchParams(location.search).get('dest');
const SIM = (() => { const t = Date.parse(new URLSearchParams(location.search).get('t')); return Number.isFinite(t) ? t - Date.now() : 0; })();
const nowMs = () => Date.now() + SIM;
let nyxIVisible=false;
let locs = [], cur = null, favs = store.get('vc-favs', []);
// Migración: quita los tres favoritos que venían por defecto en 1.0, sin tocar favoritos elegidos por el usuario.
const OLD_DEFAULT = ['Lorville', 'HDSF-Elbridge', 'Dupree Industrial Manufacturing Facility'];
if (!store.get('vc-favs-v2', false)) { if (JSON.stringify(favs) === JSON.stringify(OLD_DEFAULT)) { favs = []; store.set('vc-favs', favs); } store.set('vc-favs-v2', true); }
// Orbitron no tiene cifras tabulares: cada dígito va en una celda de ancho fijo para que el texto no tiemble.
function mono(el, text) {
  if (!el || el.dataset.v === text) return;
  const prev = el.dataset.v || '';
  el.dataset.v = text; el.setAttribute('aria-label', text);
  const kind = c => /\d/.test(c) ? 'd' : c === ':' ? 'c' : 'o';
  // misma forma (p. ej. 12:34:56 → 12:35:05): solo se cambian las cifras que varían, sin reconstruir nada
  if (prev.length === text.length && [...prev].every((c, i) => kind(c) === kind(text[i])) && el.children.length === text.length) {
    for (let i = 0; i < text.length; i++) if (prev[i] !== text[i]) el.children[i].textContent = text[i] === ' ' ? '\u00a0' : text[i];
    return;
  }
  el.innerHTML = [...text].map(c => kind(c) === 'd' ? `<span class="dg" aria-hidden="true">${c}</span>` : kind(c) === 'c' ? '<span class="cl" aria-hidden="true">:</span>' : `<span aria-hidden="true">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
}
const byName = n => locs.find(l => l.name === n && (nyxIVisible||!isNyxI(l)));
const dur = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s % 60).padStart(2, '0')} s`; };

let exactSolar=null;
let activeLocation=null;
function setClock(solar,reference=null){
  exactSolar=solar||null;
  cur=solar||reference;
  lastScenePaint=0;
  $('where').textContent=solar?'Hora local':reference?'Referencia solar · '+reference.name:'Hora local sin cálculo';
  $('solarEvents').hidden=!cur;
  $('solarTimeline').hidden=!cur;
  if(!cur)mono($('clock'),'—');
  $('fav').disabled=!exactSolar;
  renderFavs();
  tick();
}
function select(l) {
  if(!l)return;
  setClock(l);
  input.value='';
  const url=new URL(location.href);
  url.searchParams.delete('dest');
  url.hash=encodeURIComponent(l.name.replace(/ /g,'_'));
  history.replaceState(null,'',url);
  store.set('vc-last',l.name);
  const poi=poiData.find(p=>p.system===l.system&&normalize(p.name)===normalize(l.name));
  selectedPoiKey=poi?atlasKey(poi):null;
  applyPoiToMain(poi||l);
}

function renderFavs() {
  const isFav = exactSolar && favs.includes(exactSolar.name);
  $('fav').setAttribute('aria-pressed', String(!!isFav));
  $('fav').innerHTML = `<span class="ico" aria-hidden="true">${isFav ? '★' : '☆'}</span><span class="txt">${isFav ? 'Fijada' : 'Fijar'}</span>`;
  $('fav').setAttribute('aria-label', isFav ? 'Quitar de fijadas' : 'Fijar ubicación');
  $('cards').hidden = !favs.length;
  $('cards').innerHTML = favs.map(byName).filter(Boolean).map(l => `
    <button class="card${cur && l.name === cur.name ? ' on' : ''}" data-name="${l.name.replace(/"/g, '&quot;')}">
      <span class="cn">${l.name}</span><span class="cb">${l.body}</span>
      <span class="ct" data-t></span><span class="cp" data-p></span>
    </button>`).join('');
}

let lastScenePaint = 0;
const SCENE_EVERY_MS = 15000; // el paisaje cambia despacio: repintado cada 15 s; el reloj, en cada fotograma
function tick() {
  const now = nowMs();
  $('net').textContent = SIM ? 'Hora simulada' : navigator.onLine ? 'En línea' : 'Sin conexión · modo offline';
  if (!cur) return;
  const r = compute(cur, now), st = sunState(cur, r);
  fast(now,r);
  document.documentElement.dataset.phase = st.phase;
  $('phase').textContent = PHASE[st.phase];
  if (!lastScenePaint || now - lastScenePaint >= SCENE_EVERY_MS || now < lastScenePaint) {
    lastScenePaint = now;
    const P = paintScene($('scene'), st, cur.body);
    document.body.style.background = P.near; // suelo continuo bajo la escena en móvil
    const W = photoWeights(st), ph = $('photo');
    if (ph) for (const pic of ph.children) pic.style.opacity = (W[pic.dataset.k] || 0).toFixed(3);
  }

  $('riseEvent').hidden=r.polar;
  $('setEvent').hidden=r.polar;
  $('tlRise').hidden=$('tlSet').hidden=r.polar;
  if(r.polar){
    $('tl').style.removeProperty('background');
  }else{
    const rise=r.nextStarriseInSeconds, set=r.nextStarsetInSeconds;
    mono($('riseIn'),rise<=0?'Ahora':dur(rise));
    mono($('setIn'),set<=0?'Ahora':dur(set));
    $('riseEvent').classList.toggle('solar-next',!r.isDay);
    $('setEvent').classList.toggle('solar-next',r.isDay);

    const dawn=r.sunriseLocalFraction*100, dusk=100-dawn;
    const twilight=Math.min(6,(dusk-dawn)/2);
    $('tlRise').style.left=dawn+'%';
    $('tlSet').style.left=dusk+'%';
    $('tl').style.background=`linear-gradient(90deg,
      var(--night) ${Math.max(0,dawn-4)}%, var(--dawn) ${dawn}%,
      var(--day) ${dawn+twilight}%, var(--day) ${dusk-twilight}%,
      var(--dusk) ${dusk}%, var(--night) ${Math.min(100,dusk+4)}%)`;
  }
  const schedule=$('solarSchedule');
  if(schedule&&!r.polar)schedule.textContent='Hora de Madrid · amanecer '+madridTime.format(Date.parse(r.nextStarriseUtc))+' · atardecer '+madridTime.format(Date.parse(r.nextStarsetUtc));
  for (const el of $('cards').children) {
    const l = byName(el.dataset.name); if (!l) continue;
    const ph = sunState(l, compute(l, now)).phase;
    el.querySelector('[data-p]').textContent = PHASE[ph]; el.dataset.phase = ph;
  }
}
// En el juego el día dura mucho menos que en la Tierra (Hurston: 1 s real ≈ 9,7 s de juego).
// Si el reloj se pinta una vez por segundo, los segundos saltan de ~10 en ~10 y de forma irregular.
// Por eso la hora local, la línea temporal y las tarjetas se pintan en cada fotograma.
function fast(now = nowMs(), r = cur && compute(cur, now)) {
  if (!r) return;
  mono($('clock'), r.localTime);
  $('tlNow').style.left=(r.localTimeSeconds/864)+'%';
  for (const el of $('cards').children) { const l = byName(el.dataset.name); if (l) mono(el.querySelector('[data-t]'), compute(l, now).localTime); }
}
// Limitar repintados del reloj: evita cálculos DOM en cada frame (60/120 Hz) en iPhone.
let lastClockFrame=0;
function frame(timestamp) {
  if(document.visibilityState==='visible' && timestamp-lastClockFrame>=100){lastClockFrame=timestamp;fast()}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
function fromHash() { const h = decodeURIComponent(location.hash.slice(1)).replace(/_/g, ' ').toLowerCase(); return h && locs.find(l => l.name.toLowerCase() === h && (nyxIVisible||!isNyxI(l))); }

buildScene($('scene'));
// Las fotos solo se muestran si cargan las cuatro; si falta alguna, queda la escena procedural.
Promise.all([...$('photo').querySelectorAll('img')].map(img => img.decode ? img.decode() : Promise.resolve()))
  .then(() => $('photo').classList.add('ready')).catch(() => $('photo').remove());

const input = $('q'), menu = $('suggestions');
let suggestions = [], cursor = -1;
// Búsqueda también por tipo y por apodos usados en el juego (p. ej. «Hathor» para las plataformas láser).
const ALIASES = { 'Orbital laser platform': 'hathor olp plataforma laser orbital', 'Planetary alignment facility': 'hathor paf alineacion planetaria' };
const searchTags = l => `${l.type || ''} ${ALIASES[l.type] || ''}`;
function hideMenu() {
  menu.hidden = true; menu.replaceChildren(); suggestions = []; cursor = -1;
  input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant');
}
function chooseSearchResult(item){
 if(!item)return;
 if(item.kind==='poi'){
  const p=item.value;
  const solar=locs.find(l=>normalize(l.name)===normalize(p.name)&&l.system===p.system);
  const referenceBody=stantonBody(p)||p.parent;
  const surface=/outpost|bunker|underground|surface|facility|planetary-alignment|settlement|moon|planet/i.test(p.type||'')&&!/orbital|platform$/i.test(p.type||'');
  const reference=surface&&!p.stantonIntel?.orbital&&locs.find(l=>l.system===p.system&&normalize(l.body)===normalize(referenceBody));
  setClock(solar,reference||null);
  if(solar)store.set('vc-last',solar.name);
  const url=new URL(location.href);
  url.searchParams.set('dest',atlasKey(p));
  url.hash='';
  history.replaceState(null,'',url);
  selectedPoiKey=atlasKey(p);
  applyPoiToMain(p);
  window.scrollTo({top:0});

 }else {selectedPoiKey=null;select(item.value)}
 hideMenu();input.blur();setFilterOpen(false);
}
function pick(i){chooseSearchResult(suggestions[i])}
const serviceIcons={repair:'repair',rearm:'rearm',refuel:'refuel',refinery:'refinery',clinic:'medic',cargo:'cargo'};
const evidenceState=value=>({confirmed:'confirmed',reported:'possible',possible:'possible',unavailable:'unavailable'}[value]||'unknown');
const dossierIcons=p=>new Set(sectionsFor(p).flatMap(section=>section.icons||[]));
let activeFilter='';
let operationsEnabled=false;
function setFilterOpen(open){
 $('searchFilters').hidden=!open;
 $('filterToggle').setAttribute('aria-expanded',String(open));
}
$('filterToggle').addEventListener('click',()=>{
 setFilterOpen($('searchFilters').hidden);
 hideMenu();
});
let rawStantonCatalog=[];
let stantonReview,stantonAudit;
const stantonZone=$('stantonZone');
const auditedSystems=['Pyro','Nyx'];
const sectionsFor=p=>[...tacticalSections(p),...stantonSections(p)];
const filters=[['repair','Reparación'],['refuel','Repostaje'],['rearm','Rearme'],['contested','Zona disputada'],['loot','Botín'],['trade','Comercio']];
function matchesFilter(p,filter){
 if(!filter)return true;
 if(serviceIcons[filter])return ['confirmed','possible'].includes(evidenceState(p.services?.[filter]));
 if(filter==='loot'&&(p.lootIntel?.categories?.length||p.tacticalIntel?.weapons?.length))return true;
 return dossierIcons(p).has(filter);
}
function makeTacticalLabel(icon,text,size=20,state){
 const label=document.createElement('span');label.className='tactical-label';
 label.append(tacticalIcon(icon,{size,state}),text);
 return label;
}
function resultIcon(p){
 if(dossierIcons(p).has('anti-capital'))return 'anti-capital';
 if(activeFilter)return activeFilter;
 const shape=normalize(p.name+' '+p.type);
 if(/distribution (center|centre)|centro de distribucion/.test(shape))return 'distribution';
 if(/bunker|security depot/.test(shape))return 'bunker';
 if(/\bcave\b|cueva/.test(shape))return 'cave';
 if(dossierIcons(p).has('contested'))return 'contested';
 if(p.hathor)return /OLP$/.test(p.name)?'mining':'bunker';
 if(matchesFilter(p,'repair'))return 'repair';
 if(matchesFilter(p,'trade'))return 'commodity';
 return 'intel';
}
for(const [id,title] of filters){
 const button=document.createElement('button');button.type='button';
 button.dataset.filter=id;button.setAttribute('aria-pressed','false');
 button.append(makeTacticalLabel(id,title));$('tacticalFilters').append(button);
 button.addEventListener('click',()=>{
  activeFilter=activeFilter===id?'':id;
  for(const filter of $('tacticalFilters').children)filter.setAttribute('aria-pressed',String(filter.dataset.filter===activeFilter));
  updateMenu();
 });
}
for(const [planet,bodies] of Object.entries(stantonGroups)){
 const group=document.createElement('optgroup');group.label=planet;
 group.append(new Option(planet+' y lunas',planet));
 group.append(new Option('Solo '+planet,'only:'+planet));
 for(const moon of bodies.slice(1))group.append(new Option(moon,moon));
 stantonZone.append(group);
}
stantonZone.addEventListener('change',()=>{updateMenu();renderStantonCoverage();});
function renderStantonCoverage(){
 const host=$('stantonCoverage');
 if(!rawStantonCatalog.length){host.textContent='Catálogo Stanton pendiente de cargar.';return;}
 const zone=auditedSystems.includes(stantonZone.value)?'Stanton':stantonZone.value||'Stanton';
 const c=stantonCoverage(rawStantonCatalog,poiData,zone,stantonReview,stantonAudit);
 const summary=document.createElement('p');
 const percentage=count=>(c.total?100*count/c.total:0).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1});
 summary.textContent=c.operational+' / '+c.total+' operativas · '+percentage(c.operational)+' % · '+c.certifiedLocal+' / '+c.total+' certificadas · '+percentage(c.certifiedLocal)+' %';
 const list=document.createElement('dl');list.className='stanton-metrics';
 const metrics={'Geografía con identidad única':c.geographic,'Fichas con datos añadidos':c.enriched,
  'UUID revisados':c.audited,'Documentación candidata por UUID':c.documentedLocal,'Evidencia local certificada':c.certifiedLocal,'Campos aplicables revisados':c.reviewedAll,
  ...Object.fromEntries(Object.entries(c.counts).map(([key,count])=>[stantonFields[key],count])),
  'Fuente documental':c.sources.documented,'Fuente reportada':c.sources.reported,'Fuente de otra versión':c.sources.historical};
 for(const [label,count] of Object.entries(metrics)){
  const row=document.createElement('div'),name=document.createElement('dt'),result=document.createElement('dd');
  name.textContent=label;
  const bar=document.createElement('progress');bar.max=Math.max(1,c.total);bar.value=count;bar.setAttribute('aria-label',label);
  result.append(bar,count+' / '+c.total);
  const field=Object.keys(stantonFields).find(key=>stantonFields[key]===label);
  if(field)result.append(' · '+c.certifiedCounts[field]+' certificados · '+c.pendingFields[field]+' sin certificar');
  row.append(name,result);list.append(row);
 }
 const note=document.createElement('small');
 note.textContent=' '+c.catalogTotal+' registros en el catálogo. '+c.excludedTemporary+' plataformas temporales de RSI Discovery Month fuera de cobertura. Los registros sin nombre de juego siguen en el denominador. Las fuentes históricas y el entorno heredado no suman cobertura operativa.';
 const inventory=document.createElement('small');
 const pendingLabels={
  unplaced:'sin posición extraída',hidden:'con marcador oculto',placed:'visibles sin evidencia operativa',
  technical:'registros técnicos',unclassified:'sin clasificación',
 };
 const pending=Object.entries(pendingLabels).flatMap(([key,label])=>c.pending[key]?[c.pending[key]+' '+label]:[]);
 inventory.textContent=(c.catalogTotal-c.pending.unclassified)+' / '+c.catalogTotal+' registros conciliados'+(pending.length?' · '+pending.join(' · '):'')+'.';
 const closure=document.createElement('p');
 const reasons={technical:'registros técnicos',reference:'referencias estelares',homonym:'registros con nombres repetidos',
  unplaced:'registros sin posición',hidden:'marcadores ocultos',placed:'marcadores sin uso local confirmado'};
 const findings=Object.entries(reasons).flatMap(([key,label])=>c.auditedDispositions[key]?[c.auditedDispositions[key]+' '+label]:[]);
 closure.textContent=c.audited+' / '+c.total+' UUID revisados · '+percentage(c.audited)+' %. '+(c.total-c.certifiedLocal)+' sin evidencia local certificada'+(findings.length?' · '+findings.join(' · '):'')+'.';
 host.replaceChildren(summary,closure,list,inventory,note);
}
$('operationsToggle').addEventListener('click',()=>{
 operationsEnabled=!operationsEnabled;
 $('operationsToggle').setAttribute('aria-pressed',String(operationsEnabled));
 if(activeLocation)applyPoiToMain(activeLocation);
});

function isQvStation(p){
 return atlasSystem(p.system)==='Nyx'&&/^QV (?:Breaker|Extraction|Logistics) Station(?: BRK-\d+)?$/.test(p.name);
}
function searchesVariant(p,query){
 return /^[a-f0-9]{8}[a-f0-9-]*$/.test(query)&&p.catalogVariant?.startsWith(query);
}
function qvStationNames(items,query,locationOf){
 const preferred=new Map();
 const priority={jump:0,visible:1,hidden:2,unplaced:3};
 const rank=p=>priority[p.catalogIntel?.marker.state]??4;
 for(const item of items){
  const p=locationOf(item);
  if(!isQvStation(p)||searchesVariant(p,query))continue;
  const previous=preferred.get(p.name);
  if(!previous||rank(p)<rank(locationOf(previous)))preferred.set(p.name,item);
 }
 return items.filter(item=>{
  const p=locationOf(item);
  return !isQvStation(p)||searchesVariant(p,query)||preferred.get(p.name)===item;
 });
}
function qvMarkerLabel(p){
 if(atlasSystem(p.system)==='Pyro'&&p.catalogVariant){
  return {jump:'Salto cuántico',visible:'Marcador visible',hidden:'Marcador oculto',unplaced:'Sin posición extraída'}[p.catalogIntel?.marker.state]||'';
 }
 if(!isQvStation(p))return '';
 if(p.catalogIntel?.marker.state==='jump')return 'Salto cuántico';
 if(p.name.endsWith('Station'))return 'Destino por contrato';
 if(p.catalogIntel?.marker.state==='hidden')return 'Marcador oculto';
 return 'Sin posición extraída';
}

function updateMenu(){
 const q=normalize(input.value);
 if(!q&&!activeFilter&&!stantonZone.value){hideMenu();return}
 const solar=(activeFilter||stantonZone.value?[]:locs.filter(l=>nyxIVisible||!isNyxI(l))).map(l=>({kind:'solar',value:l,name:l.name,parent:l.body,system:l.system,tags:searchTags(l)}));
 const pois=poiData.filter(p=>matchesFilter(p,activeFilter)&&(auditedSystems.includes(stantonZone.value)?atlasSystem(p.system)===stantonZone.value:inStantonZone(p,stantonZone.value))).map(p=>({kind:'poi',value:p,name:p.name,parent:p.parent,system:p.system,tags:[
 p.type,p.operator,p.affiliation,p.jurisdiction,p.catalogVariant,...(p.aliases||[]),...tacticalTags(p),
 ...(p.amenities||[]),
 ...(p.tacticalIntel?.threats||[]),...(p.tacticalIntel?.resources||[]),
 ...(p.tacticalIntel?.weapons||[]),...(p.tacticalIntel?.armor||[]),
 ...(p.tacticalIntel?.components||[]),...(p.tacticalIntel?.steps||[]),
 ...(p.tacticalIntel?.requirements||[]),
 ...(p.lootIntel?.categories||[]),
 ...(p.missions||[]).map(x=>x.name),
 ...(p.resources||[]).map(x=>x.name),
 ...(p.activities||[]).map(x=>x.name),
 ...(p.tacticalTips||[]),...stantonSections(p).map(section=>section.title+' '+section.text),
 /paf|olp|attritus|lamina|ruptura|vivere/i.test(p.name)?'hathor paf olp':''
 ].filter(Boolean).join(' ')}));
 const unique=new Map();
 for(const item of [...pois,...solar]){const key=atlasKey(item.value);if(!unique.has(key))unique.set(key,item)}
 const ranked=[...unique.values()].map(item=>{
  const n=normalize(item.name),parent=normalize(item.parent),sys=normalize(item.system),tags=normalize(item.tags);
  const text=[n,parent,sys,tags].join(' ');
  const matches=q.split(/\s+/).every(term=>text.includes(term));
  const intel=auditedSystems.includes(atlasSystem(item.system))?item.value.catalogIntel:null;
  const state=intel?.marker.state;
  const ambiguous=Boolean(item.value.catalogVariant)&&['hidden','unplaced'].includes(state);
  const score=n===q?(ambiguous?2:0):n.startsWith(q)?1:n.includes(q)?2:tags.includes(q)?3:matches?4:99;
  const jump=Number(state==='jump');
  const detailed=Number(Boolean(item.value.serviceIntel||item.value.hathor||intel?.sections.length));
  return{item,score,jump,detailed};
 }).filter(x=>x.score<99).sort((a,b)=>a.score-b.score||b.jump-a.jump||b.detailed-a.detailed||a.item.name.localeCompare(b.item.name,'es')).map(x=>x.item);
 suggestions=qvStationNames(ranked,q,item=>item.value).slice(0,activeFilter?100:16);
 menu.replaceChildren();cursor=-1;
 if(!suggestions.length){const empty=document.createElement('div');empty.className='empty';empty.textContent=poiData.length?'Sin coincidencias en el atlas':'Cargando atlas…';menu.append(empty)}
 suggestions.forEach((item,i)=>{const btn=document.createElement('button');btn.type='button';btn.id='suggestion-'+i;btn.setAttribute('role','option');btn.setAttribute('aria-selected','false');const name=document.createElement('span');name.textContent=item.name;const meta=document.createElement('small');meta.textContent=[item.parent,item.system,item.kind==='poi'?'Ficha táctica':'Reloj solar',qvMarkerLabel(item.value),(!isQvStation(item.value)||searchesVariant(item.value,q))&&item.value.catalogVariant?.slice(0,8)].filter(Boolean).join(' · ');if(item.kind==='poi'){
  const icon=resultIcon(item.value);
  const state=['repair','refuel','rearm'].includes(icon)?evidenceState(item.value.services?.[icon]):undefined;
  if(icon==='anti-capital')meta.textContent+=' · Anticapital por misión';
  name.prepend(tacticalIcon(icon,{size:20,state}));name.className='tactical-label';
 }btn.append(name,meta);btn.addEventListener('pointerdown',e=>e.preventDefault());btn.addEventListener('click',()=>pick(i));menu.append(btn)});
 menu.hidden=false;input.setAttribute('aria-expanded','true');
}
input.addEventListener('input',updateMenu);
input.addEventListener('focus',updateMenu);
input.addEventListener('keydown',e=>{
  if(e.key==='Escape'){hideMenu();return;}
  if((e.key==='ArrowDown'||e.key==='ArrowUp')&&suggestions.length){
    e.preventDefault(); cursor=(cursor+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length;
    menu.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected',String(i===cursor)));
    input.setAttribute('aria-activedescendant','suggestion-'+cursor);
    menu.querySelectorAll('button')[cursor]?.scrollIntoView({block:'nearest'});
  }
  if(e.key==='Enter'){
    const item=suggestions[cursor<0?0:cursor];
    if(item){e.preventDefault();chooseSearchResult(item)}
  }
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.atlas-search-stack'))hideMenu();});
$('fav').addEventListener('click', () => { if (!exactSolar) return; favs = favs.includes(exactSolar.name) ? favs.filter(n => n !== exactSolar.name) : [...favs, exactSolar.name].slice(-6); store.set('vc-favs', favs); renderFavs(); tick(); });
$('cards').addEventListener('click', e => { const b = e.target.closest('.card'); if (b) select(byName(b.dataset.name)); });
window.addEventListener('hashchange', () => { const l = fromHash(); if (l && l !== cur) select(l); });

fetch('./data/locations.json').then(r => r.json()).then(d => {
  locs = d.locations;
  $('count').textContent = `${d.count} ubicaciones`;

  select(fromHash() || byName(store.get('vc-last', '')) || byName('Lorville'));
}).catch(() => { $('where').textContent = 'No se pudo cargar el catálogo. Comprueba la conexión y recarga.'; });
setInterval(tick, 1000); tick();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

// Atlas de contratos: panel complementario, no altera la búsqueda de ubicaciones ni el reloj.
const intelInput=$('intelQuery'),intelResults=$('intelResults');
let intelRecords=[];
const intelNorm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const intelText=r=>[r.name,r.system,r.type,r.contractor,r.rank,...(r.enemies||[]),r.loot?.item,r.notes].filter(Boolean).join(' ');
const intelAliases={arma:['rifle','shotgun','escopeta','pistola','weapon'],armas:['rifle','shotgun','escopeta','pistola','weapon'],escopeta:['shotgun'],rifle:['rifle'],mochila:['backpack'],casco:['helmet'],pechera:['core'],armadura:['core','helmet','backpack']};
function intelRender(){
 const query=intelNorm(intelInput.value.trim());
 const terms=query.split(/\s+/).filter(Boolean);
 const found=intelRecords.filter(r=>{const t=intelNorm(intelText(r));return terms.every(q=>t.includes(q)||(intelAliases[q]||[]).some(a=>t.includes(a)))});
 intelResults.replaceChildren();
 const hint=$('intelSuggestions');hint.replaceChildren();
 if(query){const termsFound=[...new Set(intelRecords.flatMap(r=>[r.loot?.item,r.name]).filter(Boolean))].filter(v=>intelNorm(v).includes(query)||terms.some(t=>(intelAliases[t]||[]).some(a=>intelNorm(v).includes(a)))).slice(0,7);
 for(const v of termsFound){const b=document.createElement('button');b.type='button';b.className='intel-suggest';b.textContent=v;b.addEventListener('click',()=>{intelInput.value=v;intelRender()});hint.append(b)}
 }
 $('intelCoverage').textContent=intelRecords.length+' contratos documentados · No es un catálogo completo de armas, escudos o planos';
 if(!found.length){const p=document.createElement('p');p.className='intel-empty';p.textContent=query?'No hay coincidencias en los '+intelRecords.length+' contratos documentados. No significa que ese plano o componente no exista.':'No hay contratos disponibles.';intelResults.append(p);return;}
 for(const r of found){
  const card=document.createElement('article');card.className='intel-card';
  const title=document.createElement('h3');title.textContent=r.name;
  const meta=document.createElement('small');meta.textContent=[r.system,r.contractor,r.rank].filter(Boolean).join(' · ');
  const loot=document.createElement('p');loot.className='intel-grade';loot.dataset.level=r.loot.level;
  loot.textContent=lootBadge(r).label+': '+(r.loot.item||'No especificado');
  const details=document.createElement('p');details.textContent=r.notes||'';
  const source=document.createElement('a');source.href=r.evidence.url;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Consultar fuente ('+r.evidence.grade+')';
  card.append(title,meta,loot,details,source);intelResults.append(card);
 }
}
intelInput.addEventListener('input',intelRender);
fetch('./data/intel-missions-4.10.3.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(d=>{intelRecords=(d.records||[]).filter(r=>validateIntelRecord(r).valid);intelRender()}).catch(()=>{intelResults.textContent='Catálogo no disponible. Comprueba la conexión.'});

// Índice de estaciones y puestos, separado del buscador solar y de contratos.
const poiQuery=$('poiQuery'),poiSystem=$('poiSystem'),poiService=$('poiService'),poiResults=$('poiResults');
let poiData=[];
let selectedPoiKey=null;

// Interpretación transversal de metadatos reales del catálogo, sin atribuir misiones ni botín no verificados.
function applyPoiToMain(p){
 const same=activeLocation&&atlasKey(activeLocation)===atlasKey(p);
 activeLocation=p;
 const host=$('locationDossier');
 const previouslyOpen=new Set(same?Array.from(host.querySelectorAll('details[open]'),el=>el.dataset.domain):[]);
 host.replaceChildren();
 $('mainIntelLocation').textContent=p.name;
 const body=p.stantonIntel?.orbital?p.parent:stantonBody(p)||p.parent||p.body;
 $('locationMeta').textContent=[body&&body!==p.name?body:null,p.system,p.type].filter(Boolean).join(' · ');
 const environment=body&&poiData.find(row=>row.name===body&&row.system===p.system)?.stantonIntel?.environment;
 const c=exactSolar&&coords(exactSolar);
 const nav=c&&exactSolar.quantum!==true&&nearestQT(exactSolar,locs);
 const solar=c&&[
  fmtCoords(c)+' · '+c.altKm.toFixed(2)+' km',
  exactSolar.quantum===true?'Salto cuántico directo':null,
  nav?'Desde '+nav.from.name+': '+nav.km.toFixed(1)+' km por superficie, rumbo '+nav.bearing.toFixed(0)+'° ('+compass(nav.bearing)+')':null,
 ].filter(Boolean).join(' · ');
 const model=locationDossier(p,{environment,body,solar,operations:operationsEnabled});
 $('locationEvidence').textContent=model.stantonVersionLabel;
 $('locationEvidence').hidden=!model.stantonVersionLabel;
 const order=Object.keys(dossierGroups);
 if(operationsEnabled){order.splice(order.indexOf('services'),1);order.unshift('services')}
 const makeLink=(url,label)=>{
  const a=document.createElement('a');a.href=url;a.textContent=label;
  a.target='_blank';a.rel='noopener noreferrer';return a;
 };
 for(const domain of order){
  const facts=model.groups.get(domain)||[];
  if(!facts.length&&(domain!=='services'||!model.services.size))continue;
  const [title,icon]=dossierGroups[domain];
  const secondary=domain==='navigation';
  const section=document.createElement(secondary?'details':'section');
  section.className='location-dossier-block';section.dataset.domain=domain;
  if(secondary)section.open=previouslyOpen.has(domain);
  const heading=document.createElement(secondary?'summary':'h2');
  heading.className='tactical-label';heading.append(tacticalIcon(icon,{size:20}),title);section.append(heading);
  if(domain==='services'&&model.services.size){
   const list=document.createElement('ul');list.className='service-icons';
   for(const [key,item] of model.services){
    const state=evidenceState(item.state);
    const status=state==='confirmed'?(atlasSystem(p.system)==='Stanton'?'Certificado · funcionamiento LIVE pendiente':'Documentado · LIVE pendiente'):tacticalStates[state][0];
    const row=document.createElement('li');
    row.append(makeTacticalLabel(serviceIcons[key],item.label+' · '+status,20,state));list.append(row);
   }
   section.append(list);
  }
  for(const fact of facts){
   const copy=document.createElement('p');copy.className='dossier-fact';
   if(fact.title){
    const lead=document.createElement('strong');lead.textContent=fact.title;
    if(fact.icon==='anti-capital'){
     lead.className='tactical-label';
     lead.prepend(tacticalIcon(fact.icon,{size:20}));
    }
    copy.append(lead,' · ');
   }
   if(fact.temperature){
    const temp=document.createElement('strong');
    temp.className='environment-temperature';temp.textContent=fact.temperature;
    copy.append(temp,' ');
   }
   copy.append(fact.text);
   if(fact.status){const status=document.createElement('small');status.textContent=' '+fact.status;copy.append(status)}
   if(fact.sources.length){
    const refs=document.createElement('span');refs.className='dossier-refs';
    for(const i of fact.sources){
     const a=document.createElement('a');a.href='#dossier-source-'+i;a.textContent='['+i+']';
     a.addEventListener('click',e=>{
      e.preventDefault();
      $('locationSources').open=true;
      $('dossier-source-'+i)?.focus();
     });
     a.setAttribute('aria-label','Ver fuente '+i);refs.append(a);
    }
    copy.append(refs);
   }
   section.append(copy);
   if(operationsEnabled&&fact.uncertainty){
    const limit=document.createElement('small');
    limit.className='dossier-limit';limit.textContent=fact.uncertainty;section.append(limit);
   }
   if(fact.destinations?.length){
    const links=document.createElement('div');links.className='location-dossier-nav';
    for(const target of fact.destinations){
     const dest=target.uuid
      ? poiData.find(item=>(item.source?.uuid||item.id)===target.uuid)
      : poiData.find(item=>atlasKey(item)===atlasKey({system:p.system,name:target}));
     if(!dest)continue;
     const button=document.createElement('button');button.type='button';
     button.textContent=target.uuid?[dest.name,dest.parent].filter(Boolean).join(' · '):target;
     button.addEventListener('click',()=>chooseSearchResult({kind:'poi',value:dest}));links.append(button);
    }
    if(links.childElementCount)section.append(links);
   }
  }
  if(domain==='navigation'&&c){
   const button=document.createElement('button');button.type='button';button.className='mini';button.textContent='Copiar coordenadas';
   button.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(fmtCoords(c)+' · alt '+c.altKm.toFixed(2)+' km · x '+c.x.toFixed(3)+' y '+c.y.toFixed(3)+' z '+c.z.toFixed(3)+' km');button.textContent='Coordenadas copiadas'}
    catch{button.textContent='No se pudieron copiar'}
   });
   section.append(button);
   const r=compute(exactSolar,nowMs());
   if(!r.polar){const schedule=document.createElement('p');schedule.id='solarSchedule';schedule.className='dossier-fact';section.append(schedule);schedule.textContent='Hora de Madrid · amanecer '+madridTime.format(Date.parse(r.nextStarriseUtc))+' · atardecer '+madridTime.format(Date.parse(r.nextStarsetUtc));}
  }
  host.append(section);
 }
 if(!host.childElementCount){
  const note=document.createElement('p');note.textContent='Información operativa pendiente de verificar.';host.append(note);
 }
 if(model.sources.length||model.versionLabel){
  const details=document.createElement('details');details.id='locationSources';details.dataset.domain='sources';
  details.className='location-dossier-block';details.open=previouslyOpen.has('sources');
  const heading=document.createElement('summary');heading.textContent='Fuentes y versión';details.append(heading);
  if(model.versionLabel){const version=document.createElement('p');version.textContent=model.versionLabel;details.append(version)}
  const list=document.createElement('ol');list.className='dossier-sources';
  for(const source of model.sources){
   const row=document.createElement('li');
   const link=makeLink(source.url,source.label);link.id='dossier-source-'+source.index;
   row.append(link);list.append(row);
  }
  if(list.childElementCount)details.append(list);
  host.append(details);
 }
}

function renderPoi(){
 const query=normalize(poiQuery.value);
 const queryTerms=query.split(/\s+/).filter(Boolean);
 const matches=qvStationNames(poiData.filter(p=>{
  if(poiSystem.value&&p.system!==poiSystem.value)return false;
  if(poiService.value&&!['reported','confirmed'].includes(p.services?.[poiService.value]))return false;
  const text=normalize([p.name,p.system,p.parent,p.operator,p.type,p.catalogVariant,...(p.amenities||[]),...tacticalTags(p),
   ...(p.tacticalIntel?.threats||[]),...(p.tacticalIntel?.resources||[]),...(p.tacticalIntel?.weapons||[]),
   ...(p.tacticalIntel?.steps||[]),...(p.lootIntel?.categories||[]),
   ...(p.missions||[]).map(x=>x.name),...(p.resources||[]).map(x=>x.name),
   ...stantonSections(p).map(section=>section.title+' '+section.text)].join(' '));
  return queryTerms.every(term=>text.includes(term));
 }),query,p=>p);
 $('poiCount').textContent=matches.length+' de '+poiData.length+' ubicaciones catalogadas · servicios sujetos a verificación';
 poiResults.replaceChildren();
 if(!matches.length){const p=document.createElement('p');p.textContent='No hay resultados documentados para estos filtros.';poiResults.append(p);return;}
 for(const p of matches.slice(0,100)){
 const card=document.createElement('article');card.className='poi-entry';const h=document.createElement('h3');h.append(makeTacticalLabel(resultIcon(p),p.name));
 const meta=document.createElement('p');meta.className='poi-meta';meta.textContent=[p.system,p.parent,p.type,qvMarkerLabel(p)].filter(Boolean).join(' · ');
 const org=document.createElement('p');org.textContent='Operador: '+(p.operator||'Sin verificar');
 const intel=document.createElement('p');intel.className='poi-meta';const labels=[];if(p.missions?.length)labels.push('Misiones '+p.missions.length);if(p.tacticalIntel?.threats?.length)labels.push('PvE');if(p.tacticalIntel?.resources?.length||p.resources?.length)labels.push('Recursos');if(matchesFilter(p,'loot'))labels.push('Botín');if(matchesFilter(p,'repair'))labels.push('Reparación');if(p.tacticalIntel?.steps?.length)labels.push('Guía '+p.tacticalIntel.steps.length+' pasos');intel.textContent=labels.length?'INTEL: '+labels.join(' · '):'Solo ficha geográfica / información operativa no documentada';
 const svc=document.createElement('p');svc.textContent='Refinería: '+({confirmed:'confirmada',reported:'reportada, sin confirmar',unknown:'desconocida',unavailable:'no disponible'}[p.services?.refinery]||'sin datos');
 card.append(h,meta,org,intel,svc);
 card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','Ver información de '+p.name);
 card.addEventListener('click',()=>chooseSearchResult({kind:'poi',value:p}));
 card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseSearchResult({kind:'poi',value:p})}});
 if(p.sourceUrls?.length){const a=document.createElement('a');a.href=p.sourceUrls[0];a.rel='noopener noreferrer';a.target='_blank';a.textContent='Consultar fuente';card.append(a)}
 poiResults.append(card);
 }
}
for(const el of [poiQuery,poiSystem,poiService])el.addEventListener('input',renderPoi);
function updateAtlasProgress(d){
 const total=poiData.length;
 if(!total)return;
 const documented=poiData.filter(p=>sectionsFor(p).length);
 const count=documented.length,percent=100*count/total;
 $('atlasProgressBar').dataset.loaded='true';$('atlasProgressBar').setAttribute('aria-valuemax',String(total));$('atlasProgressBar').setAttribute('aria-valuenow',String(count));
 $('atlasProgressFill').style.width=percent.toFixed(2)+'%';$('atlasProgressPercent').textContent=percent.toFixed(1)+'%';
 $('atlasProgressCount').textContent=count.toLocaleString('es-ES')+' / '+total.toLocaleString('es-ES')+' con ficha táctica o de servicios con fuentes';
 $('atlasProgressUpdated').textContent=d.generatedAt?'Actualizado: '+new Date(d.generatedAt).toLocaleString('es-ES'):'Fecha desconocida';
 const repair=documented.filter(p=>p.serviceIntel?.services.includes('repair')).length;
 $('atlasProgressQuality').textContent=repair+' fichas con reparación reportada · filtra con «reparación» y el nombre de la zona';
}
async function mergeFreshIntel(d){
 if(!Array.isArray(d.locations)||!poiData?.length)return;
 const byUuid=new Map(d.locations.map(x=>[x.id,x]));
 let changed=false;
 poiData=poiData.map(p=>{const e=byUuid.get(p.source?.uuid||p.id);if(!e)return p;changed=true;return {...p,missions:e.missions||p.missions||[],resources:e.resources||p.resources||[],nearbyLocations:e.nearbyLocations||[],intelDetailSource:e.source,intelCheckedAt:e.checkedAt}});
 if(!changed)return;
 if(selectedPoiKey){const p=poiData.find(x=>atlasKey(x)===selectedPoiKey);if(p)applyPoiToMain(p)}
 if(input.value.trim()||activeFilter||stantonZone.value)updateMenu();
 renderPoi();
}

let lastCommodityFingerprint='';
function mergeFreshResources(data){
 if(!Array.isArray(data.locations)||!poiData?.length)return;
 const resourcesById=new Map(data.locations.filter(e=>e.id&&Array.isArray(e.resources)).map(e=>[e.id,e.resources]));
 if(!resourcesById.size)return;
 let changed=false;
 poiData=poiData.map(p=>{
  const extra=resourcesById.get(p.source?.uuid||p.id);if(!extra?.length)return p;
  const unique=new Map();
  for(const resource of [...(Array.isArray(p.resources)?p.resources:[]),...extra]){
   if(resource&&typeof resource.name==='string')unique.set(normalize(resource.name),resource);
  }
  if(unique.size===(p.resources||[]).length)return p;
  changed=true;
  return {...p,resources:[...unique.values()],resourceIndexCheckedAt:data.generatedAt,resourceIndexVersion:data.version};
 });
 if(changed){
  if(selectedPoiKey){const p=poiData.find(x=>atlasKey(x)===selectedPoiKey);if(p)applyPoiToMain(p)}
  if(input.value.trim()||activeFilter||stantonZone.value)updateMenu();
  renderPoi();
 }
}
async function refreshResourceIndex(version){
 try{
  const r=await fetch('./data/atlas-commodities.json',{cache:'no-cache'});
  if(!r.ok)return;
  const d=await r.json();
  if(d.schemaVersion!==1||d.version!==version||!Array.isArray(d.locations))return;
  mergeFreshResources(d);
  lastCommodityFingerprint=d.generatedAt||'';
 }catch(e){console.warn('Catalogued resources unavailable',e)}
}
let lastEnrichmentFingerprint='';
let atlasRefreshBusy=false;
// Poll a tiny status manifest, not the full 1MB atlas every 15 seconds.
async function refreshAtlasProgress(){
 if(atlasRefreshBusy||document.hidden)return;
 atlasRefreshBusy=true;
 try{
  const response=await fetch('./data/atlas-meta.json',{cache:'no-store'});
  if(!response.ok)throw Error('Atlas metadata HTTP '+response.status);
  const meta=await response.json();
  if(meta.schemaVersion!==1||!meta.catalogTotal)throw Error('Invalid atlas metadata');
  updateAtlasQuality(meta);
  const fingerprint=[meta.version,meta.enrichedCount,meta.enrichedGeneratedAt].join('|');
  if(fingerprint!==lastEnrichmentFingerprint){
   const detail=await fetch('./data/atlas-enriched.json',{cache:'no-cache'});
   if(!detail.ok)throw Error('Atlas detail HTTP '+detail.status);
   const d=await detail.json();
   if(d.version!==meta.version)throw Error('Atlas metadata and detail versions differ');
   await mergeFreshIntel(d);
   lastEnrichmentFingerprint=fingerprint;
  }
  if(meta.commodityGeneratedAt&&meta.commodityGeneratedAt!==lastCommodityFingerprint){
   await refreshResourceIndex(meta.version);
  }
 }catch(e){
  if(!$('atlasProgressBar').dataset.loaded){$('atlasProgressCount').textContent='Progreso no disponible';$('atlasProgressUpdated').textContent='Sin datos publicados'}
  if(!$('atlasQuality').dataset.loaded)$('atlasQuality').textContent='Auditoría global pendiente de publicación; no se presume cobertura completa.';
  console.warn('Atlas metadata refresh unavailable',e);
 }finally{atlasRefreshBusy=false}
}
setInterval(()=>{if(!document.hidden)refreshAtlasProgress()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAtlasProgress()});
function updateAtlasQuality(d){
 const el=$('atlasQuality');if(!el)return;
 const c=d.counts;if(!c||!c.total)return;
 const pct=Math.round(100*c.actionable/c.total);
 el.replaceChildren();const title=document.createElement('strong');title.textContent='CATÁLOGO BASE (API) · '+c.actionable.toLocaleString('es-ES')+'/'+c.total.toLocaleString('es-ES')+' con algún dato operativo ('+pct+'%)';
 const desc=document.createElement('div');desc.textContent=c.geographicOnly.toLocaleString('es-ES')+' fichas API solo geográficas · '+(d.seedOnlyCounts?.total||0)+' fichas curadas fuera del catálogo API · '+c.withMissions+' con misiones · '+c.withResources+' con recursos · '+c.withServices+' con servicios · '+c.withLoot+' con botín · '+(c.withWeapons||0)+' con armas · '+(c.withTrade||0)+' con comercio · '+(c.withHazards||0)+' con peligros';
 const perSystem=document.createElement('div');perSystem.className='atlas-quality-systems';
 for(const [name,stats] of Object.entries(d.systems||{})){
  const line=document.createElement('div');
  line.textContent=name+': '+(stats.actionable||0)+' / '+(stats.total||0)+' fichas con algún dato operativo';
  perSystem.append(line);
 }
 const note=document.createElement('small');note.textContent='Fichas curadas coincidentes: '+c.curated+' · fichas curadas fuera del catálogo API: '+(d.seedOnlyCounts?.total||0)+'. Una ficha con datos no implica dossier completo. Auditoría: '+(d.qualityGeneratedAt||'fecha desconocida');
 el.append(title,desc,perSystem,note);el.dataset.loaded='true';
}
async function loadAtlas(){
 const currentLiveRequest=fetchCurrentLive();
 const base=await fetch('./data/atlas-poi-seed.json').then(r=>{if(!r.ok)throw Error('Seed HTTP '+r.status);return r.json()});
 const byKey=new Map();const key=atlasKey;
 const stantonRequest=fetch('./data/stanton-intel.json').then(r=>r.ok?r.json():null).catch(()=>null);
 const stantonSharedRequest=fetch('./data/stanton-shared-claims.json').then(r=>r.ok?r.json():null).catch(()=>null);
 const stantonAuditRequest=fetch('./data/stanton-certified-evidence.json').then(r=>r.ok?r.json():null).catch(()=>null);
 const catalogIntelRequests=Promise.all(auditedSystems.map(system=>
  fetch('./data/'+system.toLowerCase()+'-intel.json').then(r=>r.ok?r.json():null).catch(()=>null)));
 const servicesRequest=fetch('./data/atlas-services.json').then(r=>{if(!r.ok)throw Error('Services HTTP '+r.status);return r.json()})
  .catch(error=>{console.warn('Tactical services unavailable',error);return null});
 for(const p of base.locations||[])byKey.set(key(p),p);
 let apiCount=0,version='',catalog=[];
 try{
  const r=await fetch('./data/wiki-atlas.json',{cache:'no-cache'});
  if(r.ok){const d=await r.json();if(d.schemaVersion!==1||!Array.isArray(d.locations)||!d.locations.length)throw Error('Invalid API catalog');
   version=d.version||'';
   catalog=auditedSystems.reduce((rows,system)=>identifyCatalogVariants(rows,system),identifyCatalogVariants(d.locations));
   rawStantonCatalog=traceStantonParents(catalog.filter(p=>atlasSystem(p.system)==='Stanton'));
   for(const entry of catalog){if(!entry.name||!entry.system||isStantonPlaceholder(entry))continue;const p={...entry,system:atlasSystem(entry.system)};const k=key(p),old=byKey.get(k);if(old){byKey.set(k,{...p,...old,affiliation:p.affiliation||old.affiliation||null,jurisdiction:p.jurisdiction||old.jurisdiction||null,amenities:[...new Set([...(p.amenities||[]),...(old.amenities||[])])],missionCount:p.missionCount??old.missionCount??null,childCount:p.childCount??old.childCount??null,source:p.source||old.source,operator:old.operator||p.affiliation||null,sourceUrls:[...(old.sourceUrls||[]),...(p.source?.uuid?['https://api.star-citizen.wiki/api/locations/'+encodeURIComponent(p.source.uuid)]:[])]})}else{byKey.set(k,{...p,operator:p.affiliation||null,services:Object.fromEntries((p.amenities||[]).filter(x=>/refiner/i.test(x)).map(()=>['refinery','reported'])),sourceUrls:[],verification:'api-catalog',patch:d.version})}apiCount++}
  }
 }catch(err){console.warn('Atlas API snapshot unavailable; curated catalog retained',err)}
 try{const er=await fetch('./data/atlas-enriched.json',{cache:'no-cache'});if(er.ok){const ed=await er.json();lastEnrichmentFingerprint=[ed.version,ed.enrichedCount,ed.generatedAt].join('|');if(ed.version===version&&Array.isArray(ed.locations)){const byUuid=new Map([...byKey.values()].filter(p=>p.id||p.source?.uuid).map(p=>[p.source?.uuid||p.id,p]));for(const e of ed.locations){const current=byUuid.get(e.id);if(!current)continue;const k=key(current);byKey.set(k,{...current,missions:e.missions||current.missions,resources:e.resources||current.resources,nearbyLocations:e.nearbyLocations||[],intelDetailSource:e.source,intelCheckedAt:e.checkedAt})}}}}catch(err){console.warn('Detailed atlas unavailable',err)}
 const serviceSnapshot=await servicesRequest;
 mergeTacticalAtlas(byKey,serviceSnapshot,version);
 const stantonSnapshot=await stantonRequest;
 stantonReview=stantonSnapshot?.catalogReview;
 stantonAudit=await stantonAuditRequest;
 mergeStanton(byKey,stantonSnapshot,await stantonSharedRequest,stantonAudit);
 const snapshots=await catalogIntelRequests;
 for(const [index,system] of auditedSystems.entries()){
  const review=applyCatalogIntel(byKey,catalog,snapshots[index],version,system);
  const summary=$(system.toLowerCase()+'Coverage');
  if(review){
   const c=review.counts;
   summary.textContent=review.reviewed+' / '+review.total+' UUID revisados · '+c.jump+
    ' con salto configurado · '+c.visible+' visibles sin salto · '+c.hidden+
    ' ocultos · '+c.unplaced+' sin posición · '+c.technical+' técnicos.';
  }else summary.textContent='Auditoría de '+system+' pendiente para esta versión del catálogo.';
 }
 nyxIVisible=canReleaseNyxI(await currentLiveRequest,version);
 if(nyxIVisible){
  const prepared=await fetch('./data/nyx-i-5.0.json').then(r=>r.ok?r.json():null).catch(()=>null);
  applyNyxI(byKey,prepared);
 }else{
  for(const [key,place] of byKey)if(isNyxI(place))byKey.delete(key);
 }
 poiData=traceStantonParents([...byKey.values()]).filter(p=>!isStantonTemporaryEvent(p,stantonReview))
  .sort((a,b)=>a.system.localeCompare(b.system)||a.name.localeCompare(b.name));
 updateAtlasProgress({generatedAt:serviceSnapshot?.checkedAt});
 renderStantonCoverage();
 await refreshResourceIndex(version);
 if(input.value.trim()||activeFilter||stantonZone.value)updateMenu();
 const requested=byKey.get(initialDestination);
 if(requested&&(!selectedPoiKey||selectedPoiKey!==key(requested)))chooseSearchResult({kind:'poi',value:requested});
 else{
  const match=byKey.get(selectedPoiKey||(cur&&key(cur)));
  if(match)applyPoiToMain(match);
 }
 renderPoi();
 $('poiCount').textContent+=' · API: '+(apiCount?apiCount+' registros '+version:'sin snapshot; catálogo local');
}
loadAtlas().then(refreshAtlasProgress).catch(e=>{$('poiCount').textContent='No se pudo cargar el atlas: '+e.message});

// Un explorador, dos vistas: evita paneles interminables y preserva búsquedas existentes.
const atlasTabs=[[$('atlasTabPoi'),$('atlasPanePoi')],[$('atlasTabIntel'),$('atlasPaneIntel')]];
function activateAtlas(index,focus=false){atlasTabs.forEach(([tab,pane],i)=>{const active=i===index;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;pane.hidden=!active});if(focus)atlasTabs[index][0].focus()}
for(let i=0;i<atlasTabs.length;i++){const [tab]=atlasTabs[i];tab.addEventListener('click',()=>activateAtlas(i));tab.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();activateAtlas((i+(e.key==='ArrowRight'?1:atlasTabs.length-1))%atlasTabs.length,true)}})}
activateAtlas(0);
