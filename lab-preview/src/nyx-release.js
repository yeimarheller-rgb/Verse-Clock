import {atlasKey, atlasSystem, normalize} from './tactical-atlas.js';

const planetId='2a8a3554-b2f2-489d-a50c-5adff46cbf1b';
const versionUrl='https://api.star-citizen.wiki/api/game-versions/default';
const patchNotes='https://robertsspaceindustries.com/spectrum/community/SC/forum/190048/thread/star-citizen-alpha-5-0-ptu-patch-notes-4/9250020';
const lootRoadmap='https://robertsspaceindustries.com/spectrum/community/SC/forum/3/thread/roadmap-roundup-november-18-2026/9243177';
const preparationStatus='Datos del PTU · comprobación en LIVE pendiente';
const liveFive=/^5\.\d+(?:\.\d+)?-LIVE\.\d+$/i;

export function isNyxI(place){
 return atlasSystem(place.system)==='Nyx' && [place.name,place.parent,place.body].some(name=>/^nyx (?:i|1)$/.test(normalize(name)));
}

export function canReleaseNyxI(live,snapshotVersion){
 if(live)return live.channel==='live' && liveFive.test(live.code);
 return liveFive.test(snapshotVersion);
}

export async function fetchCurrentLive(){
 try{
  const response=await fetch(versionUrl,{cache:'no-store',signal:AbortSignal.timeout(3500)});
  return response.ok?(await response.json()).data:null;
 }catch{return null;}
}

export function applyNyxI(byKey,snapshot){
 if(snapshot?.schemaVersion!==1||!Array.isArray(snapshot.locations))return;
 const planetKey=atlasKey({name:'Nyx I',system:'Nyx'});
 const planet=byKey.get(planetKey)||{id:planetId,name:'Nyx I',system:'Nyx',parent:'Nyx',type:'Planeta'};
 byKey.set(planetKey,{...planet,aliases:['Nyx 1'],nyxReleaseSections:[
  {title:'Destinos de superficie',icons:['landing'],status:preparationStatus,
   text:'Nyx I incorpora asentamientos medianos y centros de extracción Starchitect. Localiza el centro del grupo en el mapa estelar y usa el contrato para confirmar el punto exacto.',
   sources:[patchNotes,'https://www.lootmaster.org/starmap?sys=nyx&o='+planetId]},
  {title:'Botín de Nyx I',icons:['loot'],status:preparationStatus,
   text:'Algunas fichas muestran puntos de aparición identificados por Loot Verse. Los objetos y cantidades dependen de la distribución del parche y de la sesión.',
   sources:[lootRoadmap,'https://loot-verse.com/']},
  {title:'Repostaje y mantenimiento',icons:['refuel'],status:'Servicios de superficie pendientes',
   text:'Comprueba los servicios de aterrizaje de cada destino. Levski, en Delamar, figura en el atlas como opción reportada de repostaje dentro del sistema.',
   destinations:['Levski']},
 ]});
 const byId=new Map([...byKey].filter(([,p])=>isNyxI(p)).map(([key,p])=>[p.source?.uuid||p.id,key]));
 for(const row of snapshot.locations){
  const key=atlasKey({name:row.name,system:'Nyx'});
  const originalKey=byId.get(row.id)||key;
  const existing=byKey.get(originalKey);
  if(existing && (existing.source?.uuid||existing.id)!==row.id)continue;
  const mapSource='https://www.lootmaster.org/starmap?sys=nyx&o='+encodeURIComponent(row.id);
  const sections=[
   {title:'Ubicación de superficie',icons:['landing'],text:'Puesto identificado en el mapa del PTU de Nyx I. Comprueba el marcador y el acceso en LIVE.',status:preparationStatus,sources:[mapSource]},
  ];
  if(row.loot)sections.push({title:'Puntos de aparición de botín',icons:['loot'],status:'Fuente '+snapshot.lootBuild,
   text:'Loot Verse identifica '+row.loot.spots+' puntos de aparición en este puesto. El contenido y la disponibilidad pueden variar.',
   sources:['https://loot-verse.com/#place-'+row.loot.slug]});
  if(row.beds)sections.push({title:'Camas médicas',icons:['clinic'],status:preparationStatus,
   text:'El plano del PTU registra '+row.beds+' camas médicas. Comprueba el acceso y los servicios disponibles en partida.',sources:[mapSource]});
  const place=existing||{id:row.id,name:row.name,system:'Nyx',parent:'Nyx I',type:'Puesto de superficie'};
  byKey.set(originalKey,{...place,operator:place.operator||row.faction,nyxReleaseSections:sections});
 }
}
