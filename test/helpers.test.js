'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, file } = require('./load');

const { api, env } = load();

test('audioFiles: tar lydfiler på endelse (uansett store/små bokstaver) eller audio/-type, og dropper resten', () => {
  const liste = [file('a.mp3'), file('b.M4A'), file('c.jpg'), file('d.txt'), file('e', 'audio/x-custom'), file('f.FLAC'), file('g.opus'), file('h.mp3.bak')];
  const navn = Array.from(api.audioFiles(liste)).map(f => f.name);
  assert.deepEqual(navn, ['a.mp3', 'b.M4A', 'e', 'f.FLAC', 'g.opus']);
});

test('audioFiles: alle støttede formater nevnt på forsiden er med', () => {
  for (const ext of ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wav']) assert.ok(api.AUDIO_EXT.test('x.' + ext), ext);
});

test('folderOf og rootName: undermapper og toppmappe fra webkitRelativePath', () => {
  assert.equal(api.folderOf(file('Musikk/Rock/Album/sang.mp3')), 'Musikk/Rock/Album');
  assert.equal(api.folderOf(file('Musikk/sang.mp3')), 'Musikk');
  assert.equal(api.folderOf(file('sang.mp3')), '', 'enkeltfil uten mappe');
  assert.equal(api.rootName([file('Musikk/Rock/sang.mp3')]), 'Musikk');
  assert.equal(api.rootName([file('sang.mp3')]), 'Valgte filer');
  assert.equal(api.rootName([]), 'Valgte filer');
});

test('niceName: fjerner filendelse og gjør understrek til mellomrom', () => {
  assert.equal(api.niceName('Min_beste_sang.mp3'), 'Min beste sang');
  assert.equal(api.niceName('Dr. Dre - Still.flac'), 'Dr. Dre - Still');
  assert.equal(api.niceName('uten-endelse'), 'uten-endelse');
});

test('fmt: m:ss og t:mm:ss, og tåler ugyldige tall', () => {
  assert.equal(api.fmt(0), '0:00');
  assert.equal(api.fmt(5.9), '0:05');
  assert.equal(api.fmt(65), '1:05');
  assert.equal(api.fmt(600), '10:00');
  assert.equal(api.fmt(3599), '59:59');
  assert.equal(api.fmt(3600), '1:00:00');
  assert.equal(api.fmt(3725), '1:02:05');
  assert.equal(api.fmt(NaN), '0:00', 'varighet er NaN før lyden er lastet');
  assert.equal(api.fmt(Infinity), '0:00', 'direktestrøm har uendelig varighet');
  assert.equal(api.fmt(-4), '0:00');
});

test('store og recall: lagrer og leser tilbake, og bruker standardverdi når noe mangler', () => {
  api.store('x', { a: [1, 2] });
  assert.deepEqual(JSON.parse(JSON.stringify(api.recall('x', null))), { a: [1, 2] });
  assert.equal(api.recall('finnes-ikke', 'std'), 'std');
  env.storage.set('kaputt', '{ikke json');
  assert.equal(api.recall('kaputt', 'std'), 'std', 'ødelagt lagring skal ikke krasje appen');
});

test('store: tåler at lagring er blokkert (privat modus)', () => {
  const l = load({ storageFails: true });
  assert.doesNotThrow(() => l.api.store('x', 1));
  assert.equal(l.api.recall('x', 'std'), 'std');
});

test('status: viser melding, markerer feil, og tømmes uten argument', () => {
  api.status('Hei', false);
  assert.equal(env.el('status').textContent, 'Hei');
  assert.ok(!env.el('status').classList.contains('err'));
  api.status('Feil!', true);
  assert.ok(env.el('status').classList.contains('err'));
  api.status();
  assert.equal(env.el('status').textContent, '');
  assert.ok(!env.el('status').classList.contains('err'));
});
