// Capa independiente para POI orbitales: sin simular amanecer, gravedad o servicios.
export const ORBITAL_TYPES=Object.freeze(['orbital-station','lagrange-station','refinery','orbital-point','jump-gateway']);
export function validateOrbitalPOI(p){
 const errors=[];
 if(!p||typeof p!=='object')return {valid:false,errors:['POI inválido']};
 for(const k of ['id','name','system','type','source'])if(typeof p[k]!=='string'||!p[k].trim())errors.push('Falta '+k);
 if(!ORBITAL_TYPES.includes(p.type))errors.push('Tipo no válido');
 if(p.services && (typeof p.services!=='object'||Array.isArray(p.services)))errors.push('Servicios inválidos');
 if(p.services)for(const [key,v] of Object.entries(p.services))if(!['confirmed','reported','unknown','unavailable'].includes(v))errors.push('Servicio '+key+' no verificado');
 if(p.sunrise||p.sunset||p.lengthOfDayDays)errors.push('POI orbital no admite ciclo solar de superficie');
 return {valid:errors.length===0,errors};
}
export function serviceMatches(p,service){return p.services?.[service]==='confirmed'}
