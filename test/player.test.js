'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, run, plain, pickFolder, file } = require('./load');

const SANGER = ['Musikk/Rock/sang 1.mp3', 'Musikk/Rock/sang 2.mp3', 'Musikk/Pop/sang 10.mp3', 'Musikk/Pop/sang 3.mp3', 'Musikk/omslag.jpg'];

function ny(opts = {}, filer = SANGER) {
  const l = load({ storage: { shuffle: 'false' }, ...opts });   // uten shuffle: forutsigbar rekkefølge
  if (filer) pickFolder(l.env, filer);
  return l;
}
const tittel = l => l.env.el('title').textContent;
const spilt = l => l.audio.fileName;

/* ---------- velge mappe ---------- */
test('Velge mappe: kun lydfiler telles, mappenavn og antall vises, status ber om å trykke spill', () => {
  const l = ny();
  assert.equal(l.env.el('srcName').textContent, 'Musikk · 4 sanger');
  assert.equal(l.api.tracks.length, 4);
  assert.equal(tittel(l), 'Trykk spill for å starte');
  assert.equal(l.env.el('status').textContent, 'Mappe valgt. Trykk spill.');
});

test('Velge mappe: én sang gir «sang» i entall', () => {
  assert.equal(ny({}, ['Mappe/a.mp3']).env.el('srcName').textContent, 'Mappe · 1 sang');
});

test('Velge mappe uten lydfiler gir feilmelding og beholder forrige valg', () => {
  const l = ny();
  pickFolder(l.env, ['Bilder/a.jpg', 'Bilder/b.png']);
  assert.equal(l.env.el('status').textContent, 'Fant ingen lydfiler i mappa');
  assert.ok(l.env.el('status').classList.contains('err'));
  assert.equal(l.api.tracks.length, 4, 'forrige mappe er uendret');
});

test('Avbrutt mappevalg (ingen filer) endrer ingenting', () => {
  const l = ny();
  l.env.el('dir').files = [];
  l.env.el('dir').dispatch('change');
  assert.equal(l.api.tracks.length, 4);
});

test('Uten mappe: tittel ber om mappe, og spill åpner mappevelgeren', () => {
  const l = ny({}, null);
  assert.equal(l.env.el('srcName').textContent, 'Ingen mappe valgt');
  let åpnet = 0; l.env.el('dir').addEventListener('click', () => åpnet++);
  l.env.el('play').click();
  assert.equal(åpnet, 1);
  l.env.el('next').click(); l.env.el('prev').click();
  assert.equal(åpnet, 1, 'neste og forrige gjør ingenting uten sanger');
  assert.equal(l.audio.playLog.length, 0);
});

test('«Velg mappe …»-knappen åpner mappevelgeren og nullstiller verdien', () => {
  const l = ny({}, null);
  let åpnet = 0; l.env.el('dir').addEventListener('click', () => åpnet++);
  l.env.el('dir').value = 'gammel';
  l.env.el('pick').click();
  assert.equal(åpnet, 1);
  assert.equal(l.env.el('dir').value, '');
});

test('Ny mappe stopper spillingen og frigir lyd-adressen', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  assert.equal(l.audio.paused, false);
  const url = l.audio.src;
  pickFolder(l.env, ['Annet/x.mp3']);
  assert.equal(l.audio.paused, true);
  assert.ok(l.env.revoked.includes(url), 'object-URL er frigitt');
  assert.equal(l.audio.src, '');
  assert.equal(l.env.el('srcName').textContent, 'Annet · 1 sang');
});

/* ---------- rekkefølge ---------- */
test('Uten shuffle: sortert på mappe og navn, tall tas som tall (3 før 10)', () => {
  const l = ny();
  const navn = Array.from(l.api.order).map(i => l.api.tracks[i].folder + '/' + l.api.tracks[i].name);
  assert.deepEqual(navn, ['Musikk/Pop/sang 3.mp3', 'Musikk/Pop/sang 10.mp3', 'Musikk/Rock/sang 1.mp3', 'Musikk/Rock/sang 2.mp3']);
});

test('Med shuffle: alle sanger kommer med nøyaktig én gang', () => {
  const l = ny({ storage: { shuffle: 'true' } });
  assert.deepEqual(plain(l.api.order).sort(), [0, 1, 2, 3]);
});

test('Shuffle-knappen: bytter, husker valget og beholder sangen som spilles', async () => {
  const l = ny({ storage: { shuffle: 'true' } });
  assert.equal(l.env.el('shuffle').textContent, '⤮ Shuffle på');
  assert.equal(l.env.el('shuffle').getAttribute('aria-pressed'), 'true');
  l.env.el('play').click(); await run(l.env);
  const nå = spilt(l);
  l.env.el('shuffle').click();
  assert.equal(l.env.el('shuffle').textContent, '→ Shuffle av');
  assert.equal(l.env.el('shuffle').getAttribute('aria-pressed'), 'false');
  assert.equal(l.env.storage.get('shuffle'), 'false');
  assert.equal(l.api.tracks[l.api.order[l.api.pos]].name, nå, 'samme sang etter bytte');
  l.env.el('shuffle').click();
  assert.equal(l.api.tracks[l.api.order[0]].name, nå, 'med shuffle på legges nåværende sang først');
  assert.equal(l.api.pos, 0);
});

test('Shuffle-valget leses fra lagring ved oppstart, og er på som standard', () => {
  assert.equal(load().api.shuffleOn, true);
  assert.equal(load({ storage: { shuffle: 'false' } }).api.shuffleOn, false);
});

/* ---------- spille ---------- */
test('Spill: starter første sang, viser tittel og mappe, og bytter ikon til pause', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  assert.equal(spilt(l), 'sang 3.mp3');
  assert.equal(tittel(l), 'sang 3');
  assert.equal(l.env.el('sub').textContent, 'Musikk/Pop');
  assert.match(l.env.el('playIcon').innerHTML, /M7 5h4v14H7z/);
  assert.equal(l.env.el('play').getAttribute('aria-label'), 'Pause');
});

test('Spill/pause veksler, og ikonet følger lydelementet', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.env.el('play').click(); await run(l.env);
  assert.equal(l.audio.paused, true);
  assert.match(l.env.el('playIcon').innerHTML, /M8 5v14l11-7z/);
  assert.equal(l.env.el('play').getAttribute('aria-label'), 'Spill');
  l.env.el('play').click(); await run(l.env);
  assert.equal(l.audio.paused, false);
  assert.equal(l.audio.playLog.length, 2, 'fortsetter samme sang, laster ikke på nytt');
});

test('Neste og forrige går gjennom listen', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.env.el('next').click(); await run(l.env);
  assert.equal(spilt(l), 'sang 10.mp3');
  l.env.el('next').click(); await run(l.env);
  assert.equal(spilt(l), 'sang 1.mp3');
  l.env.el('prev').click(); await run(l.env);
  assert.equal(spilt(l), 'sang 10.mp3');
});

test('Forrige: over 3 sekunder starter samme sang på nytt, og første sang starter på nytt', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.env.el('next').click(); await run(l.env);
  l.audio.currentTime = 10;
  l.env.el('prev').click(); await run(l.env);
  assert.equal(spilt(l), 'sang 10.mp3'); assert.equal(l.audio.currentTime, 0);
  l.audio.currentTime = 1;
  l.env.el('prev').click(); await run(l.env);
  assert.equal(spilt(l), 'sang 3.mp3', 'under 3 s: forrige sang');
  l.audio.currentTime = 1;
  l.env.el('prev').click(); await run(l.env);
  assert.equal(spilt(l), 'sang 3.mp3', 'første sang: blir stående');
  assert.equal(l.audio.currentTime, 0);
});

test('Forrige på pauset sang starter avspilling igjen', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.audio.currentTime = 20; l.audio.pause();
  l.env.el('prev').click(); await run(l.env);
  assert.equal(l.audio.paused, false); assert.equal(l.audio.currentTime, 0);
});

test('Slutt på sangen går til neste, og etter siste sang starter en ny runde', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  for (let i = 0; i < 3; i++) { l.audio.dispatch('ended'); await run(l.env); }
  assert.equal(spilt(l), 'sang 2.mp3');
  l.audio.dispatch('ended'); await run(l.env);
  assert.equal(spilt(l), 'sang 3.mp3', 'ny runde fra start');
  assert.equal(l.api.pos, 0);
});

test('Ny runde med shuffle blander på nytt, men alle sanger er med', async () => {
  const l = ny({ storage: { shuffle: 'true' } });
  l.env.el('play').click(); await run(l.env);
  for (let i = 0; i < 4; i++) { l.audio.dispatch('ended'); await run(l.env); }
  assert.deepEqual(plain(l.api.order).sort(), [0, 1, 2, 3]);
  assert.equal(l.api.pos, 0);
});

test('Hver ny sang frigir forrige lyd-adresse (ingen minnelekkasje)', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  const første = l.audio.src;
  l.env.el('next').click(); await run(l.env);
  assert.ok(l.env.revoked.includes(første));
  assert.notEqual(l.audio.src, første);
});

/* ---------- tid og spolefelt ---------- */
test('Tid og spolefelt oppdateres under avspilling', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.audio.duration = 200; l.audio.dispatch('loadedmetadata');
  assert.equal(l.env.el('dur').textContent, '3:20');
  l.audio.currentTime = 50; l.audio.dispatch('timeupdate');
  assert.equal(l.env.el('cur').textContent, '0:50');
  assert.equal(l.env.el('seek').value, 250);
});

test('Spoling: dra viser ny tid uten å hoppe, slipp setter posisjonen', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.audio.duration = 200; l.audio.dispatch('loadedmetadata');
  l.env.el('seek').value = 500; l.env.el('seek').dispatch('input');
  assert.equal(l.env.el('cur').textContent, '1:40');
  l.audio.currentTime = 1; l.audio.dispatch('timeupdate');
  assert.equal(l.env.el('seek').value, 500, 'feltet hopper ikke mens du drar');
  l.env.el('seek').dispatch('change');
  assert.equal(l.audio.currentTime, 100);
  l.audio.currentTime = 110; l.audio.dispatch('timeupdate');
  assert.equal(l.env.el('seek').value, 550, 'følger lyden igjen etter slipp');
});

test('Spoling før lengden er kjent gjør ingenting galt', async () => {
  const l = ny();
  l.env.el('seek').value = 500;
  assert.doesNotThrow(() => { l.env.el('seek').dispatch('input'); l.env.el('seek').dispatch('change'); });
  assert.equal(l.audio.currentTime, 0);
});

/* ---------- feil ---------- */
test('Nettleseren krever trykk (NotAllowedError): ber om trykk og hopper ikke over sangen', async () => {
  const l = ny();
  l.audio.fail = () => 'NotAllowedError';
  l.env.el('play').click(); await run(l.env, 1000);
  assert.equal(l.env.el('status').textContent, 'Trykk spill for å starte');
  assert.equal(l.audio.playLog.length, 1);
  assert.equal(l.api.pos, 0);
});

test('Ødelagt sang: viser melding og hopper videre til neste etter 0,4 s', async () => {
  const l = ny();
  l.audio.fail = n => (n === 'sang 3.mp3' ? 'NotSupportedError' : null);
  l.env.el('play').click(); await run(l.env);
  assert.match(l.env.el('status').textContent, /Kunne ikke spille «sang 3.mp3», hopper over/);
  assert.ok(l.env.el('status').classList.contains('err'));
  await run(l.env, 400);
  assert.equal(spilt(l), 'sang 10.mp3');
  assert.equal(l.audio.paused, false);
  assert.equal(l.env.el('status').textContent, '', 'meldingen fjernes når neste sang spiller');
});

test('Ødelagt sang gir både avvist play() og error-hendelse, men hopper bare ÉN sang', async () => {
  // I Chrome skjer begge deler for en fil som ikke kan dekodes. Før 1.5.0 ble neste (gode) sang hoppet over.
  const l = ny();
  l.audio.fail = n => (n === 'sang 3.mp3' ? 'NotSupportedError' : null);
  l.env.el('play').click(); await run(l.env);
  l.audio.dispatch('error');
  await run(l.env, 1000);
  assert.equal(spilt(l), 'sang 10.mp3', 'sang 10 skal spilles, ikke sang 1');
  assert.deepEqual(plain(l.audio.playLog), ['sang 3.mp3', 'sang 10.mp3']);
});

test('Error-hendelse alene (fil som feiler etter start) hopper til neste', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.audio.dispatch('error');
  assert.match(l.env.el('status').textContent, /Filen kan ikke spilles, hopper over/);
  await run(l.env, 400);
  assert.equal(spilt(l), 'sang 10.mp3');
});

test('Error-hendelse uten lyd-adresse (etter stopp) ignoreres', () => {
  const l = ny();
  l.audio.dispatch('error');
  assert.equal(l.env.el('status').textContent, 'Mappe valgt. Trykk spill.');
});

test('Skifter du mappe mens en hopp-over venter, laster ikke den gamle timeren noe', async () => {
  const l = ny();
  l.audio.fail = n => (n === 'sang 3.mp3' ? 'NotSupportedError' : null);
  l.env.el('play').click(); await run(l.env);
  pickFolder(l.env, ['Ny/a.mp3', 'Ny/b.mp3']);
  await run(l.env, 1000);
  assert.equal(l.audio.paused, true);
  assert.equal(l.audio.src, '');
});

test('Alle sanger ødelagt: stopper etter 10 feil på rad, eller antall sanger hvis færre', async () => {
  const få = ny({}, ['M/a.mp3', 'M/b.mp3']);
  få.audio.fail = () => 'NotSupportedError';
  få.env.el('play').click();
  for (let i = 0; i < 6; i++) await run(få.env, 500);
  assert.equal(få.env.el('status').textContent, 'For mange filer som ikke kan spilles. Stoppet.');
  assert.equal(få.audio.playLog.length, 2, 'prøvde hver sang én gang');
  const mange = ny({}, Array.from({ length: 30 }, (_, i) => `M/s${i}.mp3`));
  mange.audio.fail = () => 'NotSupportedError';
  mange.env.el('play').click();
  for (let i = 0; i < 20; i++) await run(mange.env, 500);
  assert.equal(mange.audio.playLog.length, 10);
});

test('En sang som spiller nullstiller feilteller', async () => {
  const l = ny();
  l.api.errorsInRow = 5;
  l.env.el('play').click(); await run(l.env);
  assert.equal(l.api.errorsInRow, 0);
});

/* ---------- låseskjerm og headset ---------- */
function medMediaSession() {
  const handlers = {};
  const ms = { metadata: null, playbackState: 'none', positions: [], setActionHandler: (a, f) => { handlers[a] = f; }, setPositionState: p => ms.positions.push(p) };
  const l = load({ storage: { shuffle: 'false' }, navigator: { onLine: true, mediaSession: ms }, extra: { MediaMetadata: class { constructor(o) { Object.assign(this, o); } } } });
  pickFolder(l.env, SANGER);
  return { l, ms, handlers };
}

test('Låseskjerm: tittel, mappe og ikon settes for hver sang, og spillestatus følger', async () => {
  const { l, ms } = medMediaSession();
  l.env.el('play').click(); await run(l.env);
  assert.equal(ms.metadata.title, 'sang 3');
  assert.equal(ms.metadata.artist, 'Musikk/Pop');
  assert.equal(ms.metadata.album, 'Lommespiller');
  assert.equal(ms.metadata.artwork[0].type, 'image/png');
  assert.equal(ms.playbackState, 'playing');
  l.audio.pause();
  assert.equal(ms.playbackState, 'paused');
});

test('Headset og låseskjerm: alle handlinger er koblet til riktig funksjon', async () => {
  const { l, ms, handlers } = medMediaSession();
  assert.deepEqual(Object.keys(handlers).sort(), ['nexttrack', 'pause', 'play', 'previoustrack', 'seekbackward', 'seekforward', 'seekto', 'stop']);
  handlers.play(); await run(l.env);
  assert.equal(l.audio.paused, false);
  handlers.nexttrack(); await run(l.env);
  assert.equal(l.audio.fileName, 'sang 10.mp3');
  handlers.pause(); assert.equal(l.audio.paused, true);
  handlers.play(); await run(l.env);
  handlers.stop(); assert.equal(l.audio.paused, true, 'stop pauser bare, så spilleren kan fortsette');
  l.audio.duration = 100; l.audio.currentTime = 50;
  handlers.seekto({ seekTime: 20 }); assert.equal(l.audio.currentTime, 20);
  handlers.seekforward({}); assert.equal(l.audio.currentTime, 30);
  handlers.seekforward({ seekOffset: 500 }); assert.equal(l.audio.currentTime, 100, 'stopper ved slutten');
  handlers.seekbackward({ seekOffset: 30 }); assert.equal(l.audio.currentTime, 70);
  handlers.seekbackward({ seekOffset: 500 }); assert.equal(l.audio.currentTime, 0);
  l.audio.currentTime = 3.5; l.audio.pause();
  handlers.previoustrack(); await run(l.env);
  assert.equal(l.audio.fileName, 'sang 10.mp3', 'forrige etter 3 s starter sangen på nytt');
  assert.ok(ms.positions.length > 0);
});

test('Posisjon til låseskjermen: rapporteres bare når lengden er et gyldig tall', async () => {
  const { l, ms } = medMediaSession();
  l.env.el('play').click(); await run(l.env);
  l.audio.dispatch('loadedmetadata');
  assert.equal(ms.positions.length, 0, 'NaN-lengde rapporteres ikke');
  l.audio.duration = Infinity; l.audio.dispatch('loadedmetadata');
  assert.equal(ms.positions.length, 0, 'uendelig lengde rapporteres ikke');
  l.audio.duration = 180; l.audio.currentTime = 500; l.audio.dispatch('loadedmetadata');
  assert.deepEqual(plain(ms.positions[0]), { duration: 180, playbackRate: 1, position: 180 });
});

test('Appen virker også i nettlesere uten Media Session', async () => {
  const l = ny();   // navigator uten mediaSession
  l.env.el('play').click(); await run(l.env);
  assert.equal(l.audio.paused, false);
});
