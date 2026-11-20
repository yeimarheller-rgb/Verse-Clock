// VERSE CLOCK 1.5 — interfaz. Datos: src/engine.js + data/locations.json. Escena: src/scene.js.
import { compute } from './engine.js';
import { sunState, buildScene, paintScene, photoWeights } from './scene.js';
import { envFor, SOURCE } from './environment.js';
import { coords, fmtCoords, nearestQT, compass } from './nav.js';
import { securityFor } from './security.js';
import { lootFor } from './loot.js';
import { validateIntelRecord, lootBadge } from './intel-schema.js';
import { securityFor as destinationSecurity } from './security.js';
import { lootFor as destinationLoot } from './loot.js';

const $ = id => document.getElementById(id);
const tz = z => new Intl.DateTimeFormat('es-ES', { timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const MAD = tz('Europe/Madrid');
const DATE = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: 'short', year: 'numeric' });
const PHASE = { day: 'Día', night: 'Noche', sunrise: 'Amanecer', sunset: 'Atardecer', polar: 'Ciclo polar' };
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// ?t=2026-11-04T21:39:00Z simula otro instante (para revisar fases). Se avisa en pantalla.
const SIM = (() => { const t = Date.parse(new URLSearchParams(location.search).get('t')); return Number.isFinite(t) ? t - Date.now() : 0; })();
const nowMs = () => Date.now() + SIM;
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
const byName = n => locs.find(l => l.name === n);
const label = l => `${l.name} (${l.body})`;
const dur = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s % 60).padStart(2, '0')} s`; };

function select(l) {
  if (!l) return; cur = l;
  lastScenePaint = 0;
  $('q').value = '';
  $('mainIntelLocation').hidden=true;
  $('mainIntelApi').hidden=true;
  $('place').textContent = l.name;
  $('where').textContent = `${l.body} · ${l.system}`;
  $('dayLen').textContent = `${(l.lengthOfDayDays * 1440).toFixed(0)} min`;
  $('kind').textContent = l.type || '—';
  const loot = lootFor(l);
  $('lootStatus').textContent = loot.label;
  $('lootStatus').dataset.level = loot.level;
  $('lootNote').textContent = loot.summary;
  const sec = securityFor(l);
  $('securityThreat').textContent = sec.threat;
  $('securityThreat').dataset.risk = sec.threat === 'Alto' ? 'high' : sec.threat === 'Desconocido' ? 'unknown' : 'conditional';
  $('pvpRisk').textContent = sec.pvp || 'Sin datos';
  $('pveRisk').textContent = 'PvE: '+(sec.pve || 'Sin datos');
  $('securityFaction').textContent = sec.faction;
  $('securityAccess').textContent = sec.access;
  $('securityNote').textContent = sec.notes;
  $('securityEvidence').replaceChildren();
  if (sec.source) { const a = document.createElement('a'); a.href = sec.source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = sec.source.grade + ' · ' + sec.source.build; $('securityEvidence').append(a); }
  else $('securityEvidence').textContent = 'Sin evidencia específica';
  const env = envFor(l);
  $('grav').textContent = env.gravity.label; $('grav').dataset.g = env.gravity.key; $('gravHint').textContent = env.gravity.hint;
  $('hazWrap').hidden = !env.tags.length;
  $('haz').innerHTML = env.tags.map(t => `<span class="chip" data-k="${t.key}">${t.label}</span>`).join('');
  $('envMini').textContent = [env.gravity.key === 'low' ? 'Gravedad baja' : env.gravity.key === 'mid' ? 'Gravedad media' : '', ...env.tags.map(t => t.label.split(' ')[0])].filter(Boolean).join(' · ');
  $('envSrc').textContent = `Entorno según la comunidad (gravedad: ${SOURCE.gravity}; peligros: ${SOURCE.hazards}). Puede cambiar con cada parche.`;
  const c = coords(l), kmFmt = v => v.toFixed(1).replace('.', ',');
  $('coord').textContent = `${fmtCoords(c)} · ${c.altKm.toFixed(2).replace('.', ',')} km`;
  $('coordXYZ').textContent = `x ${c.x.toFixed(3)} · y ${c.y.toFixed(3)} · z ${c.z.toFixed(3)} km (respecto a ${l.body})`;
  $('qt').textContent = l.quantum === true ? 'Sí, se puede saltar directo' : l.quantum === false ? 'No tiene' : 'Sin dato';
  const nav = l.quantum === true ? null : nearestQT(l, locs);
  $('qtRoute').textContent = nav ? `Desde ${nav.from.name}: ${kmFmt(nav.km)} km por superficie, rumbo ${nav.bearing.toFixed(0)}° (${compass(nav.bearing)})` : '';
  $('rate').textContent = `1 s real = ${(1 / l.lengthOfDayDays).toFixed(1).replace('.', ',')} s de juego`;
  history.replaceState(null, '', '#' + encodeURIComponent(l.name.replace(/ /g, '_')));
  store.set('vc-last', l.name);
  renderFavs(); tick();
  const poi=poiData.find(p=>p.system===l.system&&p.name.toLocaleLowerCase('es')===l.name.toLocaleLowerCase('es'));
  if(poi)applyPoiToMain(poi);
}

function renderFavs() {
  const isFav = cur && favs.includes(cur.name);
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
  $('mad').textContent = MAD.format(now);
  $('date').textContent = DATE.format(now);
  $('net').textContent = SIM ? 'Hora simulada' : navigator.onLine ? 'En línea' : 'Sin conexión · modo offline';
  if (!cur) return;
  const r = compute(cur, now), st = sunState(cur, r);
  fast(now);
  document.documentElement.dataset.phase = st.phase;
  $('phase').textContent = PHASE[st.phase];
  if (!lastScenePaint || now - lastScenePaint >= SCENE_EVERY_MS || now < lastScenePaint) {
    lastScenePaint = now;
    const P = paintScene($('scene'), st, cur.body);
    document.body.style.background = P.near; // suelo continuo bajo la escena en móvil
    const W = photoWeights(st), ph = $('photo');
    if (ph) for (const pic of ph.children) pic.style.opacity = (W[pic.dataset.k] || 0).toFixed(3);
  }

  const lodS = cur.lengthOfDayDays * 86400;
  if (r.polar) {
    $('solar').classList.add('polar');
    mono($('riseIn'), 'Sin evento'); mono($('setIn'), 'Sin evento');
    $('riseAt').textContent = $('setAt').textContent = 'Ciclo polar en el modelo';
    $('bar').style.width = '0%'; $('pct').textContent = '—';
    $('tl').style.background = 'var(--night)'; $('tlRise').hidden = $('tlSet').hidden = true;
  } else {
    $('solar').classList.remove('polar');
    mono($('riseIn'), r.starriseNow ? 'Ahora' : dur(r.nextStarriseInSeconds));
    mono($('setIn'), r.starsetNow ? 'Ahora' : dur(r.nextStarsetInSeconds));
    $('riseAt').textContent = MAD.format(Date.parse(r.nextStarriseUtc)) + ' Madrid';
    $('setAt').textContent = MAD.format(Date.parse(r.nextStarsetUtc)) + ' Madrid';
    // progreso de la fase actual (día o noche) en tiempo real
    const toSet = r.nextStarsetInSeconds, toRise = r.nextStarriseInSeconds;
    const dayS = r.isDay ? lodS - (toRise - toSet) : toSet - toRise; // duración de la luz
    const phaseLen = r.isDay ? dayS : lodS - dayS, left = r.isDay ? toSet : toRise;
    const pct = clampPct(100 * (1 - left / Math.max(1, phaseLen)));
    $('bar').style.width = pct + '%'; $('pct').textContent = `${pct.toFixed(0)} % de la ${r.isDay ? 'luz' : 'noche'}`;
    // línea temporal del día local (00:00 → 24:00)
    const riseL = (r.localTimeSeconds + toRise * 86400 / lodS) % 86400 / 864;
    const setL = (r.localTimeSeconds + toSet * 86400 / lodS) % 86400 / 864;
    $('tlRise').hidden = $('tlSet').hidden = false;
    $('tlRise').style.left = riseL + '%'; $('tlSet').style.left = setL + '%';
    $('tl').style.background = `linear-gradient(90deg, var(--night) 0%, var(--night) ${riseL - 4}%, var(--dawn) ${riseL}%, var(--day) ${riseL + 6}%, var(--day) ${setL - 6}%, var(--dusk) ${setL}%, var(--night) ${setL + 4}%, var(--night) 100%)`;
  }
  for (const el of $('cards').children) {
    const l = byName(el.dataset.name); if (!l) continue;
    const ph = sunState(l, compute(l, now)).phase;
    el.querySelector('[data-p]').textContent = PHASE[ph]; el.dataset.phase = ph;
  }
}
// En el juego el día dura mucho menos que en la Tierra (Hurston: 1 s real ≈ 9,7 s de juego).
// Si el reloj se pinta una vez por segundo, los segundos saltan de ~10 en ~10 y de forma irregular.
// Por eso la hora local, la línea temporal y las tarjetas se pintan en cada fotograma.
function fast(now = nowMs()) {
  if (!cur) return;
  const r = compute(cur, now);
  mono($('clock'), r.localTime);
  $('tlNow').style.left = (r.localTimeSeconds / 864) + '%';
  for (const el of $('cards').children) { const l = byName(el.dataset.name); if (l) mono(el.querySelector('[data-t]'), compute(l, now).localTime); }
}
// Limitar repintados del reloj: evita cálculos DOM en cada frame (60/120 Hz) en iPhone.
let lastClockFrame=0;
function frame(timestamp) {
  if(document.visibilityState==='visible' && timestamp-lastClockFrame>=100){lastClockFrame=timestamp;fast()}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
const clampPct = v => Math.min(100, Math.max(0, v));

function find(v) {
  v = v.trim().toLowerCase(); if (!v) return null;
  return locs.find(x => label(x).toLowerCase() === v) || locs.find(x => x.name.toLowerCase() === v) || locs.find(x => x.name.toLowerCase().includes(v));
}
function fromHash() { const h = decodeURIComponent(location.hash.slice(1)).replace(/_/g, ' ').toLowerCase(); return h && locs.find(l => l.name.toLowerCase() === h); }

buildScene($('scene'));
// Las fotos solo se muestran si cargan las cuatro; si falta alguna, queda la escena procedural.
Promise.all([...$('photo').querySelectorAll('img')].map(img => img.decode ? img.decode() : Promise.resolve()))
  .then(() => $('photo').classList.add('ready')).catch(() => $('photo').remove());

const input = $('q'), menu = $('suggestions');
let suggestions = [], cursor = -1;
// Búsqueda también por tipo y por apodos usados en el juego (p. ej. «Hathor» para las plataformas láser).
const ALIASES = { 'Orbital laser platform': 'hathor olp plataforma laser orbital', 'Planetary alignment facility': 'hathor paf alineacion planetaria' };
const searchTags = l => `${l.type || ''} ${ALIASES[l.type] || ''}`;
const normalize = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function hideMenu() {
  menu.hidden = true; menu.replaceChildren(); suggestions = []; cursor = -1;
  input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant');
}
function chooseSearchResult(item){
 if(!item)return;
 if(item.kind==='poi'){
  const p=item.value;
  selectedPoiKey=[p.system||'',p.name||''].join('|').toLocaleLowerCase('es');
  const solar=locs.find(l=>normalize(l.name)===normalize(p.name)&&l.system===p.system);
  if(solar)select(solar);
  else{
   const parent=locs.find(l=>l.system===p.system&&(normalize(l.body)===normalize(p.parent)||normalize(l.name)===normalize(p.parent)));
   if(parent){select(parent);$('place').textContent=p.name;$('where').textContent=[p.parent,p.system,'Reloj solar de referencia: '+parent.body].filter(Boolean).join(' · ')}
   else{$('place').textContent=p.name;$('where').textContent=[p.parent,p.system,'Sin reloj solar local verificado'].filter(Boolean).join(' · ');cur=null;$('kind').textContent=p.type||'Instalación';$('dayLen').textContent='Sin datos';$('coord').textContent='Sin coordenadas verificadas';$('coordXYZ').textContent='';$('qt').textContent='Sin dato';$('qtRoute').textContent='';}
  }
  applyPoiToMain(p);

 }else {selectedPoiKey=null;select(item.value)}
 hideMenu();input.blur();
}
function pick(i){chooseSearchResult(suggestions[i])}
function updateMenu(){
 const q=normalize(input.value);
 if(!q){hideMenu();return}
 const solar=locs.map(l=>({kind:'solar',value:l,name:l.name,parent:l.body,system:l.system,tags:searchTags(l)}));
 const pois=poiData.map(p=>({kind:'poi',value:p,name:p.name,parent:p.parent,system:p.system,tags:[
 p.type,p.operator,p.affiliation,p.jurisdiction,
 ...(p.amenities||[]),
 ...(p.tacticalIntel?.threats||[]),...(p.tacticalIntel?.resources||[]),
 ...(p.tacticalIntel?.weapons||[]),...(p.tacticalIntel?.armor||[]),
 ...(p.tacticalIntel?.components||[]),...(p.tacticalIntel?.steps||[]),
 ...(p.tacticalIntel?.requirements||[]),
 ...(p.lootIntel?.categories||[]),
 ...(p.missions||[]).map(x=>x.name),
 ...(p.resources||[]).map(x=>x.name),
 ...(p.activities||[]).map(x=>x.name),
 ...(p.tacticalTips||[]),
 /paf|olp|attritus|lamina|ruptura|vivere/i.test(p.name)?'hathor paf olp':''
 ].filter(Boolean).join(' ')}));
 const unique=new Map();
 for(const item of [...pois,...solar]){const key=[normalize(item.system),normalize(item.name)].join('|');if(!unique.has(key))unique.set(key,item)}
 suggestions=[...unique.values()].map(item=>{
  const n=normalize(item.name),parent=normalize(item.parent),sys=normalize(item.system),tags=normalize(item.tags);
  const score=n===q?0:n.startsWith(q)?1:n.includes(q)?2:parent.startsWith(q)?3:parent.includes(q)?4:tags.includes(q)?5:sys.includes(q)?6:99;
  return{item,score};
 }).filter(x=>x.score<99).sort((a,b)=>a.score-b.score||a.item.name.localeCompare(b.item.name,'es')).slice(0,16).map(x=>x.item);
 menu.replaceChildren();cursor=-1;
 if(!suggestions.length){const empty=document.createElement('div');empty.className='empty';empty.textContent=poiData.length?'Sin coincidencias en el atlas':'Cargando atlas…';menu.append(empty)}
 suggestions.forEach((item,i)=>{const btn=document.createElement('button');btn.type='button';btn.id='suggestion-'+i;btn.setAttribute('role','option');btn.setAttribute('aria-selected','false');const name=document.createElement('span');name.textContent=item.name;const meta=document.createElement('small');meta.textContent=[item.parent,item.system,item.kind==='poi'?'Ficha táctica':'Reloj solar'].filter(Boolean).join(' · ');btn.append(name,meta);btn.addEventListener('pointerdown',e=>e.preventDefault());btn.addEventListener('click',()=>pick(i));menu.append(btn)});
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
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.search'))hideMenu();});
$('copyCoord').addEventListener('click', async () => {
  if (!cur) return; const c = coords(cur);
  const txt = `${cur.name} (${cur.body}) — ${fmtCoords(c)} · alt ${c.altKm.toFixed(2)} km · x ${c.x.toFixed(3)} y ${c.y.toFixed(3)} z ${c.z.toFixed(3)} km`;
  try { await navigator.clipboard.writeText(txt); $('copyCoord').textContent = 'Copiado'; } catch { $('copyCoord').textContent = 'No se pudo'; }
  setTimeout(() => { $('copyCoord').textContent = 'Copiar'; }, 1500);
});
$('fav').addEventListener('click', () => { if (!cur) return; favs = favs.includes(cur.name) ? favs.filter(n => n !== cur.name) : [...favs, cur.name].slice(-6); store.set('vc-favs', favs); renderFavs(); tick(); });
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
function derivedLocationIntel(p){
 const entries=[];const services=Array.isArray(p.amenities)?p.amenities.filter(x=>typeof x==='string'&&x.trim()):[];
 const groups=[
  [/refiner|refinería|refining/i,'Refinería','Servicios de refinado registrados; comprobar disponibilidad, costes y tiempos en terminal.'],
  [/repair|refuel|restock|rearm|repar|repost|reabast/i,'Servicios de nave','Servicios de nave catalogados; comprobar operatividad antes de desplazarse.'],
  [/trade|commodity|shop|store|market|comerc|tienda|venta/i,'Comercio','Actividad comercial catalogada; inventario y precios no confirmados en tiempo real.'],
  [/medical|clinic|hospital|medic|clínica/i,'Asistencia médica','Servicio sanitario catalogado; no presupone punto de regeneración.'],
  [/cargo|freight|hauling|carga|almacén/i,'Logística y carga','Instalación logística catalogada; los contratos disponibles varían.'],
  [/vehicle|ship dealer|rental|vehículo|alquiler/i,'Vehículos y naves','Servicio relacionado con vehículos catalogado; modelos disponibles sin verificar.'],
  [/weapon|armor|armour|munition|arma|armadura/i,'Equipamiento','Punto de equipamiento catalogado; comprobar stock.']
 ];
 const found=new Set();
 for(const service of services){let classified=false;for(const [pattern,label,description] of groups){if(pattern.test(service)){if(!found.has(label)){entries.push('◈ '+label+' [API / servicio]: '+description);found.add(label)}classified=true;break}}if(!classified)entries.push('◈ Servicio registrado [API]: '+service)}
 if(Number.isInteger(p.missionCount)&&p.missionCount>0)entries.push('◈ Contratos asociados [API]: '+p.missionCount+' referencias en catálogo; no implica disponibilidad actual ni revela tipo de misión.');
 if(Number.isInteger(p.childCount)&&p.childCount>0)entries.push('◈ Lugares dependientes [API]: '+p.childCount+' ubicaciones vinculadas; explorar sus fichas para identificar instalaciones próximas.');
 if(p.jurisdiction)entries.push('◈ Jurisdicción [API]: '+p.jurisdiction+'. Las normas y respuesta de seguridad no se deducen automáticamente de este dato.');
 if(p.affiliation)entries.push('◈ Afiliación [API]: '+p.affiliation+'. No presupone presencia de NPC hostiles.');
 return entries;
}


function universalIntel(p){
 const out=[];const add=(heading,items)=>{if(!Array.isArray(items)||!items.length)return;out.push('━━ '+heading+' ━━');for(const item of items){if(typeof item==='string'){out.push('◇ '+item);continue}if(!item||typeof item!=='object')continue;const label=item.name||item.label||item.title||'Dato';const detail=item.detail||item.description||item.location||'';const evidence=[item.confidence||item.status,item.patch||item.source?.version,item.checkedAt?('revisado '+String(item.checkedAt).slice(0,10)):null,item.source?.provider||item.source].filter(x=>typeof x==='string'&&x).join(' · ');out.push('◇ '+label+(evidence?' ['+evidence+']':'')+(detail?': '+detail:''))}};
 add('ACTIVIDADES Y CONTRATOS',p.activities);
 add('MISIONES DOCUMENTADAS',p.missions);
 add('BOTÍN POR INSTALACIÓN',p.lootItems);
 add('RECURSOS Y MINERÍA',p.resources);
 add('INSTALACIONES VINCULADAS',p.nearbyLocations);
 add('COMERCIO Y PRODUCTOS',p.commodities);
 add('SERVICIOS Y TIENDAS',p.shops);
 add('NPC Y AMENAZAS DOCUMENTADAS',p.npcs);
 add('CONSEJOS TÁCTICOS',p.tacticalTips);
 return out;
}

// Monochrome vector HUD pictograms. No platform-dependent emoji glyphs.
const tacticalIconPaths={
 'PVE':'M12 2v4m0 12v4M2 12h4m12 0h4M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10zm0 3v4m-2-2h4',
 'PVP':'M3 7l9-4 9 4v5c0 5-4 8-9 10-5-2-9-5-9-10V7zm5 5h8m-4-4v8',
 'BOTÍN':'M4 8l8-5 8 5v9l-8 5-8-5V8zm0 0 8 5 8-5m-8 5v9',
 'ARMAS':'M4 6h16v5H4zm3 5v7h5v-7m-5 7-2 3m7-3 2 3M17 6V3',
 'MISIONES':'M7 3h10l3 3v15H4V3h3zm2 7h7m-7 4h7m-7 4h5',
 'COMERCIO':'M3 7h18v13H3V7zm0 4h18M7 4h10M7 16h4',
 'PELIGROS':'M12 2 2 21h20L12 2zm0 7v5m0 3v1',
 'RECURSOS':'M3 20 20 3m-7 0 8 8M5 8l6 6m-8-2 9 9'
};
function tacticalHudIcon(title){
 const key=Object.keys(tacticalIconPaths).find(k=>title.includes(k))||'RECURSOS';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','22');svg.setAttribute('height','22');
 svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');
 svg.setAttribute('stroke-linecap','square');svg.setAttribute('stroke-linejoin','miter');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');
 path.setAttribute('d',tacticalIconPaths[key]);svg.append(path);return svg;
}
function renderTacticalCards(p,sec,loot){
 const root=$('intelTacticalCards'),readiness=$('intelReadiness'),sources=$('intelSourceLinks');
 if(!root||!readiness||!sources)return;
 root.replaceChildren();sources.replaceChildren();readiness.replaceChildren();
 const intel=p.lootIntel,missions=p.missions||[],resources=p.resources||[],amenities=p.amenities||[];
 const hasPve=Boolean(p.tacticalIntel?.threats?.some(x=>!/(?:sin (?:medici[oó]n|datos|confirmaci[oó]n)|no (?:hay|se dispone|existe)|desconocid)/i.test(x))||sec.pve&&!/sin datos|sin verificar|desconocid/i.test(sec.pve));
 const hasPvp=Boolean(sec.pvp&&!/sin datos|sin verificar|desconocid/i.test(sec.pvp));
 const hasLoot=Boolean(intel?.categories?.length||p.tacticalIntel?.weapons?.length);
 const hasMissions=Boolean(missions.length||p.activities?.length);
 const hasResources=Boolean(resources.length||intel?.mining||p.tacticalIntel?.resources?.length);
 const hasServices=Boolean(amenities.length||Object.values(p.services||{}).some(x=>x==='reported'||x==='confirmed'));
 const cards=[
  ['⚔️','COMBATE PVE / NPC',p.tacticalIntel?.threats?.length?p.tacticalIntel.threats.join(' · '):hasPve?sec.pve:'Sin datos específicos',hasPve,'Evaluación documental, no estado del servidor'],
  ['🎯','COMBATE PVP / JUGADORES',hasPvp?sec.pvp:'Sin datos específicos',hasPvp,'No detecta jugadores en vivo'],
  ['🎒','BOTÍN / EQUIPO',p.tacticalIntel?.weapons?.length?p.tacticalIntel.weapons.length+' armas posibles · pool PAF':intel?.categories?.length?intel.categories.length+' categorías documentadas':loot?.summary||'Sin botín específico verificado',hasLoot,'Pool posible ≠ objeto garantizado'],
  ['📜','MISIONES',missions.length?missions.length+' contratos identificados':p.activities?.length?p.activities.length+' actividades documentadas':'Sin contratos identificados',hasMissions,'Disponibilidad dependiente del servidor'],
  ['⛏️','RECURSOS',resources.length?resources.length+' recursos identificados':p.tacticalIntel?.resources?.length?p.tacticalIntel.resources.length+' recursos / recompensas documentados':intel?.mining?'Minería de evento documentada':'Sin recursos específicos verificados',hasResources,'Presencia en campo no garantizada'],
  ['🛠️','SERVICIOS',amenities.length?amenities.length+' servicios catalogados':hasServices?'Servicios reportados':'Sin servicios específicos registrados',hasServices,'Confirmar antes de desplazarte']
 ];
 // Las notas operativas curadas deben aparecer en la interfaz, no quedarse ocultas en JSON.
 const notes=p.operationalNotes||{};
 const domains=[
  ['⚔️','PVE / NPC','pve'],['🎯','PVP / JUGADORES','pvp'],
  ['🎒','BOTÍN','loot'],['🔫','ARMAS','weapons'],
  ['📜','MISIONES','missions'],['💰','COMERCIO','trade'],
  ['⚠️','PELIGROS','hazards']
 ];
 for(const [symbol,title,key] of domains){
  const value=notes[key];
  if(typeof value!=='string'||!value.trim())continue;
  const unknown=/^(sin |no hay |no existe |no se |servicios no)/i.test(value.trim());
  cards.push([symbol,title,value,!unknown,'Nota operativa curada · comprobar fuentes y parche']);
 }
 const covered=cards.filter(c=>c[3]).length,score=Math.round(100*covered/cards.length);
 const header=document.createElement('div');header.className='intel-readiness-head';
 const label=document.createElement('span');label.textContent='◈ COBERTURA DE INTELIGENCIA';
 const value=document.createElement('strong');value.textContent=covered+'/'+cards.length+' TARJETAS';
 header.append(label,value);
 const meter=document.createElement('div');meter.className='intel-readiness-meter';const fill=document.createElement('span');fill.style.width=score+'%';meter.append(fill);
 const caption=document.createElement('div');caption.className='intel-readiness-caption';caption.textContent='Cobertura documental '+score+'% · no mide seguridad, calidad ni probabilidad de botín. '+(p.intelCheckedAt?'API consultada: '+new Date(p.intelCheckedAt).toLocaleDateString('es-ES'):'Ficha sin fecha de consulta API');
 readiness.append(header,meter,caption);
 for(const [symbol,title,value,known,evidence] of cards){
  const card=document.createElement('div');card.className='intel-tactical-card';card.dataset.kind=known?'known':'unknown';
  const t=document.createElement('div');t.className='intel-tactical-title';t.append(tacticalHudIcon(title),document.createTextNode(title));
  const v=document.createElement('div');v.className='intel-tactical-value';v.textContent=value;
  const e=document.createElement('small');e.className='intel-evidence';e.textContent=(known?'DOCUMENTADO · ':'SIN COBERTURA · ')+evidence;
  card.append(t,v,e);root.append(card)
 }
 const urls=[...(p.tacticalIntel?.sources||[]),...(p.lootIntel?.sources||[]),...(p.sourceUrls||[])].filter(x=>typeof x==='string'&&/^https:\/\//.test(x));
 const seen=new Set();
 for(const url of urls){if(seen.has(url)||seen.size>=4)continue;seen.add(url);const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='↗ '+new URL(url).hostname;link.setAttribute('aria-label','Abrir fuente: '+url);sources.append(link)}
}

function applyPoiToMain(p){
 const sec=destinationSecurity(p),loot=destinationLoot(p);
 renderTacticalCards(p,sec,loot);
 $('securityThreat').textContent=sec.threat||'Desconocido';
 $('securityThreat').dataset.risk=sec.threat==='Alto'?'high':'unknown';
 $('securityFaction').textContent=(p.operator&&/antiguo|abandonad/i.test(p.operator)?p.operator+' (histórico)':p.operator)||p.affiliation||sec.faction||'Sin verificar';
 $('securityAccess').textContent=sec.access||'Sin verificar';
 $('securityNote').textContent=[p.name+' · '+[p.system,p.parent,p.type].filter(Boolean).join(' · '),sec.notes,p.verification==='api-catalog'?'Catálogo geográfico API: PvP, NPC y botín no certificados por la API.':''].filter(Boolean).join(' — ');
 $('pvpRisk').textContent=sec.pvp||'Sin datos verificados';
 $('pveRisk').textContent='PvE: '+(sec.pve||'Sin datos verificados');
 $('lootStatus').textContent=loot.label||'Botín sin verificar';
 $('lootStatus').dataset.level=loot.level||'unknown';
 $('lootNote').textContent=loot.summary||'Sin datos verificados';
 $('securityEvidence').textContent=['Ficha: '+p.name,p.patch||p.source?.version||'',p.verification||'Sin verificar'].filter(Boolean).join(' · ');
 $('mainIntelLocation').textContent='INTEL DEL DESTINO: '+p.name+' · '+(p.system||'');
 $('mainIntelLocation').hidden=false;
 const rows=[['Cuerpo / zona',p.parent],['Sistema',p.system],['Jurisdicción',p.jurisdiction],['Operador / afiliación',p.affiliation],['Tipo',p.type],['Servicios registrados',(p.amenities||[]).join(', ')],['Misiones asociadas',Number.isInteger(p.missionCount)?String(p.missionCount):null],['Instalaciones dependientes',Number.isInteger(p.childCount)?String(p.childCount):null]];
 const summary=rows.filter(([,v])=>v&&v!=='unknown').map(([k,v])=>k+': '+v);
 const universal=universalIntel(p);
 if(universal.length)summary.push(...universal);
 const derived=derivedLocationIntel(p);
 if(derived.length){summary.push('━━ ACTIVIDADES Y DATOS DOCUMENTADOS ━━');summary.push(...derived)}
 const parentBody=locs.find(l=>l.system===p.system&&(String(l.name).toLocaleLowerCase('es')===String(p.parent||'').toLocaleLowerCase('es')||String(l.body).toLocaleLowerCase('es')===String(p.parent||'').toLocaleLowerCase('es')));
 if(parentBody){const e=envFor(parentBody);if(e?.tags?.length)summary.push('Entorno del cuerpo '+parentBody.name+' (referencia, no medición de la base): '+e.tags.map(t=>t.label).join(', '));if(e?.gravity?.label)summary.push('Gravedad del cuerpo de referencia: '+e.gravity.label)}
 if(p.activities?.length){summary.push('━━ ACTIVIDADES Y OPORTUNIDADES ━━');for(const a of p.activities)summary.push('◈ '+a.name+' ['+a.confidence+']: '+a.detail)}
 if(p.tacticalTips?.length){summary.push('━━ INFORMACIÓN ÚTIL ANTES DE IR ━━');for(const tip of p.tacticalTips)summary.push('▸ '+tip)}
 if(p.tacticalIntel){const t=p.tacticalIntel;summary.push('━━ DOSSIER TÁCTICO DOCUMENTADO ━━');summary.push(t.title);if(t.weapons)summary.push('ARMAS POSIBLES: '+t.weapons.join(' · '));if(t.armor)summary.push('ARMADURAS POSIBLES: '+t.armor.join(' · '));if(t.components)summary.push('COMPONENTES POSIBLES: '+t.components.join(' · '));if(t.threats?.length)summary.push('AMENAZAS: '+t.threats.join(' · '));if(t.resources?.length)summary.push('RECURSOS / RECOMPENSAS: '+t.resources.join(' · '));if(t.requirements?.length)summary.push('PREPARACIÓN: '+t.requirements.join(' · '));for(const [i,step] of (t.steps||[]).entries())summary.push('PASO '+(i+1)+': '+step);summary.push('LIMITACIÓN: '+t.caveat);for(const url of t.sources)summary.push('FUENTE: '+url)}
 if(p.lootIntel){const li=p.lootIntel;summary.push('━━ BOTÍN ESPECÍFICO · '+li.scope.toUpperCase()+' ━━');summary.push('Estado: '+li.status);summary.push('SOLO: '+li.solo);summary.push('ORGANIZACIÓN: '+li.org);for(const category of li.categories||[])summary.push('◇ '+category);summary.push('MINERÍA DEL EVENTO: '+li.mining);summary.push('PRECAUCIÓN: '+li.caveat);if(li.sources?.length)summary.push('FUENTES: '+li.sources.join(' · '))}
 summary.push('Temperatura exacta de la instalación: sin verificar');
 summary.push('Origen: '+(p.source?.provider||'Catálogo local')+' · '+(p.source?.version||p.patch||'versión sin verificar'));
 $('mainIntelApi').textContent=summary.join('\n');
 $('mainIntelApi').hidden=false;
}
function showPoiDestination(p){
 const sec=destinationSecurity(p),loot=destinationLoot(p);
 $('destinationName').textContent=p.name;
 $('destinationMeta').textContent=[p.system,p.parent,p.type,p.operator].filter(Boolean).join(' · ');
 const parentLoc=locs.find(l=>l.name?.toLowerCase()===String(p.parent||'').toLowerCase()||l.body?.toLowerCase()===String(p.parent||'').toLowerCase());
 const environment=parentLoc?envFor(parentLoc):null;
 const climate=environment?.tags?.map(t=>t.label).join(' · ');
 $('destinationClimate').textContent=climate||'Sin datos específicos verificados';
 $('destinationTemperature').textContent='Temperatura exacta sin verificar';
 $('destinationPvp').textContent=sec.pvp||'Sin datos';
 $('destinationPve').textContent=sec.pve||'Sin datos';
 $('destinationFaction').textContent=sec.faction||p.operator||'Sin verificar';
 $('destinationAccess').textContent=sec.access||'Sin verificar';
 $('destinationLoot').textContent=loot.summary;
 const n=p.name.toLowerCase();
 const isHathor=/hathor|attritus|lamina|ruptura|vivere|\bolp\b|\bpaf\b/.test(n);
 const hazard=isHathor?( /aberdeen|ruptura|vivere/.test(n+' '+(p.parent||'').toLowerCase())?'Calor extremo en Aberdeen; mercenarios hostiles y Valakkar juveniles en operaciones de alineación.':'Mercenarios hostiles y Valakkar juveniles en operaciones de alineación; comprobar condiciones locales.' ):/lazarus|phoenix research lab|storm breaker/.test(n)?'Radiación y tormentas electromagnéticas: riesgo de daño por distorsión e inutilización de la nave (fuente comunitaria).':/jumptown/.test(n)?'Frío extremo en Daymar; no hay armisticio (fuente comunitaria).':'No se ha documentado un peligro ambiental específico para esta instalación.';
 $('destinationHazards').textContent=hazard;
 $('destinationPrep').textContent=isHathor?'PvP elevado: prever emboscadas de jugadores/organizaciones. Llevar MaxLift, multiherramienta, fusibles, equipo de combate y apoyo médico; GEO/ROC para minería.':/lazarus|phoenix research lab|storm breaker/.test(n)?'Planificar aproximación ante interferencias, protección radiológica y requisitos de acceso.':/jumptown/.test(n)?'Planificar extracción y combustible: sin servicios locales; el evento dinámico no se presupone activo.':/checkmate|orbituary|ruin station/.test(n)?'Distinguir zona pública de Contested Zone; prever combate PvPvE.':'Confirmar permisos, contrato y hostilidad antes de abrir fuego; no hay detección de jugadores en vivo.';
 $('destinationEvidence').textContent=[sec.source?.grade,sec.source?.build,p.patch].filter(Boolean).join(' · ')||'Sin validación específica por parche';
 $('destinationNotes').textContent=sec.notes||'No hay evaluación específica para este destino.';
 const source=$('destinationSource');const url=sec.source?.url||loot.source||p.sourceUrls?.[0];source.hidden=!url;if(url)source.href=url;
 applyPoiToMain(p);
 $('destinationIntel').hidden=true;
}
$('destinationClose').addEventListener('click',()=>{$('destinationIntel').hidden=true});
function renderPoi(){
 const q=poiQuery.value.trim().toLocaleLowerCase('es');
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('es');
 const queryTerms=normalize(q).split(/\\s+/).filter(Boolean);
 const matches=poiData.filter(p=>(!poiSystem.value||p.system===poiSystem.value)&&(!poiService.value||['reported','confirmed'].includes(p.services?.[poiService.value]))&&queryTerms.every(term=>normalize([p.name,p.system,p.parent,p.operator,p.type,...(p.amenities||[]),...(p.tacticalIntel?.threats||[]),...(p.tacticalIntel?.resources||[]),...(p.tacticalIntel?.weapons||[]),...(p.tacticalIntel?.steps||[]),...(p.lootIntel?.categories||[]),...(p.missions||[]).map(x=>x.name),...(p.resources||[]).map(x=>x.name)].filter(Boolean).join(' ')).includes(term)));
 $('poiCount').textContent=matches.length+' de '+poiData.length+' ubicaciones catalogadas · servicios sujetos a verificación';
 poiResults.replaceChildren();
 if(!matches.length){const p=document.createElement('p');p.textContent='No hay resultados documentados para estos filtros.';poiResults.append(p);return;}
 for(const p of matches.slice(0,100)){
 const card=document.createElement('article');card.className='poi-entry';const h=document.createElement('h3');h.textContent=p.name;
 const meta=document.createElement('p');meta.className='poi-meta';meta.textContent=[p.system,p.parent,p.type].filter(Boolean).join(' · ');
 const org=document.createElement('p');org.textContent='Operador: '+(p.operator||'Sin verificar');
 const intel=document.createElement('p');intel.className='poi-meta';const labels=[];if(p.missions?.length)labels.push('Misiones '+p.missions.length);if(p.tacticalIntel?.threats?.length)labels.push('PvE');if(p.tacticalIntel?.resources?.length||p.resources?.length)labels.push('Recursos');if(p.tacticalIntel?.weapons?.length||p.lootIntel?.categories?.length)labels.push('Botín');if(p.tacticalIntel?.steps?.length)labels.push('Guía '+p.tacticalIntel.steps.length+' pasos');intel.textContent=labels.length?'INTEL: '+labels.join(' · '):'Solo ficha geográfica / información operativa no documentada';
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
 const total=Number(d.catalogTotal)||2017,count=Math.max(0,Math.min(total,Number(d.enrichedCount)||0)),percent=total?100*count/total:0;
 $('atlasProgressBar').dataset.loaded='true';$('atlasProgressBar').setAttribute('aria-valuemax',String(total));$('atlasProgressBar').setAttribute('aria-valuenow',String(count));
 $('atlasProgressFill').style.width=percent.toFixed(2)+'%';$('atlasProgressPercent').textContent=percent.toFixed(1)+'%';
 $('atlasProgressCount').textContent=count.toLocaleString('es-ES')+' / '+total.toLocaleString('es-ES')+' ubicaciones consultadas';
 $('atlasProgressUpdated').textContent=d.generatedAt?'Actualizado: '+new Date(d.generatedAt).toLocaleString('es-ES'):'Fecha desconocida';
 const c=d.coverage;if(c)$('atlasProgressQuality').textContent='Con misiones: '+(c.missions||0)+' · Con recursos: '+(c.resources||0)+' · Con lugares vinculados: '+(c.nearby||0)+' · Consultado ≠ información completa';
}
async function mergeFreshIntel(d){
 if(!Array.isArray(d.locations)||!poiData?.length)return;
 const byUuid=new Map(d.locations.map(x=>[x.id,x]));
 const selectedKey=p=>[String(p.system||'').replace(/\s+system$/i,'').trim(),p.name||''].join('|').toLocaleLowerCase('es');
 let changed=false;
 poiData=poiData.map(p=>{const e=byUuid.get(p.source?.uuid||p.id);if(!e)return p;changed=true;return {...p,missions:e.missions||p.missions||[],resources:e.resources||p.resources||[],nearbyLocations:e.nearbyLocations||[],intelDetailSource:e.source,intelCheckedAt:e.checkedAt}});
 if(!changed)return;
 if(selectedPoiKey){const p=poiData.find(x=>selectedKey(x)===selectedPoiKey);if(p)applyPoiToMain(p)}
 if(input.value.trim())updateMenu();
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
  if(selectedPoiKey){const p=poiData.find(x=>[x.system||'',x.name||''].join('|').toLocaleLowerCase('es')===selectedPoiKey);if(p)applyPoiToMain(p)}
  if(input.value.trim())updateMenu();
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
  updateAtlasProgress(meta);
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
 el.replaceChildren();const title=document.createElement('strong');title.textContent='AUDITORÍA GLOBAL · '+c.actionable.toLocaleString('es-ES')+'/'+c.total.toLocaleString('es-ES')+' con algún dato operativo ('+pct+'%)';
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
 const base=await fetch('./data/atlas-poi-seed.json').then(r=>{if(!r.ok)throw Error('Seed HTTP '+r.status);return r.json()});
 const byKey=new Map();const key=p=>[String(p.system||'').replace(/\s+system$/i,'').trim(),p.name||''].join('|').toLocaleLowerCase('es');
 for(const p of base.locations||[])byKey.set(key(p),p);
 let apiCount=0,version='';
 try{
  const r=await fetch('./data/wiki-atlas.json',{cache:'no-cache'});
  if(r.ok){const d=await r.json();if(d.schemaVersion!==1||!Array.isArray(d.locations)||!d.locations.length)throw Error('Invalid API catalog');
   version=d.version||'';
   for(const p of d.locations){if(!p.name||!p.system)continue;const k=key(p),old=byKey.get(k);if(old){byKey.set(k,{...p,...old,affiliation:p.affiliation||old.affiliation||null,jurisdiction:p.jurisdiction||old.jurisdiction||null,amenities:[...new Set([...(p.amenities||[]),...(old.amenities||[])])],missionCount:p.missionCount??old.missionCount??null,childCount:p.childCount??old.childCount??null,source:p.source||old.source,operator:old.operator||p.affiliation||null,sourceUrls:[...(old.sourceUrls||[]),...(p.source?.uuid?['https://api.star-citizen.wiki/api/locations/'+encodeURIComponent(p.source.uuid)]:[])]})}else{byKey.set(k,{...p,operator:p.affiliation||null,services:Object.fromEntries((p.amenities||[]).filter(x=>/refiner/i.test(x)).map(()=>['refinery','reported'])),sourceUrls:[],verification:'api-catalog',patch:d.version})}apiCount++}
  }
 }catch(err){console.warn('Atlas API snapshot unavailable; curated catalog retained',err)}
 try{const er=await fetch('./data/atlas-enriched.json',{cache:'no-cache'});if(er.ok){const ed=await er.json();updateAtlasProgress(ed);lastEnrichmentFingerprint=[ed.version,ed.enrichedCount,ed.generatedAt].join('|');if(ed.version===version&&Array.isArray(ed.locations)){const byUuid=new Map([...byKey.values()].filter(p=>p.id||p.source?.uuid).map(p=>[p.source?.uuid||p.id,p]));for(const e of ed.locations){const current=byUuid.get(e.id);if(!current)continue;const k=key(current);byKey.set(k,{...current,missions:e.missions||current.missions,resources:e.resources||current.resources,nearbyLocations:e.nearbyLocations||[],intelDetailSource:e.source,intelCheckedAt:e.checkedAt})}}}}catch(err){console.warn('Detailed atlas unavailable',err)}
 if(!$('atlasProgressBar').dataset.loaded){$('atlasProgressCount').textContent='Datos de progreso no disponibles';$('atlasProgressUpdated').textContent='Sin snapshot de enriquecimiento';}

 poiData=[...byKey.values()].sort((a,b)=>a.system.localeCompare(b.system)||a.name.localeCompare(b.name));
 await refreshResourceIndex(version);
 if(input.value.trim())updateMenu();
 if(selectedPoiKey){const match=poiData.find(p=>key(p)===selectedPoiKey);if(match)applyPoiToMain(match)}
 renderPoi();
 $('poiCount').textContent+=' · API: '+(apiCount?apiCount+' registros '+version:'sin snapshot; catálogo local');
}
loadAtlas().then(refreshAtlasProgress).catch(e=>{$('poiCount').textContent='No se pudo cargar el atlas: '+e.message});

// Un explorador, dos vistas: evita paneles interminables y preserva búsquedas existentes.
const atlasTabs=[[$('atlasTabPoi'),$('atlasPanePoi')],[$('atlasTabIntel'),$('atlasPaneIntel')]];
function activateAtlas(index,focus=false){atlasTabs.forEach(([tab,pane],i)=>{const active=i===index;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;pane.hidden=!active});if(focus)atlasTabs[index][0].focus()}
for(let i=0;i<atlasTabs.length;i++){const [tab]=atlasTabs[i];tab.addEventListener('click',()=>activateAtlas(i));tab.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();activateAtlas((i+(e.key==='ArrowRight'?1:atlasTabs.length-1))%atlasTabs.length,true)}})}
activateAtlas(0);
