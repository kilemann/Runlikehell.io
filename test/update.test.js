'use strict';
/* Oppdatering (1.7.1): appen starter fra lagret kopi (virker uten nett), og ny versjon lastes ned i bakgrunnen.
   Før 1.7.1 så du den gamle versjonen til du åpnet appen på nytt. Nå:
   - Når ny versjon tar over og musikken ikke spiller: siden lastes på nytt med en gang
   - Spiller musikken: ingen avbrudd, men en «Oppdater nå»-knapp vises
   - Første installasjon laster ikke siden på nytt
   - Når appen hentes fram igjen, sjekkes det etter ny versjon, maks én gang i timen */
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, run, pickFolder } = require('./load');

function ny({ controller = true, reg } = {}) {
  const ls = {};
  const r = reg || { updates: 0, update() { this.updates++; return Promise.resolve(); } };
  const sw = {
    controller: controller ? {} : null,
    register: () => Promise.resolve(r),
    addEventListener: (t, f) => { ls[t] = f; },
  };
  const loc = { protocol: 'https:', hash: '', href: 'https://example.test/app/', reloads: 0, reload() { this.reloads++; } };
  const l = load({ storage: { shuffle: 'false' }, navigator: { onLine: true, serviceWorker: sw }, location: loc });
  l.env.winEvents.dispatch('load');
  return { ...l, sw, ls, loc, reg: r, takeOver: () => ls.controllerchange && ls.controllerchange({}) };
}
const skjult = (l, id) => l.env.el(id).classList.contains('hidden');
const synlig = (l) => { l.env.document.visibilityState = 'visible'; l.env.document.dispatch('visibilitychange'); };

test('Ny versjon tar over mens musikken ikke spiller: siden lastes på nytt med en gang', async () => {
  const l = ny();
  await run(l.env);
  l.takeOver();
  assert.equal(l.loc.reloads, 1);
});

test('Ny versjon tar over mens musikken spiller: ingen avbrudd, «Oppdater nå» vises', async () => {
  const l = ny();
  pickFolder(l.env, ['M/a.mp3']);
  l.env.el('play').click(); await run(l.env);
  assert.equal(skjult(l, 'updateBox'), true, 'skjult før ny versjon finnes');
  l.takeOver();
  assert.equal(l.loc.reloads, 0);
  assert.equal(l.audio.paused, false);
  assert.equal(skjult(l, 'updateBox'), false);
  l.env.el('updateBtn').click();
  assert.equal(l.loc.reloads, 1);
});

test('Første installasjon (ingen versjon fra før) laster ikke siden på nytt', async () => {
  const l = ny({ controller: false });
  await run(l.env);
  l.takeOver();
  assert.equal(l.loc.reloads, 0);
  assert.equal(skjult(l, 'updateBox'), true);
});

test('Siden lastes bare på nytt én gang, selv om det kommer flere signaler', async () => {
  const l = ny();
  await run(l.env);
  l.takeOver(); l.takeOver();
  l.env.el('updateBtn').click();
  assert.equal(l.loc.reloads, 1);
});

test('Appen hentet fram igjen: sjekker etter ny versjon, maks én gang i timen', async () => {
  const l = ny();
  await run(l.env);
  synlig(l);
  assert.equal(l.reg.updates, 0, 'nettopp sjekket ved oppstart');
  await run(l.env, 61 * 60000);
  synlig(l);
  assert.equal(l.reg.updates, 1);
  synlig(l);
  assert.equal(l.reg.updates, 1, 'ikke igjen før det har gått en time');
  l.env.document.visibilityState = 'hidden'; l.env.document.dispatch('visibilitychange');
  await run(l.env, 61 * 60000);
  l.env.document.visibilityState = 'hidden'; l.env.document.dispatch('visibilitychange');
  assert.equal(l.reg.updates, 1, 'sjekker ikke når appen går i bakgrunnen');
});

test('Feil ved sjekk etter ny versjon (f.eks. uten nett) stopper ikke appen', async () => {
  const l = ny({ reg: { update() { return Promise.reject(new Error('uten nett')); } } });
  await run(l.env, 61 * 60000);
  synlig(l); await run(l.env);
  pickFolder(l.env, ['M/a.mp3']);
  assert.equal(l.api.tracks.length, 1);
});

test('Nedlastet fil (ikke fra nettet) lytter ikke etter oppdateringer', () => {
  let lyttet = 0;
  const sw = { controller: {}, register: () => Promise.resolve({}), addEventListener: () => { lyttet++; } };
  load({ location: { protocol: 'file:' }, navigator: { onLine: true, serviceWorker: sw } });
  assert.equal(lyttet, 0);
});
