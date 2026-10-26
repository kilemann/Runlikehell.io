'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./load');

/* Kjører en service worker-fil i en simulert worker med lager (caches) og nett (fetch) */
function lastSW(file, { cacheKeys = [], hits = {}, nett } = {}) {
  const handlers = {}, lager = new Map(), log = { slettet: [], fetch: [], claimed: 0, skipWaiting: 0, unregistered: 0, navigert: [] };
  for (const k of cacheKeys) lager.set(k, new Map());
  const cache = (name) => ({ addAll: async urls => { lager.get(name).added = urls; } });
  const caches = {
    open: async name => { if (!lager.has(name)) lager.set(name, new Map()); return cache(name); },
    keys: async () => [...lager.keys()],
    delete: async k => { log.slettet.push(k); lager.delete(k); return true; },
    match: async (req) => { const u = typeof req === 'string' ? req : req.url; return hits[u] || hits[u.replace(/^https:\/\/x\.test/, '.')] || undefined; },
  };
  const self = {
    location: { origin: 'https://x.test' },
    addEventListener: (t, f) => { handlers[t] = f; },
    skipWaiting: () => { log.skipWaiting++; return Promise.resolve(); },
    clients: { claim: async () => { log.claimed++; }, matchAll: async () => [{ url: 'https://x.test/', navigate: u => log.navigert.push(u) }] },
    registration: { unregister: async () => { log.unregistered++; } },
  };
  const ctx = vm.createContext({ self, caches, URL, Promise, console, fetch: async r => { log.fetch.push(r.url); return nett ? nett(r) : { fra: 'nett' }; } });
  vm.runInContext(fs.readFileSync(file, 'utf8') + '\n;globalThis.__v = typeof VERSION === "undefined" ? null : VERSION; globalThis.__files = typeof FILES === "undefined" ? null : FILES; globalThis.__cache = typeof CACHE === "undefined" ? null : CACHE;', ctx, { filename: file });
  const hendelse = async (type, ev = {}) => { let p; handlers[type]({ waitUntil: x => { p = x; }, ...ev }); await p; };
  const hent = async (ev) => { let svar; let kalt = false; handlers.fetch({ ...ev, respondWith: p => { kalt = true; svar = p; } }); return kalt ? svar : undefined; };
  return { v: ctx.__v, files: ctx.__files, cacheName: ctx.__cache, lager, log, hendelse, hent, handlers };
}
const APP_SW = path.join(ROOT, 'app', 'sw.js');
const ROT_SW = path.join(ROOT, 'sw.js');
const get = (url, extra = {}) => ({ method: 'GET', url: 'https://x.test' + url, mode: 'same-origin', ...extra });

test('App-SW: lagrer alle filer appen trenger, under navn med versjonsnummer', async () => {
  const sw = lastSW(APP_SW);
  await sw.hendelse('install');
  assert.equal(sw.cacheName, 'lopespiller-' + sw.v);
  assert.deepEqual(sw.lager.get(sw.cacheName).added, sw.files);
  assert.equal(sw.log.skipWaiting, 1, 'ny versjon tar over uten å vente');
});

test('App-SW: alle lagrede filer finnes i app-mappa', () => {
  const sw = lastSW(APP_SW);
  for (const f of sw.files) {
    const rel = f === './' ? 'index.html' : f;
    assert.ok(fs.existsSync(path.join(ROOT, 'app', rel)), `${f} mangler`);
  }
  for (const m of ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png']) assert.ok(sw.files.includes(m), m + ' må lagres for å virke uten nett');
});

test('App-SW: ved aktivering slettes lagre fra eldre versjoner, men ikke andre apper sine', async () => {
  const sw = lastSW(APP_SW);
  const nå = 'lopespiller-' + sw.v;
  const s2 = lastSW(APP_SW, { cacheKeys: ['lopespiller-1.0.0', 'lopespiller-1.3.0', nå, 'annen-app-1'] });
  await s2.hendelse('activate');
  assert.deepEqual(s2.log.slettet.sort(), ['lopespiller-1.0.0', 'lopespiller-1.3.0']);
  assert.deepEqual([...s2.lager.keys()].sort(), [nå, 'annen-app-1'].sort());
  assert.equal(s2.log.claimed, 1);
});

test('App-SW: lagret kopi vinner (lokalt først), og søkeparametre ignoreres', async () => {
  const lagret = { fra: 'lager' };
  const sw = lastSW(APP_SW, { hits: { 'https://x.test/app/index.html?v=2': lagret } });
  assert.deepEqual(await sw.hent({ request: get('/app/index.html?v=2') }), lagret);
  assert.equal(sw.log.fetch.length, 0, 'ingen nettrafikk når filen ligger lagret');
});

test('App-SW: sidenavigering uten treff faller tilbake til lagret index.html, ellers til nett', async () => {
  const idx = { fra: 'index' };
  const sw = lastSW(APP_SW, { hits: { './index.html': idx } });
  assert.deepEqual(await sw.hent({ request: get('/app/ukjent', { mode: 'navigate' }) }), idx);
  const tom = lastSW(APP_SW);
  assert.deepEqual(await tom.hent({ request: get('/app/ukjent', { mode: 'navigate' }) }), { fra: 'nett' });
  assert.deepEqual(await tom.hent({ request: get('/app/data.json') }), { fra: 'nett' }, 'ikke-lagret fil hentes fra nett');
});

test('App-SW: lar POST og andre nettsteder være i fred', async () => {
  const sw = lastSW(APP_SW);
  assert.equal(await sw.hent({ request: get('/app/x', { method: 'POST' }) }), undefined);
  assert.equal(await sw.hent({ request: { method: 'GET', url: 'https://annen.test/x', mode: 'cors' } }), undefined);
});

test('Rot-SW (opprydder): tar over, sletter bare de gamle v1.0.x-lagrene, melder seg ut og laster siden på nytt', async () => {
  const sw = lastSW(ROT_SW, { cacheKeys: ['lopespiller-1.0.0', 'lopespiller-1.0.1', 'lopespiller-1.3.0', 'annet'] });
  await sw.hendelse('install');
  assert.equal(sw.log.skipWaiting, 1);
  await sw.hendelse('activate');
  assert.deepEqual(sw.log.slettet.sort(), ['lopespiller-1.0.0', 'lopespiller-1.0.1']);
  assert.equal(sw.log.unregistered, 1);
  assert.deepEqual(sw.log.navigert, ['https://x.test/']);
});

test('Manifestet er gyldig og peker på ikoner som finnes', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.name, 'Lommespiller');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512'), 'Chrome krever 192 og 512');
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(ROOT, 'app', i.src)), i.src);
});

test('Forsiden: lokale lenker og bilder finnes, og nedlasting peker på spilleren', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const lokale = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map(m => m[1]);
  assert.ok(lokale.length >= 3);
  for (const l of lokale) assert.ok(fs.existsSync(path.join(ROOT, l)), `${l} finnes ikke`);
  assert.match(html, /href="app\/index\.html" download="Lommespiller\.html"/);
});
