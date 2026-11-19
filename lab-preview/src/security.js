// Datos de seguridad: separar control, intrusos y amenazas de misión.
// No equivale a telemetría ni garantiza NPC presentes en cada sesión.
export const INTEL_VERSION = '4.10.2';
export const FACTIONS = Object.freeze({
  'Nine Tails': {kind:'Banda criminal',system:'Stanton'},
  'XenoThreat': {kind:'Organización extremista armada',system:'Pyro / eventos Stanton'},
  'Headhunters': {kind:'Organización criminal',system:'Pyro'},
  'Citizens for Prosperity': {kind:'Organización civil y contratista de seguridad',system:'Pyro'},
  'Bit Zeros': {kind:'Organización criminal',system:'Pyro'}
});
const EVIDENCE = Object.freeze({
  siege: {source:'Notas de Alpha 4.10 — Siege of Orison',url:'https://starcitizen.tools/4.10',build:'4.10.0',grade:'Documentado'},
  dc: {source:'Guía de centros de distribución Alpha 4.10',url:'https://scanz.space/news/guides/distribution-centres-a-practical-field-guide',build:'4.10',grade:'Guía comunitaria'},
  reports: {source:'Reportes de jugadores (octubre 2026)',url:'https://www.reddit.com/r/starcitizen/comments/1xfylgz/distribution_center_missions/',build:'4.10',grade:'Reporte comunitario'},
  lazarus: {source:'Lazarus Phoenix / Storm Breaker · guía comunitaria',url:'https://www.citadelsc.com/en/guides/storm-breaker',build:'4.2+ · persistencia reportada 4.10',grade:'Guía comunitaria'},
  contested: {source:'Contested Zones · guía de actividades',url:'https://obsidiansquad.org/guides',build:'4.10.1 (snapshot)',grade:'Guía comunitaria'},
  hathor: {source:'Hathor OLP/PAF: guías, botín y reportes PvP',url:'https://starcitizen.tools/Planetary_alignment_facilities',build:'4.10 (fuente comunitaria)',grade:'Documentado / reportado'},
  pyro: {source:'Contrato Citizens for Prosperity 4.10.2',url:'https://api.star-citizen.wiki/missions/protect-location-from-xenothreat-attack',build:'4.10.2',grade:'Datos de misión'}
});
const entries = [
  {match:/lazarus|phoenix research lab|tithonus research lab|storm breaker/i,access:'Acceso mediante tarjetas y lanzadera',threat:'Alto',pvp:'Alto potencial · actividad disputada',pve:'Guardias, radiación, tormenta EM y Valakkar Apex',faction:'ASD / jugadores',status:'Guías comunitarias',notes:'Storm Breaker: cadena Farro (Pyro IV) → Lazarus (Pyro I), tarjetas, huevo, invocación de Apex. Botín: colmillos y perlas irradiadas, armería y equipo especial. Grupos y saqueadores pueden coincidir; no implica PvP constante ni presencia en vivo.',evidence:'lazarus'},
  {match:/^(checkmate|orbituary|ruin station)(?: station)?$/i,access:'Zonas disputadas PvPvE',threat:'Alto',pvp:'Alto · zonas disputadas',pve:'NPC hostiles en Contested Zones',faction:'Facciones de Pyro / jugadores',status:'Guía comunitaria',notes:'Las Contested Zones de estas estaciones concentran PvPvE por tableros, armas y componentes valiosos. No confundir toda la estación con su zona disputada.',evidence:'contested'},
  {match:/hathor|orbital laser platform|planetary alignment facility|\\b(?:attritus|lamina|ruptura|vivere)\\b|\\b(?:olp|paf)[- _]/i,access:'Actividad abierta / zonas restringidas',threat:'Alto',pvp:'Alto · zona disputada',pve:'Mercenarios y Valakkar según fase',faction:'Bandas locales / jugadores',status:'Guías y reportes',notes:'OLP y PAF de Hathor: botín militar y furtivo, armaduras y armas especiales; actividad PvP de grupos y solitarios reportada. Riesgo potencial, NO jugadores detectados en tiempo real. PAF: Daymar/Aberdeen.',evidence:'hathor'},
  {match:/^dupree industrial manufacturing facility$/i,access:'Restringido',threat:'Alto',status:'Reportado',notes:'Jugadores reportan hostilidad en toda la instalación. El contrato puede modificar los permisos.',evidence:'reports'},
  {match:/^cry-astro processing plant (19-02|34-12)$/i,access:'Restringido',threat:'Alto',status:'Reportado',notes:'Hostilidad general reportada; comprobar misión y avisos de intrusión.',evidence:'reports'},
  {match:/^microtech logistics depot s4ld13$/i,access:'Mixto',threat:'Variable',status:'Reportado',notes:'Seguridad microTech en exteriores y ocupación criminal reportada en gran parte del interior.',evidence:'reports'},
  {match:/^greycat (stanton i production complex-b|construction complex-b)$/i,access:'Restringido',threat:'Alto',status:'Reportado',notes:'Hostilidad reportada. No hay facción concreta verificada para cada NPC.',evidence:'reports'},
  {match:/^covalex distribution centre s[14]dc0[56]$/i,access:'Acceso público habitual',threat:'Condicional',status:'Guía',notes:'Las misiones y zonas restringidas pueden cambiar el comportamiento de seguridad.',evidence:'dc'},
  {match:/^sakura sun (goldenrod|magnolia) workcenter$/i,access:'Acceso público habitual',threat:'Condicional',status:'Guía',notes:'No confundir acceso general con autorización para todas las zonas o contratos.',evidence:'dc'},
  {match:/^ruin station$/i,access:'Territorio de facción',threat:'Potencialmente alto',faction:'XenoThreat',status:'Lore / comunidad',notes:'Asociación territorial documentada; no confirma la reacción de cada NPC.',evidence:'pyro'}
];
export function securityFor(location, mission = null) {
  const name = String(location?.name || '').trim();
  const type = String(location?.type || '').toLowerCase();
  const e = entries.find(x=>x.match.test(name));
  const base = e ? {...e} : {access:'Sin verificar',threat:'Desconocido',status:'Sin datos',notes:/bunker|underground|distribution|outpost|centro de distribuci/i.test(type)?'Instalación potencialmente sujeta a permisos, NPC o contratos. No hay clasificación fiable por nombre.':'No existe evidencia específica de hostilidad para esta ubicación.'};
  delete base.match;
  const ev = base.evidence ? EVIDENCE[base.evidence] : null;
  delete base.evidence;
  const active = mission && typeof mission === 'object' ? {
    contractor: String(mission.contractor || ''),
    enemy: String(mission.enemy || ''),
    name: String(mission.name || '')
  } : null;
  return {...base, pvp:base.pvp||'Sin datos',pve:base.pve||'Según misión / sin datos',faction:base.faction || 'No confirmada',mission:active,source:ev,version:INTEL_VERSION};
}
