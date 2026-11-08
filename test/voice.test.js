'use strict';
/* Talestemme (1.7.0): myk damestemme sier «Pause», «Resume» og «Next» når du trykker på headsettet.
   Fra 1.9.0 ferdige lydklipp i appen (telefonens talesyntese feilet med låst skjerm). Regler:
   - Bare kommandoer fra headset/låseskjerm får stemme, ikke knappene i appen
   - Musikk og stemme overlapper aldri: Pause pauser først og snakker så; Resume og Next snakker først
   - Kommandoen utføres alltid: når klippet er ferdig, ved feil, eller etter maks 2 s
   - Stemmen kan slås av, og virker hver gang, ikke bare første gang */
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, run, pickFolder } = require('./load');

const SANGER = ['Musikk/a.mp3', 'Musikk/b.mp3', 'Musikk/c.mp3'];
/* Simulert stemmeklipp. modus: 'end' = ferdig etter 0,6 s, 'error' = nektes av telefonen, 'stille' = svarer aldri */
function ny(opts = {}) {
  const handlers = {};
  const ms = { metadata: null, playbackState: 'none', setActionHandler: (a, f) => { handlers[a] = f; }, setPositionState() {} };
  const l = load({
    storage: { shuffle: 'false', ...(opts.storage || {}) },
    navigator: { onLine: true, mediaSession: ms },
    extra: { MediaMetadata: class { constructor(o) { Object.assign(this, o); } } },
  });
  const v = l.env.el('voiceAudio');
  const stemme = { said: [], modus: opts.modus || 'end' };
  v.play = function () {
    const ord = Object.keys(l.api.CLIPS).find(k => l.api.CLIPS[k] === this.src);
    stemme.said.push(ord);
    if (stemme.modus === 'error') return Promise.reject(Object.assign(new Error('nektet'), { name: 'NotAllowedError' }));
    if (stemme.modus === 'end') l.env.sandbox.setTimeout(() => { this.onended && this.onended(); }, 600);
    return Promise.resolve();
  };
  pickFolder(l.env, SANGER);
  return { ...l, handlers, stemme };
}
const sagt = l => l.stemme.said;
const spilt = l => l.audio.fileName;

/* ---------- kommandoer fra headsettet ---------- */
test('Pause fra headset: musikken stopper med en gang, så sier stemmen «Pause»', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.pause();
  assert.equal(l.audio.paused, true, 'pauser før stemmen snakker');
  assert.deepEqual(sagt(l), ['pause']);
});

test('Resume fra headset: stemmen sier «Resume» først, musikken starter når den er ferdig', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.pause(); await run(l.env, 1000);
  l.handlers.play(); await run(l.env);
  assert.deepEqual(sagt(l), ['pause', 'resume']);
  assert.equal(l.audio.paused, true, 'ingen musikk mens stemmen snakker');
  await run(l.env, 700);
  assert.equal(l.audio.paused, false);
  assert.equal(spilt(l), 'a.mp3', 'samme sang fortsetter');
});

test('Første start fra headset sier «Play»', async () => {
  const l = ny();
  l.handlers.play(); await run(l.env, 700);
  assert.deepEqual(sagt(l), ['play']);
  assert.equal(l.audio.paused, false);
});

test('Next fra headset: musikken stopper, stemmen sier «Next», så starter neste sang', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.nexttrack(); await run(l.env);
  assert.equal(l.audio.paused, true, 'ingen musikk mens stemmen snakker');
  assert.deepEqual(sagt(l), ['next']);
  await run(l.env, 700);
  assert.equal(spilt(l), 'b.mp3');
  assert.equal(l.audio.paused, false);
});

test('Stemmens pause før Next regnes ikke som Android-pause', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.nexttrack(); await run(l.env, 3000);
  assert.ok(!l.api.logg.some(e => e.msg.startsWith('Stoppet av Android')));
  assert.equal(spilt(l), 'b.mp3');
});

test('Play fra headset mens musikken spiller gir ingen stemme', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.play(); await run(l.env, 700);
  assert.deepEqual(sagt(l), []);
});

test('Pause fra headset når musikken alt er pauset gir ingen stemme', async () => {
  const l = ny();
  l.handlers.pause();
  assert.deepEqual(sagt(l), []);
});

test('Knappene i appen gir ingen stemme', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.env.el('next').click(); await run(l.env);
  l.env.el('play').click(); await run(l.env);
  assert.deepEqual(sagt(l), []);
});

/* ---------- kommandoen utføres alltid ---------- */
test('Svarer ikke stemmen, utføres kommandoen likevel etter 2 s', async () => {
  const l = ny({ modus: 'stille' });
  l.env.el('play').click(); await run(l.env);
  l.handlers.nexttrack(); await run(l.env, 1900);
  assert.equal(spilt(l), 'a.mp3');
  await run(l.env, 200);
  assert.equal(spilt(l), 'b.mp3');
  assert.equal(l.audio.paused, false);
});

test('Feiler stemmen, utføres kommandoen med en gang og feilen logges', async () => {
  const l = ny({ modus: 'error' });
  l.env.el('play').click(); await run(l.env);
  l.handlers.nexttrack(); await run(l.env, 10);
  assert.equal(spilt(l), 'b.mp3');
  assert.ok(l.api.logg.some(e => e.msg === 'Stemme feilet (NotAllowedError)'));
});

test('To raske Next etter hverandre hopper to sanger, i riktig rekkefølge', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.nexttrack(); await run(l.env, 100);
  l.handlers.nexttrack(); await run(l.env, 700);
  assert.equal(spilt(l), 'c.mp3');
  assert.equal(l.audio.paused, false);
  assert.ok(!l.api.logg.some(e => e.msg.startsWith('Stemme feilet')), 'avbrutt stemme er ikke en feil');
});

test('Pause rett etter Resume: musikken ender på pause', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.pause(); await run(l.env, 1000);
  l.handlers.play(); await run(l.env, 100);
  l.handlers.pause(); await run(l.env, 2000);
  assert.equal(l.audio.paused, true);
  assert.equal(sagt(l)[sagt(l).length - 1], 'pause');
});

test('Stemmen virker hver gang, også etter mange kommandoer (ikke bare første gang)', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  for (let i = 0; i < 10; i++) { l.handlers.nexttrack(); await run(l.env, 700); }
  assert.equal(sagt(l).length, 10);
  assert.ok(sagt(l).every(o => o === 'next'));
  assert.ok(!l.api.logg.some(e => e.msg.startsWith('Stemme feilet')));
});

test('Hvert klipp finnes som innebygd lyd (ingen avhengighet av telefonens talesyntese)', () => {
  const l = ny();
  for (const o of ['pause', 'resume', 'next', 'play']) assert.match(l.api.CLIPS[o], /^data:audio\/mpeg;base64,.{1000,}/, o);
  assert.equal(l.env.el('voiceBox').classList.contains('hidden'), false);
});

test('«Test stemme» sier «Resume»', () => {
  const l = ny();
  l.env.el('voiceTest').click();
  assert.deepEqual(sagt(l), ['resume']);
});

test('Stemmen kan slås av, valget huskes, og da utføres kommandoer med en gang', async () => {
  const l = ny();
  assert.equal(l.env.el('voiceOn').getAttribute('aria-pressed'), 'true', 'på som standard');
  l.env.el('voiceOn').click();
  assert.equal(l.env.el('voiceOn').getAttribute('aria-pressed'), 'false');
  assert.equal(l.env.storage.get('voice'), 'false');
  l.env.el('play').click(); await run(l.env);
  l.handlers.nexttrack(); await run(l.env);
  assert.equal(spilt(l), 'b.mp3');
  assert.deepEqual(sagt(l), []);
  const igjen = ny({ storage: { voice: 'false' } });
  assert.equal(igjen.env.el('voiceOn').getAttribute('aria-pressed'), 'false');
});

/* ---------- 1.9.1: stemmen skal ikke ta over mediakontrollene ---------- */
test('Med Web Audio spilles klippet uten det ekstra lydelementet, og Resume virker etter Pause', async () => {
  const kilder = []; let klokke;
  class Ctx {
    constructor() { this.state = 'running'; this.destination = {}; }
    resume() { return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({ dur: 1 }); }
    createBufferSource() { const s = { connect() {}, stop() {}, start: () => { kilder.push(s); klokke(() => s.onended && s.onended(), 500); } }; return s; }
  }
  const handlers = {};
  const ms = { metadata: null, playbackState: 'none', setActionHandler: (a, f) => { handlers[a] = f; }, setPositionState() {} };
  const l = load({ storage: { shuffle: 'false' }, navigator: { onLine: true, mediaSession: ms },
    extra: { AudioContext: Ctx, atob, MediaMetadata: class {} } });
  klokke = l.env.sandbox.setTimeout;
  pickFolder(l.env, SANGER);
  let voiceBrukt = 0; l.env.el('voiceAudio').play = () => { voiceBrukt++; return Promise.resolve(); };
  l.env.document.dispatch('click'); await run(l.env);          // første trykk gjør klippene klare
  l.env.el('play').click(); await run(l.env);
  handlers.pause(); await run(l.env, 700);
  handlers.play(); await run(l.env, 700);
  assert.equal(kilder.length, 2, 'Pause og Resume sagt via Web Audio');
  assert.equal(voiceBrukt, 0, 'lydelementet røres ikke');
  assert.equal(l.audio.paused, false, 'musikken fortsatte');
  assert.ok(l.api.logg.some(e => e.msg === 'Headset: spill-kommando mottatt'));
});
