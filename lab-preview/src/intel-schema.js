// Atlas de inteligencia: esquema de evidencia, sin datos de juego inventados.
export const INTEL_SCHEMA_VERSION = 1;
export const EVIDENCE_GRADES = Object.freeze(['official','game-data','community','unverified']);
export const LOOT_LEVELS = Object.freeze(['confirmed','reported','unknown']);
const norm = value => typeof value === 'string' ? value.trim() : '';
export function validateIntelRecord(record) {
  const errors=[];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {valid:false,errors:['Registro inválido']};
  for(const field of ['id','name','system','type','patch']) if(!norm(record[field])) errors.push('Falta '+field);
  if (!EVIDENCE_GRADES.includes(record.evidence?.grade)) errors.push('Grado de evidencia inválido');
  if (!LOOT_LEVELS.includes(record.loot?.level)) errors.push('Nivel de botín inválido');
  if(record.loot?.level==='confirmed' && (!norm(record.loot?.item) || !norm(record.evidence?.url) || record.evidence?.grade==='unverified')) errors.push('Botín confirmado requiere recompensa y evidencia verificable');
  if(record.coordinates && !['number','number','number'].every((t,i)=>typeof [record.coordinates.x,record.coordinates.y,record.coordinates.z][i]===t && Number.isFinite([record.coordinates.x,record.coordinates.y,record.coordinates.z][i]))) errors.push('Coordenadas inválidas');
  if(record.dynamicEncounter===true && record.coordinates) errors.push('Encuentro dinámico no admite coordenadas fijas');
  return {valid:errors.length===0,errors};
}
export function lootBadge(record) {
  const check=validateIntelRecord(record);
  if(!check.valid) return {color:'neutral',label:'Sin verificar',reason:check.errors.join('; ')};
  if(record.loot.level==='confirmed') return {color:'green',label:'Botín valioso confirmado'};
  if(record.loot.level==='reported') return {color:'amber',label:'Botín posible'};
  return {color:'neutral',label:'Sin verificar'};
}
