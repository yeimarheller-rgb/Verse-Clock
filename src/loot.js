// Loot intelligence: una marca verde requiere evidencia específica y vigente.
// No confundir la existencia de botín con una garantía de aparición en cada sesión.
export const LOOT_STATES = Object.freeze({verified:'confirmed',reported:'reported',unknown:'unknown'});
const RECORDS = [
  {match:/hathor|orbital laser platform|planetary alignment facility/i,level:'reported',summary:'Instalaciones asociadas a actividades de alto interés; el botín específico y su disponibilidad necesitan verificación por ubicación y parche.',source:null}
];
export function lootFor(location) {
  const name=String(location?.name||'');
  const type=String(location?.type||'');
  const record=RECORDS.find(r=>r.match.test(name)||r.match.test(type));
  if(!record) return {level:'unknown',label:'Botín sin verificar',summary:'No hay evidencia suficiente de botín valioso para esta ubicación.',source:null};
  return {level:record.level,label:record.level==='confirmed'?'Botín valioso': 'Botín posible',summary:record.summary,source:record.source};
}
