// VERSE CLOCK 1.5 — interfaz. Datos: src/engine.js + data/locations.json. Escena: src/scene.js.
import { compute } from './engine.js';
import { sunState, buildScene, paintScene, photoWeights } from './scene.js';
import { envFor, SOURCE } from './environment.js';
import { coords, fmtCoords, nearestQT, compass } from './nav.js';

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
