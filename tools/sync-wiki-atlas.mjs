// Conector reproducible: Star Citizen Wiki API v3. Node >= 22.
// Uso: node tools/sync-wiki-atlas.mjs [directorio-salida]
import {mkdir,writeFile} from 'node:fs/promises';
const ROOT='https://api.star-citizen.wiki';
const output=process.argv[2]||'data';
const systems=['Stanton','Pyro','Nyx'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url){
 for(let attempt=0;attempt<4;attempt++){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
  try{const response=await fetch(url,{headers:{Accept:'application/json'},signal:controller.signal});
   if(response.status===429||response.status>=500){if(attempt<3){await sleep(1000*(attempt+1));continue;}}
   if(!response.ok)throw Error('HTTP '+response.status+' '+url);
   return await response.json();
  }finally{clearTimeout(timer)}
 }
 throw Error('Retries exhausted '+url);
}
const endpoint=(path,params)=>{const url=new URL(path,ROOT);for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));return url.toString()};
const text=x=>typeof x==='string'?x.trim():'';
const display=x=>typeof x==='string'?x:(x&&typeof x==='object'?x.name||x.display_name||x.label||'':'');
export function normalizeLocation(p,system,version){
 const name=text(p.name);const uuid=text(p.uuid||p.id);if(!name||!uuid)return null;
 const amenities=Array.isArray(p.amenities)?p.amenities.map(display).filter(Boolean):[];
 return {id:uuid,name,system:display(p.system)||system,parent:display(p.parent)||null,type:display(p.type?.classification)||display(p.type)||'unknown',affiliation:display(p.affiliation)||null,jurisdiction:display(p.jurisdiction)||null,amenities,missionCount:Number.isInteger(p.mission_count)?p.mission_count:null,childCount:Number.isInteger(p.child_count)?p.child_count:null,source:{provider:'Star Citizen Wiki API',endpoint:'/api/locations',uuid,version},verifiedServiceNames:amenities};
}
export async function collectSystem(system,version,request=json){
 const seen=new Map();let page=1,totalPages=null;
 while(true){
  if(page>500)throw Error('Excessive pagination '+system);
  const url=endpoint('/api/locations',{'version':version,'filter[system]':system,'page[number]':page,'page[size]':200});
  const response=await request(url);if(!Array.isArray(response.data))throw Error('Invalid locations response '+system+' page '+page);
  for(const item of response.data){const normalized=normalizeLocation(item,system,version);if(normalized)seen.set(normalized.id,normalized)}
  const meta=response.meta||{};const n=Number(meta.last_page);if(Number.isInteger(n)&&n>0)totalPages=n;
  if(totalPages!==null){if(page>=totalPages)break;}
  else if(response.data.length<200)break;
  page++;await sleep(120);
 }
 return [...seen.values()];
}
async function main(){
 const versionResponse=await json(endpoint('/api/game-versions/default',{}));
 const v=versionResponse.data||versionResponse;const version=text(v.code||v.version||v.identifier);
 if(!version)throw Error('No explicit game version returned: refusing unpinned import');
 const all=[];const counts={};for(const system of systems){const list=await collectSystem(system,version);counts[system]=list.length;all.push(...list);}
 const unique=[...new Map(all.map(x=>[x.id,x])).values()].sort((a,b)=>a.system.localeCompare(b.system)||a.name.localeCompare(b.name));
 if(!unique.length)throw Error('Empty atlas: refusing overwrite');
 const artifact={schemaVersion:1,source:'https://api.star-citizen.wiki/api/locations',version,generatedAt:new Date().toISOString(),systems,counts,locations:unique};
 await mkdir(output,{recursive:true});await writeFile(output+'/wiki-atlas.json',JSON.stringify(artifact,null,2)+'\n');
 process.stdout.write(JSON.stringify({version,counts,total:unique.length})+'\n');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)main().catch(e=>{console.error(e);process.exitCode=1});
