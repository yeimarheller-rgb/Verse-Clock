import {atlasSystem} from './tactical-atlas.js';

const markerText = {
 jump: 'Marcador visible con salto cuántico configurado en la extracción del parche.',
 visible: 'Marcador visible en la extracción. Carece de salto cuántico directo.',
 hidden: 'Marcador oculto en la extracción. Consulta la ruta local antes de viajar.',
 unplaced: 'Este UUID carece de posición en la extracción. Acceso en partida pendiente.',
 technical: 'Registro técnico del mapa sin identidad de destino.',
};

export function applyCatalogIntel(byKey, catalog, snapshot, version, system) {
 if(!snapshot || snapshot.schemaVersion!==1 || snapshot.version!==version) return null;
 const ids=new Set(catalog.filter(row=>atlasSystem(row.system)===system).map(row=>row.id));
 const statuses=new Map(Object.entries(snapshot.records).filter(([id,state])=>ids.has(id)&&Object.hasOwn(markerText,state)));
 for(const [key,location] of byKey){
  if(atlasSystem(location.system)!==system)continue;
  const id=location.source?.uuid||location.id;
  if(!statuses.has(id))continue;
  const state=statuses.get(id);
  const parent=state==='unplaced'&&snapshot.parentReferences?.[id];
  byKey.set(key,{...location,catalogIntel:{
   checkedAt:snapshot.checkedAt,
   marker:{
    state,
    text:markerText[state],
    sources:[snapshot.definitionSource,snapshot.positionSource],
    parentUuid:parent!==id&&ids.has(parent)?parent:undefined,
   },
   sections:snapshot.details?.[id]||[],
  }});
 }
 const counts=Object.fromEntries(Object.keys(markerText).map(state=>[state,0]));
 for(const state of statuses.values())counts[state]++;
 return {total:ids.size,reviewed:statuses.size,counts};
}
