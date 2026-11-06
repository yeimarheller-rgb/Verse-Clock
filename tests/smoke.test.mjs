import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
test('PWA standalone',()=>assert.equal(manifest.display,'standalone'));
test('UTC y Europe/Madrid',()=>{assert.ok(html.includes("tz('UTC')"));assert.ok(html.includes("tz('Europe/Madrid')"))});
test('motor y catálogo en caché offline',()=>{assert.ok(sw.includes('./src/engine.js'));assert.ok(sw.includes('./data/locations.json'))});
test('aviso honesto: no es telemetría del servidor',()=>assert.ok(html.includes('No es una lectura del servidor')));
