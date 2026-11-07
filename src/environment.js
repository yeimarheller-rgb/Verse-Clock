// VERSE CLOCK — entorno por cuerpo celeste. Datos de la comunidad, no oficiales; revisar en cada parche.
// Gravedad: SCMINER «Ore by Location», parche 4.10.2 (scminer.rocks/data/ore-by-location).
// Peligros: starcitizen.tools (aviso de viaje de Pyro I; atmósfera de Daymar).
export const SOURCE = { gravity: 'SCMINER · parche 4.10.2', hazards: 'starcitizen.tools' };
const G = { Hurston: 1.00, microTech: 1.00, Aberdeen: 0.38, Arial: 0.32, Ita: 0.35, Magda: 0.32,
  Cellin: 0.34, Daymar: 0.35, Yela: 0.35, Calliope: 0.35, Clio: 0.35, Euterpe: 0.34, Lyria: 0.34, Wala: 0.31,
  'Pyro I': 0.85, Monox: 0.90, Bloom: 0.95, 'Pyro IV': 0.70, Ignis: 0.35, Vatra: 0.34, Adir: 0.32, Fairo: 0.33, Terminus: 0.80 };
// Etiquetas ambientales por cuerpo (solo las que tienen fuente).
const TAGS = {
  'Pyro I': ['heat', 'radiation', 'storm'], Daymar: ['toxic'], Monox: ['toxic'],
  Aberdeen: ['heat'], Arial: ['heat'], Ignis: ['heat'], Adir: ['heat'],
  microTech: ['cold'], Calliope: ['cold'], Clio: ['cold'], Euterpe: ['cold'], Lyria: ['cold'], Yela: ['cold'], Terminus: ['cold'],
  Cellin: ['volcanic'], Vatra: ['volcanic'], Fairo: ['volcanic'], Bloom: ['volcanic'],
};
export const TAG_LABEL = { heat: '🌡️ Calor extremo', cold: '❄️ Frío extremo', toxic: '☣️ Atmósfera tóxica', radiation: '☢️ Zonas irradiadas', storm: '⛈️ Tormentas', volcanic: '🌋 Volcánico' };

// Gravedad en tres niveles, sin decimales: lo que importa al saltar o caer.
export function gravityBand(g) {
  if (g == null) return { key: 'unknown', label: 'Sin dato', hint: 'No hay dato contrastado para este cuerpo' };
  if (g < 0.5) return { key: 'low', label: 'Baja', hint: 'Saltos largos y caídas lentas' };
  if (g < 0.85) return { key: 'mid', label: 'Media', hint: 'Algo más ligera que en la Tierra' };
  return { key: 'normal', label: 'Normal', hint: 'Similar a la Tierra' };
}
export function envFor(loc) {
  const g = G[loc.body];
  return { gravity: gravityBand(g), tags: (TAGS[loc.body] || []).map(t => ({ key: t, label: TAG_LABEL[t] })) };
}
export const BODIES_WITH_GRAVITY = Object.keys(G);
