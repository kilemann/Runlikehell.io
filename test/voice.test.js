'use strict';
/* Talestemme (1.7.0): myk damestemme sier «Pause», «Resume» og «Next» når du trykker på headsettet.
   Bruker telefonens egen talesyntese (speechSynthesis). Regler:
   - Bare kommandoer fra headset/låseskjerm får stemme, ikke knappene i appen
   - Musikk og stemme overlapper aldri: Pause pauser først og snakker så; Resume og Next snakker først
   - Kommandoen utføres alltid: når stemmen er ferdig, ved feil, eller etter maks 1,5 s
   - Engelsk damestemme velges automatisk, men kan velges selv, og stemmen kan slås av */
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, run, pickFolder } = require('./load');

const SANGER = ['Musikk/a.mp3', 'Musikk/b.mp3', 'Musikk/c.mp3'];
const STEMMER = [
  { name: 'Deutsch', lang: 'de-DE', default: true },
  { name: 'English United States', lang: 'en-US' },
  { name: 'Google UK English Female', lang: 'en-GB' },
  { name: 'Google UK English Male', lang: 'en-GB' },
  { name: 'Norsk', lang: 'nb-NO' },
];

function fakeSynth(stemmer = STEMMER) {
  const s = { said: [], cancelled: 0, voices: stemmer, auto: 'end', _ls: {} };
  s.getVoices = () => s.voices;
  s.cancel = () => { s.cancelled++; const u = s.current; s.current = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); };
  s.speak = u => {
    s.said.push(u); s.current = u;
    // 'end': ferdig etter 0,6 s, 'error': feiler med en gang, 'stille': svarer aldri
    if (s.auto === 'error' && u.onerror) s.setTimeout(() => u.onerror({ error: 'not-allowed' }), 0);
    if (s.auto === 'end') s.setTimeout(() => { if (s.current === u) { s.current = null; u.onend && u.onend({}); } }, 600);
  };
  s.addEventListener = (t, f) => { s._ls[t] = f; };
  return s;
}

function ny(opts = {}) {
  const handlers = {};
  const ms = { metadata: null, playbackState: 'none', setActionHandler: (a, f) => { handlers[a] = f; }, setPositionState() {} };
  const synth = opts.synth === null ? undefined : (opts.synth || fakeSynth());
  const l = load({
    storage: { shuffle: 'false', ...(opts.storage || {}) },
    navigator: { onLine: true, mediaSession: ms },
    extra: {
      MediaMetadata: class { constructor(o) { Object.assign(this, o); } },
      ...(synth ? { speechSynthesis: synth, SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } } } : {}),
    },
  });
  if (synth) synth.setTimeout = l.env.sandbox.setTimeout;   // stemmen følger testklokka
  pickFolder(l.env, SANGER);
  return { ...l, handlers, synth };
}
const sagt = l => l.synth.said.map(u => u.text);
const spilt = l => l.audio.fileName;

/* ---------- kommandoer fra headsettet ---------- */
test('Pause fra headset: musikken stopper med en gang, så sier stemmen «Pause»', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.pause();
  assert.equal(l.audio.paused, true, 'pauser før stemmen snakker');
  assert.deepEqual(sagt(l), ['Pause']);
});

test('Resume fra headset: stemmen sier «Resume» først, musikken starter når den er ferdig', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.pause(); await run(l.env, 1000);
  l.handlers.play(); await run(l.env);
  assert.deepEqual(sagt(l), ['Pause', 'Resume']);
  assert.equal(l.audio.paused, true, 'ingen musikk mens stemmen snakker');
  await run(l.env, 700);
  assert.equal(l.audio.paused, false);
  assert.equal(spilt(l), 'a.mp3', 'samme sang fortsetter');
});

test('Første start fra headset sier «Play»', async () => {
  const l = ny();
  l.handlers.play(); await run(l.env, 700);
  assert.deepEqual(sagt(l), ['Play']);
  assert.equal(l.audio.paused, false);
});

test('Next fra headset: musikken stopper, stemmen sier «Next», så starter neste sang', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.nexttrack(); await run(l.env);
  assert.equal(l.audio.paused, true, 'ingen musikk mens stemmen snakker');
  assert.deepEqual(sagt(l), ['Next']);
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
test('Svarer ikke stemmen, utføres kommandoen likevel etter 1,5 s', async () => {
  const synth = fakeSynth(); synth.auto = 'stille';
  const l = ny({ synth });
  l.env.el('play').click(); await run(l.env);
  l.handlers.nexttrack(); await run(l.env, 1400);
  assert.equal(spilt(l), 'a.mp3');
  await run(l.env, 200);
  assert.equal(spilt(l), 'b.mp3');
  assert.equal(l.audio.paused, false);
});

test('Feiler stemmen, utføres kommandoen med en gang og feilen logges', async () => {
  const synth = fakeSynth(); synth.auto = 'error';
  const l = ny({ synth });
  l.env.el('play').click(); await run(l.env);
  l.handlers.nexttrack(); await run(l.env, 10);
  assert.equal(spilt(l), 'b.mp3');
  assert.ok(l.api.logg.some(e => e.msg === 'Stemme feilet (not-allowed)'));
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
  assert.equal(sagt(l)[sagt(l).length - 1], 'Pause');
});

test('Uten talesyntese i nettleseren virker headsettet som før, uten forsinkelse', async () => {
  const l = ny({ synth: null });
  l.env.el('play').click(); await run(l.env);
  l.handlers.nexttrack(); await run(l.env);
  assert.equal(spilt(l), 'b.mp3');
  assert.equal(l.env.el('voiceBox').classList.contains('hidden'), true, 'stemmeinnstillinger skjules');
});

/* ---------- valg av stemme ---------- */
test('Engelsk damestemme velges automatisk, med rolig tempo', async () => {
  const l = ny();
  l.env.el('play').click(); await run(l.env);
  l.handlers.pause();
  const u = l.synth.said[0];
  assert.equal(u.voice.name, 'Google UK English Female');
  assert.equal(u.lang, 'en-GB');
  assert.ok(u.rate < 1, 'litt roligere enn normalt');
});

test('Uten kjent damestemme brukes første engelske stemme', async () => {
  const l = ny({ synth: fakeSynth([{ name: 'Deutsch', lang: 'de-DE' }, { name: 'English United States', lang: 'en-US' }]) });
  l.env.el('play').click(); await run(l.env);
  l.handlers.pause();
  assert.equal(l.synth.said[0].voice.name, 'English United States');
});

test('Uten engelske stemmer snakker den likevel med språk en-US', async () => {
  const l = ny({ synth: fakeSynth([{ name: 'Norsk', lang: 'nb-NO' }]) });
  l.env.el('play').click(); await run(l.env);
  l.handlers.pause();
  assert.equal(l.synth.said[0].lang, 'en-US');
});

test('Stemmelista viser engelske stemmer, og valgt stemme brukes og huskes', async () => {
  const l = ny();
  const html = l.env.el('voiceSel').innerHTML;
  assert.ok(html.includes('Google UK English Male'));
  assert.ok(!html.includes('Deutsch'));
  l.env.el('voiceSel').value = 'Google UK English Male';
  l.env.el('voiceSel').dispatch('change');
  assert.equal(l.env.storage.get('voiceName'), JSON.stringify('Google UK English Male'));
  l.env.el('play').click(); await run(l.env);
  l.handlers.pause();
  assert.equal(l.synth.said[0].voice.name, 'Google UK English Male');
});

test('Stemmelista oppdateres når telefonen har lastet inn stemmene', () => {
  const synth = fakeSynth([]);
  const l = ny({ synth });
  synth.voices = STEMMER;
  synth._ls.voiceschanged();
  assert.ok(l.env.el('voiceSel').innerHTML.includes('Google UK English Female'));
});

test('«Test stemme» sier «Resume»', () => {
  const l = ny();
  l.env.el('voiceTest').click();
  assert.deepEqual(sagt(l), ['Resume']);
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
