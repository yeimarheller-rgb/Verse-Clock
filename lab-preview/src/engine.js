// VERSE CLOCK — motor astronómico independiente (sin dependencias).
// Adaptado de VerseTime (https://github.com/dydrmr/VerseTime) de dydrmr, GPL-3.0.
// Este archivo se distribuye bajo GPL-3.0. Ver LICENSE.
// Modelo: predicción a partir del reloj UTC. NO es lectura en directo del servidor de Star Citizen.

export const EPOCH_MS = Date.UTC(2020, 0, 1);
const deg = r => r * 180 / Math.PI;
const rad = d => d * Math.PI / 180;
const mod = (a, b) => ((a % b) + b) % b;
const sq = n => n * n;

// Vector estrella→cuerpo expresado en el sistema rotado del cuerpo (BS en VerseTime)
function bs(body, star) {
  const { w: qw, x: qx, y: qy, z: qz } = body.q;
  const dx = star.x - body.x, dy = star.y - body.y, dz = star.z - body.z;
  return {
    x: (1 - 2 * sq(qy) - 2 * sq(qz)) * dx + (2 * qx * qy - 2 * qz * qw) * dy + (2 * qx * qz + 2 * qy * qw) * dz,
    y: (2 * qx * qy + 2 * qz * qw) * dx + (1 - 2 * sq(qx) - 2 * sq(qz)) * dy + (2 * qy * qz - 2 * qx * qw) * dz,
    z: (2 * qx * qz - 2 * qy * qw) * dx + (2 * qy * qz + 2 * qx * qw) * dy + (1 - 2 * sq(qx) - 2 * sq(qy)) * dz,
  };
}

// Constantes por ubicación: no dependen del tiempo. Se calculan una vez.
export function prepareLocation(loc, body, star) {
  const v = bs(body, star);
  const sXYZ = sq(v.x) + sq(v.y) + sq(v.z), sXY = sq(v.x) + sq(v.y);
  const declination = Math.abs(deg(Math.acos((sXYZ + sXY - sq(v.z)) / (2 * Math.sqrt(sXYZ) * Math.sqrt(sXY)))));
  const apparentRadius = deg(Math.asin(star.radius / Math.sqrt(sXYZ)));
  const staticMeridian = deg(mod(Math.atan2(v.y, v.x) - Math.PI / 2, 2 * Math.PI));

  const { x, y, z } = loc;
  const latitude = deg(Math.atan2(z, Math.sqrt(sq(x) + sq(y))));
  const longitude360 = Math.abs(latitude) === 90 ? 0 : deg(mod(Math.atan2(y, x), 2 * Math.PI));
  const elevation = Math.sqrt(sq(x) + sq(y) + sq(z)) - body.radius;
  const elevationDeg = deg(Math.acos(body.radius / (body.radius + Math.max(0, elevation))));
  const riseSetAngle0 = deg(Math.acos(-Math.tan(rad(latitude)) * Math.tan(rad(declination)))) + apparentRadius + elevationDeg;
  const riseSetAngle = Number.isFinite(riseSetAngle0) ? riseSetAngle0 : null; // null = ciclo polar

  return {
    name: loc.name, body: body.name, system: star.name,
    rotationRateHours: body.rotationRate, rotationCorrection: body.rotationCorrection,
    lengthOfDayDays: body.rotationRate / 24,
    angularRate: 6 / body.rotationRate, // grados por minuto real
    latitude, longitude360, elevationKm: elevation, declination, staticMeridian, riseSetAngle,
  };
}

export function bodyHourAngle(p, ms) {
  const days = (ms - EPOCH_MS) / 86400000;
  const cycle = p.lengthOfDayDays === 0 ? 0 : days / p.lengthOfDayDays;
  return mod(360 - mod(cycle, 1) * 360 - p.rotationCorrection, 360);
}

export function hourAngle(p, ms) {
  const r = mod(bodyHourAngle(p, ms) - mod(p.longitude360 - p.staticMeridian, 360), 360);
  return r > 180 ? r - 360 : r;
}

// Devuelve todo lo necesario para la interfaz o para un asistente.
export function compute(p, ms = Date.now()) {
  const ha = hourAngle(p, ms);
  const localSeconds = 86400 * (360 - (ha + 180)) / 360;
  const lod = p.lengthOfDayDays;
  const daylightDays = (2 * p.riseSetAngle / p.angularRate) * 3 / 4300;
  const polar = !Number.isFinite(p.riseSetAngle); // ciclo polar: sin amanecer/anochecer ordinario
  const nextNoon = (ha > 0 ? ha : 360 + ha) / p.angularRate / 1440;
  const offs = (p.riseSetAngle / p.angularRate) * 3 / 4300;

  let nextRise = null, nextSet = null;
  if (!polar) {
    nextRise = nextNoon - offs;
    if (!(ha > p.riseSetAngle) && ha > 0) nextRise += lod;
    nextSet = nextNoon + offs;
    if (ha > -p.riseSetAngle && !(ha > 0)) nextSet -= lod;
  }
  const riseFrac = polar ? null : (1 - daylightDays / lod) / 2;
  const isDay = polar ? null : (localSeconds > riseFrac * 86400 && localSeconds < (1 - riseFrac) * 86400);

  return {
    utc: new Date(ms).toISOString(),
    hourAngle: ha,
    localTimeSeconds: localSeconds,
    localTime: fmt(localSeconds),
    isDay,
    polar,
    dayLengthRealMinutes: lod * 1440,
    nextStarriseUtc: nextRise == null ? null : new Date(ms + nextRise * 86400000).toISOString(),
    nextStarsetUtc: nextSet == null ? null : new Date(ms + nextSet * 86400000).toISOString(),
    nextStarriseInSeconds: nextRise == null ? null : nextRise * 86400,
    nextStarsetInSeconds: nextSet == null ? null : nextSet * 86400,
    // Igual que VerseTime: margen de 90 s alrededor del evento = «está ocurriendo ahora».
    // El valor puede ser ligeramente negativo justo después del evento (heredado del modelo original).
    starriseNow: nextRise != null && (nextRise * 86400 < 90 || nextRise * 86400 > lod * 86400 - 90),
    starsetNow: nextSet != null && (nextSet * 86400 < 90 || nextSet * 86400 > lod * 86400 - 90),
  };
}

export function fmt(sec) {
  sec = mod(Math.floor(sec), 86400);
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}
