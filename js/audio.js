/* ============================================================
   Áudio procedural — sem arquivos externos
   ============================================================ */
import { state } from './state.js';

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let ambient = null;
let battleDrone = null;
let noiseBuffer = null;
let started = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.62;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.00;
  musicBus.connect(master);
  noiseBuffer = makeNoise(2.2);
  return ctx;
}

function makeNoise(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function env(node, t, a, d, peak = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  node.connect(g);
  g.connect(sfxBus);
  return { g, stop: t + a + d + 0.02 };
}

function tone(freq, dur, type = 'sine', peak = 0.16, slide = null, delay = 0) {
  if (!ensure() || !state.settings.sound) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  const { stop } = env(o, t, 0.006, dur, peak);
  o.start(t);
  o.stop(stop);
}

function noiseBurst(dur = 0.4, freq = 900, peak = 0.28, type = 'lowpass', delay = 0) {
  if (!ensure() || !state.settings.sound) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.18), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t); src.stop(t + dur + 0.02);
}

export function initAudio() {
  if (started) { if (ctx?.state === 'suspended') ctx.resume(); return; }
  if (!ensure()) return;
  started = true;
  if (ctx.state === 'suspended') ctx.resume();
  startAmbient();
}

export function click() { tone(520, 0.045, 'square', 0.05, 420); }
export function open() { tone(320, 0.09, 'sine', 0.08, 520); }
export function close() { tone(420, 0.07, 'sine', 0.06, 280); }
export function success() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.28, 'triangle', 0.10, null, i * 0.075));
}
export function error() { tone(150, 0.16, 'sawtooth', 0.1, 90); tone(120, 0.2, 'square', 0.05, 70, 0.02); }
export function coin() { tone(1046, 0.07, 'triangle', 0.1); tone(1318, 0.12, 'triangle', 0.08, null, 0.05); }
export function buildStart() { noiseBurst(0.35, 700, 0.16); tone(220, 0.25, 'sawtooth', 0.07, 180); }
export function buildDone() {
  [392, 523, 659].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, null, i * 0.08));
  noiseBurst(0.25, 500, 0.12);
}
export function march() { tone(140, 0.5, 'sawtooth', 0.07, 220); noiseBurst(0.5, 400, 0.1); }
export function battleStart() {
  noiseBurst(0.7, 2400, 0.25);
  tone(65, 0.9, 'sawtooth', 0.12, 40);
  [0, 0.12, 0.24].forEach((d, i) => tone(880 - i * 120, 0.1, 'square', 0.05, null, d));
}
export function explosion() {
  if (!ensure() || !state.settings.sound) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(1800, t);
  f.frequency.exponentialRampToValueAtTime(60, t + 0.9);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.42, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t); src.stop(t + 1.05);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.3, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  o.connect(og); og.connect(sfxBus);
  o.start(t); o.stop(t + 0.6);
}
export function gunfire() {
  if (!ensure() || !state.settings.sound) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 4; i++) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1400;
    const g = ctx.createGain();
    const tt = t + i * 0.075 + Math.random() * 0.03;
    g.gain.setValueAtTime(0.0001, tt);
    g.gain.exponentialRampToValueAtTime(0.1, tt + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(tt); src.stop(tt + 0.1);
  }
}
export function victory() {
  const notes = [392, 523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone(f, 0.55, 'triangle', 0.12, null, i * 0.11));
  tone(1567.98, 0.8, 'triangle', 0.1, null, 0.62);
  noiseBurst(1.2, 3000, 0.06);
}
export function defeat() {
  [220, 196, 174.61, 146.83].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.12, f * 0.94, i * 0.14));
  noiseBurst(1.4, 500, 0.1);
}
export function levelUp() {
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, null, i * 0.06));
}
export function alarm() { tone(880, 0.12, 'square', 0.06); tone(880, 0.12, 'square', 0.06, null, 0.18); }

/* ---------------- ambient music ---------------- */
function startAmbient() {
  if (!ctx || ambient) return;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(musicBus);
  const freqs = [55, 82.41, 110, 164.81];
  const oscs = freqs.map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? 'triangle' : 'sine';
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 4;
    const og = ctx.createGain();
    og.gain.value = 0.1 - i * 0.012;
    o.connect(og); og.connect(g);
    o.start();
    return o;
  });
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.055;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.045;
  lfo.connect(lfoGain); lfoGain.connect(g.gain);
  lfo.start();
  ambient = { g, oscs, lfo };
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.linearRampToValueAtTime(state.settings.music ? 0.42 : 0, ctx.currentTime + 3);
}

export function setMusic(on) {
  if (!ensure()) return;
  if (!ambient) startAmbient();
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.linearRampToValueAtTime(on ? 0.42 : 0, t + 1.2);
}

export function setSound(on) {
  if (!ensure()) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.linearRampToValueAtTime(on ? 0.7 : 0.0, ctx.currentTime + 0.2);
}

export function startBattleAmbience() {
  if (!ensure() || battleDrone) return;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(musicBus);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = 48;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 180;
  o.connect(f); f.connect(g);
  o.start();
  const t = ctx.currentTime;
  g.gain.linearRampToValueAtTime(0.5, t + 0.8);
  battleDrone = { g, o };
}

export function stopBattleAmbience() {
  if (!battleDrone || !ctx) return;
  const t = ctx.currentTime;
  battleDrone.g.gain.cancelScheduledValues(t);
  battleDrone.g.gain.linearRampToValueAtTime(0, t + 0.8);
  const o = battleDrone.o;
  setTimeout(() => { try { o.stop(); } catch { /* noop */ } }, 1000);
  battleDrone = null;
}
