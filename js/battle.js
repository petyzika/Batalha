/* ============================================================
   Cena de batalha animada — COMANDO GLOBAL
   ============================================================ */
import { UNIT_DEFS, HERO_BY_KEY, FACTION_COLORS, fmt, clamp } from './data.js';
import { state } from './state.js';
import {
  battleStart, gunfire, explosion, victory, defeat,
  startBattleAmbience, stopBattleAmbience
} from './audio.js';

const DURATION = 7600;

function rnd(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class BattleScene {
  constructor(root, opts = {}) {
    this.root = root;
    this.onFinish = opts.onFinish || (() => {});
    this.active = false;
    this.resultShown = false;
    this.done = false;
    this.outcome = null;
    this.units = [];
    this.tracers = [];
    this.explosions = [];
    this.sparks = [];
    this.shake = 0;
    this.t = 0;
    this._raf = 0;
    this._last = 0;
    this._nextTrace = 0;
    this._nextBoom = 0;
    this._nextGun = 0;
    this._resize = () => this.resize();
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-b-action]');
      if (!btn) return;
      const act = btn.dataset.bAction;
      if (act === 'skip') this.showResult();
      if (act === 'continue') this.finish();
    });
  }

  play(outcome) {
    this.outcome = outcome;
    this.resultShown = false;
    this.done = false;
    this.active = true;
    this.t = 0;
    this.units = [];
    this.tracers = [];
    this.explosions = [];
    this.sparks = [];
    this.shake = 0;
    this._nextTrace = 0;
    this._nextBoom = 900;
    this._nextGun = 200;
    this.root.hidden = false;
    const hero = HERO_BY_KEY[state.activeHero] || HERO_BY_KEY.valkyrie;
    const factionColor = FACTION_COLORS[outcome.faction] || '#e3594c';
    this.root.innerHTML = `
      <div class="battle" style="--enemy:${factionColor}">
        <canvas id="battle-canvas" aria-label="Campo de batalha"></canvas>
        <div class="battle-vignette"></div>
        <div class="battle-top">
          <div class="battle-side">
            <small>FORÇA DE ATAQUE · ${hero.name}</small>
            <b>${state.player.name}</b>
            <div class="bp"><svg class="ico"><use href="#i-sword"/></svg> ${fmt(outcome.atk)} PODER</div>
            <div class="battle-bar"><i id="b-bar-player"></i></div>
          </div>
          <div class="battle-center">
            <div class="bt-phase" id="b-phase">RECONHECIMENTO</div>
            <div class="bt-timer" id="b-timer">00:08</div>
            <div class="bt-sub">SETOR ${outcome.targetId.replace('t', '')} · ${outcome.targetName.toUpperCase()}</div>
          </div>
          <div class="battle-side right">
            <small>${outcome.faction}</small>
            <b>${outcome.targetName}</b>
            <div class="bp"><svg class="ico"><use href="#i-shield"/></svg> ${fmt(outcome.def)} DEFESA</div>
            <div class="battle-bar"><i id="b-bar-enemy"></i></div>
          </div>
        </div>
        <div class="battle-bottom">
          <div class="battle-log" id="b-log"><b>SISTEMA:</b> Unidades em posição. Aguardando ordem de fogo.</div>
          <div class="battle-skip">
            <button class="btn ghost small" data-b-action="skip"><svg class="ico"><use href="#i-arrow"/></svg> ACELERAR COMBATE</button>
          </div>
        </div>
        <div class="battle-result" id="b-result" hidden></div>
      </div>`;
    this.canvas = this.root.querySelector('#battle-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.barPlayer = this.root.querySelector('#b-bar-player');
    this.barEnemy = this.root.querySelector('#b-bar-enemy');
    this.phaseEl = this.root.querySelector('#b-phase');
    this.timerEl = this.root.querySelector('#b-timer');
    this.logEl = this.root.querySelector('#b-log');
    this.resultEl = this.root.querySelector('#b-result');
    this.resize();
    window.addEventListener('resize', this._resize);
    this.buildUnits();
    battleStart();
    startBattleAmbience();
    this._last = performance.now();
    this._raf = requestAnimationFrame((n) => this.loop(n));
  }

  buildUnits() {
    const o = this.outcome;
    const r = rnd(9137 + o.level * 71);
    const friendly = [];
    for (const def of UNIT_DEFS) {
      const q = o.sentUnits?.[def.key] || 0;
      if (!q) continue;
      const n = clamp(Math.ceil(q / Math.max(1, Math.round((o.sentCount + 8) / 26))), 1, 8);
      for (let i = 0; i < n; i++) friendly.push(def.key === 'helicopter' ? 'heli' : def.key === 'tank' || def.key === 'artillery' ? 'tank' : 'inf');
    }
    const enemy = [];
    const eInf = clamp(8 + o.level * 3, 8, 26);
    for (let i = 0; i < eInf; i++) enemy.push('inf');
    for (let i = 0; i < clamp(o.level, 1, 8); i++) enemy.push('tank');
    if (o.level >= 3) enemy.push('heli');

    const make = (list, side) => list.map((type, i) => {
      const lane = (i + 0.5) / list.length;
      const y = 0.56 + ((lane * 0.82 + r() * 0.12) % 0.34);
      const depth = clamp((y - 0.56) / 0.34, 0, 1);
      return {
        side, type,
        x0: side === 'left' ? 0.12 + r() * 0.16 : 0.9 - r() * 0.15,
        x: 0,
        y,
        scale: 0.55 + depth * 1.05,
        delay: r() * 0.9,
        speed: 0.032 + r() * 0.035,
        bob: r() * Math.PI * 2,
        dieAt: side === 'right'
          ? (this.outcome.win ? 3.4 + r() * 3.2 : 99)
          : (this.outcome.win ? 5.8 + r() * 2.2 : 2.8 + r() * 3.4),
        recoil: 0
      };
    });
    this.units = [...make(friendly, 'left'), ...make(enemy, 'right')].sort((a, b) => a.y - b.y);
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  loop(now) {
    if (!this.active) return;
    const dt = Math.min(50, now - this._last);
    this._last = now;
    this.t += dt;
    if (!this.resultShown && this.t >= DURATION) this.showResult();
    this.update(dt);
    this.draw();
    this._raf = requestAnimationFrame((n) => this.loop(n));
  }

  update(dt) {
    if (this.resultShown) {
      this.units.forEach(u => { u.recoil *= 0.9; });
    }
    const prog = clamp(this.t / DURATION, 0, 1);
    for (const u of this.units) {
      const targetX = u.side === 'left' ? 0.43 : 0.57;
      const moveT = clamp((prog - u.delay * 0.16) / 0.55, 0, 1);
      u.x = u.x0 + (targetX - u.x0) * easeOut(moveT);
      u.recoil *= Math.pow(0.86, dt / 16);
    }
    if (!this.resultShown) {
      if (this.t > this._nextTrace && this.t < DURATION - 400) {
        this.spawnTracer();
        this._nextTrace = this.t + 45 + Math.random() * 130;
      }
      if (this.t > this._nextGun) {
        gunfire();
        this._nextGun = this.t + 700 + Math.random() * 900;
      }
      if (this.t > this._nextBoom && this.t < DURATION - 500) {
        this.spawnExplosion(0.36 + Math.random() * 0.28, 0.58 + Math.random() * 0.3, 0.6 + Math.random() * 0.9);
        if (Math.random() < 0.55) explosion();
        this.shake = Math.min(9, this.shake + 4);
        this._nextBoom = this.t + 320 + Math.random() * 700;
      }
      // HUD
      const e = this.outcome;
      const playerRatio = e.win ? 1 - 0.5 * easeIn(prog) : 1 - 0.92 * easeIn(prog);
      const enemyRatio = e.win ? 1 - 0.97 * easeIn(Math.max(0, (prog - 0.18) / 0.82)) : 1 - 0.45 * easeIn(prog);
      if (this.barPlayer) this.barPlayer.style.width = `${clamp(playerRatio * 100, 0, 100)}%`;
      if (this.barEnemy) this.barEnemy.style.width = `${clamp(enemyRatio * 100, 0, 100)}%`;
      if (this.timerEl) {
        const left = Math.max(0, DURATION - this.t);
        this.timerEl.textContent = `00:${String(Math.ceil(left / 1000)).padStart(2, '0')}`;
      }
      if (this.phaseEl) {
        const phase = this.t < 1400 ? 'RECONHECIMENTO' : this.t < 3200 ? 'BOMBARDEIO PREPARATÓRIO' : this.t < 5400 ? 'ASSALTO TERRESTRE' : 'COMBATE CORPO A CORPO';
        if (this.phaseEl.textContent !== phase) {
          this.phaseEl.textContent = phase;
          this.pushLog(phase);
        }
      }
    }
    // effects
    for (const p of this.tracers) p.life -= dt;
    this.tracers = this.tracers.filter(p => p.life > 0);
    for (const e of this.explosions) e.t += dt;
    this.explosions = this.explosions.filter(e => e.t < 900);
    for (const s of this.sparks) {
      s.x += s.vx * dt / 1000;
      s.y += s.vy * dt / 1000;
      s.vy += 260 * dt / 1000;
      s.life -= dt;
    }
    this.sparks = this.sparks.filter(s => s.life > 0);
    this.shake *= Math.pow(0.88, dt / 16);
  }

  pushLog(text) {
    if (!this.logEl) return;
    this.logEl.innerHTML = `<b>SISTEMA:</b> ${text}`;
  }

  spawnTracer() {
    const shooters = this.units.filter(u => u.type !== 'heli' && Math.sin(this.t / 2000 + u.bob) > -0.9);
    if (!shooters.length) return;
    const shooter = shooters[Math.floor(Math.random() * shooters.length)];
    if (this.t / 1000 > shooter.dieAt) return;
    const side = shooter.side;
    const targets = this.units.filter(u => u.side !== side);
    if (!targets.length) return;
    const target = targets[Math.floor(Math.random() * targets.length)];
    const from = this.unitScreen(shooter, true);
    const to = this.unitScreen(target, false);
    this.tracers.push({ x1: from.x, y1: from.y, x2: to.x + (Math.random() - 0.5) * 18, y2: to.y + (Math.random() - .5) * 12, life: 80 + Math.random() * 70, max: 150 });
    shooter.recoil = 1;
    for (let i = 0; i < 3; i++) {
      this.sparks.push({ x: from.x, y: from.y, vx: (Math.random() - .5) * 90 + (side === 'left' ? 60 : -60), vy: (Math.random() - .5) * 70, life: 160 + Math.random() * 120, color: '#ffd48a' });
    }
  }

  spawnExplosion(x, y, size) {
    this.explosions.push({ x, y, size, t: 0, hue: Math.random() < 0.5 ? 28 : 42 });
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 230;
      this.sparks.push({ x: x * this.w, y: y * this.h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 350 + Math.random() * 450, color: Math.random() < .6 ? '#ffb057' : '#ffe2a4' });
    }
  }

  unitScreen(u, muzzle) {
    const x = u.x * this.w;
    const y = u.y * this.h;
    const scale = u.scale * clamp(this.h / 720, 0.7, 1.4);
    const off = u.side === 'left' ? 1 : -1;
    if (u.type === 'heli') return { x: x + (muzzle ? off * 16 : 0) * scale, y: y - 30 * scale };
    if (u.type === 'tank') return { x: x + (muzzle ? off * 22 * scale : 0), y: y - 10 * scale };
    return { x: x + (muzzle ? off * 9 * scale : 0), y: y - 9 * scale };
  }

  draw() {
    const c = this.ctx;
    const w = this.w, h = this.h;
    c.clearRect(0, 0, w, h);
    c.save();
    if (this.shake > 0.2) c.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);
    this.drawSky(c, w, h);
    this.drawGround(c, w, h);
    // explosions behind units for smoke
    for (const e of this.explosions) this.drawExplosion(c, e);
    for (const u of this.units) this.drawUnit(c, u);
    // tracers
    for (const p of this.tracers) {
      const a = clamp(p.life / p.max, 0, 1);
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(255,220,150,${a * 0.9})`;
      c.lineWidth = 1.4;
      c.shadowColor = '#ffcf7a';
      c.shadowBlur = 5;
      c.beginPath();
      c.moveTo(p.x1, p.y1);
      c.lineTo(p.x2, p.y2);
      c.stroke();
      c.restore();
    }
    // sparks
    for (const s of this.sparks) {
      c.fillStyle = s.color;
      c.globalAlpha = clamp(s.life / 500, 0, 1);
      c.fillRect(s.x, s.y, 2, 2);
    }
    c.globalAlpha = 1;
    // foreground dust
    const dust = c.createLinearGradient(0, h * 0.62, 0, h);
    dust.addColorStop(0, 'rgba(40,32,22,0)');
    dust.addColorStop(1, 'rgba(12,10,8,.55)');
    c.fillStyle = dust;
    c.fillRect(0, h * 0.62, w, h * 0.38);
    c.restore();
  }

  drawSky(c, w, h) {
    const horizon = h * 0.52;
    const sky = c.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#0b1119');
    sky.addColorStop(0.45, '#242b31');
    sky.addColorStop(0.72, '#6b4b39');
    sky.addColorStop(0.9, '#b56c3b');
    sky.addColorStop(1, '#d18a50');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, horizon + 2);
    // stars
    const rs = rnd(77);
    c.fillStyle = 'rgba(220,235,245,.55)';
    for (let i = 0; i < 70; i++) {
      const x = rs() * w, y = rs() * h * 0.33;
      const a = 0.15 + rs() * 0.5;
      c.globalAlpha = a;
      c.fillRect(x, y, 1.2, 1.2);
    }
    c.globalAlpha = 1;
    // sun glow
    const sunX = w * 0.7, sunY = horizon - h * 0.035;
    const sg = c.createRadialGradient(sunX, sunY, 2, sunX, sunY, w * 0.32);
    sg.addColorStop(0, 'rgba(255,180,100,.42)');
    sg.addColorStop(0.35, 'rgba(240,130,60,.16)');
    sg.addColorStop(1, 'rgba(240,130,60,0)');
    c.fillStyle = sg;
    c.fillRect(0, 0, w, horizon);
    c.fillStyle = 'rgba(255,196,130,.5)';
    c.beginPath();
    c.arc(sunX, sunY, 22, 0, Math.PI * 2);
    c.fill();
    // clouds
    c.save();
    c.globalAlpha = 0.22;
    c.fillStyle = '#20262c';
    for (let i = 0; i < 5; i++) {
      const cx = ((this.t / 160 + i * w * 0.29) % (w + 300)) - 120;
      const cy = h * (0.08 + i * 0.06);
      c.beginPath();
      c.ellipse(cx, cy, 90 + i * 26, 9 + i * 2.5, 0.03, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    // distant mountains
    const m1 = rnd(421);
    c.fillStyle = 'rgba(22,26,28,.9)';
    c.beginPath();
    c.moveTo(0, horizon);
    let x = 0;
    while (x < w) {
      const peak = h * (0.08 + m1() * 0.11);
      c.lineTo(x + w * 0.045, horizon - peak);
      x += w * 0.045;
      c.lineTo(x, horizon + 2);
    }
    c.closePath();
    c.fill();
    const m2 = rnd(817);
    c.fillStyle = 'rgba(12,16,18,.95)';
    c.beginPath();
    c.moveTo(0, horizon);
    x = 0;
    while (x < w) {
      const peak = h * (0.025 + m2() * 0.075);
      c.lineTo(x + w * 0.06, horizon - peak);
      x += w * 0.06;
      c.lineTo(x, horizon + 3);
    }
    c.closePath();
    c.fill();
    // ruined skyline
    const rs2 = rnd(9001);
    c.fillStyle = '#101413';
    for (let i = 0; i < 22; i++) {
      const bx = rs2() * w;
      const bw = 8 + rs2() * 30;
      const bh = 12 + rs2() * h * 0.11;
      c.fillRect(bx, horizon - bh, bw, bh);
      if (rs2() > 0.6) {
        c.fillRect(bx + bw * 0.4, horizon - bh - 6, 2, 7);
        c.fillStyle = 'rgba(227,89,76,.55)';
        c.fillRect(bx + bw * 0.4, horizon - bh - 7, 2, 2);
        c.fillStyle = '#101413';
      }
    }
    // searchlights
    const beam = (px, ang, alpha) => {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(px, horizon, px + Math.cos(ang) * h * 0.5, horizon + Math.sin(ang) * h * 0.5);
      g.addColorStop(0, `rgba(180,210,230,${alpha})`);
      g.addColorStop(1, 'rgba(180,210,230,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(px, horizon);
      c.lineTo(px + Math.cos(ang - 0.05) * h * 0.65, horizon + Math.sin(ang - 0.05) * h * 0.65);
      c.lineTo(px + Math.cos(ang + 0.05) * h * 0.65, horizon + Math.sin(ang + 0.05) * h * 0.65);
      c.closePath();
      c.fill();
      c.restore();
    };
    const s1 = -1.65 + Math.sin(this.t / 2600) * 0.35;
    const s2 = -1.5 + Math.sin(this.t / 3100 + 1.3) * 0.4;
    beam(w * 0.2, s1, 0.05);
    beam(w * 0.82, s2, 0.045);
  }

  drawGround(c, w, h) {
    const horizon = h * 0.52;
    const g = c.createLinearGradient(0, horizon, 0, h);
    g.addColorStop(0, '#6b5637');
    g.addColorStop(0.18, '#4b402b');
    g.addColorStop(0.55, '#2b261c');
    g.addColorStop(1, '#12110d');
    c.fillStyle = g;
    c.fillRect(0, horizon, w, h - horizon);
    // distant haze
    const haze = c.createLinearGradient(0, horizon, 0, horizon + h * 0.12);
    haze.addColorStop(0, 'rgba(210,150,90,.25)');
    haze.addColorStop(1, 'rgba(210,150,90,0)');
    c.fillStyle = haze;
    c.fillRect(0, horizon, w, h * 0.12);
    // perspective grid
    c.save();
    c.strokeStyle = 'rgba(200,190,160,.055)';
    c.lineWidth = 1;
    const vx = w * 0.5;
    for (let i = -8; i <= 8; i++) {
      c.beginPath();
      c.moveTo(vx + i * w * 0.035, horizon);
      c.lineTo(vx + i * w * 0.34, h);
      c.stroke();
    }
    for (let i = 1; i <= 7; i++) {
      const y = horizon + Math.pow(i / 7, 1.9) * (h - horizon);
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.restore();
    // craters and debris
    const r = rnd(551);
    for (let i = 0; i < 26; i++) {
      const x = r() * w;
      const y = horizon + r() * (h - horizon);
      const dep = (y - horizon) / (h - horizon);
      const rx = (6 + r() * 26) * (0.3 + dep);
      c.fillStyle = 'rgba(10,9,7,.4)';
      c.beginPath();
      c.ellipse(x, y, rx, rx * 0.32, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(190,170,130,.06)';
      c.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = horizon + r() * (h - horizon);
      c.fillStyle = 'rgba(190,180,150,.1)';
      c.fillRect(x, y, 2 + r() * 3, 1.5);
    }
    // smoke columns fixed
    const rs = rnd(331);
    c.save();
    c.globalAlpha = 0.16;
    for (let i = 0; i < 4; i++) {
      const sx = rs() * w;
      const sy = horizon - 4;
      for (let k = 0; k < 3; k++) {
        c.fillStyle = '#0c0d0b';
        c.beginPath();
        c.ellipse(sx + Math.sin(this.t / 1400 + i + k) * 10, sy - k * 26, 20 + k * 12, 14 + k * 8, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  drawUnit(c, u) {
    const x = u.x * this.w;
    const y = u.y * this.h;
    const s = u.scale * clamp(this.h / 720, 0.75, 1.5);
    const dead = this.t / 1000 > u.dieAt;
    const friendly = u.side === 'left';
    const body = friendly ? '#3a4a42' : '#4a3530';
    const dark = friendly ? '#232e29' : '#2d201d';
    const rim = friendly ? 'rgba(69,211,198,.4)' : 'rgba(227,89,76,.4)';
    c.save();
    c.translate(x, y);
    // shadow
    c.fillStyle = 'rgba(0,0,0,.38)';
    c.beginPath();
    c.ellipse(0, 2 * s, (u.type === 'tank' ? 18 : 8) * s, 3.2 * s, 0, 0, Math.PI * 2);
    c.fill();
    if (dead) {
      c.globalAlpha = 0.45;
      c.fillStyle = dark;
      c.beginPath();
      c.ellipse(0, 0, (u.type === 'tank' ? 14 : 7) * s, 2.6 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      return;
    }
    if (u.type === 'heli') {
      const hover = Math.sin(this.t / 240 + u.bob) * 4 * s;
      c.translate(0, -34 * s + hover);
      c.fillStyle = dark;
      c.beginPath();
      c.ellipse(0, 0, 11 * s, 4.2 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.fillRect(-11 * s, -2 * s, 22 * s, 4 * s);
      c.fillRect(friendly ? 6 * s : -20 * s, -1.4 * s, 14 * s, 2.8 * s);
      c.fillStyle = rim;
      c.fillRect(-5 * s, -3.6 * s, 8 * s, 1.2 * s);
      // rotor
      c.strokeStyle = 'rgba(220,235,240,.4)';
      c.lineWidth = 1.2;
      const rw = (24 + Math.sin(this.t / 40) * 8) * s;
      c.beginPath(); c.moveTo(-rw, -5 * s); c.lineTo(rw, -5 * s); c.stroke();
      c.beginPath(); c.moveTo(-5 * s, -2 * s); c.lineTo(5 * s, -8 * s); c.stroke();
      c.strokeStyle = 'rgba(200,220,230,.5)';
      c.beginPath(); c.moveTo(-6 * s, 1 * s); c.lineTo(6 * s, 1 * s); c.stroke();
      c.restore();
      return;
    }
    if (u.type === 'tank') {
      const bob = Math.sin(this.t / 220 + u.bob) * 0.7 * s;
      c.translate(0, bob);
      // tracks
      c.fillStyle = '#191b19';
      c.fillRect(-16 * s, -5 * s, 32 * s, 6 * s);
      c.fillStyle = '#2c2d28';
      for (let i = -2; i <= 2; i++) c.fillRect(i * 6 * s - 1.5 * s, -4.5 * s, 3 * s, 5 * s);
      // hull
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(-16 * s, -6 * s);
      c.lineTo(-10 * s, -13 * s);
      c.lineTo(11 * s, -13 * s);
      c.lineTo(16 * s, -6 * s);
      c.closePath();
      c.fill();
      c.strokeStyle = rim;
      c.lineWidth = 1;
      c.stroke();
      // turret
      c.fillStyle = dark;
      c.fillRect(-6 * s, -16 * s, 12 * s, 4 * s);
      c.strokeStyle = '#6d7b70';
      c.lineWidth = 2 * s;
      c.beginPath();
      c.moveTo(friendly ? 5 * s : -5 * s, -14 * s);
      c.lineTo(friendly ? 22 * s : -22 * s, -15 * s);
      c.stroke();
      if (u.recoil > 0.2) {
        c.fillStyle = 'rgba(255,214,140,.85)';
        c.beginPath();
        c.arc(friendly ? 23 * s : -23 * s, -15 * s, 3 * s * u.recoil, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      return;
    }
    // infantry
    const bob = Math.sin(this.t / 160 + u.bob) * 0.8 * s;
    c.translate(0, bob);
    c.fillStyle = dark;
    c.fillRect(-2 * s, -4 * s, 1.6 * s, 4 * s);
    c.fillRect(0.6 * s, -4 * s, 1.6 * s, 4 * s);
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(-4 * s, -13 * s);
    c.lineTo(4 * s, -13 * s);
    c.lineTo(3 * s, -4 * s);
    c.lineTo(-3 * s, -4 * s);
    c.closePath();
    c.fill();
    c.fillStyle = '#26332d';
    c.beginPath();
    c.arc(0, -15 * s, 2.8 * s, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = rim;
    c.lineWidth = 0.8;
    c.stroke();
    // rifle
    c.strokeStyle = '#141a17';
    c.lineWidth = 1.6 * s;
    c.beginPath();
    c.moveTo(friendly ? 3 * s : -3 * s, -10 * s);
    c.lineTo(friendly ? 12 * s : -12 * s, -11 * s);
    c.stroke();
    if (u.recoil > 0.25) {
      c.fillStyle = 'rgba(255,220,150,.9)';
      c.beginPath();
      c.arc(friendly ? 13 * s : -13 * s, -11 * s, 2.2 * s * u.recoil, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  drawExplosion(c, e) {
    const p = e.t / 900;
    const x = e.x * this.w, y = e.y * this.h;
    const r = e.size * (30 + p * 95) * clamp(this.h / 720, 0.7, 1.4);
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, `rgba(255,240,200,${(1 - p) * 0.9})`);
    g.addColorStop(0.25, `rgba(255,170,70,${(1 - p) * 0.7})`);
    g.addColorStop(0.6, `rgba(210,80,30,${(1 - p) * 0.3})`);
    g.addColorStop(1, 'rgba(120,40,10,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = `rgba(255,220,160,${(1 - p) * 0.35})`;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x, y, r * (0.6 + p * 0.6), 0, Math.PI * 2);
    c.stroke();
    c.restore();
    // smoke
    c.save();
    for (let i = 0; i < 4; i++) {
      const a = (1 - p) * 0.22;
      c.fillStyle = `rgba(35,32,28,${a})`;
      c.beginPath();
      c.ellipse(x + Math.sin(i * 2 + p * 3) * r * 0.4, y - p * r * (0.2 + i * 0.12), r * (0.35 + i * 0.1), r * (0.25 + i * 0.08), 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  showResult() {
    if (this.resultShown || !this.active) return;
    this.resultShown = true;
    stopBattleAmbience();
    const o = this.outcome;
    if (o.win) victory(); else defeat();
    this.barPlayer.style.width = o.win ? '52%' : '2%';
    this.barEnemy.style.width = o.win ? '1%' : '58%';
    if (this.phaseEl) this.phaseEl.textContent = o.win ? 'SETOR CONQUISTADO' : 'FORÇA DERROTADA';
    if (this.timerEl) this.timerEl.textContent = '00:00';
    this.resultEl.hidden = false;
    this.resultEl.className = `battle-result ${o.win ? 'win' : 'loss'}`;
    const loot = Object.entries(o.loot || {}).filter(([, v]) => v > 0).map(([k, v]) =>
      `<span class="loot-item" style="--rc:${k === 'oil' ? '#f0a33a' : k === 'steel' ? '#a9bfd2' : k === 'food' ? '#8fc45b' : '#e8c15a'}"><svg class="ico"><use href="#i-${k === 'oil' ? 'oil' : k === 'steel' ? 'steel' : k === 'food' ? 'food' : 'credit'}"/></svg>+${fmt(v)}</span>`
    ).join('');
    this.resultEl.innerHTML = `
      <div class="br-kicker">${o.win ? 'OPERAÇÃO CONCLUÍDA' : 'OPERAÇÃO FRACASSADA'}</div>
      <div class="br-title">${o.win ? 'VITÓRIA' : 'DERROTA'}</div>
      <div class="br-sub">${o.targetName} · ${o.faction} · Setor nível ${o.level}</div>
      <div class="br-stats">
        <div class="br-stat"><small>PODER DE ATAQUE</small><b>${fmt(o.atk)}</b></div>
        <div class="br-stat"><small>DEFESA INIMIGA</small><b>${fmt(o.def)}</b></div>
        <div class="br-stat"><small>UNIDADES PERDIDAS</small><b class="${o.win ? '' : 'red'}">${fmt(o.lost)}</b></div>
        <div class="br-stat"><small>FERIDOS RECUPERADOS</small><b class="teal">${fmt(o.recoveredTotal)}</b></div>
      </div>
      ${o.win ? `<div class="br-loot">${loot}</div>` : '<p class="modal-note" style="margin:10px 0">Suas tropas restantes retornaram à base. Reforce o exército e tente novamente.</p>'}
      <div class="br-actions">
        <button class="btn ${o.win ? '' : 'ghost'}" data-b-action="continue"><svg class="ico"><use href="#i-${o.win ? 'flag' : 'shield'}"/></svg> ${o.win ? 'ASSUMIR O SETOR' : 'RETORNAR À BASE'}</button>
      </div>`;
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const o = this.outcome;
    this.close();
    this.onFinish(o);
  }

  close() {
    this.active = false;
    this.resultShown = false;
    cancelAnimationFrame(this._raf);
    stopBattleAmbience();
    window.removeEventListener('resize', this._resize);
    this.root.hidden = true;
    this.root.innerHTML = '';
    this.canvas = null;
  }
}

function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
function easeIn(t) { return Math.pow(clamp(t, 0, 1), 2); }
