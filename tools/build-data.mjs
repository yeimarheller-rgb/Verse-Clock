// Genera data/locations.json desde los CSV de VerseTime (GPL-3.0). Uso: node tools/build-data.mjs <ruta VerseTime/data>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { prepareLocation } from '../src/engine.js';
const dir = process.argv[2];
const csv = f => { const [h, ...rows] = readFileSync(`${dir}/${f}`, 'utf8').trim().split(/\r?\n/); const k = h.split(','); return rows.map(r => Object.fromEntries(r.split(',').map((v, i) => [k[i], v]))); };
const bodies = Object.fromEntries(csv('bodies.csv').map(b => [b.name, b]));
const star = n => { const s = bodies[n]; return { name: n, x: +s.coordinateX, y: +s.coordinateY, z: +s.coordinateZ, radius: +s.bodyRadius }; };
const body = b => ({ name: b.name, x: +b.coordinateX, y: +b.coordinateY, z: +b.coordinateZ, q: { w: +b.quaternionW, x: +b.quaternionX, y: +b.quaternionY, z: +b.quaternionZ }, radius: +b.bodyRadius, rotationRate: +b.rotationRate, rotationCorrection: +b.rotationCorrection });
const SURFACE_SKIP = /station|space|satellite|comm array|navigation|lagrange|jump point|asteroid/i;
const out = [];
for (const l of csv('locations.csv')) {
  const b = bodies[l.parentBody]; if (!b || !bodies[l.parentStar] || +b.rotationRate === 0) continue;
  if (SURFACE_SKIP.test(l.type)) continue;
  const p = prepareLocation({ name: l.name, x: +l.coordinateX, y: +l.coordinateY, z: +l.coordinateZ }, body(b), star(l.parentStar));
  if (p.elevationKm > 50) continue; // en órbita, no superficie
  p.type = l.type; out.push(p);
}
out.sort((a, b) => (a.system + a.body + a.name).localeCompare(b.system + b.body + b.name));
mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/locations.json', import.meta.url), JSON.stringify({ source: 'VerseTime (dydrmr) data/*.csv, GPL-3.0', epochUtc: '2020-01-01T00:00:00Z', count: out.length, locations: out }, null, 1));
console.log('ubicaciones', out.length);
