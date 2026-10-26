'use strict';
/* Utgivelsesregler: versjonsnummeret skal være likt overalt, og endringsloggen skal være ført.
   Ved ny versjon: endre package.json først, så skal disse testene bli røde til resten er oppdatert. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const les = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const V = JSON.parse(les('package.json')).version;
const semver = v => v.split('.').map(Number);
const nyereEnn = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

test('package.json har et gyldig versjonsnummer', () => assert.match(V, /^\d+\.\d+\.\d+$/));

test('Spilleren (app/index.html) har samme versjon', () => assert.match(les('app', 'index.html'), new RegExp(`const VERSION = "${V.replace(/\./g, '\\.')}";`)));

test('Service worker (app/sw.js) har samme versjon, så nye filer hentes ved oppdatering', () => assert.match(les('app', 'sw.js'), new RegExp(`const VERSION = "${V.replace(/\./g, '\\.')}";`)));

test('Forsiden har samme versjon i kommentaren og i bunnteksten', () => {
  const h = les('index.html');
  assert.ok(h.includes(`nedlastingsside v${V} */`), 'kommentar «nedlastingsside v…» i style');
  assert.ok(h.includes(`<footer>Lommespiller v${V}</footer>`), 'bunntekst');
});

test('README har samme versjon øverst og som første punkt i versjonslista', () => {
  const r = les('README.md');
  assert.ok(r.includes(`**Versjon:** ${V} ·`), 'linja «Versjon:»');
  const liste = r.split('## Versjoner')[1].split('\n').filter(l => l.startsWith('- **'));
  assert.ok(liste[0].startsWith(`- **${V}**`), `første punkt skal være ${V}, var: ${liste[0]}`);
});

test('Versjonslista i README er ført nyeste først, uten dobbelte nummer', () => {
  const v = [...les('README.md').split('## Versjoner')[1].matchAll(/^- \*\*(\d+\.\d+\.\d+)\*\*/gm)].map(m => m[1]);
  assert.ok(v.length >= 5);
  for (let i = 1; i < v.length; i++) assert.ok(nyereEnn(v[i - 1], v[i]), `${v[i - 1]} skal stå før ${v[i]}`);
});
