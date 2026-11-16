// VERSE CLOCK — coordenadas y navegación sobre la superficie del cuerpo (datos de VerseTime).
// Las coordenadas x, y, z están en km, en el marco que gira con el cuerpo, como en el juego.
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

export function coords(l) {
  const lon = l.longitude360 > 180 ? l.longitude360 - 360 : l.longitude360;
  return { lat: l.latitude, lon, altKm: Math.max(0, l.elevationKm), x: l.x, y: l.y, z: l.z };
}
export function fmtCoords(c) {
  const f = v => Math.abs(v).toFixed(3).replace('.', ',');
  return `${c.lat < 0 ? 'S' : 'N'} ${f(c.lat)}° · ${c.lon < 0 ? 'O' : 'E'} ${f(c.lon)}°`;
}
// Distancia por la superficie (km) y rumbo inicial (0° = norte, 90° = este) de a → b.
export function route(a, b, radiusKm) {
  const p1 = rad(a.latitude), p2 = rad(b.latitude), dl = rad(b.longitude360 - a.longitude360);
  const ang = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2));
  const brg = (deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))) + 360) % 360;
  return { km: ang * radiusKm, bearing: brg };
}
// Marcador cuántico más cercano en el mismo cuerpo, para llegar a sitios sin QT directo.
export function nearestQT(target, locs) {
  let best = null;
  for (const l of locs) {
    if (l === target || l.body !== target.body || l.quantum !== true || /\(closed\)/i.test(l.name)) continue;
    const r = route(l, target, target.bodyRadiusKm);
    if (!best || r.km < best.km) best = { from: l, ...r };
  }
  return best;
}
export function compass(b) { return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(b / 45) % 8]; }
