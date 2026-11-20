// Pure, inspectable UUID-only commodity-to-location join.
// Never match by name or inherit a planet's resources into its installations.
export function buildCommodityIndex(catalog, commodities, checkedAt=new Date().toISOString()) {
  if(!catalog||!Array.isArray(catalog.locations)||!catalog.version)throw Error('Invalid versioned atlas catalog');
  if(!Array.isArray(commodities))throw Error('Expected array of commodities');
  const known=new Set(catalog.locations.map(l=>l.id).filter(Boolean));
  const grouped=new Map();
  const counters={commoditiesScanned:commodities.length,resourceCommodities:0,linkedLocations:0,resourceLinks:0,unmatchedLocationLinks:0};
  const categories=new Set(['mineable','harvestable','salvage','remains']);
  for(const item of commodities){
    if(!item||typeof item!=='object'||typeof item.name!=='string'||!Array.isArray(item.locations))continue;
    const kind=String(item.kind||'').toLocaleLowerCase('en');
    const isResource=categories.has(kind)||item.has_ship_mineables===true||item.has_ground_vehicle_mineables===true||item.has_fps_mineables===true||item.has_harvestables===true||item.has_salvage===true;
    if(!isResource)continue;
    counters.resourceCommodities++;
    for(const location of item.locations){
      // The only accepted foreign key is the API's actual starmap-location UUID.
      const id=typeof location==='object'&&location!==null?location.uuid:null;
      if(typeof id!=='string'||!known.has(id)){counters.unmatchedLocationLinks++;continue}
      let record=grouped.get(id);if(!record){record=new Map();grouped.set(id,record)}
      const method=(Array.isArray(location.entries)?[...new Set(location.entries.map(x=>x?.resource_kind||x?.group_name).filter(Boolean))]:[]);
      const resource={
        name:item.name.trim(),
        kind:kind||'resource',
        confidence:'Star Citizen Wiki API / recurso indexado por UUID',
        detail:'Recurso vinculado a la ubicación exacta en la API del parche; no garantiza aparición ni cantidad. '+(method.length?'Registros: '+method.join(', ')+'.':''),
        source:{provider:'Star Citizen Wiki API',endpoint:'/api/commodities',version:catalog.version,commodityUuid:item.uuid||null,locationUuid:id},
        checkedAt
      };
      if(!record.has(item.uuid||item.name))record.set(item.uuid||item.name,resource);
    }
  }
  const locations=[...grouped].map(([id,entries])=>({id,resources:[...entries.values()]})).sort((a,b)=>a.id.localeCompare(b.id));
  counters.linkedLocations=locations.length;
  counters.resourceLinks=locations.reduce((n,l)=>n+l.resources.length,0);
  return {schemaVersion:1,version:catalog.version,generatedAt:checkedAt,catalogTotal:catalog.locations.length,
    source:'https://api.star-citizen.wiki/api/commodities',counts:counters,locations};
}
