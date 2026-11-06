// VERSE CLOCK 1.0 — interfaz. Datos: src/engine.js + data/locations.json. Escena: src/scene.js.
import { compute } from './engine.js';
import { sunState, buildScene, paintScene } from './scene.js';

const $ = id => document.getElementById(id);
const tz = z => new Intl.DateTimeFormat('es-ES', { timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const MAD = tz('Europe/Madrid');
const DATE = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: 'short', year: 'numeric' });
const PHASE = { day: 'Día', night: 'Noche', sunrise: 'Amanecer', sunset: 'Atardecer', polar: 'Ciclo polar' };
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// ?t=2026-11-04T21:39:00Z simula otro instante (para revisar fases). Se avisa en pantalla.
const SIM = (() => { const t = Date.parse(new URLSearchParams(location.search).get('t')); return Number.isFinite(t) ? t - Date.now() : 0; })();
const nowMs = () => Date.now() + SIM;
let locs = [], cur = null, favs = store.get('vc-favs', ['Lorville', 'HDSF-Elbridge', 'Dupree Industrial Manufacturing Facility']);
const byName = n => locs.find(l => l.name === n);
const label = l => `${l.name} (${l.body})`;
const dur = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s % 60).padStart(2, '0')} s`; };

function select(l) {
  if (!l) return; cur = l;
  $('q').value = '';
  $('place').textContent = l.name;
  $('where').textContent = `${l.body} · ${l.system}`;
  $('lat').textContent = `${l.latitude.toFixed(1)}°`;
  $('dayLen').textContent = `${(l.lengthOfDayDays * 1440).toFixed(0)} min`;
  $('alt').textContent = `${Math.max(0, l.elevationKm).toFixed(2)} km`;
  $('kind').textContent = l.type || '—';
  history.replaceState(null, '', '#' + encodeURIComponent(l.name.replace(/ /g, '_')));
  store.set('vc-last', l.name);
  renderFavs(); tick();
}

function renderFavs() {
  const isFav = cur && favs.includes(cur.name);
  $('fav').setAttribute('aria-pressed', String(!!isFav));
  $('fav').innerHTML = `<span class="ico" aria-hidden="true">${isFav ? '★' : '☆'}</span><span class="txt">${isFav ? 'Fijada' : 'Fijar'}</span>`;
  $('fav').setAttribute('aria-label', isFav ? 'Quitar de fijadas' : 'Fijar ubicación');
  $('cards').innerHTML = favs.map(byName).filter(Boolean).map(l => `
    <button class="card${cur && l.name === cur.name ? ' on' : ''}" data-name="${l.name.replace(/"/g, '&quot;')}">
      <span class="cn">${l.name}</span><span class="cb">${l.body}</span>
      <span class="ct" data-t></span><span class="cp" data-p></span>
    </button>`).join('');
}

function tick() {
  const now = nowMs();
  $('mad').textContent = MAD.format(now);
  $('date').textContent = DATE.format(now);
  $('net').textContent = SIM ? 'Hora simulada' : navigator.onLine ? 'En línea' : 'Sin conexión · modo offline';
  if (!cur) return;
  const r = compute(cur, now), st = sunState(cur, r);
  $('clock').textContent = r.localTime;
  document.documentElement.dataset.phase = st.phase;
  $('phase').textContent = PHASE[st.phase];
  const P = paintScene($('scene'), st, cur.body);
  document.body.style.background = P.near; // suelo continuo bajo la escena en móvil

  const lodS = cur.lengthOfDayDays * 86400;
  if (r.polar) {
    $('solar').classList.add('polar');
    $('riseIn').textContent = $('setIn').textContent = 'Sin evento';
    $('riseAt').textContent = $('setAt').textContent = 'Ciclo polar en el modelo';
    $('bar').style.width = '0%'; $('pct').textContent = '—';
    $('tl').style.background = 'var(--night)'; $('tlRise').hidden = $('tlSet').hidden = true;
  } else {
    $('solar').classList.remove('polar');
    $('riseIn').textContent = r.starriseNow ? 'Ahora' : dur(r.nextStarriseInSeconds);
    $('setIn').textContent = r.starsetNow ? 'Ahora' : dur(r.nextStarsetInSeconds);
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
  $('tlNow').style.left = (r.localTimeSeconds / 864) + '%';

  for (const el of $('cards').children) {
    const l = byName(el.dataset.name); if (!l) continue;
    const rr = compute(l, now), s = sunState(l, rr);
    el.querySelector('[data-t]').textContent = rr.localTime;
    el.querySelector('[data-p]').textContent = PHASE[s.phase];
    el.dataset.phase = s.phase;
  }
}
const clampPct = v => Math.min(100, Math.max(0, v));

function find(v) {
  v = v.trim().toLowerCase(); if (!v) return null;
  return locs.find(x => label(x).toLowerCase() === v) || locs.find(x => x.name.toLowerCase() === v) || locs.find(x => x.name.toLowerCase().includes(v));
}
function fromHash() { const h = decodeURIComponent(location.hash.slice(1)).replace(/_/g, ' ').toLowerCase(); return h && locs.find(l => l.name.toLowerCase() === h); }

buildScene($('scene'));
$('q').addEventListener('change', e => { const l = find(e.target.value); if (l) select(l); else $('where').textContent = 'Sin resultados: prueba con el nombre de la base o del planeta'; });
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') { const l = find(e.target.value); if (l) { select(l); e.target.blur(); } } });
$('fav').addEventListener('click', () => { if (!cur) return; favs = favs.includes(cur.name) ? favs.filter(n => n !== cur.name) : [...favs, cur.name].slice(-6); store.set('vc-favs', favs); renderFavs(); tick(); });
$('cards').addEventListener('click', e => { const b = e.target.closest('.card'); if (b) select(byName(b.dataset.name)); });
window.addEventListener('hashchange', () => { const l = fromHash(); if (l && l !== cur) select(l); });

fetch('./data/locations.json').then(r => r.json()).then(d => {
  locs = d.locations;
  $('count').textContent = `${d.count} ubicaciones`;
  $('places').innerHTML = locs.map(l => `<option value="${label(l).replace(/"/g, '&quot;')}">`).join('');
  select(fromHash() || byName(store.get('vc-last', '')) || byName('Lorville'));
}).catch(() => { $('where').textContent = 'No se pudo cargar el catálogo. Comprueba la conexión y recarga.'; });
setInterval(tick, 1000); tick();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
