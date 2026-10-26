'use strict';
const path = require('node:path');
const { loadApp, FakeElement } = require('./harness');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'app', 'index.html');
const NAMES = [
  'VERSION', 'IS_WEB', 'AUDIO_EXT', 'audioFiles', 'folderOf', 'rootName', 'niceName', 'fmt', 'store', 'recall', 'status',
  'tracks', 'order', 'pos', 'shuffleOn', 'errorsInRow', 'curUrl', 'folderName',
  'buildOrder', 'loadAt', 'skipAfterError', 'play', 'pause', 'toggle', 'next', 'prev', 'stop', 'showInstall',
];

/* Simulert lydelement. `fail(filnavn)` kan returnere et feilnavn som play() avviser med. */
class FakeAudio extends FakeElement {
  constructor() {
    super('audio');
    this.paused = true; this.currentTime = 0; this.duration = NaN; this.playbackRate = 1;
    this.playLog = []; this.fail = () => null; this.env = null;
  }
  get src() { return this._attrs.get('src') || ''; }
  set src(v) { this._attrs.set('src', v); this.currentTime = 0; this.duration = NaN; }
  get fileName() { const f = this.env.blobs.get(this.src); return f ? f.name : null; }
  play() {
    const name = this.fileName;
    this.playLog.push(name);
    const err = this.fail(name);
    if (err) return Promise.reject(Object.assign(new Error(err), { name: err }));
    this.paused = false; this.dispatch('play'); this.dispatch('playing');
    return Promise.resolve();
  }
  pause() { if (!this.paused) { this.paused = true; this.dispatch('pause'); } }
  load() {}
}

function file(rel, type = '') {
  const parts = rel.split('/');
  return { name: parts[parts.length - 1], webkitRelativePath: parts.length > 1 ? rel : '', type };
}

function load(opts = {}) {
  let audio;
  const app = loadApp(HTML, NAMES, {
    ...opts,
    prepare: env => {
      audio = env.setEl('audio', new FakeAudio()); audio.env = env;
      env.setEl('dir', new FakeElement('dir')).webkitdirectory = true;
      // nye <input>-elementer støtter mappevalg, som i Chrome (slås av med mappevalg: false)
      const lag = env.document.createElement;
      env.document.createElement = tag => { const e = lag(tag); if (tag === 'input' && opts.mappevalg !== false) e.webkitdirectory = true; return e; };
      if (opts.prepare) opts.prepare(env);
    },
  });
  return { ...app, audio };
}

const flush = () => new Promise(r => setImmediate(r));
/* Slipp løftene til du har ventet, og la den simulerte klokken gå videre */
async function run(env, ms = 0) { await flush(); if (ms) env.advance(ms); await flush(); }
const plain = x => JSON.parse(JSON.stringify(x));

/* Velg en mappe i appen. files: relative stier som «Mappe/Album/sang.mp3» */
function pickFolder(env, files) {
  const dir = env.el('dir');
  dir.files = files.map(f => (typeof f === 'string' ? file(f) : f));
  dir.dispatch('change');
}

module.exports = { load, run, flush, plain, pickFolder, file, FakeAudio, HTML, ROOT };
