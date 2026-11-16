// VERSE CLOCK — escena procedural. Visualización artística: no es imagen del juego.
// La posición y el color del sol salen de la fase solar del motor (src/engine.js).

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (c1, c2, t) => { const a = hex(c1), b = hex(c2); return '#' + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join(''); };

// Elevación solar aproximada en [-1, 1]: 0 = horizonte, 1 = mediodía, -1 = medianoche.
// Proxy geométrico a partir del ángulo horario y del ángulo de salida/puesta del modelo.
export function sunState(p, r) {
  if (r.polar || p.riseSetAngle == null) return { elevation: -0.35, side: 0, phase: 'polar' };
  const ha = r.hourAngle, rs = p.riseSetAngle, a = Math.abs(ha);
  const elevation = a <= rs ? Math.sin((Math.PI / 2) * (rs - a) / rs) : -(a - rs) / Math.max(1, 180 - rs);
  const side = ha > 0 ? -1 : 1; // en VerseTime HA>0 = mañana (hora local < 12:00): -1 mañana, 1 tarde
  let phase;
  if (elevation > 0.18) phase = 'day';
  else if (elevation < -0.12) phase = 'night';
  else phase = side < 0 ? 'sunrise' : 'sunset';
  return { elevation, side, phase };
}

// Paletas clave por elevación. sunrise tira a rosa, sunset a naranja intenso.
const KEYS = [
  { e: -1.0, top: '#03050c', mid: '#070c1c', hor: '#0d1830', haze: '#101a2e', far: '#141c2c', mid2: '#0c121e', near: '#05080e', sun: '#ff9a4a', stars: 1, lights: 1 },
  { e: -0.12, top: '#0a1024', mid: '#1c2448', hor: '#4a3a5c', haze: '#3a2c44', far: '#2a2636', mid2: '#181722', near: '#0a0a10', sun: '#ff7a3a', stars: .55, lights: .9 },
  { e: 0.0, top: '#1a2348', mid: '#7a4a5e', hor: '#ff8a3c', haze: '#d8643a', far: '#6a3e3a', mid2: '#3a2422', near: '#160e0e', sun: '#ff8a2a', stars: .1, lights: .55 },
  { e: 0.18, top: '#24416e', mid: '#c0784e', hor: '#ffc070', haze: '#e89a5a', far: '#9a6a52', mid2: '#5c3a2c', near: '#22160f', sun: '#ffd27a', stars: 0, lights: .15 },
  { e: 1.0, top: '#2c5c92', mid: '#7aa6c8', hor: '#e8d2a8', haze: '#d8b88a', far: '#b08a66', mid2: '#7a5638', near: '#3a2616', sun: '#fff4d6', stars: 0, lights: 0 },
];
const DAWN = { hor: '#ff9aa0', haze: '#d8789a', mid: '#8a5c84' }; // tinte de amanecer

// Tinte del suelo por cuerpo (aproximado, artístico). Por defecto: neutro.
const GROUND = { Hurston: '#a8743e', Daymar: '#c0703a', Cellin: '#8a8270', Yela: '#b8c4d4', microTech: '#d8e4f0', Calliope: '#c8d8e8', Clio: '#c0d0e0', Euterpe: '#d0dcea', Arial: '#c06a3a', Aberdeen: '#b89a3a', Magda: '#8a6a6a', Ita: '#8a9a6a', Lyria: '#a8b8c8', Wala: '#9a8a7a', ArcCorp: '#8a6a5a', 'Pyro I': '#a04a2a', 'Pyro IV': '#8a5a3a', Bloom: '#7a8a5a', Monox: '#8a8a8a', Terminus: '#6a5a4a' };

export function palette(elevation, side, body) {
  const e = clamp(elevation, -1, 1);
  let i = 0; while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
  const A = KEYS[i], B = KEYS[i + 1], t = clamp((e - A.e) / (B.e - A.e), 0, 1);
  const out = {};
  for (const k of Object.keys(A)) out[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : mix(A[k], B[k], t);
  if (side < 0) { const w = clamp(1 - Math.abs(e) / 0.25, 0, 1) * 0.6; for (const k in DAWN) out[k] = mix(out[k], DAWN[k], w); }
  const g = GROUND[body];
  if (g) { const light = clamp((e + 0.15) / 1.15, 0, 1); out.far = mix(out.far, g, 0.35 * light); out.mid2 = mix(out.mid2, g, 0.3 * light); out.near = mix(out.near, mix(g, '#000000', 0.7), 0.25 * light); }
  return out;
}

// Cordilleras deterministas (semilla fija) — mismo paisaje en cada carga.
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function ridge(seed, base, amp, rough, w = 1600) {
  const r = rng(seed); const pts = []; let y = base;
  for (let x = 0; x <= w; x += 20) { y += (r() - 0.5) * rough; y = lerp(y, base, 0.08); pts.push([x, y + Math.sin(x / (90 + seed % 50)) * amp]); }
  return 'M0 900 L' + pts.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L') + ` L${w} 900 Z`;
}
function city(seed, x0, ground, span = 260, k = 1) { // silueta industrial: torres escalonadas + naves bajas
  const r = rng(seed); let d = '', lights = '';
  const win = (x, w, top) => { for (let yy = ground - 6 * k; yy > top + 4 * k; yy -= 9 * k) if (r() < 0.5) lights += `<rect x="${(x + 1 * k + r() * Math.max(0, w - 4 * k)).toFixed(1)}" y="${yy.toFixed(1)}" width="${(2.2 * k).toFixed(1)}" height="${(1.6 * k).toFixed(1)}"/>`; };
  for (let x = x0; x < x0 + span; x += (6 + r() * 10) * k) {
    if (r() < 0.13) { // torre escalonada
      const h = (80 + r() * 90) * k, w = (14 + r() * 8) * k; let y = ground, ww = w, xx = x;
      for (const f of [0.45, 0.35, 0.2]) { const top = y - h * f; d += `M${xx.toFixed(1)} ${y.toFixed(1)} V${top.toFixed(1)} H${(xx + ww).toFixed(1)} V${y.toFixed(1)} Z `; win(xx, ww, top); y = top; xx += ww * 0.18; ww *= 0.64; }
      d += `M${(xx + ww / 2 - k).toFixed(1)} ${y.toFixed(1)} V${(y - 22 * k).toFixed(1)} h${2 * k} V${y.toFixed(1)} Z `;
      x += w;
    } else {
      const h = (6 + r() * 26) * k, w = (8 + r() * 16) * k;
      d += `M${x.toFixed(1)} ${ground} V${(ground - h).toFixed(1)} H${(x + w).toFixed(1)} V${ground} Z `; win(x, w, ground - h);
    }
  }
  return { d, lights };
}

export function buildScene(svg) {
  const stars = (() => { const r = rng(7); let s = ''; for (let i = 0; i < 160; i++) s += `<circle cx="${(r() * 1600).toFixed(0)}" cy="${(r() * 520).toFixed(0)}" r="${(r() * 1.3 + .3).toFixed(2)}" opacity="${(r() * .7 + .3).toFixed(2)}"/>`; return s; })();
  const c1 = city(23, 1120, 600, 220, 0.8), c2 = city(11, 540, 690, 480, 1.35);
  svg.setAttribute('viewBox', '0 0 1600 900');
  svg.setAttribute('preserveAspectRatio', 'xMidYMax slice');
  svg.innerHTML = `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop id="s0" offset="0"/><stop id="s1" offset=".55"/><stop id="s2" offset=".78"/></linearGradient>
    <radialGradient id="glow"><stop id="g0" offset="0" stop-opacity=".95"/><stop id="g1" offset=".25" stop-opacity=".45"/><stop id="g2" offset="1" stop-opacity="0"/></radialGradient>
    <linearGradient id="hazeG" x1="0" y1="0" x2="0" y2="1"><stop id="h0" offset="0" stop-opacity="0"/><stop id="h1" offset="1" stop-opacity=".75"/></linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  <g id="stars" fill="#dfe8ff">${stars}</g>
  <circle id="halo" r="420" fill="url(#glow)"/>
  <circle id="sun" r="30"/>
  <rect y="430" width="1600" height="260" fill="url(#hazeG)"/>
  <path id="rFar" d="${ridge(3, 520, 48, 60)}"/>
  <path id="cFar" d="${c1.d}"/><g id="lFar" fill="#ffcf7a">${c1.lights}</g>
  <path id="rMid" d="${ridge(9, 660, 22, 34)}"/>
  <path id="cMid" d="${c2.d}"/><g id="lMid" fill="#ffb85a">${c2.lights}</g>
  <path id="rNear" d="${ridge(17, 770, 40, 70)}"/>`;
}

export function paintScene(svg, st, body) {
  const P = palette(st.elevation, st.side, body), $ = id => svg.querySelector('#' + id);
  $('s0').setAttribute('stop-color', P.top); $('s1').setAttribute('stop-color', P.mid); $('s2').setAttribute('stop-color', P.hor);
  $('h0').setAttribute('stop-color', P.haze); $('h1').setAttribute('stop-color', P.haze);
  $('rFar').setAttribute('fill', P.far); $('cFar').setAttribute('fill', P.far);
  $('rMid').setAttribute('fill', P.mid2); $('cMid').setAttribute('fill', P.mid2); $('rNear').setAttribute('fill', P.near);
  $('stars').setAttribute('opacity', P.stars.toFixed(3));
  $('lFar').setAttribute('opacity', P.lights.toFixed(3)); $('lMid').setAttribute('opacity', P.lights.toFixed(3));
  // Sol: recorre el cielo de izquierda (amanecer) a derecha (anochecer).
  const x = 800 + st.side * (1 - clamp(st.elevation, 0, 1)) * 380;
  const y = 560 - clamp(st.elevation, -0.3, 1) * 470;
  for (const id of ['sun', 'halo']) { $(id).setAttribute('cx', x.toFixed(1)); $(id).setAttribute('cy', y.toFixed(1)); }
  $('sun').setAttribute('fill', P.sun);
  ['g0', 'g1', 'g2'].forEach(g => $(g).setAttribute('stop-color', P.sun));
  $('halo').setAttribute('opacity', clamp(st.elevation + 0.35, 0, 1).toFixed(3));
  return P;
}


// Fotografías por fase (img/bg/*). Pesos continuos según la elevación solar: fundido sin saltos.
// Si las imágenes no están o no cargan, se queda visible la escena procedural de arriba.
const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
export function photoWeights(st) {
  if (st.phase === 'polar') return { night: 1, sunrise: 0, day: 0, sunset: 0 };
  const e = st.elevation;
  const night = 1 - ramp(e, -0.16, 0.0);
  const twilight = ramp(e, -0.2, -0.02) * (1 - ramp(e, 0.08, 0.3));
  const day = ramp(e, 0.12, 0.38);
  const w = { night, sunrise: st.side < 0 ? twilight : 0, sunset: st.side < 0 ? 0 : twilight, day };
  const sum = w.night + w.sunrise + w.sunset + w.day || 1;
  for (const k in w) w[k] /= sum;
  return w;
}
