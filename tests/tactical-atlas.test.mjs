import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {atlasKey, atlasSystem, mergeTacticalAtlas, tacticalSections, tacticalTags} from '../lab-preview/src/tactical-atlas.js';

const json = name => JSON.parse(readFileSync(new URL('../lab-preview/data/'+name+'.json', import.meta.url)));
const catalogue = new Map([
  ...json('wiki-atlas').locations.map(p => ({...p, system: atlasSystem(p.system)})),
  ...json('atlas-poi-seed').locations,
].map(p => [atlasKey(p), p]));
const snapshot = json('atlas-services');
const keys = new Set(catalogue.keys());
mergeTacticalAtlas(catalogue, snapshot, json('wiki-atlas').version);
const get = (name, system = 'Stanton') => catalogue.get(atlasKey({name, system}));

test('at least 100 unique services and Hathor dossiers attach to existing locations', () => {
  assert.equal(new Set(snapshot.locations.map(atlasKey)).size, snapshot.locations.length);
  assert.ok(snapshot.locations.every(p => keys.has(atlasKey(p))));
  const documented = [...catalogue.values()].filter(p => tacticalSections(p).length);
  assert.ok(documented.length >= 100);
  for (const p of documented) {
    for (const section of tacticalSections(p)) {
      assert.ok(section.text.length);
      assert.ok(section.sources.every(({url, name}) => new URL(url).protocol === 'https:' && name));
    }
  }
});

test('Hathor keeps orbital platforms, cave minerals and PAF weapons distinct', () => {
  const paf = get('Lamina PAF-I'), olp = get('Lamina OLP');
  assert.deepEqual(paf.hathor.linked, ['Lamina OLP']);
  assert.equal(olp.hathor.linked.length, 3);
  assert.match(tacticalTags(paf).join(' '), /Hathor.*S71/);
  assert.doesNotMatch(tacticalTags(paf).join(' '), /Carinite/);
  assert.match(tacticalTags(olp).join(' '), /Carinite/);
  assert.match(tacticalTags(get('Ruptura PAF-I')).join(' '), /HDMS-Anderson/);
  assert.match(tacticalTags(paf).join(' '), /Shubin Mining Facility SCD-1/);
  assert.equal(paf.services?.repair, undefined);
});

test('repair, trade and the contested objective are attached to the right destinations', () => {
  const station = get('Seraphim Station');
  assert.equal(station.services.repair, 'reported');
  assert.match(tacticalTags(station).join(' '), /Admin - Seraphim/);
  assert.ok(get('Levski', 'Nyx').serviceIntel.services.includes('repair'));
  assert.ok(!get('Checkmate Station', 'Pyro'));
  assert.match(tacticalTags(get('Checkmate', 'Pyro')).join(' '), /Placas 1, 2 y 3/);
  assert.match(tacticalTags(get('Orbituary', 'Pyro')).join(' '), /Placas 4 y 7/);
  assert.match(tacticalTags(get('PYAM-EXHANG-0-1', 'Pyro')).join(' '), /railguns/);
  assert.doesNotMatch(tacticalTags(station).join(' '), /Placas/);
});
