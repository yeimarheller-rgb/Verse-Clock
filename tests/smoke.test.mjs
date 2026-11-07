import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
test('PWA standalone',()=>assert.equal(manifest.display,'standalone'));
test('horas de eventos en Europe/Madrid',()=>assert.ok(app.includes("tz('Europe/Madrid')")));
test('motor, escena, app y catálogo en caché offline',()=>{for(const f of ['./src/engine.js','./src/scene.js','./src/app.js','./src/environment.js','./data/locations.json'])assert.ok(sw.includes(f),f)});
test('aviso honesto: no es telemetría del servidor y paisaje artístico',()=>{assert.ok(html.includes('No es una lectura del servidor'));assert.ok(html.includes('visualización artística'))});
test('sin datos inventados (temperatura/clima)',()=>assert.ok(!/°C|temperatura|clima/i.test(html+app)));

test('fotos por fase declaradas y con respaldo procedural',()=>{for(const k of ['night','sunrise','day','sunset'])for(const v of ['wide','tall'])assert.ok(html.includes(`./img/bg/${k}-${v}.webp`),k+v);assert.ok(app.includes("$('photo').remove()"))});

test('entorno: gravedad en niveles y sin decimales en pantalla',async()=>{const m=await import('../src/environment.js');
 assert.equal(m.envFor({body:'Daymar'}).gravity.key,'low');assert.equal(m.envFor({body:'Hurston'}).gravity.key,'normal');
 assert.equal(m.envFor({body:'Pyro IV'}).gravity.key,'mid');assert.equal(m.envFor({body:'ArcCorp'}).gravity.key,'unknown');
 assert.ok(m.envFor({body:'Pyro I'}).tags.some(t=>t.key==='radiation'))});
