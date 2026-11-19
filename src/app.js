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
function frame() { fast(); requestAnimationFrame(frame); }
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
function pick(i) { if (!suggestions[i]) return; select(suggestions[i]); hideMenu(); input.blur(); }
function updateMenu() {
  const q = normalize(input.value);
  if (!q || !locs.length) { hideMenu(); return; }
  suggestions = locs.map(l => {
    const n = normalize(l.name), b = normalize(l.body), sys = normalize(l.system), tags = normalize(searchTags(l));
    const score = n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : b.startsWith(q) ? 3 : b.includes(q) ? 4 : sys.includes(q) ? 5 : tags.includes(q) ? 6 : 99;
    return {l,score};
  }).filter(x => x.score < 99).sort((a,b) => a.score - b.score || a.l.name.localeCompare(b.l.name,'es')).slice(0,16).map(x => x.l);
  menu.replaceChildren(); cursor = -1;
  if (!suggestions.length) {
    const empty = document.createElement('div'); empty.className='empty'; empty.textContent='Sin coincidencias'; menu.append(empty);
  }
  suggestions.forEach((l,i) => {
    const btn=document.createElement('button'); btn.type='button'; btn.id='suggestion-'+i;
    btn.setAttribute('role','option'); btn.setAttribute('aria-selected','false');
    const name=document.createElement('span'); name.textContent=l.name;
    const meta=document.createElement('small'); meta.textContent=[l.body,l.system].filter(Boolean).join(' · ');
    btn.append(name,meta);
    btn.addEventListener('pointerdown',e=>e.preventDefault());
    btn.addEventListener('click',()=>pick(i)); menu.append(btn);
  });
  menu.hidden=false; input.setAttribute('aria-expanded','true');
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
    const l=suggestions[cursor<0?0:cursor]||find(input.value);
    if(l){e.preventDefault();pick(suggestions.indexOf(l));if(cur!==l)select(l);}
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
function intelRender(){
 const query=intelInput.value.trim().toLocaleLowerCase('es');
 const found=intelRecords.filter(r=>[r.name,r.system,r.contractor,r.rank,...(r.enemies||[]),r.loot?.item,r.notes].join(' ').toLocaleLowerCase('es').includes(query));
 intelResults.replaceChildren();
 if(!found.length){const p=document.createElement('p');p.className='intel-empty';p.textContent=query?'No hay contratos documentados que coincidan.':'No hay contratos disponibles.';intelResults.append(p);return;}
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
function showPoiDestination(p){
 const sec=destinationSecurity(p),loot=destinationLoot(p);
 $('destinationName').textContent=p.name;
 $('destinationMeta').textContent=[p.system,p.parent,p.type,p.operator].filter(Boolean).join(' · ');
 $('destinationPvp').textContent=sec.pvp||'Sin datos';
 $('destinationPve').textContent=sec.pve||'Sin datos';
 $('destinationFaction').textContent=sec.faction||p.operator||'Sin verificar';
 $('destinationAccess').textContent=sec.access||'Sin verificar';
 $('destinationLoot').textContent=loot.summary;
 const n=p.name.toLowerCase();
 const isHathor=/hathor|attritus|lamina|ruptura|vivere|\\bolp\\b|\\bpaf\\b/.test(n);\n const hazard=isHathor?( /aberdeen|ruptura|vivere/.test(n+' '+(p.parent||'').toLowerCase())?'Calor extremo en Aberdeen; mercenarios hostiles y Valakkar juveniles en operaciones de alineación.':'Mercenarios hostiles y Valakkar juveniles en operaciones de alineación; comprobar condiciones locales.' ):/lazarus|phoenix research lab|storm breaker/.test(n)?'Radiación y tormentas electromagnéticas: riesgo de daño por distorsión e inutilización de la nave (fuente comunitaria).':/jumptown/.test(n)?'Frío extremo en Daymar; no hay armisticio (fuente comunitaria).':'No se ha documentado un peligro ambiental específico para esta instalación.';
 $('destinationHazards').textContent=hazard;
 $('destinationPrep').textContent=isHathor?'PvP elevado: prever emboscadas de jugadores/organizaciones. Llevar MaxLift, multiherramienta, fusibles, equipo de combate y apoyo médico; GEO/ROC para minería.':/lazarus|phoenix research lab|storm breaker/.test(n)?'Planificar aproximación ante interferencias, protección radiológica y requisitos de acceso.':/jumptown/.test(n)?'Planificar extracción y combustible: sin servicios locales; el evento dinámico no se presupone activo.':/checkmate|orbituary|ruin station/.test(n)?'Distinguir zona pública de Contested Zone; prever combate PvPvE.':'Confirmar permisos, contrato y hostilidad antes de abrir fuego; no hay detección de jugadores en vivo.';
 $('destinationEvidence').textContent=[sec.source?.grade,sec.source?.build,p.patch].filter(Boolean).join(' · ')||'Sin validación específica por parche';
 $('destinationNotes').textContent=sec.notes||'No hay evaluación específica para este destino.';
 const source=$('destinationSource');const url=sec.source?.url||loot.source||p.sourceUrls?.[0];source.hidden=!url;if(url)source.href=url;
 $('destinationIntel').hidden=false;
 $('destinationIntel').scrollIntoView({block:'start',behavior:'smooth'});
}
$('destinationClose').addEventListener('click',()=>{$('destinationIntel').hidden=true});
function renderPoi(){
 const q=poiQuery.value.trim().toLocaleLowerCase('es');
 const matches=poiData.filter(p=>(!poiSystem.value||p.system===poiSystem.value)&&(!poiService.value||['reported','confirmed'].includes(p.services?.[poiService.value]))&&[p.name,p.system,p.parent,p.operator,p.type].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(q));
 $('poiCount').textContent=matches.length+' de '+poiData.length+' ubicaciones catalogadas · servicios sujetos a verificación';
 poiResults.replaceChildren();
 if(!matches.length){const p=document.createElement('p');p.textContent='No hay resultados documentados para estos filtros.';poiResults.append(p);return;}
 for(const p of matches.slice(0,100)){
 const card=document.createElement('article');card.className='poi-entry';const h=document.createElement('h3');h.textContent=p.name;
 const meta=document.createElement('p');meta.className='poi-meta';meta.textContent=[p.system,p.parent,p.type].filter(Boolean).join(' · ');
 const org=document.createElement('p');org.textContent='Operador: '+(p.operator||'Sin verificar');
 const svc=document.createElement('p');svc.textContent='Refinería: '+({confirmed:'confirmada',reported:'reportada, sin confirmar',unknown:'desconocida',unavailable:'no disponible'}[p.services?.refinery]||'sin datos');
 card.append(h,meta,org,svc);
 card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','Ver información de '+p.name);
 card.addEventListener('click',()=>showPoiDestination(p));
 card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showPoiDestination(p)}});
 if(p.sourceUrls?.length){const a=document.createElement('a');a.href=p.sourceUrls[0];a.rel='noopener noreferrer';a.target='_blank';a.textContent='Consultar fuente';card.append(a)}
 poiResults.append(card);
 }
}
for(const el of [poiQuery,poiSystem,poiService])el.addEventListener('input',renderPoi);
async function loadAtlas(){
 const base=await fetch('./data/atlas-poi-seed.json').then(r=>{if(!r.ok)throw Error('Seed HTTP '+r.status);return r.json()});
 const byKey=new Map();const key=p=>[p.system||'',p.name||''].join('|').toLocaleLowerCase('es');
 for(const p of base.locations||[])byKey.set(key(p),p);
 let apiCount=0,version='';
 try{
  const r=await fetch('./data/wiki-atlas.json',{cache:'no-cache'});
  if(r.ok){const d=await r.json();if(d.schemaVersion!==1||!Array.isArray(d.locations)||!d.locations.length)throw Error('Invalid API catalog');
   version=d.version||'';
   for(const p of d.locations){if(!p.name||!p.system)continue;const k=key(p),old=byKey.get(k);if(old){byKey.set(k,{...p,...old,sourceUrls:[...(old.sourceUrls||[]),...(p.source?.uuid?['https://api.star-citizen.wiki/api/locations/'+encodeURIComponent(p.source.uuid)]:[])]})}else{byKey.set(k,{...p,operator:p.affiliation||null,services:Object.fromEntries((p.amenities||[]).filter(x=>/refiner/i.test(x)).map(()=>['refinery','reported'])),sourceUrls:[],verification:'api-catalog',patch:d.version})}apiCount++}
  }
 }catch(err){console.warn('Atlas API snapshot unavailable; curated catalog retained',err)}
 poiData=[...byKey.values()].sort((a,b)=>a.system.localeCompare(b.system)||a.name.localeCompare(b.name));
 renderPoi();
 $('poiCount').textContent+=' · API: '+(apiCount?apiCount+' registros '+version:'sin snapshot; catálogo local');
}
loadAtlas().catch(e=>{$('poiCount').textContent='No se pudo cargar el atlas: '+e.message});

// Un explorador, dos vistas: evita paneles interminables y preserva búsquedas existentes.
const atlasTabs=[[$('atlasTabPoi'),$('atlasPanePoi')],[$('atlasTabIntel'),$('atlasPaneIntel')]];
function activateAtlas(index,focus=false){atlasTabs.forEach(([tab,pane],i)=>{const active=i===index;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;pane.hidden=!active});if(focus)atlasTabs[index][0].focus()}
for(let i=0;i<atlasTabs.length;i++){const [tab]=atlasTabs[i];tab.addEventListener('click',()=>activateAtlas(i));tab.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();activateAtlas((i+(e.key==='ArrowRight'?1:atlasTabs.length-1))%atlasTabs.length,true)}})}
activateAtlas(0);
