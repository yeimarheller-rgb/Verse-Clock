// Comprueba la sintaxis de todo el JavaScript del navegador como módulo ES (lo que carga el iPhone).
import test from 'node:test';import assert from 'node:assert/strict';
import {readdirSync,copyFileSync,mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const dir=new URL('../src/',import.meta.url);const tmp=mkdtempSync(join(tmpdir(),'vc-'));
for(const f of readdirSync(dir).filter(f=>f.endsWith('.js')))test(`sintaxis src/${f}`,()=>{const m=join(tmp,f.replace(/\.js$/,'.mjs'));copyFileSync(new URL(f,dir),m);
 const r=spawnSync(process.execPath,['--check',m],{encoding:'utf8'});assert.equal(r.status,0,r.stderr)});
