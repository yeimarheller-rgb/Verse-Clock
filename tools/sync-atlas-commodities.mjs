// One paginated Wiki API harvest -> exact-UUID resource index; no inferred loot.
// Node 22; run after tools/sync-wiki-atlas.mjs.
import {readFile,writeFile} from 'node:fs/promises';
import {buildCommodityIndex} from './atlas-commodities-core.mjs';
const catalog=JSON.parse(await readFile('lab-preview/data/wiki-atlas.json','utf8'));
const root='https://api.star-citizen.wiki';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(url){
 for(let n=0;n<4;n++){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),20000);
  try{
    let r;try{r=await fetch(url,{headers:{Accept:'application/json'},signal:c.signal})}finally{clearTimeout(t)}
    if((r.status===429||r.status>=500)&&n<3){await sleep(1000*(n+1));continue}
    if(!r.ok)throw Error('Commodity API HTTP '+r.status);
    return await r.json();
  }catch(e){if(n===3)throw e;await sleep(750*(n+1))}
 }
 throw Error('Commodity API retries exhausted');
}
let page=1,last=null;const all=[];const seen=new Set();
while(true){
 if(page>100)throw Error('Commodity API pagination limit exceeded');
 const u=new URL('/api/commodities',root);u.searchParams.set('version',catalog.version);
 u.searchParams.set('page[number]',String(page));u.searchParams.set('page[size]','200');
 const result=await get(u.toString());
 if(!Array.isArray(result.data))throw Error('Invalid commodity API data page '+page);
 for(const c of result.data){const id=c?.uuid||c?.key;if(id&&!seen.has(id)){seen.add(id);all.push(c)}}
 const max=Number(result.meta?.last_page);
 if(Number.isInteger(max)&&max>0)last=max;
 if(last!==null?page>=last:result.data.length<200)break;
 page++;await sleep(300);
}
const artifact=buildCommodityIndex(catalog,all);
if(!artifact.counts.linkedLocations)throw Error('No exact UUID resource associations; refusing empty overwrite');
await writeFile('lab-preview/data/atlas-commodities.json',JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({version:artifact.version,pages:page,...artifact.counts}));
