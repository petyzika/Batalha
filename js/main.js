/* ============================================================
   COMANDO GLOBAL — inicialização, tela-título e ciclo do jogo
   ============================================================ */
import { SAVE_KEY } from './data.js';
import {
  state, loadState, save, startTicker, activeBattle, setView, markIntroSeen
} from './state.js';
import {
  initAudio, setSound, setMusic
} from './audio.js';
import { IsoRenderer } from './iso.js';
import { WorldRenderer } from './world.js';
import { BattleScene } from './battle.js';
import { UI } from './ui.js';

const $ = (sel) => document.querySelector(sel);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ============================================================
   Cena cinematográfica da tela-título (canvas procedural)
   ============================================================ */
function rnd(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function ridgePath(rng, w, baseY, amp, step, bottom) {
  const pts = [[-20, bottom]];
  let x = -20;
  let y = baseY;
  while (x < w + 40) {
    y = baseY - rng() * amp - Math.sin(x * 0.011) * amp * 0.22;
    pts.push([x, y]);
    x += step * (0.55 + rng() * 0.9);
  }
  pts.push([w + 20, bottom]);
  return pts;
}

class TitleScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.bgCtx = this.bg.getContext('2d');
    this.fg = document.createElement('canvas');
    this.fgCtx = this.fg.getContext('2d');
    this.smokeSprite = this.makeSmokeSprite();
    this.running = false;
    this.t = 0;
    this._raf = 0;
    this._last = 0;
    this._lastPaint = 0;
    this.dpr = 1;
    this.w = 1;
    this.h = 1;
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas);
    this.resize();
  }

  makeSmokeSprite() {
    const size = 128;
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const g = cv.getContext('2d');
    const rad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    rad.addColorStop(0, 'rgba(50,50,48,1)');
    rad.addColorStop(0.5, 'rgba(36,40,42,.55)');
    rad.addColorStop(1, 'rgba(20,24,28,0)');
    g.fillStyle = rad;
    g.fillRect(0, 0, size, size);
    return cv;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width || window.innerWidth);
    const h = Math.max(1, rect.height || window.innerHeight);
    this.dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const pw = Math.round(w * this.dpr);
    const ph = Math.round(h * this.dpr);
    for (const cv of [this.canvas, this.bg, this.fg]) {
      cv.width = pw;
      cv.height = ph;
    }
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.bgCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.fgCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = w;
    this.h = h;
    this.layout();
  }

  withCtx(ctx, fn) {
    const prev = this.ctx;
    this.ctx = ctx;
    fn();
    this.ctx = prev;
  }

  layout() {
    const { w, h } = this;
    const rng = rnd(0x0c0d3a7);
    this.stars = Array.from({ length: Math.round(clamp(w / 8, 60, 190)) }, () => ({
      x: rng() * w,
      y: rng() * h * 0.56,
      r: 0.35 + rng() * 1.15,
      a: 0.18 + rng() * 0.7,
      tw: rng() * Math.PI * 2,
      speed: 0.35 + rng() * 1.4
    }));
    this.dust = Array.from({ length: Math.round(clamp(w / 22, 26, 72)) }, () => ({
      x: rng() * w,
      y: h * (0.5 + rng() * 0.55),
      r: 0.6 + rng() * 1.7,
      speed: 4 + rng() * 16,
      drift: (rng() - 0.5) * 14,
      a: 0.1 + rng() * 0.45,
      ph: rng() * Math.PI * 2
    }));
    this.embers = Array.from({ length: Math.round(clamp(w / 42, 12, 32)) }, () => ({
      x: rng() * w,
      y: h * (0.62 + rng() * 0.4),
      r: 0.7 + rng() * 1.8,
      speed: 12 + rng() * 32,
      drift: (rng() - 0.5) * 34,
      a: 0.25 + rng() * 0.55,
      ph: rng() * Math.PI * 2
    }));
    this.backRidge = ridgePath(rng, w, h * 0.628, h * 0.075, 34, h);
    this.midRidge = ridgePath(rng, w, h * 0.674, h * 0.052, 26, h);
    this.frontRidge = ridgePath(rng, w, h * 0.716, h * 0.032, 20, h);
    this.lights = Array.from({ length: Math.round(clamp(w / 40, 18, 54)) }, () => ({
      x: rng() * w,
      y: h * (0.695 + rng() * 0.025),
      a: 0.2 + rng() * 0.55,
      s: 0.7 + rng() * 1.2,
      ph: rng() * Math.PI * 2
    }));
    this.smokeSeeds = [0.16, 0.38, 0.72, 0.88].map((x, i) => ({
      x: w * x,
      y: h * (0.64 + (i % 2) * 0.03),
      w: 26 + (i % 3) * 16,
      drift: (i % 2 ? -1 : 1) * (5 + i * 2),
      ph: i * 1.7
    }));
    const planeRng = rnd(0x71a3);
    this.planes = [
      { y: 0.19, speed: 38, s: 1, d: 1 },
      { y: 0.3, speed: 25, s: 0.7, d: 1 },
      { y: 0.13, speed: 19, s: 0.55, d: -1 }
    ].map((p, i) => ({ ...p, ph: planeRng() * 1.4, blink: i * 1.7 }));
    this.twinkles = this.stars.filter((s, i) => i % 8 === 0);
    this.buildStatic();
  }

  buildStatic() {
    const { w, h } = this;

    // ---- camada de fundo -------------------------------------------
    this.withCtx(this.bgCtx, () => {
      const c = this.ctx;
      c.clearRect(0, 0, w, h);

      const sky = c.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#03060a');
      sky.addColorStop(0.34, '#071019');
      sky.addColorStop(0.58, '#101c29');
      sky.addColorStop(0.74, '#1d2630');
      sky.addColorStop(1, '#080b0f');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, h);

      // estrelas (estáticas; as cintilantes são desenhadas por cima)
      for (const s of this.stars) {
        c.globalAlpha = s.a * 0.8;
        c.fillStyle = '#d9ecff';
        c.beginPath();
        c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        c.fill();
        if (s.r > 1.1) {
          c.globalAlpha *= 0.28;
          c.fillRect(s.x - s.r * 3, s.y - 0.35, s.r * 6, 0.7);
          c.fillRect(s.x - 0.35, s.y - s.r * 3, 0.7, s.r * 6);
        }
      }
      c.globalAlpha = 1;

      const haze = c.createRadialGradient(w * 0.68, h * 0.69, 0, w * 0.68, h * 0.69, w * 0.7);
      haze.addColorStop(0, 'rgba(242,146,54,.24)');
      haze.addColorStop(0.32, 'rgba(206,96,34,.10)');
      haze.addColorStop(0.72, 'rgba(80,40,30,.03)');
      haze.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = haze;
      c.fillRect(0, h * 0.35, w, h * 0.65);

      const pcx = w * 0.5;
      const pcy = h * 1.55;
      const pr = h * 0.98;
      const planet = c.createLinearGradient(0, pcy - pr, 0, pcy);
      planet.addColorStop(0, '#1b2833');
      planet.addColorStop(0.35, '#101a23');
      planet.addColorStop(0.72, '#0a1219');
      planet.addColorStop(1, '#05080c');
      c.fillStyle = planet;
      c.beginPath();
      c.arc(pcx, pcy, pr, 0, Math.PI * 2);
      c.fill();

      c.save();
      c.beginPath();
      c.arc(pcx, pcy, pr, 0, Math.PI * 2);
      c.clip();
      c.globalAlpha = 0.28;
      c.strokeStyle = 'rgba(122,164,190,.22)';
      c.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const yy = h * 0.62 + i * h * 0.058;
        c.beginPath();
        c.moveTo(0, yy);
        for (let x = 0; x <= w; x += 40) {
          c.lineTo(x, yy + Math.sin(x * 0.006 + i * 1.3) * 4);
        }
        c.stroke();
      }
      c.globalAlpha = 1;
      c.restore();

      c.save();
      c.strokeStyle = 'rgba(255,178,82,.82)';
      c.lineWidth = 2.1;
      c.shadowColor = 'rgba(255,152,54,.65)';
      c.shadowBlur = 26;
      c.beginPath();
      c.arc(pcx, pcy, pr, Math.PI * 1.06, Math.PI * 1.94);
      c.stroke();
      c.restore();

      const rim = c.createLinearGradient(0, h * 0.6, 0, h * 0.8);
      rim.addColorStop(0, 'rgba(255,196,112,0)');
      rim.addColorStop(0.5, 'rgba(255,192,108,.10)');
      rim.addColorStop(1, 'rgba(255,180,92,0)');
      c.fillStyle = rim;
      c.fillRect(0, h * 0.6, w, h * 0.2);

      for (const [gx, gy, gr] of [[0.2, 0.655, 0.19], [0.52, 0.64, 0.3], [0.84, 0.665, 0.17]]) {
        const gg = c.createRadialGradient(w * gx, h * gy, 2, w * gx, h * gy, w * gr);
        gg.addColorStop(0, 'rgba(255,168,76,.16)');
        gg.addColorStop(0.45, 'rgba(232,118,44,.06)');
        gg.addColorStop(1, 'rgba(180,80,30,0)');
        c.fillStyle = gg;
        c.fillRect(0, h * 0.5, w, h * 0.25);
      }

      this.drawRidge(this.backRidge, '#1b2833', 'rgba(255,166,82,.34)', 0.85);
      this.drawRidge(this.midRidge, '#0c141c', 'rgba(210,128,62,.48)', 0.9);

      this.drawTower(w * 0.06, h * 0.70, h * 0.1, 0.55, true);
      this.drawTower(w * 0.93, h * 0.69, h * 0.14, 0.4, true);

      this.drawOutpost(w * 0.115, h * 0.79, Math.min(1.2, w / 1250), 0, 1, true);
      this.drawOutpost(w * 0.885, h * 0.80, Math.min(1.2, w / 1250), 0, -1, true);
      this.drawVehicle(w * 0.27, h * 0.845, 0.9, 0, 1, true);
      this.drawVehicle(w * 0.71, h * 0.858, 1.15, 0, -1, true);
    });

    // ---- camada de primeiro plano ---------------------------------
    this.withCtx(this.fgCtx, () => {
      const c = this.ctx;
      c.clearRect(0, 0, w, h);

      const ground = c.createLinearGradient(0, h * 0.72, 0, h);
      ground.addColorStop(0, 'rgba(6,9,12,.72)');
      ground.addColorStop(0.3, '#05080b');
      ground.addColorStop(1, '#020406');
      c.fillStyle = ground;
      c.fillRect(0, h * 0.735, w, h * 0.265);

      this.drawRidge(this.frontRidge, '#05080b', 'rgba(255,172,84,.38)', 1);
      this.drawRunway(w * 0.5, h * 0.958, w * 0.62, 0, true);

      c.save();
      c.globalAlpha = 0.10;
      c.strokeStyle = 'rgba(120,180,210,.5)';
      c.lineWidth = 1;
      const gy = h * 0.87;
      for (let i = 0; i < 9; i++) {
        const y = gy + i * i * 2.4;
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
      for (let i = -12; i <= 12; i++) {
        c.beginPath();
        c.moveTo(w / 2 + i * w * 0.055, gy);
        c.lineTo(w / 2 + i * w * 0.16, h);
        c.stroke();
      }
      c.restore();
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(80, now - this._last);
      this._last = now;
      this.t += dt;
      if (now - this._lastPaint >= 33) {
        this._lastPaint = now;
        this.draw(dt);
      }
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  draw(dt) {
    const c = this.ctx;
    const { w, h } = this;
    const t = this.t;
    c.clearRect(0, 0, w, h);
    c.drawImage(this.bg, 0, 0, w, h);

    // estrelas cintilantes (só um subconjunto; o resto está no fundo)
    for (const s of this.twinkles) {
      const tw = 0.55 + Math.sin(t * 0.0009 * s.speed + s.tw) * 0.45;
      c.globalAlpha = s.a * tw;
      c.fillStyle = '#e4f2ff';
      c.beginPath();
      c.arc(s.x, s.y, s.r * 1.15, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // luzes de cidades no limbo
    for (const l of this.lights) {
      const flick = 0.55 + Math.sin(t * 0.0016 + l.ph) * 0.45;
      c.globalAlpha = l.a * flick;
      c.fillStyle = '#ffbf6a';
      c.fillRect(l.x, l.y, l.s, l.s * 0.55);
    }
    c.globalAlpha = 1;

    // torres de rádio
    for (const [x, baseY, height, alpha] of [
      [w * 0.06, h * 0.70, h * 0.1, 0.55],
      [w * 0.93, h * 0.69, h * 0.14, 0.4]
    ]) {
      const blink = 0.35 + Math.sin(t * 0.003 + x) * 0.65;
      c.globalAlpha = alpha * blink;
      c.fillStyle = '#ff5c45';
      c.beginPath();
      c.arc(x, baseY - height - 2, 1.8, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // radares e luzes de alerta dos postos avançados
    for (const [x, y, s, dir] of [
      [w * 0.115, h * 0.79, Math.min(1.2, w / 1250), 1],
      [w * 0.885, h * 0.80, Math.min(1.2, w / 1250), -1]
    ]) {
      c.save();
      c.translate(x, y);
      c.scale(s * dir, s);
      c.strokeStyle = 'rgba(140,180,205,.22)';
      c.lineWidth = 1;
      c.save();
      c.translate(-20, -84);
      c.rotate(Math.sin(t * 0.0005) * 0.4 - 0.15);
      c.beginPath();
      c.ellipse(0, 0, 20, 7, 0, 0, Math.PI * 2);
      c.stroke();
      c.fillRect(-1, 0, 2, 10);
      c.restore();
      const blink = 0.25 + Math.sin(t * 0.0022 + x) * 0.55;
      c.globalAlpha = blink;
      c.fillStyle = '#ff6a48';
      c.beginPath();
      c.arc(8, -115, 2.4, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    c.globalAlpha = 1;

    // luzes dos veículos
    for (const [x, y, s, dir] of [
      [w * 0.27, h * 0.845, 0.9, 1],
      [w * 0.71, h * 0.858, 1.15, -1]
    ]) {
      const blink = 0.3 + Math.sin(t * 0.002 + y) * 0.7;
      c.globalAlpha = blink;
      c.fillStyle = '#ffb457';
      c.beginPath();
      c.arc(x + s * dir * -4, y - s * 50, 1.4 * s, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // fumaça de guerra (sprite pré-renderizado)
    for (const seed of this.smokeSeeds) {
      for (let i = 0; i < 13; i++) {
        const p = ((t * 0.000026 + i * 0.075 + seed.ph * 0.03) % 1);
        const r = seed.w * (0.35 + p * 2.6);
        const x = seed.x + Math.sin(p * 5 + seed.ph) * 18 + p * seed.drift * 12;
        const y = seed.y - p * h * 0.42;
        const a = (1 - p) * 0.20 * clamp(p * 9, 0, 1);
        c.globalAlpha = a;
        c.drawImage(this.smokeSprite, x - r, y - r, r * 2, r * 2);
      }
    }
    c.globalAlpha = 1;

    // holofotes varrendo o céu
    this.drawSearchlight(w * 0.12, h * 0.86, -0.5 + Math.sin(t * 0.00018) * 0.32, t);
    this.drawSearchlight(w * 0.88, h * 0.86, 0.5 + Math.sin(t * 0.00014 + 1.6) * 0.3, t);

    // aeronaves
    for (const p of this.planes) this.drawPlane(p, t);

    // primeiro plano em cache (solo, cordilheira, pista, grade)
    c.drawImage(this.fg, 0, 0, w, h);

    // pulsos da pista
    this.drawRunway(w * 0.5, h * 0.958, w * 0.62, t, false, true);

    // partículas / brasas
    for (const d of this.dust) {
      const y = (d.y - t * 0.001 * d.speed) % (h * 1.1);
      const yy = y < 0 ? y + h * 1.1 : y;
      c.globalAlpha = d.a * (0.45 + Math.sin(t * 0.001 + d.ph) * 0.35);
      c.fillStyle = '#b9d9ee';
      c.beginPath();
      c.arc((d.x + Math.sin(t * 0.0005 + d.ph) * 18 + t * 0.002 * d.drift) % w, yy, d.r, 0, Math.PI * 2);
      c.fill();
    }
    for (const e of this.embers) {
      const y = (e.y - t * 0.001 * e.speed) % (h * 0.9);
      const yy = y < h * 0.35 ? y + h * 0.9 : y;
      c.globalAlpha = e.a * (0.35 + Math.sin(t * 0.002 + e.ph) * 0.3);
      c.fillStyle = '#ff9d42';
      c.beginPath();
      c.arc((e.x + Math.sin(t * 0.0007 + e.ph) * 22 + t * 0.003 * e.drift) % w, yy, e.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // linha de varredura
    const scanY = (t * 0.028) % (h + 160) - 80;
    const scan = c.createLinearGradient(0, scanY - 60, 0, scanY + 60);
    scan.addColorStop(0, 'rgba(120,200,225,0)');
    scan.addColorStop(0.5, 'rgba(120,200,225,.028)');
    scan.addColorStop(1, 'rgba(120,200,225,0)');
    c.fillStyle = scan;
    c.fillRect(0, scanY - 60, w, 120);
  }

  drawRidge(pts, fill, stroke, strokeAlpha) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.save();
      c.globalAlpha = strokeAlpha;
      c.strokeStyle = stroke;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(pts[1][0], pts[1][1]);
      for (let i = 2; i < pts.length - 1; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
      c.restore();
    }
  }

  drawTower(x, baseY, height, alpha, staticOnly = false) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = '#0a1118';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x - 7, baseY);
    c.lineTo(x, baseY - height);
    c.lineTo(x + 7, baseY);
    c.stroke();
    if (!staticOnly) {
      c.lineWidth = 1;
      const blink = 0.35 + Math.sin(this.t * 0.003 + x) * 0.65;
      c.globalAlpha = alpha * blink;
      c.fillStyle = '#ff5c45';
      c.beginPath();
      c.arc(x, baseY - height - 2, 1.8, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  drawOutpost(x, y, s, t, dir, staticOnly = false) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.scale(s * dir, s);
    c.fillStyle = '#04070a';
    c.strokeStyle = 'rgba(140,180,205,.22)';
    c.lineWidth = 1;
    // torre de vigilância
    c.fillRect(-30, -52, 8, 52);
    c.fillRect(20, -52, 8, 52);
    c.fillRect(-34, -58, 36, 10);
    c.fillRect(-18, -68, 38, 10);
    c.strokeRect(-34, -78, 30, 10);
    // mastro
    c.beginPath();
    c.moveTo(8, -64);
    c.lineTo(8, -112);
    c.stroke();
    c.beginPath();
    c.moveTo(-8, -96);
    c.lineTo(8, -104);
    c.lineTo(24, -96);
    c.stroke();
    // radar girando
    if (!staticOnly) {
      c.save();
      c.translate(-20, -84);
      c.rotate(Math.sin(t * 0.0005) * 0.4 - 0.15);
      c.beginPath();
      c.ellipse(0, 0, 20, 7, 0, 0, Math.PI * 2);
      c.stroke();
      c.fillRect(-1, 0, 2, 10);
      c.restore();
    }
    // sacos e caixas
    c.fillRect(-52, -18, 22, 18);
    c.fillRect(-44, -28, 14, 10);
    c.fillRect(34, -22, 26, 22);
    // luz de alerta
    if (!staticOnly) {
      const blink = 0.25 + Math.sin(t * 0.0022 + x) * 0.55;
      c.globalAlpha = blink;
      c.fillStyle = '#ff6a48';
      c.beginPath();
      c.arc(8, -115, 2.4, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  drawVehicle(x, y, s, t, dir, staticOnly = false) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.scale(s * dir, s);
    c.fillStyle = '#030609';
    c.strokeStyle = 'rgba(120,160,185,.18)';
    c.lineWidth = 1;
    // esteiras
    c.fillRect(-42, -14, 84, 16);
    c.fillRect(-42, -5, 84, 7);
    for (let i = 0; i < 7; i++) c.fillRect(-38 + i * 12, -13, 2, 15);
    // casco
    c.beginPath();
    c.moveTo(-34, -14);
    c.lineTo(-26, -27);
    c.lineTo(18, -27);
    c.lineTo(34, -14);
    c.closePath();
    c.fill();
    // torre e canhão
    c.fillRect(-12, -36, 28, 10);
    c.fillRect(12, -33, 40, 3.2);
    c.fillRect(-22, -33, 8, 3);
    // antena
    c.beginPath();
    c.moveTo(-4, -36);
    c.lineTo(-4, -48);
    c.stroke();
    if (!staticOnly) {
      const blink = 0.3 + Math.sin(t * 0.002 + y) * 0.7;
      c.globalAlpha = blink;
      c.fillStyle = '#ffb457';
      c.beginPath();
      c.arc(-4, -50, 1.4, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  drawRunway(cx, y, width, t, staticOnly = false, pulsesOnly = false) {
    const c = this.ctx;
    c.save();
    if (!pulsesOnly) {
      c.globalAlpha = 0.55;
      c.strokeStyle = 'rgba(255,176,82,.16)';
      c.lineWidth = 1;
      for (let i = -1; i <= 1; i += 2) {
        c.beginPath();
        c.moveTo(cx + i * width * 0.22, y);
        c.lineTo(cx + i * width * 0.5, this.h);
        c.stroke();
      }
    }
    if (!staticOnly) {
      for (let i = 0; i < 8; i++) {
        const p = ((t * 0.00007 + i * 0.11) % 1);
        const yy = y + p * (this.h - y);
        c.globalAlpha = (1 - p) * 0.55;
        c.fillStyle = '#ffb45c';
        c.fillRect(cx - 1.5, yy, 3, 7 + p * 20);
      }
    }
    c.restore();
  }

  drawSearchlight(x, y, angle, t) {
    const c = this.ctx;
    const len = this.h * 0.9;
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    const g = c.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0, 'rgba(210,230,245,.12)');
    g.addColorStop(0.45, 'rgba(160,200,225,.045)');
    g.addColorStop(1, 'rgba(140,190,220,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-4, 0);
    c.lineTo(-len * 0.16, -len);
    c.lineTo(len * 0.16, -len);
    c.lineTo(4, 0);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(220,240,255,.4)';
    c.beginPath();
    c.arc(0, 0, 2.4, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  drawPlane(p, t) {
    const c = this.ctx;
    const { w, h } = this;
    const span = w * 1.45;
    const travel = ((t * 0.001 * p.speed + p.ph * span) % span + span) % span;
    const x = p.d > 0 ? travel - w * 0.25 : w * 1.2 - travel;
    const y = h * p.y + Math.sin(t * 0.0002 + p.ph) * 3;
    c.save();
    c.translate(x, y);
    c.scale(p.s * p.d, p.s);
    const alpha = 0.5;
    c.globalAlpha = alpha;
    c.fillStyle = '#111a22';
    c.beginPath();
    c.moveTo(-18, 0);
    c.lineTo(8, -2.2);
    c.lineTo(18, 0);
    c.lineTo(8, 2.2);
    c.closePath();
    c.fill();
    c.fillRect(-5, -1, 14, 2);
    c.beginPath();
    c.moveTo(-5, 0);
    c.lineTo(-14, -9);
    c.lineTo(-9, -9);
    c.lineTo(1, 0);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(-5, 0);
    c.lineTo(-14, 9);
    c.lineTo(-9, 9);
    c.lineTo(1, 0);
    c.closePath();
    c.fill();
    // rastro
    const trail = c.createLinearGradient(-80, 0, -12, 0);
    trail.addColorStop(0, 'rgba(180,205,220,0)');
    trail.addColorStop(1, 'rgba(180,205,220,.10)');
    c.fillStyle = trail;
    c.fillRect(-86, -1, 74, 2);
    // luz de navegação
    const blink = Math.sin(t * 0.003 + p.blink) > 0.3 ? 1 : 0.12;
    c.globalAlpha = blink;
    c.fillStyle = '#ff3b2f';
    c.beginPath();
    c.arc(-13, -8, 1.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#4fe0a0';
    c.beginPath();
    c.arc(-13, 8, 1.5, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

/* ============================================================
   Boot
   ============================================================ */
loadState();

const titleScreen = $('#title-screen');
const game = $('#game');
const startBtn = $('#btn-start');
const titleScene = new TitleScene($('#title-canvas'));
titleScene.start();

// mensagem de progresso / botão de continuar
try {
  const hasSave = !!localStorage.getItem(SAVE_KEY);
  if (hasSave) {
    const label = $('#start-label');
    if (label) label.textContent = 'CONTINUAR CAMPANHA';
    const hint = $('#title-save');
    if (hint) hint.innerHTML = '<svg class="ico"><use href="#i-shield"/></svg> Progresso encontrado · retome o comando';
  }
} catch { /* armazenamento indisponível */ }

// contador "online" decorativo
const onlineEl = $('#title-players');
if (onlineEl) {
  let online = 12847;
  setInterval(() => {
    online += Math.round((Math.random() - 0.42) * 24);
    onlineEl.textContent = online.toLocaleString('pt-BR');
  }, 5200);
}

const iso = new IsoRenderer($('#base-canvas'));
const world = new WorldRenderer($('#world-canvas'), $('#world-markers'));
let ui = null;
const battle = new BattleScene($('#battle-root'), {
  onFinish(outcome) { if (ui) ui.battleFinished(outcome); }
});

function bootGame() {
  if (ui) return;
  ui = new UI({ iso, world, battle });
  ui.renderAll();
  const validViews = ['base', 'world', 'army', 'research', 'campaign', 'hero', 'alliance'];
  const view = validViews.includes(state.view) ? state.view : 'base';
  if (!validViews.includes(state.view)) state.view = 'base';
  ui.applyView(view);
  startTicker();

  window.addEventListener('beforeunload', () => save(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save(true);
  });

  // retoma batalhas que chegaram enquanto o jogador estava fora
  const pending = activeBattle();
  if (pending) setTimeout(() => ui.openBattle(pending), 1100);
}

startBtn?.addEventListener('click', () => {
  if (startBtn.disabled) return;
  startBtn.disabled = true;
  initAudio();
  setSound(state.settings.sound);
  setMusic(state.settings.music);
  markIntroSeen();

  game.hidden = false;
  requestAnimationFrame(() => {
    game.classList.add('ready');
    bootGame();
  });

  titleScreen.classList.add('leaving');
  setTimeout(() => {
    titleScreen.hidden = true;
    titleScene.stop();
  }, 760);
});

// demo/captura automatizada: entra direto no jogo (visitantes veem o título)
try {
  const auto = navigator.webdriver === true || new URLSearchParams(location.search).has('autostart');
  if (auto) setTimeout(() => startBtn?.click(), 80);
} catch { /* ambiente sem navigator */ }

// rede de segurança: se o navegador restaurar a página com o jogo visível
if (!titleScreen || titleScreen.hidden) bootGame();

// atalhos de navegação
document.addEventListener('keydown', (e) => {
  if (!ui || e.target.matches('input, textarea, select')) return;
  if (e.key === 'Escape') {
    if ($('#modal-root .modal')) return; // UI fecha o modal
    if (document.body.dataset.view === 'world') setView('base');
    return;
  }
  const map = { '1': 'base', '2': 'world', '3': 'army', '4': 'research', '5': 'hero', '6': 'campaign', '7': 'alliance' };
  if (map[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) setView(map[e.key]);
});
