'use strict';
/* Pause-feil (1.6.0): musikken stoppet for lett med låst skjerm på løpetur.
   Testene dekker tre årsaker og en logg som viser hva som faktisk skjedde:
   - Android stopper musikken (Bluetooth-brudd, annen app tar lyden): fortsett automatisk, med grenser
   - En sang henger (tiden står stille) uten feilmelding: hopp videre
   - Fortsett etter pause på en fil som ikke lenger kan spilles: hopp videre i stedet for å bli stående
   - Hendelseslogg med kilde (app-knapp, headset/låseskjerm, Android) som overlever omstart */
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, run, pickFolder } = require('./load');

const SANGER = ['Musikk/a.mp3', 'Musikk/b.mp3', 'Musikk/c.mp3'];

function ny(opts = {}) {
  const handlers = {};
  const ms = { metadata: null, playbackState: 'none', setActionHandler: (a, f) => { handlers[a] = f; }, setPositionState() {} };
  const l = load({
    storage: { shuffle: 'false', ...(opts.storage || {}) },
    navigator: { onLine: true, mediaSession: ms },
    extra: { MediaMetadata: class { constructor(o) { Object.assign(this, o); } } },
  });
  pickFolder(l.env, opts.filer || SANGER);
  return { ...l, handlers };
}
const spilt = l => l.audio.fileName;
const logg = l => l.api.logg.map(e => e.msg);
const sisteLogg = l => logg(l)[logg(l).length - 1];
/* Det Chrome gjør når Android tar lyden: pauser lydelementet uten å gå via appen */
const androidPause = l => l.audio.pause();

/* ---------- hvem pauset? ---------- */
test('Pause fra app-knappen logges som app-knapp og fortsetter ikke av seg selv', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.env.el('play').click();
  assert.equal(l.audio.paused, true);
  assert.equal(sisteLogg(l), 'Pause (app-knapp)');
  await run(l.env, 30000);
  assert.equal(l.audio.paused, true);
});

test('Pause fra headset/låseskjerm logges som headset og fortsetter ikke av seg selv', async () => {
  const l = ny();
  l.handlers.play(); await run(l.env);
  l.handlers.pause();
  assert.equal(sisteLogg(l), 'Pause (headset/låseskjerm)');
  await run(l.env, 30000);
  assert.equal(l.audio.paused, true);
});

test('Spill og neste fra headset logges med kilde', async () => {
  const l = ny();
  l.handlers.play(); await run(l.env);
  l.handlers.nexttrack(); await run(l.env);
  assert.ok(logg(l).includes('Spill (headset/låseskjerm)'));
  assert.ok(logg(l).includes('Neste (headset/låseskjerm)'));
  assert.equal(sisteLogg(l), 'Ny sang: b');
});

test('Pause fra Android (ikke appen eller headsettet) logges og fortsetter automatisk etter 1,5 s', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  androidPause(l);
  assert.match(sisteLogg(l), /^Stoppet av Android/);
  await run(l.env, 1400);
  assert.equal(l.audio.paused, true, 'venter litt først');
  await run(l.env, 200);
  assert.equal(l.audio.paused, false);
  assert.equal(spilt(l), 'a.mp3', 'samme sang fortsetter');
  assert.equal(sisteLogg(l), 'Fortsatte automatisk');
});

test('Automatisk fortsett avbrytes hvis du selv trykker pause i ventetiden', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  androidPause(l);
  l.handlers.play(); await run(l.env);      // du fortsetter selv
  l.handlers.pause();                        // og pauser bevisst
  await run(l.env, 5000);
  assert.equal(l.audio.paused, true);
  assert.ok(!logg(l).includes('Fortsatte automatisk'));
});

test('Automatisk fortsett gis opp etter 3 ganger på 5 minutter, så den ikke spiller på høyttaleren i det uendelige', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  for (let i = 0; i < 3; i++) { androidPause(l); await run(l.env, 2500); assert.equal(l.audio.paused, false, `forsøk ${i + 1}`); await run(l.env, 31000); }
  androidPause(l); await run(l.env, 2500);
  assert.equal(l.audio.paused, true);
  assert.match(sisteLogg(l), /Fortsetter ikke automatisk/);
  assert.match(l.env.el('status').textContent, /Android stoppet musikken/);
  await run(l.env, 5 * 60000);              // etter 5 minutter er kvoten tilbake
  l.env.el('play').click(); await run(l.env);
  androidPause(l); await run(l.env, 2500);
  assert.equal(l.audio.paused, false);
});

test('Automatisk fortsett kan slås av, og valget huskes', async () => {
  const l = ny();
  assert.equal(l.env.el('autoResume').getAttribute('aria-pressed'), 'true', 'på som standard');
  l.env.el('autoResume').click();
  assert.equal(l.env.el('autoResume').getAttribute('aria-pressed'), 'false');
  assert.equal(l.env.storage.get('autoResume'), 'false');
  l.env.el('play').click(); await run(l.env);
  androidPause(l); await run(l.env, 5000);
  assert.equal(l.audio.paused, true);
  const igjen = ny({ storage: { autoResume: 'false' } });
  assert.equal(igjen.env.el('autoResume').getAttribute('aria-pressed'), 'false');
});

test('Slutt på sangen er ikke en Android-pause', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.audio.ended = true; l.audio.pause(); l.audio.dispatch('ended'); l.audio.ended = false;
  await run(l.env, 3000);
  assert.ok(!logg(l).some(m => m.startsWith('Stoppet av Android')));
  assert.equal(spilt(l), 'b.mp3');
});

test('Bytte av sang og ny mappe regnes ikke som Android-pause', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.env.el('next').click(); await run(l.env);
  pickFolder(l.env, ['Ny/x.mp3']);
  await run(l.env, 3000);
  assert.ok(!logg(l).some(m => m.startsWith('Stoppet av Android')));
  assert.equal(l.audio.paused, true, 'ny mappe starter ikke av seg selv');
});

/* ---------- sang som henger ---------- */
test('Sang som henger (tiden står stille i 10 s mens den skal spille) hoppes over', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.audio.currentTime = 1.0;
  for (let i = 0; i < 9; i++) await run(l.env, 1000);
  assert.equal(spilt(l), 'a.mp3', 'ikke før 10 s');
  await run(l.env, 3000);
  assert.equal(spilt(l), 'b.mp3');
  assert.ok(logg(l).includes('Henger: a.mp3, hopper over'));
});

test('Sang som spiller normalt hoppes ikke over', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  for (let i = 0; i < 30; i++) { l.audio.currentTime += 1; await run(l.env, 1000); }
  assert.equal(spilt(l), 'a.mp3');
});

test('Pauset sang regnes ikke som heng', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.env.el('play').click();
  await run(l.env, 60000);
  assert.equal(spilt(l), 'a.mp3');
  assert.equal(l.audio.paused, true);
});

/* ---------- fortsett på en fil som ikke kan spilles ---------- */
test('Fortsett etter pause på en fil som ikke lenger kan leses hopper til neste', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.pause();
  l.audio.fail = n => (n === 'a.mp3' ? 'NotReadableError' : null);
  l.handlers.play(); await run(l.env, 500);
  assert.equal(spilt(l), 'b.mp3');
  assert.equal(l.audio.paused, false);
  assert.ok(logg(l).some(m => m.startsWith('Filfeil: a.mp3')));
});

test('Fortsett som krever trykk (NotAllowedError) hopper ikke over sangen', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.pause();
  l.audio.fail = () => 'NotAllowedError';
  l.handlers.play(); await run(l.env, 1000);
  assert.equal(spilt(l), 'a.mp3');
  assert.equal(l.env.el('status').textContent, 'Trykk spill for å starte');
});

/* ---------- loggen ---------- */
test('Loggen har klokkeslett, nyeste nederst, og vises i appen', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  const e = l.api.logg[l.api.logg.length - 1];
  assert.match(e.t, /^\d\d:\d\d:\d\d$/);
  assert.ok(l.env.el('log').innerHTML.includes('Ny sang: a'));
});

test('Loggen lagres og overlever omstart, maks 300 linjer', async () => {
  const l = ny();
  for (let i = 0; i < 160; i++) { l.env.el('next').click(); await run(l.env); }
  assert.equal(l.api.logg.length, 300);
  const lagret = l.env.storage.get('logg');
  const igjen = ny({ storage: { logg: lagret } });   // ny() velger mappe, som gir én ny linje
  assert.equal(igjen.api.logg.length, 300);
  assert.equal(igjen.api.logg[298].msg, l.api.logg[299].msg, 'gammel logg er med');
  assert.match(igjen.api.logg[299].msg, /^Mappe valgt: Musikk/);
});

test('Loggen escaper filnavn (ingen HTML fra filnavn)', async () => {
  const l = ny({ filer: ['M/<i>x.mp3'] });
  l.env.el('play').click(); await run(l.env);
  assert.ok(!l.env.el('log').innerHTML.includes('<i>x'));
  assert.ok(l.env.el('log').innerHTML.includes('&lt;i&gt;x'));
});

test('«Tøm logg» tømmer både visning og lagring', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.env.el('clearLog').click();
  assert.equal(l.api.logg.length, 0);
  assert.equal(l.env.storage.get('logg'), '[]');
});

test('Ødelagt logg i lagring gir tom logg, ikke krasj', () => {
  const l = ny({ storage: { logg: '{ikke json' } });
  assert.deepEqual([...l.api.logg].map(e => e.msg), ['Mappe valgt: Musikk (3 sanger)'], 'bare den nye linja');
});

/* ---------- 1.7.2: avbrutt play() er ikke en ødelagt fil ---------- */
test('Pause rett etter neste (play avbrytes med AbortError): ingen hopp-over, musikken forblir pauset', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  const ekte = l.audio.play.bind(l.audio);
  let avbryt;
  l.audio.play = function () { this.playLog.push(this.fileName); return new Promise((_, rej) => { avbryt = rej; }); };
  l.env.el('next').click();                 // neste sang lastes, play() venter
  l.env.el('play').click();                 // du trykker pause før den rakk å starte
  avbryt(Object.assign(new Error('avbrutt av pause()'), { name: 'AbortError' }));   // slik Chrome svarer
  l.audio.play = ekte;
  await run(l.env, 1000);
  assert.equal(spilt(l), 'b.mp3');
  assert.equal(l.audio.paused, true);
  assert.ok(!logg(l).some(m => m.startsWith('Filfeil')));
});

test('Shuffle: ny runde starter ikke med samme sang som forrige runde sluttet med', async () => {
  for (let i = 0; i < 20; i++) {
    const l = ny({ storage: { shuffle: 'true' } });
    l.env.el('play').click(); await run(l.env);
    for (let k = 0; k < 2; k++) { l.env.el('next').click(); await run(l.env); }
    const sist = spilt(l);
    l.env.el('next').click(); await run(l.env);
    assert.notEqual(spilt(l), sist);
  }
});

/* ---------- 1.9.0: mer robust automatisk fortsett ---------- */
test('Mislykket forsøk på å fortsette prøves på nytt, og teller som én stopp', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  androidPause(l);
  l.audio.fail = () => 'NotSupportedError';
  await run(l.env, 1600);
  assert.equal(l.audio.paused, true);
  l.audio.fail = () => null;
  await run(l.env, 3000);
  assert.equal(l.audio.paused, false, 'andre forsøk lykkes');
  assert.ok(logg(l).some(m => m.startsWith('Forsøk 1 å fortsette feilet')));
  await run(l.env, 31000);
  androidPause(l); await run(l.env, 2000);
  await run(l.env, 31000);
  androidPause(l); await run(l.env, 2000);
  assert.equal(l.audio.paused, false, 'tre stopp-runder er fortsatt innenfor kvoten');
});

test('Neste sang mens automatisk fortsett venter: ventende forsøk avbrytes', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  androidPause(l);
  l.env.el('next').click(); await run(l.env);
  const antall = l.audio.playLog.length;
  await run(l.env, 6000);
  assert.equal(l.audio.playLog.length, antall);
});

test('Stopp av Android logger skjermstatus og posisjon', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  androidPause(l);
  assert.match(sisteLogg(l), /skjerm (på|av\/låst).*s i sangen/);
});

test('Android stopper lyden igjen med en gang etter hvert forsøk: prøver videre med økende pauser, gir opp etter 5', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  const venter = [1500, 3000, 6000, 12000, 20000];
  androidPause(l);
  for (let i = 0; i < venter.length; i++) {
    await run(l.env, venter[i] - 100);
    assert.equal(l.audio.paused, true, `pause ${i + 1} ikke over før ${venter[i]} ms`);
    await run(l.env, 150);
    assert.equal(l.audio.paused, false, `forsøk ${i + 1} fortsetter`);
    await run(l.env, 900);
    androidPause(l);                                   // Android stopper igjen etter ca. 1 s
  }
  await run(l.env, 60000);
  assert.equal(l.audio.paused, true);
  assert.match(sisteLogg(l), /Fortsetter ikke automatisk \(Android stoppet lyden 6 ganger på rad\)/);
  assert.match(l.env.el('status').textContent, /igjen og igjen/);
});

test('Stopp langt fra hverandre er nye runder og starter på 1,5 s igjen', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  androidPause(l); await run(l.env, 1600);
  await run(l.env, 1000); androidPause(l); await run(l.env, 3100);
  assert.equal(l.audio.paused, false);
  await run(l.env, 30000);
  androidPause(l); await run(l.env, 1600);
  assert.equal(l.audio.paused, false, 'ny runde: 1,5 s');
});

test('«Lyden venter på data» logges ikke ved start av sang, bare midt i en sang', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.audio.currentTime = 0; l.audio.dispatch('waiting');
  assert.ok(!logg(l).includes('Lyden venter på data (buffer tom)'));
  l.audio.currentTime = 30; l.audio.dispatch('waiting');
  assert.ok(logg(l).includes('Lyden venter på data (buffer tom)'));
});
