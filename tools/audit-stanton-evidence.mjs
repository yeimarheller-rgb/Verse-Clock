import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

const [sourceRepo, reviewedAt] = process.argv.slice(2);
if (!sourceRepo || !/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt || '')) {
 throw Error('Usage: node tools/audit-stanton-evidence.mjs SCUNPACKED_REPOSITORY YYYY-MM-DD');
}
const data = name => JSON.parse(readFileSync(new URL('../lab-preview/data/'+name+'.json', import.meta.url)));
const intel = data('stanton-intel');
const index = data('wiki-atlas');
const pinnedSource = intel.catalogReview.positionSource;
const sourceCommit = new URL(pinnedSource).pathname.split('/')[4];
const definitionSource = pinnedSource.replace('starmap_positions.json','starmap.json');
const git = (...args) => execFileSync('git',['-C',sourceRepo,...args],{encoding:'utf8',maxBuffer:32*1024*1024}).trim();
if (git('show','-s','--format=%s',sourceCommit) !== intel.live || intel.live !== index.version) throw Error('Unexpected source build');
const extract = path => JSON.parse(git('show',sourceCommit+':'+path));
const unique = (rows,key) => {
 const groups = new Map();
 for(const row of rows){
  const id=key(row);
  groups.set(id,groups.has(id)?null:row);
 }
 return groups;
};
const definitions = unique(extract('starmap.json'),row=>row.UUID);
const placements = unique(extract('starmap_positions.json').entities.filter(row=>row.system==='stanton'),row=>row.uuid);
const placedNames=unique([...placements.values()].filter(Boolean),row=>row.name);
const inventory = index.locations.filter(row=>row.system==='Stanton System');
const rows = unique(intel.locations.filter(row=>row.uuid),row=>row.uuid);
const claims = [];
const add = (uuid,field,text,uncertainty,source,proof,sourceDetail) => {
 claims.push({uuid,field,text,uncertainty,source,proof,sourceDetail});
};
for(const row of inventory){
 const uuid=row.id;
 const def=definitions.get(uuid), pos=placements.get(uuid);
 if(!def || def.Name!==row.name || !pos || pos.name!==row.name || ![pos.x,pos.y,pos.z].every(Number.isFinite))continue;
 for(const claim of rows.get(uuid)?.claims||[]){
  if(claim.field!=='access'||claim.status!=='documented'||claim.patch!==intel.live||!claim.uncertainty||
     !claim.sources.includes(pinnedSource)||!claim.sources.includes(definitionSource))continue;
  const visible=!pos.hidden&&!def.HideInStarmap;
  const parent=definitions.get(pos.parent_uuid);
  let sourceDetail;
  const privateBase='El marcador de esta base minera está colocado y visible en los datos del parche, sin salto cuántico directo. El registro de la UEE identifica la base como privada y exige autorización de acceso.';
  const bodyJump=`En el mapa estelar, selecciona ${parent?.Name} para buscar ${def.Name}. Su marcador colocado está configurado para salto cuántico y tiene un radio de llegada de referencia de 20 km.`;
  if(claim.text===privateBase&&visible&&!pos.qt_valid&&/^A privately owned mining base.*No unauthorized access allowed\.$/.test(def.Description)){
   sourceDetail='hidden=false; qt_valid=false; '+def.Description;
  }else if(claim.text===bodyJump&&visible&&pos.qt_valid&&!def.BlockTravel&&def.ParentUUID===pos.parent_uuid&&def.QuantumTravel?.ArrivalRadius===20000){
   sourceDetail='parent_uuid='+parent.UUID+'; hidden=false; qt_valid=true; ArrivalRadius=20000';
  }else if(def.Name==='CRU L3'&&visible&&!pos.qt_valid&&claim.text==='El marcador regional CRU L3 está colocado y visible en los datos del parche. Úsalo como referencia del sector de Crusader. El marcador carece de configuración para el salto cuántico directo.'){
   sourceDetail='hidden=false; qt_valid=false; '+def.Description;
  }
  const target=claim.destinations?.length===1&&placedNames.get(claim.destinations[0]);
  if(!sourceDetail&&pos.hidden&&!pos.qt_valid&&target?.qt_valid&&!target.hidden&&
     claim.sources.some(url=>url.endsWith('/'+target.uuid))&&[target.x,target.y,target.z].every(Number.isFinite)){
   const km=Math.round(Math.hypot(pos.x-target.x,pos.y-target.y,pos.z-target.z)/1000);
   const pocket=`Selecciona ${target.name} como destino cuántico. El centro de la bolsa ${pos.name} figura a unos ${km} km del centro de la estación en los archivos del parche. La bolsa está oculta y carece de salto directo.`;
   const wreck=`El punto de restos figura a unos ${km} km en línea recta de Pyro Gateway, del lado de Stanton. Pyro Gateway es un destino cuántico independiente. El marcador de los restos está oculto y carece de salto directo.`;
   if((claim.text===pocket&&/^[A-Z]{3} L[1-5]-A$/.test(pos.name))||
      (claim.text===wreck&&pos.name==='Stanton-Pyro Jump Point Wreck Site'&&target.name==='Pyro Gateway')){
    sourceDetail='hidden=true; qt_valid=false; destination_uuid='+target.uuid+'; distance_km='+km;
   }
  }
  if(sourceDetail)add(uuid,'access',claim.text,claim.uncertainty,pinnedSource,'position',sourceDetail);
 }
 if(pos.hidden||def.HideInStarmap||def.Type?.Classification!=='Manmade'||!/\b(?:including|like): Refueling, Restocking,/.test(def.Description))continue;
 const uncertainty='El texto de la instalación enumera el servicio. Su funcionamiento y disponibilidad no se han comprobado en sesión.';
 for(const [field,label,token] of [['refuel','repostaje','Refueling'],['rearm','reabastecimiento de munición','Restocking']]){
  add(uuid,field,`La descripción de ${def.Name} enumera ${label} como servicio de la estación.`,uncertainty,definitionSource,'description',token);
 }
}
const output={schemaVersion:1,version:intel.live,reviewedAt,status:'source-reviewed',commit:sourceCommit,claims};
writeFileSync(new URL('../lab-preview/data/stanton-certified-evidence.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({inventory:inventory.length,claims:claims.length,locations:new Set(claims.map(x=>x.uuid)).size,fields:Object.fromEntries(['access','refuel','rearm'].map(f=>[f,claims.filter(c=>c.field===f).length]))}));
