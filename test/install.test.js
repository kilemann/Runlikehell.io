'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, run, pickFolder } = require('./load');

const skjult = (l, id) => l.env.el(id).classList.contains('hidden');
function ny(opts = {}) {
  return load({
    ...opts,
    prepare: env => { env.el('installBox').classList.add('hidden'); if (opts.prepare) opts.prepare(env); },
  });
}

test('Versjonen vises øverst i spilleren', () => {
  const l = ny();
  assert.equal(l.env.el('ver').textContent, 'v' + l.api.VERSION);
});

test('Installer-boksen vises når appen er åpnet fra nettet og ikke alt er installert', () => {
  const l = ny({ location: { protocol: 'https:' } });
  assert.equal(skjult(l, 'installBox'), false);
  assert.equal(skjult(l, 'installBtn'), true, 'ingen knapp før Chrome sier at installasjon er mulig');
  assert.match(l.env.el('installHint').textContent, /Installer app/);
});

test('Installer-boksen skjules når filen er åpnet lokalt (ikke fra nettet)', () => {
  const l = ny({ location: { protocol: 'file:' } });
  assert.equal(l.api.IS_WEB, false);
  assert.equal(skjult(l, 'installBox'), true);
});

test('Installer-boksen skjules når appen allerede kjører som installert app', () => {
  const l = ny({ standalone: true });
  assert.equal(skjult(l, 'installBox'), true);
});

test('Chrome tilbyr installasjon: knappen vises med riktig tekst, og trykk åpner Chromes dialog', async () => {
  const l = ny();
  let prompt = 0, forhindret = 0;
  l.env.winEvents.dispatch('beforeinstallprompt', { preventDefault: () => forhindret++, prompt: () => prompt++, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  assert.equal(forhindret, 1, 'Chromes egen minibanner holdes tilbake');
  assert.equal(skjult(l, 'installBtn'), false);
  assert.match(l.env.el('installHint').textContent, /kassettikon/);
  l.env.el('installBtn').click(); await run(l.env);
  assert.equal(prompt, 1);
  assert.equal(skjult(l, 'installBtn'), true, 'knappen brukes opp etter ett valg');
});

test('Trykk på installer uten tilbud fra Chrome gjør ingenting', async () => {
  const l = ny();
  assert.doesNotThrow(() => l.env.el('installBtn').click());
});

test('Avvist installasjonsdialog krasjer ikke', async () => {
  const l = ny();
  l.env.winEvents.dispatch('beforeinstallprompt', { prompt() {}, userChoice: Promise.reject(new Error('avvist')) });
  l.env.el('installBtn').click(); await run(l.env);
  assert.equal(skjult(l, 'installBtn'), true);
});

test('Etter installasjon: boksen skjules og brukeren får beskjed', () => {
  const l = ny();
  l.env.winEvents.dispatch('appinstalled');
  assert.equal(skjult(l, 'installBox'), true);
  assert.match(l.env.el('status').textContent, /Installert/);
});

test('Service worker registreres bare når appen er åpnet fra nettet', () => {
  const reg = [];
  const sw = { register: url => { reg.push(url); return Promise.resolve(); } };
  const web = ny({ navigator: { onLine: true, serviceWorker: sw } });
  assert.deepEqual(reg, [], 'venter til siden er ferdig lastet');
  web.env.winEvents.dispatch('load');
  assert.deepEqual(reg, ['sw.js']);
  const fil = ny({ location: { protocol: 'file:' }, navigator: { onLine: true, serviceWorker: sw } });
  fil.env.winEvents.dispatch('load');
  assert.deepEqual(reg, ['sw.js'], 'ingen registrering for nedlastet fil');
});

test('Feil ved registrering av service worker stopper ikke appen', async () => {
  const l = ny({ navigator: { onLine: true, serviceWorker: { register: () => Promise.reject(new Error('nei')) } } });
  l.env.winEvents.dispatch('load'); await run(l.env);
  pickFolder(l.env, ['M/a.mp3']);
  assert.equal(l.api.tracks.length, 1);
});

test('Nettleser uten mappevalg får tydelig melding ved oppstart', () => {
  const l = ny({ mappevalg: false });
  assert.equal(l.env.el('status').textContent, 'Nettleseren støtter ikke mappevalg. Oppdater Chrome.');
  assert.ok(l.env.el('status').classList.contains('err'));
  assert.equal(ny().env.el('status').textContent, '', 'ingen melding når det støttes');
});

test('Rydder bort gammel lagring fra v1.0–1.2 ved oppstart, og tåler at lagring mangler', () => {
  const slettet = [];
  ny({ indexedDB: { deleteDatabase: n => slettet.push(n) } });
  assert.deepEqual(slettet, ['lopespiller']);
  assert.doesNotThrow(() => ny({ indexedDB: { deleteDatabase() { throw new Error('nei'); } } }));
  assert.doesNotThrow(() => ny({ indexedDB: undefined }));
});
