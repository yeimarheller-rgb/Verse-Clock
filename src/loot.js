// Loot intelligence: una marca verde requiere evidencia específica y vigente.
// No confundir la existencia de botín con una garantía de aparición en cada sesión.
export const LOOT_STATES = Object.freeze({verified:'confirmed',reported:'reported',unknown:'unknown'});
const RECORDS = [
  {match:/hathor|orbital laser platform|planetary alignment facility|\\b(?:attritus|lamina|ruptura|vivere)\\b|\\b(?:olp|paf)[- _]/i,level:'reported',summary:'Botín reportado: componentes militares/furtivos (escudos, plantas, refrigeradores, motores cuánticos), armaduras Antium/Morozov y armas especiales. PAF y OLP no comparten necesariamente los mismos contenedores. Ningún drop está garantizado.',source:'https://starcitizen.tools/Planetary_alignment_facilities'}
];
export function lootFor(location) {
  const name=String(location?.name||'');
  const type=String(location?.type||'');
  const record=RECORDS.find(r=>r.match.test(name)||r.match.test(type));
  if(!record) return {level:'unknown',label:'Botín sin verificar',summary:'No hay evidencia suficiente de botín valioso para esta ubicación.',source:null};
  return {level:record.level,label:record.level==='confirmed'?'Botín valioso': 'Botín posible',summary:record.summary,source:record.source};
}
