import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {navigationUncertainty, registryUncertainty, stantonNavigationText, stantonRegistryText} from '../lab-preview/src/stanton-navigation.js';

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
const inventoryNames=unique(inventory,row=>row.name);
const inventoryIds = new Set(inventory.map(row=>row.id));
const finitePosition = pos => [pos.x,pos.y,pos.z].every(Number.isFinite);
const directDestination = (def,pos) => def && pos && finitePosition(pos) && def.Name===pos.name &&
 !pos.hidden && !def.HideInStarmap && !def.BlockTravel && pos.qt_valid===true;
const approachReferences = [...placements.values()].filter(pos => pos && inventoryIds.has(pos.uuid) &&
 ['Manmade','Manmade_VisibleOnInteraction','Planet','Moon','Settlement'].includes(pos.type) &&
 directDestination(definitions.get(pos.uuid),pos));
const distance = (pos,other) => Math.hypot(pos.x-other.x,pos.y-other.y,pos.z-other.z);
const rows = unique(intel.locations.filter(row=>row.uuid),row=>row.uuid);
const claims = [];
const add = (uuid,field,text,uncertainty,source,proof,sourceDetail) => {
 claims.push({uuid,field,text,uncertainty,source,proof,sourceDetail});
};
function navigation(def,pos) {
 const parent=definitions.get(pos.parent_uuid);
 const parentPos=placements.get(pos.parent_uuid);
 if (!parent || def.ParentUUID!==parent.UUID || /^<=/.test(def.Name)) return;
 const parentReference={referenceUuid:parent.UUID,referenceName:parent.Name};
 if (directDestination(def,pos)) {
  if (def.OnlyShowWhenParentSelected && !directDestination(parent,parentPos)) return;
  return {...parentReference,mode:'direct',arrivalMeters:def.QuantumTravel?.ArrivalRadius??null,
   selectParent:def.OnlyShowWhenParentSelected===true};
 }
 if (!pos.hidden && !def.HideInStarmap && !pos.qt_valid && pos.type==='Asteroid' &&
     /No unauthorized access allowed\./.test(def.Description)) return {...parentReference,mode:'private'};
 const regional=/^(ARC|CRU|HUR|MIC) L[1-5]$/.test(def.Name) &&
  /^(A Lagrangian gravity well located in the orbit of )/.test(def.Description);
 if (!pos.hidden && !def.HideInStarmap && !pos.qt_valid && regional) {
  const body=[...definitions.values()].find(item=>item?.Name===def.Description.match(/orbit of ([^.]+)\./)?.[1] &&
   directDestination(item,placements.get(item.UUID)));
  if(body)return {mode:'sector',referenceUuid:body.UUID,referenceName:body.Name,hidden:false};
 }
 if (!pos.hidden || !def.HideInStarmap) return;
 if (pos.qt_valid && directDestination(parent,parentPos)) {
  if (/^This ASD Research Facility is no longer in operation\. No trespassing\.$/.test(def.Description) &&
      /^Onyx Facility S\d[A-Z]\d+$/.test(def.Name)) return {...parentReference,mode:'restricted'};
  if (!def.QuantumTravel && !def.HideInWorld && ['Hospital','CriminalHospital'].includes(def.RespawnLocationType) &&
      ['LandingZone','Manmade','Manmade_VisibleOnInteraction'].includes(parentPos.type)) return {...parentReference,mode:'clinic'};
 }
 if (!pos.qt_valid && ['JumpPoint','Anomaly'].includes(pos.type) &&
     directDestination(parent,parentPos) && /^This jump point connects Stanton to the /.test(def.Description)) {
  return {...parentReference,mode:'gateway'};
 }
 if (!pos.qt_valid && pos.type==='Asteroid' && !def.BlockTravel) {
  const reference=approachReferences.reduce((nearest,candidate) =>
   !nearest || distance(pos,candidate)<distance(pos,nearest) ? candidate : nearest,null);
  if (!reference) return;
  const distanceKm=Math.round(distance(pos,reference)/1000);
  // A nearby reference is useful for arrival planning. Large offsets do not provide a practical approach here.
  if (distanceKm>0 && distanceKm<=10000) return {mode:'approach',referenceUuid:reference.uuid,
   referenceName:reference.name,distanceKm,privateAccess:/No unauthorized access allowed\./.test(def.Description)};
  const privateAccess=/^A privately owned mining claim .*No unauthorized access allowed\.$/.test(def.Description);
  if((privateAccess || /^A gas pocket contained in the Lagrangian gravity well /.test(def.Description)) &&
     /^(ARC|CRU|HUR|MIC) L[1-5](?:-[A-Z])?$/.test(parent.Name)) {
   return {...parentReference,mode:'sector',hidden:true,privateAccess};
  }
  if(regional){
   const body=[...definitions.values()].find(item=>item?.Name===def.Description.match(/orbit of ([^.]+)\./)?.[1] &&
    directDestination(item,placements.get(item.UUID)));
   if(body)return {mode:'sector',referenceUuid:body.UUID,referenceName:body.Name,hidden:true};
  }
 }
}

function registry(def) {
 const parent=definitions.get(def.ParentUUID);
 if(!parent || /^<=/.test(parent.Name) || !inventoryNames.get(def.Name))return;
 const reference={referenceUuid:parent.UUID,referenceName:parent.Name};
 if(/^A privately owned mining (?:base|claim) that has been registered with the UEE Bureau of Resource Management\. No unauthorized access allowed\.$/.test(def.Description)){
  return {...reference,mode:'mining-permit'};
 }
 if(def.Description==='Owing to unstable conditions, this mining compound is no longer in operation.'){
  return {...reference,mode:'closed-mine'};
 }
 if(def.Description==='This security post is currently inactive. Access remains restricted to ArcCorp personnel and contractors only.'){
  return {...reference,mode:'restricted-post'};
 }
 if(def.Description==='This remote operations depot is for use by authorized personnel only. Trespassers will be prosecuted.'){
  return {...reference,mode:'restricted-depot'};
 }
 if(def.RespawnLocationType==='Hospital' && directDestination(parent,placements.get(parent.UUID))){
  return {...reference,mode:'hospital-record'};
 }
}

for(const row of inventory){
 const uuid=row.id;
 const def=definitions.get(uuid), pos=placements.get(uuid);
 if(!def || def.Name!==row.name || /^<=/.test(row.name) || row.name==='RSI Event Platform')continue;
 if(!pos){
  const detail=registry(def);
  const text=stantonRegistryText(detail,def.Name);
  if(text)add(uuid,detail.mode==='hospital-record'?'logistics':'access',text,registryUncertainty,definitionSource,'registry',JSON.stringify({...detail,name:def.Name}));
  continue;
 }
 if(pos.name!==row.name || !finitePosition(pos))continue;
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
 if(!claims.some(claim=>claim.uuid===uuid && claim.field==='access')){
  const detail=navigation(def,pos);
  const text=stantonNavigationText(detail,def.Name);
  if(text)add(uuid,'access',text,navigationUncertainty,pinnedSource,'navigation',JSON.stringify({...detail,name:def.Name}));
 }
 if(pos.hidden||def.HideInStarmap||def.Type?.Classification!=='Manmade'||!/\b(?:including|like): Refueling, Restocking,/.test(def.Description))continue;
 const uncertainty='El texto de la instalación enumera el servicio. Su funcionamiento y disponibilidad no se han comprobado en sesión.';
 for(const [field,label,token] of [['refuel','repostaje','Refueling'],['rearm','reabastecimiento de munición','Restocking']]){
  add(uuid,field,`La descripción de ${def.Name} enumera ${label} como servicio de la estación.`,uncertainty,definitionSource,'description',token);
 }
}
const output={schemaVersion:1,version:intel.live,reviewedAt,status:'source-reviewed',commit:sourceCommit,claims};
writeFileSync(new URL('../lab-preview/data/stanton-certified-evidence.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({inventory:inventory.length,claims:claims.length,locations:new Set(claims.map(x=>x.uuid)).size,fields:Object.fromEntries(['access','logistics','refuel','rearm'].map(f=>[f,claims.filter(c=>c.field===f).length]))}));
