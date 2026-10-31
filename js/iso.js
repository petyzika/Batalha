/* ============================================================
   Renderizador isométrico da base — COMANDO GLOBAL
   ============================================================ */
import { BUILDING_DEFS, BUILDING_BY_KEY, clamp } from './data.js';
import { state, buildingLevel, queueForBuilding } from './state.js';

const TILE = 32;
const DEPTH = 46;

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class IsoRenderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = opts.onSelect || (() => {});
    this.onHover = opts.onHover || (() => {});
    this.hoverKey = null;
    this.selectedKey = state.selectedBuilding || 'hq';
    this.t = 0;
    this.running = false;
    this.map = [];
    this.dpr = 1;
    this.w = 1;
    this.h = 1;
    this.s = 1;
    this.ox = 0;
    this.oy = 0;
    this._raf = 0;
    this._last = 0;

    this._onMove = (e) => this.pointerMove(e);
    this._onLeave = () => {
      if (this.hoverKey !== null) {
        this.hoverKey = null;
        this.canvas.style.cursor = 'default';
        this.onHover(null);
      }
    };
    this._onDown = (e) => this.pointerDown(e);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerleave', this._onLeave);
    canvas.addEventListener('pointerdown', this._onDown);
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas.parentElement || canvas);
    this.resize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(60, now - this._last);
      this._last = now;
      this.t += dt;
      this.frame();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = width;
    this.h = height;
    this.s = clamp(Math.min(width / 880, height / 640), 0.3, 1.22);
    this.ox = width / 2;
    this.oy = height * 0.5 - 108 * this.s;
    this.layout();
  }

  layout() {
    this.map = BUILDING_DEFS.map((def) => {
      const level = buildingLevel(def.key);
      return { def, level };
    }).sort((a, b) => (a.def.gx + a.def.gy) - (b.def.gx + b.def.gy));
  }

  p(x, y, z = 0) {
    return {
      x: this.ox + (x - y) * TILE * this.s,
      y: this.oy + (x + y) * TILE * 0.5 * this.s - z * this.s
    };
  }

  screenToGrid(px, py) {
    const dx = (px - this.ox) / (TILE * this.s);
    const dy = (py - this.oy) / (TILE * 0.5 * this.s);
    return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
  }

  hitTest(px, py) {
    let best = null;
    for (const item of this.map) {
      const d = item.def;
      const g = this.screenToGrid(px, py);
      const pad = 0.08;
      if (g.x >= d.gx - pad && g.x <= d.gx + d.w + pad && g.y >= d.gy - pad && g.y <= d.gy + d.d + pad) {
        const key = d.key;
        if (!best || (d.gx + d.gy) > (best.def.gx + best.def.gy)) best = item;
      }
    }
    return best ? best.def.key : null;
  }

  pointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const key = this.hitTest(e.clientX - rect.left, e.clientY - rect.top);
    this.canvas.style.cursor = key ? 'pointer' : 'default';
    if (key !== this.hoverKey) {
      this.hoverKey = key;
      this.onHover(key);
    }
  }

  pointerDown(e) {
    if (e.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const key = this.hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (key) {
      this.selectedKey = key;
      this.onSelect(key);
    }
  }

  select(key) { this.selectedKey = key; }

  /* ---------------- primitives ---------------- */
  poly(points, fill, stroke, lw = 1) {
    const c = this.ctx;
    c.beginPath();
    points.forEach((pt, i) => i ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y));
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }

  prism(gx, gy, w, d, h, top, left, right, stroke = 'rgba(0,0,0,.35)') {
    const c = this.ctx;
    const P = (x, y, z) => this.p(x, y, z);
    const A = P(gx, gy, h), B = P(gx + w, gy, h), C = P(gx + w, gy + d, h), D = P(gx, gy + d, h);
    const A0 = P(gx, gy, 0), B0 = P(gx + w, gy, 0), C0 = P(gx + w, gy + d, 0), D0 = P(gx, gy + d, 0);
    // faces
    this.poly([D, C, C0, D0], left, stroke, 1);
    this.poly([C, B, B0, C0], right, stroke, 1);
    // top
    this.poly([A, B, C, D], top, stroke, 1);
    return { A, B, C, D, A0, B0, C0, D0 };
  }

  diamond(gx, gy, w, d, z, fill, stroke, lw = 1) {
    this.poly([this.p(gx, gy, z), this.p(gx + w, gy, z), this.p(gx + w, gy + d, z), this.p(gx, gy + d, z)], fill, stroke, lw);
  }

  cylinder(cx, cy, r, h, base, top, glow = null) {
    const c = this.ctx;
    const b = this.p(cx, cy, 0);
    const t = this.p(cx, cy, h);
    const rx = r * TILE * this.s * 0.72;
    const ry = r * TILE * this.s * 0.36;
    c.save();
    const g = c.createLinearGradient(b.x - rx, 0, b.x + rx, 0);
    g.addColorStop(0, shade(base, -0.42));
    g.addColorStop(0.42, base);
    g.addColorStop(0.72, shade(base, 0.12));
    g.addColorStop(1, shade(base, -0.3));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(b.x - rx, b.y);
    c.lineTo(t.x - rx, t.y);
    c.lineTo(t.x + rx, t.y);
    c.lineTo(b.x + rx, b.y);
    c.closePath();
    c.fill();
    c.fillStyle = top;
    c.beginPath();
    c.ellipse(t.x, t.y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.25)';
    c.lineWidth = 1;
    c.stroke();
    if (glow) {
      c.fillStyle = glow;
      c.beginPath();
      c.ellipse(t.x, t.y, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    return { b, t, rx, ry };
  }

  smoke(x, y, z, size, color, count = 3, speed = 1) {
    const c = this.ctx;
    const p = this.p(x, y, z);
    for (let i = 0; i < count; i++) {
      const t = ((this.t / 2600) * speed + i / count) % 1;
      const px = p.x + Math.sin((t + i) * 5.4) * 8 * this.s + t * 16 * this.s;
      const py = p.y - t * 72 * this.s;
      const a = (1 - t) * 0.3;
      c.fillStyle = `rgba(${color},${a})`;
      c.beginPath();
      c.ellipse(px, py, (size + t * size * 1.6) * this.s, (size + t * size * 1.3) * this.s * 0.72, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  flag(gx, gy, z, color = '#f2a63b', scale = 1) {
    const c = this.ctx;
    const base = this.p(gx, gy, z);
    const h = 34 * scale * this.s;
    c.strokeStyle = '#6f7f8e';
    c.lineWidth = Math.max(1, 1.6 * this.s);
    c.beginPath();
    c.moveTo(base.x, base.y);
    c.lineTo(base.x, base.y - h);
    c.stroke();
    const wave = Math.sin(this.t / 320) * 2.2 * this.s;
    const fw = 20 * scale * this.s;
    const fh = 11 * scale * this.s;
    c.beginPath();
    c.moveTo(base.x, base.y - h);
    c.quadraticCurveTo(base.x + fw * 0.6, base.y - h + wave, base.x + fw, base.y - h + 2 * this.s);
    c.lineTo(base.x + fw * 0.92, base.y - h + 2 * this.s + fh);
    c.quadraticCurveTo(base.x + fw * 0.45, base.y - h + fh * 0.6 + wave, base.x, base.y - h + fh);
    c.closePath();
    c.fillStyle = color;
    c.fill();
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.beginPath();
    c.moveTo(base.x, base.y - h);
    c.quadraticCurveTo(base.x + fw * 0.55, base.y - h + wave, base.x + fw * 0.9, base.y - h + 2 * this.s);
    c.lineTo(base.x + fw * 0.9, base.y - h + fh * 0.45);
    c.quadraticCurveTo(base.x + fw * 0.4, base.y - h + fh * 0.2 + wave, base.x, base.y - h + fh * 0.42);
    c.fill();
  }

  tree(gx, gy, size = 1) {
    const c = this.ctx;
    const p = this.p(gx, gy);
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath();
    c.ellipse(p.x, p.y + 3 * this.s, 9 * size * this.s, 4 * size * this.s, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#3c3122';
    c.lineWidth = 2 * this.s;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(p.x, p.y - 12 * size * this.s);
    c.stroke();
    const sway = Math.sin(this.t / 800 + gx) * 1.3 * this.s;
    for (let i = 0; i < 3; i++) {
      const cy = p.y - (13 + i * 6) * size * this.s;
      const r = (10 - i * 2.2) * size * this.s;
      c.fillStyle = i === 0 ? '#23382b' : i === 1 ? '#2c4534' : '#35513c';
      c.beginPath();
      c.ellipse(p.x + sway * (i + 1) * 0.5, cy, r, r * 0.78, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  crates(gx, gy, n = 3, size = 7) {
    const c = this.ctx;
    for (let i = 0; i < n; i++) {
      const ox = (i % 2) * 0.28, oy = Math.floor(i / 2) * 0.22;
      const p = this.p(gx + ox, gy + oy);
      const s = size * this.s;
      c.fillStyle = '#3c4b3b';
      c.fillRect(p.x - s / 2, p.y - s, s, s);
      c.fillStyle = '#4b5d48';
      c.fillRect(p.x - s / 2, p.y - s, s, s * 0.4);
      c.strokeStyle = 'rgba(0,0,0,.35)';
      c.strokeRect(p.x - s / 2, p.y - s, s, s);
    }
  }

  barrels(gx, gy, n = 3) {
    const c = this.ctx;
    for (let i = 0; i < n; i++) {
      const p = this.p(gx + i * 0.24, gy + (i % 2) * 0.2);
      c.fillStyle = i % 2 ? '#6b4b2a' : '#4b5d48';
      c.fillRect(p.x - 3 * this.s, p.y - 9 * this.s, 6 * this.s, 9 * this.s);
      c.fillStyle = 'rgba(255,255,255,.15)';
      c.fillRect(p.x - 3 * this.s, p.y - 8 * this.s, 1.4 * this.s, 7 * this.s);
    }
  }

  /* ---------------- terrain ---------------- */
  drawTerrain() {
    const c = this.ctx;
    const P = (x, y, z = 0) => this.p(x, y, z);
    const A = P(0, 0), B = P(11, 0), C = P(11, 11), D = P(0, 11);
    // ambient shadow
    c.save();
    c.filter = 'blur(18px)';
    c.fillStyle = 'rgba(0,0,0,.5)';
    c.beginPath();
    c.ellipse(this.ox, this.oy + 250 * this.s, 330 * this.s, 120 * this.s, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // earth block sides
    const depth = DEPTH * this.s;
    const gradL = c.createLinearGradient(D.x, D.y, D.x, D.y + depth);
    gradL.addColorStop(0, '#1b232a'); gradL.addColorStop(1, '#080c10');
    this.poly([D, C, { x: C.x, y: C.y + depth }, { x: D.x, y: D.y + depth }], gradL);
    const gradR = c.createLinearGradient(B.x, B.y, B.x, B.y + depth);
    gradR.addColorStop(0, '#141b21'); gradR.addColorStop(1, '#06090c');
    this.poly([C, B, { x: B.x, y: B.y + depth }, { x: C.x, y: C.y + depth }], gradR);
    // earth strata
    c.strokeStyle = 'rgba(120,140,150,.07)';
    for (let i = 1; i < 3; i++) {
      c.beginPath();
      c.moveTo(D.x, D.y + depth * i / 3);
      c.lineTo(C.x, C.y + depth * i / 3);
      c.lineTo(B.x, B.y + depth * i / 3);
      c.stroke();
    }

    // plateau surface
    const grad = c.createLinearGradient(A.x, A.y, C.x, C.y);
    grad.addColorStop(0, '#27362f');
    grad.addColorStop(0.45, '#1f2c28');
    grad.addColorStop(1, '#16211f');
    this.poly([A, B, C, D], grad);

    // concrete tiles
    for (let x = 0; x < 11; x++) {
      for (let y = 0; y < 11; y++) {
        const tone = (x * 7 + y * 13) % 5;
        const fill = y === 10 || x === 10
          ? `rgba(22,32,32,${0.45 + tone * 0.02})`
          : `rgba(${30 + tone * 2},${44 + tone * 2},${41 + tone * 2},.42)`;
        this.diamond(x, y, 1, 1, 0, fill, null);
      }
    }
    // tile seams
    c.strokeStyle = 'rgba(160,190,180,.045)';
    c.lineWidth = 1;
    for (let i = 0; i <= 11; i++) {
      let a = P(i, 0), b = P(i, 11);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      a = P(0, i); b = P(11, i);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }

    // roads
    const road = (a, b, width = 20) => {
      const pa = P(a[0], a[1]), pb = P(b[0], b[1]);
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(8,12,14,.4)';
      c.lineWidth = (width + 6) * this.s;
      c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke();
      c.strokeStyle = '#242e30';
      c.lineWidth = width * this.s;
      c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke();
      c.strokeStyle = 'rgba(180,190,160,.16)';
      c.lineWidth = Math.max(1, 1.2 * this.s);
      c.setLineDash([6 * this.s, 10 * this.s]);
      c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke();
      c.setLineDash([]);
    };
    road([0.2, 3.3], [10.8, 3.3], 18);
    road([3.3, 0.2], [3.3, 10.8], 14);
    road([7.4, 0.2], [7.4, 10.8], 16);
    road([0.2, 10.1], [10.8, 10.1], 12);
    road([10.1, 0.2], [10.1, 10.8], 12);

    // HQ plaza
    this.diamond(3.45, 3.45, 3.1, 3.1, 0, '#2c3836', 'rgba(150,170,150,.16)', 1);
    this.diamond(3.62, 3.62, 2.76, 2.76, 0, null, 'rgba(242,166,59,.22)', 1.5);
    this.diamond(5.0, 3.15, 1, 1, 0, 'rgba(242,166,59,.14)', null);

    // helipad
    const hc = P(10.0, 2.0);
    c.strokeStyle = 'rgba(200,210,200,.3)';
    c.lineWidth = 1.5 * this.s;
    c.beginPath(); c.ellipse(hc.x, hc.y, 22 * this.s, 10.5 * this.s, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(200,210,200,.35)';
    c.font = `700 ${9 * this.s}px "Barlow Condensed",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('H', hc.x, hc.y);

    // perimeter fence
    c.strokeStyle = 'rgba(130,150,160,.22)';
    c.lineWidth = Math.max(1, 1.2 * this.s);
    const edge = (a, b) => {
      const pa = P(a[0], a[1]), pb = P(b[0], b[1]);
      c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke();
      const n = 11;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = pa.x + (pb.x - pa.x) * t, y = pa.y + (pb.y - pa.y) * t;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 7 * this.s); c.stroke();
      }
    };
    edge([0.15, 0.15], [10.85, 0.15]);
    edge([0.15, 0.15], [0.15, 10.85]);
    edge([0.15, 10.85], [10.85, 10.85]);

    // vegetation
    [[0.35, 5.4], [0.4, 9.5], [10.65, 9.4], [10.6, 0.4], [0.5, 0.5], [10.4, 6.9], [6.1, 10.55], [2.7, 10.5]]
      .forEach(([x, y], i) => this.tree(x, y, 0.8 + (i % 3) * 0.12));

    // props
    this.crates(6.9, 9.25, 3, 6);
    this.barrels(7.6, 9.35, 3);
    this.crates(0.55, 8.4, 2, 5);
    this.crates(9.65, 5.6, 3, 6);
    this.sandbags(9.35, 4.85);
    this.sandbags(0.65, 3.85);

    // plateau edge highlight
    c.strokeStyle = 'rgba(190,210,180,.14)';
    c.lineWidth = 1.5;
    this.poly([A, B, C, D], null, 'rgba(190,210,180,.15)', 1.5);
  }

  sandbags(gx, gy) {
    const c = this.ctx;
    for (let i = 0; i < 3; i++) {
      const p = this.p(gx + i * 0.2, gy + (i % 2) * 0.06);
      c.fillStyle = i % 2 ? '#6d6248' : '#7a6e50';
      c.beginPath();
      c.ellipse(p.x, p.y - 2 * this.s, 5.5 * this.s, 2.8 * this.s, -0.2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,.25)';
      c.stroke();
    }
  }

  drawVehicle() {
    const c = this.ctx;
    const t = (this.t / 7000) % 1;
    const dist = t < 0.5 ? t * 2 : (1 - t) * 2;
    const gx = 0.6 + dist * 10;
    const gy = 3.3;
    const p = this.p(gx, gy, 0);
    const dir = t < 0.5 ? 1 : -1;
    c.save();
    c.translate(p.x, p.y);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath(); c.ellipse(0, 2 * this.s, 11 * this.s, 4 * this.s, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3d4a3a';
    c.fillRect(-8 * this.s, -8 * this.s, 16 * this.s, 8 * this.s);
    c.fillStyle = '#57664d';
    c.fillRect(-5 * this.s * dir, -10 * this.s, 8 * this.s, 5 * this.s);
    c.fillStyle = '#1b2322';
    c.beginPath(); c.arc(-5 * this.s, 0, 2.4 * this.s, 0, Math.PI * 2); c.arc(5 * this.s, 0, 2.4 * this.s, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  /* ---------------- frame ---------------- */
  frame() {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    this.drawTerrain();
    this.drawVehicle();
    for (const item of this.map) {
      const { def, level } = item;
      if (level > 0) this.drawBuilding(def, level);
      else this.drawPlot(def);
    }
    this.drawSelection();
    this.drawBadges();
  }

  isSelected(key) { return this.selectedKey === key; }

  drawSelection() {
    const c = this.ctx;
    for (const item of this.map) {
      const d = item.def;
      const hot = this.hoverKey === d.key;
      if (!hot && !this.isSelected(d.key)) continue;
      const pts = [this.p(d.gx - 0.1, d.gy - 0.1), this.p(d.gx + d.w + 0.1, d.gy - 0.1), this.p(d.gx + d.w + 0.1, d.gy + d.d + 0.1), this.p(d.gx - 0.1, d.gy + d.d + 0.1)];
      c.save();
      c.shadowBlur = 14 * this.s;
      c.shadowColor = 'rgba(242,166,59,.55)';
      this.poly(pts, null, this.isSelected(d.key) ? 'rgba(255,190,90,.9)' : 'rgba(255,255,255,.45)', this.isSelected(d.key) ? 2 : 1);
      c.restore();
      if (this.isSelected(d.key)) {
        const corners = [[d.gx - 0.1, d.gy - 0.1], [d.gx + d.w + 0.1, d.gy - 0.1], [d.gx + d.w + 0.1, d.gy + d.d + 0.1], [d.gx - 0.1, d.gy + d.d + 0.1]];
        c.fillStyle = '#ffcf7a';
        for (const [cx, cy] of corners) {
          const p = this.p(cx, cy);
          c.beginPath();
          c.arc(p.x, p.y, 2.4 * this.s, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  }

  drawBadges() {
    const c = this.ctx;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const item of this.map) {
      const { def, level } = item;
      const q = queueForBuilding(def.key);
      const topCenter = this.p(def.gx + def.w / 2, def.gy + def.d / 2, 0);
      const y = topCenter.y - (level === 0 ? 16 : 82 + level * 2.2) * this.s;
      const x = topCenter.x;
      const isSel = this.isSelected(def.key);
      const label = level === 0 ? '+' : String(level);
      const w = level === 0 ? 24 * this.s : 21 * this.s;
      const h = level === 0 ? 20 * this.s : 18 * this.s;
      c.save();
      c.shadowBlur = isSel ? 12 * this.s : 4 * this.s;
      c.shadowColor = level === 0 ? 'rgba(242,166,59,.6)' : 'rgba(0,0,0,.8)';
      c.fillStyle = level === 0 ? 'rgba(242,166,59,.92)' : 'rgba(8,13,19,.9)';
      c.strokeStyle = level === 0 ? '#ffe0a0' : isSel ? '#ffd48a' : 'rgba(242,166,59,.55)';
      c.lineWidth = 1;
      this.roundRect(x - w / 2, y - h / 2, w, h, 3 * this.s);
      c.fill();
      c.stroke();
      c.shadowBlur = 0;
      c.fillStyle = level === 0 ? '#241604' : '#ffd48a';
      c.font = `700 ${(level === 0 ? 15 : 11) * this.s}px "Barlow Condensed",sans-serif`;
      c.fillText(label, x, y + 0.5);
      // construction / production marker
      if (q) {
        const pct = clamp((Date.now() - q.startAt) / Math.max(1, q.finishAt - q.startAt), 0, 1);
        c.fillStyle = 'rgba(0,0,0,.7)';
        c.fillRect(x - 15 * this.s, y + h / 2 + 5 * this.s, 30 * this.s, 3 * this.s);
        c.fillStyle = '#f2a63b';
        c.fillRect(x - 15 * this.s, y + h / 2 + 5 * this.s, 30 * this.s * pct, 3 * this.s);
        c.font = `600 ${8 * this.s}px "Barlow Condensed",sans-serif`;
        c.fillStyle = 'rgba(255,220,160,.9)';
        c.fillText('EM OBRAS', x, y + h / 2 + 14 * this.s);
      } else if (def.prod && level > 0 && Date.now() > (state.collect[def.key] || 0)) {
        const bob = Math.sin(this.t / 380 + def.gx) * 2;
        c.fillStyle = '#ffd48a';
        c.beginPath();
        c.arc(x + 13 * this.s, y - h / 2 - 3 * this.s + bob * this.s, 2.3 * this.s, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
  }

  roundRect(x, y, w, h, r) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  faceWindows(gx, gy, w, d, h, rows, cols, color, alpha = 0.75) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    const gap = 0.16;
    for (let r = 0; r < rows; r++) {
      const z0 = h * (0.18 + (0.66 * r) / rows);
      const z1 = z0 + h * 0.66 / rows * 0.52;
      for (let k = 0; k < cols; k++) {
        const t0 = (k + gap) / cols;
        const t1 = (k + 1 - gap) / cols;
        // front (y+d)
        this.poly([
          this.p(gx + w * t0, gy + d, z0), this.p(gx + w * t1, gy + d, z0),
          this.p(gx + w * t1, gy + d, z1), this.p(gx + w * t0, gy + d, z1)
        ], color);
        // side (x+w)
        this.poly([
          this.p(gx + w, gy + d * t0, z0), this.p(gx + w, gy + d * t1, z0),
          this.p(gx + w, gy + d * t1, z1), this.p(gx + w, gy + d * t0, z1)
        ], color);
      }
    }
    c.restore();
  }

  antenna(x, y, z, len = 26) {
    const c = this.ctx;
    const p = this.p(x, y, z);
    c.strokeStyle = '#8496a1';
    c.lineWidth = Math.max(1, 1.4 * this.s);
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(p.x, p.y - len * this.s);
    c.stroke();
    const blink = 0.4 + Math.sin(this.t / 240) * 0.6;
    c.fillStyle = `rgba(227,89,76,${blink})`;
    c.beginPath();
    c.arc(p.x, p.y - len * this.s, 2 * this.s, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(150,170,185,.4)';
    c.beginPath();
    c.moveTo(p.x - 4 * this.s, p.y - len * 0.55 * this.s);
    c.lineTo(p.x + 4 * this.s, p.y - len * 0.55 * this.s);
    c.stroke();
  }

  roofRails(gx, gy, w, d, z, color = 'rgba(255,255,255,.16)') {
    this.diamond(gx + 0.08, gy + 0.08, w - 0.16, d - 0.16, z, null, color, 1);
  }

  drawBuilding(def, level) {
    const c = this.ctx;
    const { gx, gy, w, d } = def;
    c.save();
    // ground shadow
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.beginPath();
    const cp = this.p(gx + w / 2, gy + d / 2, 0);
    c.ellipse(cp.x + 4 * this.s, cp.y + 6 * this.s, 40 * this.s, 18 * this.s, 0, 0, Math.PI * 2);
    c.fill();
    this.diamond(gx + 0.12, gy + 0.12, w - 0.24, d - 0.24, 0, 'rgba(17,26,27,.85)', null);
    switch (def.key) {
      case 'hq': this.drawHQ(gx, gy, w, d, level); break;
      case 'oil': this.drawOil(gx, gy, level); break;
      case 'steel': this.drawSteel(gx, gy, level); break;
      case 'farm': this.drawFarm(gx, gy, level); break;
      case 'power': this.drawPower(gx, gy, level); break;
      case 'barracks': this.drawBarracks(gx, gy, level); break;
      case 'factory': this.drawFactory(gx, gy, level, w, d); break;
      case 'warehouse': this.drawWarehouse(gx, gy, level); break;
      case 'lab': this.drawLab(gx, gy, level); break;
      case 'market': this.drawMarket(gx, gy, level); break;
      case 'radar': this.drawRadar(gx, gy, level); break;
      case 'airbase': this.drawAirbase(gx, gy, level); break;
      case 'hospital': this.drawHospital(gx, gy, level); break;
      case 'wall': this.drawWall(gx, gy, level); break;
      default: this.prism(gx + .2, gy + .2, w - .4, d - .4, 24, '#4b5a5d', '#314044', '#263338');
    }
    c.restore();
  }

  drawHQ(gx, gy, w, d, lv) {
    const h = 26 + lv * 3.5;
    this.prism(gx + 0.24, gy + 0.24, 1.52, 1.52, 8, '#38464a', '#283539', '#1e292d');
    // side wings
    this.prism(gx + 0.28, gy + 1.12, 0.64, 0.55, h * 0.42, '#435257', '#303f43', '#253236');
    this.prism(gx + 1.08, gy + 0.28, 0.55, 0.64, h * 0.42, '#435257', '#303f43', '#253236');
    // main block
    this.prism(gx + 0.46, gy + 0.46, 1.08, 1.08, h, '#4a5b5f', '#344348', '#28353a', 'rgba(0,0,0,.4)');
    this.faceWindows(gx + 0.46, gy + 0.46, 1.08, 1.08, h, Math.min(5, 1 + Math.ceil(lv / 2)), 3, 'rgba(255,196,100,.55)', 0.9);
    // command tower
    const th = h + 24 + lv * 2;
    this.prism(gx + 0.67, gy + 0.67, 0.66, 0.66, th, '#5d6f72', '#415156', '#334247', 'rgba(0,0,0,.45)');
    this.faceWindows(gx + 0.67, gy + 0.67, 0.66, 0.66, th, 3, 2, 'rgba(120,220,225,.55)', 0.8);
    // roof + mast
    this.diamond(gx + 0.67, gy + 0.67, 0.66, 0.66, th + 2, '#6b7d7f', 'rgba(0,0,0,.3)');
    this.antenna(gx + 1.0, gy + 1.0, th, 30 + lv);
    // gold trim
    const p1 = this.p(gx + 0.46, gy + 1.54, h * 0.78);
    const p2 = this.p(gx + 1.54, gy + 1.54, h * 0.78);
    const c = this.ctx;
    c.strokeStyle = 'rgba(242,166,59,.65)';
    c.lineWidth = 1.5 * this.s;
    c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
    // entrance
    this.poly([
      this.p(gx + 0.82, gy + 1.54, 0), this.p(gx + 1.18, gy + 1.54, 0),
      this.p(gx + 1.18, gy + 1.54, 12), this.p(gx + 0.82, gy + 1.54, 12)
    ], 'rgba(242,166,59,.5)');
    this.flag(gx + 0.34, gy + 1.5, 8, '#f2a63b', 0.9);
  }

  drawOil(gx, gy, lv) {
    const c = this.ctx;
    this.cylinder(gx + 0.62, gy + 0.72, 0.34, 32 + lv * 2, '#59645f', '#73807a', 'rgba(240,163,58,.2)');
    this.cylinder(gx + 1.42, gy + 0.78, 0.28, 26 + lv * 2, '#4f5a56', '#6b7872');
    // pipes
    const a = this.p(gx + 0.45, gy + 1.15), b = this.p(gx + 1.55, gy + 1.15);
    c.strokeStyle = '#6f5d3b';
    c.lineWidth = 3 * this.s;
    c.beginPath(); c.moveTo(a.x, a.y - 8 * this.s); c.lineTo(b.x, b.y - 8 * this.s); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.15)';
    c.lineWidth = 1 * this.s;
    c.beginPath(); c.moveTo(a.x, a.y - 9 * this.s); c.lineTo(b.x, b.y - 9 * this.s); c.stroke();
    // pumpjack
    const base = this.p(gx + 1.06, gy + 1.4);
    c.fillStyle = '#34413f';
    c.fillRect(base.x - 10 * this.s, base.y - 6 * this.s, 20 * this.s, 6 * this.s);
    c.strokeStyle = '#7c6950';
    c.lineWidth = 2.4 * this.s;
    c.beginPath(); c.moveTo(base.x, base.y - 5 * this.s); c.lineTo(base.x, base.y - 22 * this.s); c.stroke();
    const angle = Math.sin(this.t / 900) * 0.35;
    const beam = 17 * this.s;
    c.strokeStyle = '#a08253';
    c.lineWidth = 3 * this.s;
    c.beginPath();
    c.moveTo(base.x, base.y - 22 * this.s);
    c.lineTo(base.x + Math.cos(angle) * beam, base.y - 22 * this.s + Math.sin(angle) * beam * 0.5);
    c.stroke();
    c.fillStyle = 'rgba(240,163,58,.22)';
    c.beginPath(); c.ellipse(gx + 0.62, gy + 0.72, 25 * this.s, 11 * this.s, 0, 0, Math.PI * 2); c.fill();
    this.smoke(gx + 0.45, gy + 1.4, 10, 4, '120,135,125', 2, 0.5);
  }

  drawSteel(gx, gy, lv) {
    const h = 28 + lv * 2.5;
    this.prism(gx + 0.3, gy + 0.7, 1.4, 0.95, h, '#59605e', '#3c4543', '#2d3533');
    this.diamond(gx + 0.3, gy + 0.7, 1.4, 0.95, h + 1, 'rgba(105,115,112,.8)', 'rgba(0,0,0,.3)');
    // furnace glow
    this.poly([
      this.p(gx + 0.46, gy + 1.65, 4), this.p(gx + 0.92, gy + 1.65, 4),
      this.p(gx + 0.92, gy + 1.65, 18), this.p(gx + 0.46, gy + 1.65, 18)
    ], 'rgba(255,150,50,.4)');
    // chimneys
    this.cylinder(gx + 0.62, gy + 0.95, 0.2, h + 28, '#6d6a60', '#8a8578');
    this.cylinder(gx + 1.32, gy + 0.9, 0.17, h + 17, '#66645b', '#837f73');
    this.smoke(gx + 0.62, gy + 0.95, h + 28, 6, '95,100,94', 4, 0.6);
    this.smoke(gx + 1.32, gy + 0.9, h + 17, 4, '90,95,90', 3, 0.5);
    // rail / gantry
    this.prism(gx + 0.35, gy + 1.28, 1.3, 0.12, h + 12, '#3b4443', '#2a3130', '#222827');
    this.crates(gx + 1.45, gy + 1.44, 2, 7);
    this.barrels(gx + 0.25, gy + 1.5, 2);
  }

  drawFarm(gx, gy, lv) {
    const c = this.ctx;
    // field rows
    for (let i = 0; i < 8; i++) {
      const y = gy + 0.45 + i * 0.16;
      const a = this.p(gx + 0.18, y), b = this.p(gx + 1.62, y);
      c.strokeStyle = i % 2 ? 'rgba(120,160,70,.5)' : 'rgba(86,120,52,.55)';
      c.lineWidth = 3 * this.s;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    // silo
    const sh = 34 + lv * 2;
    this.cylinder(gx + 0.6, gy + 0.73, 0.22, sh, '#88906d', '#adb690', 'rgba(180,210,120,.2)');
    // barn
    this.prism(gx + 0.72, gy + 1.02, 0.92, 0.6, 20 + lv * 1.5, '#5b5140', '#3f382c', '#302a21');
    this.diamond(gx + 0.72, gy + 1.02, 0.92, 0.6, 20 + lv * 1.5 + 1, '#6e614b', 'rgba(0,0,0,.3)');
    const r1 = this.p(gx + 0.72, gy + 1.32, 26 + lv * 1.5), r2 = this.p(gx + 1.64, gy + 1.32, 26 + lv * 1.5);
    c.strokeStyle = '#8d7a58';
    c.lineWidth = 3 * this.s;
    c.beginPath(); c.moveTo(r1.x, r1.y); c.lineTo(r2.x, r2.y); c.stroke();
    this.flag(gx + 1.55, gy + 1.55, 12, '#8fc45b', 0.7);
    // fence
    c.strokeStyle = 'rgba(160,150,110,.45)';
    c.lineWidth = 1 * this.s;
    const pts = [this.p(gx + 0.15, gy + 1.85), this.p(gx + 1.85, gy + 1.85)];
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y); c.lineTo(pts[1].x, pts[1].y); c.stroke();
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const x = pts[0].x + (pts[1].x - pts[0].x) * t;
      const y = pts[0].y + (pts[1].y - pts[0].y) * t;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 7 * this.s); c.stroke();
    }
  }

  drawPower(gx, gy, lv) {
    const c = this.ctx;
    const h = 30 + lv * 2;
    this.prism(gx + 0.55, gy + 0.65, 0.9, 0.75, h, '#4e5a61', '#354147', '#283238');
    this.diamond(gx + 0.55, gy + 0.65, 0.9, 0.75, h + 1, '#60707a', 'rgba(0,0,0,.3)');
    // reactor dome
    const dc = this.p(gx + 1.0, gy + 1.0, h);
    c.fillStyle = '#4a5c66';
    c.beginPath();
    c.ellipse(dc.x, dc.y - 6 * this.s, 22 * this.s, 17 * this.s, 0, Math.PI, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(106,169,255,.5)';
    c.beginPath();
    c.ellipse(dc.x, dc.y - 6 * this.s, 13 * this.s, 9 * this.s, 0, Math.PI, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(106,169,255,.16)';
    c.beginPath(); c.ellipse(dc.x, dc.y, 34 * this.s, 16 * this.s, 0, 0, Math.PI * 2); c.fill();
    // cooling towers
    this.cylinder(gx + 1.45, gy + 0.62, 0.25, 38, '#4a5459', '#5e6b70');
    this.smoke(gx + 1.45, gy + 0.62, 38, 7, '170,185,190', 4, 0.7);
    // pylons
    for (const [x, y] of [[0.28, 1.55], [1.7, 1.55]]) {
      const p = this.p(gx + x, gy + y);
      c.strokeStyle = '#6e7c84';
      c.lineWidth = 1.4 * this.s;
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x, p.y - 26 * this.s); c.stroke();
      c.beginPath(); c.moveTo(p.x - 5 * this.s, p.y - 24 * this.s); c.lineTo(p.x + 5 * this.s, p.y - 24 * this.s); c.stroke();
    }
    // arc
    if (Math.sin(this.t / 300) > 0.55) {
      c.strokeStyle = 'rgba(150,200,255,.8)';
      c.lineWidth = 1.2;
      const a = this.p(gx + 1.0, gy + 1.0, h + 6), b = this.p(gx + 1.3, gy + 0.85, h + 3);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo((a.x + b.x) / 2 + 4, (a.y + b.y) / 2); c.lineTo(b.x, b.y); c.stroke();
    }
  }

  drawBarracks(gx, gy, lv) {
    const h = 20 + lv * 1.8;
    this.prism(gx + 0.25, gy + 0.5, 1.5, 0.9, h, '#50603f', '#39452f', '#2a3323');
    this.faceWindows(gx + 0.25, gy + 0.5, 1.5, 0.9, h, 2, 4, 'rgba(255,205,120,.45)');
    this.diamond(gx + 0.25, gy + 0.5, 1.5, 0.9, h + 1, '#61724c', 'rgba(0,0,0,.3)');
    // roof tent
    const a = this.p(gx + 0.25, gy + 0.5, h + 2), b = this.p(gx + 1.75, gy + 0.5, h + 2);
    const cc = this.p(gx + 1.75, gy + 1.4, h + 2), dd = this.p(gx + 0.25, gy + 1.4, h + 2);
    const top = this.p(gx + 1.0, gy + 0.95, h + 14);
    this.poly([a, b, top], '#5e6e45');
    this.poly([b, cc, top], '#4e5c39');
    this.poly([cc, dd, top], '#445032');
    this.poly([dd, a, top], '#556440');
    // entrance & troops
    this.poly([this.p(gx + 0.85, gy + 1.4, 0), this.p(gx + 1.18, gy + 1.4, 0), this.p(gx + 1.18, gy + 1.4, 11), this.p(gx + 0.85, gy + 1.4, 11)], 'rgba(20,26,17,.8)');
    this.flag(gx + 0.34, gy + 1.42, 4, '#83c65a', 0.85);
    this.crates(gx + 1.55, gy + 1.5, 3, 5);
    // fence posts
    this.sandbags(gx + 1.48, gy + 1.15);
  }

  drawFactory(gx, gy, lv, w, d) {
    const h = 28 + lv * 2;
    this.prism(gx + 0.2, gy + 0.35, 1.6, 1.05, h, '#5a5c57', '#3c403c', '#2c302d');
    // sawtooth roof
    for (let i = 0; i < 3; i++) {
      const x0 = gx + 0.2 + i * 0.53;
      const a = this.p(x0, gy + 0.35, h + 1), b = this.p(x0 + 0.53, gy + 0.35, h + 1);
      const t = this.p(x0 + 0.34, gy + 0.35, h + 8);
      this.poly([a, b, t], i % 2 ? 'rgba(95,102,96,.75)' : 'rgba(80,87,82,.75)');
    }
    this.faceWindows(gx + 0.2, gy + 0.35, 1.6, 1.05, h, 2, 5, 'rgba(150,200,255,.28)', 0.75);
    // chimney
    this.cylinder(gx + 1.52, gy + 0.62, 0.19, h + 34, '#6a655a', '#847e6f');
    this.smoke(gx + 1.52, gy + 0.62, h + 34, 6, '90,92,85', 4, 0.55);
    // loading bay
    this.diamond(gx + 0.3, gy + 1.45, 1.05, 0.35, 0, 'rgba(20,25,24,.8)', 'rgba(200,200,180,.12)');
    this.crates(gx + 1.55, gy + 1.52, 3, 7);
    // crane
    const c = this.ctx;
    const cp = this.p(gx + 0.22, gy + 1.28);
    c.strokeStyle = '#c79a45';
    c.lineWidth = 2 * this.s;
    c.beginPath(); c.moveTo(cp.x, cp.y); c.lineTo(cp.x, cp.y - 38 * this.s); c.stroke();
    c.beginPath(); c.moveTo(cp.x, cp.y - 38 * this.s); c.lineTo(cp.x + 28 * this.s, cp.y - 34 * this.s); c.stroke();
    c.beginPath(); c.moveTo(cp.x + 25 * this.s, cp.y - 34 * this.s); c.lineTo(cp.x + 25 * this.s, cp.y - 18 * this.s); c.stroke();
  }

  drawWarehouse(gx, gy, lv) {
    const h = 20 + lv * 1.6;
    this.prism(gx + 0.2, gy + 0.45, 1.6, 0.95, h, '#4c4c44', '#353630', '#282923');
    this.diamond(gx + 0.2, gy + 0.45, 1.6, 0.95, h + 1, '#5c5c52', 'rgba(0,0,0,.3)');
    // container stacks
    const colors = ['#7d4d2c', '#38605c', '#6a5a36', '#4e5b73'];
    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const p = this.p(gx + 0.4 + col * 0.62, gy + 1.5 + row * 0.24);
      const s = this.s;
      const c = this.ctx;
      c.fillStyle = colors[i];
      c.fillRect(p.x - 14 * s, p.y - 9 * s, 28 * s, 9 * s);
      c.fillStyle = 'rgba(255,255,255,.1)';
      c.fillRect(p.x - 14 * s, p.y - 9 * s, 28 * s, 2 * s);
      c.strokeStyle = 'rgba(0,0,0,.35)';
      c.strokeRect(p.x - 14 * s, p.y - 9 * s, 28 * s, 9 * s);
      for (let k = -2; k <= 2; k++) {
        c.beginPath(); c.moveTo(p.x + k * 4 * s, p.y - 8 * s); c.lineTo(p.x + k * 4 * s, p.y - s); c.stroke();
      }
    }
    // forklift
    const f = this.p(gx + 1.52, gy + 1.2);
    const s = this.s;
    this.ctx.fillStyle = '#b9852f';
    this.ctx.fillRect(f.x - 5 * s, f.y - 7 * s, 10 * s, 7 * s);
    this.ctx.fillRect(f.x - 2 * s, f.y - 14 * s, 2 * s, 8 * s);
    this.ctx.fillRect(f.x + 2 * s, f.y - 14 * s, 1.5 * s, 8 * s);
  }

  drawLab(gx, gy, lv) {
    const h = 24 + lv * 2;
    this.prism(gx + 0.28, gy + 0.4, 1.44, 0.95, h, '#466066', '#30454a', '#233338');
    this.faceWindows(gx + 0.28, gy + 0.4, 1.44, 0.95, h, 3, 4, 'rgba(80,225,215,.45)');
    this.diamond(gx + 0.28, gy + 0.4, 1.44, 0.95, h + 1, '#537078', 'rgba(0,0,0,.3)');
    // dome
    const c = this.ctx;
    const dc = this.p(gx + 1.35, gy + 1.18, h + 2);
    c.fillStyle = '#3c5b60';
    c.beginPath(); c.ellipse(dc.x, dc.y - 3 * this.s, 20 * this.s, 16 * this.s, 0, Math.PI, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(69,211,198,.35)';
    c.beginPath(); c.ellipse(dc.x, dc.y - 3 * this.s, 13 * this.s, 10 * this.s, 0, Math.PI, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(69,211,198,.35)';
    c.lineWidth = 1;
    c.beginPath(); c.ellipse(dc.x, dc.y - 3 * this.s, 20 * this.s, 16 * this.s, 0, Math.PI, Math.PI * 2); c.stroke();
    this.antenna(gx + 0.52, gy + 1.18, h, 22);
    // satellite dish
    const dp = this.p(gx + 0.55, gy + 0.62, h + 2);
    const ang = Math.sin(this.t / 1400) * 0.5;
    c.save();
    c.translate(dp.x, dp.y);
    c.rotate(ang);
    c.strokeStyle = '#8ba2a4';
    c.lineWidth = 2 * this.s;
    c.beginPath(); c.ellipse(0, 0, 10 * this.s, 5 * this.s, -0.5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-7 * this.s, 8 * this.s); c.stroke();
    c.restore();
  }

  drawMarket(gx, gy, lv) {
    const c = this.ctx;
    // stalls
    const stalls = [[0.35, 0.75, '#b9782f'], [1.05, 0.65, '#a34b3f'], [0.55, 1.35, '#4c7a6e'], [1.25, 1.28, '#b8953c']];
    for (const [x, y, col] of stalls) {
      const base = this.p(gx + x, gy + y);
      const s = this.s;
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.fillRect(base.x - 14 * s, base.y - 5 * s, 28 * s, 7 * s);
      c.fillStyle = '#2e2a22';
      c.fillRect(base.x - 13 * s, base.y - 13 * s, 26 * s, 9 * s);
      // canopy
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(base.x - 16 * s, base.y - 13 * s);
      c.lineTo(base.x + 16 * s, base.y - 13 * s);
      c.lineTo(base.x + 13 * s, base.y - 21 * s);
      c.lineTo(base.x - 13 * s, base.y - 21 * s);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,.3)';
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,.22)';
      c.fillRect(base.x - 13 * s, base.y - 21 * s, 26 * s, 2 * s);
      c.fillStyle = col;
      for (let k = 0; k < 2; k++) {
        c.fillRect(base.x - 14 * s + k * 15 * s, base.y - 13 * s, 1.5 * s, 9 * s);
      }
    }
    // crates
    this.crates(gx + 1.55, gy + 1.55, 3, 5);
    // string lights
    const a = this.p(gx + 0.2, gy + 0.5, 24), b = this.p(gx + 1.8, gy + 0.6, 26);
    c.strokeStyle = 'rgba(255,210,130,.25)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 8 * this.s, b.x, b.y); c.stroke();
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 7 * this.s;
      c.fillStyle = i % 2 ? 'rgba(255,200,100,.9)' : 'rgba(255,120,80,.9)';
      c.beginPath(); c.arc(x, y, 1.5 * this.s, 0, Math.PI * 2); c.fill();
    }
  }

  drawRadar(gx, gy, lv) {
    const c = this.ctx;
    const h = 16 + lv;
    this.prism(gx + 0.55, gy + 0.95, 0.9, 0.7, h, '#45565a', '#2e3c3f', '#233033');
    // lattice tower
    const base = this.p(gx + 1.0, gy + 1.0, h);
    const topY = base.y - 38 * this.s;
    c.strokeStyle = '#6d8188';
    c.lineWidth = 1.6 * this.s;
    c.beginPath(); c.moveTo(base.x - 12 * this.s, base.y); c.lineTo(base.x, topY);
    c.lineTo(base.x + 12 * this.s, base.y); c.moveTo(base.x - 6 * this.s, base.y - 18 * this.s); c.lineTo(base.x + 6 * this.s, base.y - 18 * this.s); c.stroke();
    // dish
    const ang = this.t / 1100;
    c.save();
    c.translate(base.x, topY - 4 * this.s);
    c.rotate(Math.sin(ang) * 0.28);
    c.fillStyle = '#93a6aa';
    c.beginPath();
    c.ellipse(0, 0, 15 * this.s, 7 * this.s, -0.6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(20,35,40,.65)';
    c.beginPath();
    c.ellipse(0, 0, 12 * this.s, 5 * this.s, -0.6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(69,211,198,.7)';
    c.lineWidth = 1;
    c.stroke();
    c.strokeStyle = '#8ba0a4';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-8 * this.s, 9 * this.s); c.stroke();
    c.restore();
    // sweep beam
    const sweep = (this.t / 3600) % 1;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(69,211,198,${0.06 + 0.05 * Math.sin(this.t / 700)})`;
    c.beginPath();
    c.moveTo(base.x, topY - 4 * this.s);
    c.arc(base.x, topY - 4 * this.s, 70 * this.s, sweep * Math.PI * 2, sweep * Math.PI * 2 + 0.5);
    c.closePath();
    c.fill();
    c.restore();
    this.antenna(gx + 1.55, gy + 1.5, h, 18);
  }

  drawAirbase(gx, gy, lv) {
    const c = this.ctx;
    const h = 22 + lv * 1.5;
    // runway
    this.diamond(gx + 0.12, gy + 0.2, 1.76, 1.7, 0, 'rgba(22,29,31,.85)', 'rgba(200,210,200,.12)');
    this.flag(gx + 0.3, gy + 0.4, 4, '#e3594c', 0.6);
    // hangar
    this.prism(gx + 0.25, gy + 0.85, 0.85, 0.7, h, '#4a5659', '#333f43', '#263136');
    this.diamond(gx + 0.25, gy + 0.85, 0.85, 0.7, h + 1, '#5a676b', 'rgba(0,0,0,.3)');
    // helipad
    const hp = this.p(gx + 1.38, gy + 1.12);
    c.strokeStyle = 'rgba(220,235,240,.5)';
    c.lineWidth = 1.4 * this.s;
    c.beginPath(); c.ellipse(hp.x, hp.y, 19 * this.s, 9 * this.s, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(220,235,240,.55)';
    c.font = `700 ${10 * this.s}px "Barlow Condensed",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('H', hp.x, hp.y);
    // helicopter
    const hx = gx + 1.38, hy = gy + 1.12;
    const hover = Math.sin(this.t / 600) * 1.5;
    const cp = this.p(hx, hy, 8 + hover);
    c.fillStyle = '#2e3638';
    c.fillRect(cp.x - 8 * this.s, cp.y - 4 * this.s, 16 * this.s, 5 * this.s);
    c.fillRect(cp.x + 5 * this.s, cp.y - 3 * this.s, 9 * this.s, 2.4 * this.s);
    c.strokeStyle = 'rgba(200,220,225,.6)';
    c.lineWidth = 1.2 * this.s;
    const rotor = 22 * this.s;
    c.beginPath(); c.moveTo(cp.x - rotor, cp.y - 6 * this.s); c.lineTo(cp.x + rotor, cp.y - 6 * this.s); c.stroke();
    c.beginPath(); c.moveTo(cp.x - rotor * 0.6, cp.y - 7.5 * this.s); c.lineTo(cp.x + rotor * 0.6, cp.y - 4.5 * this.s); c.stroke();
    c.strokeStyle = '#5d6b6e';
    c.beginPath(); c.moveTo(cp.x, cp.y - 4 * this.s); c.lineTo(cp.x, cp.y - 8 * this.s); c.stroke();
    // truck
    this.crates(gx + 0.4, gy + 1.6, 2, 5);
  }

  drawHospital(gx, gy, lv) {
    const h = 25 + lv * 2;
    this.prism(gx + 0.25, gy + 0.45, 1.5, 1.0, h, '#b8c3c4', '#8a999b', '#6c7b7e', 'rgba(0,0,0,.28)');
    this.faceWindows(gx + 0.25, gy + 0.45, 1.5, 1.0, h, 3, 4, 'rgba(110,190,200,.45)', 0.8);
    this.diamond(gx + 0.25, gy + 0.45, 1.5, 1.0, h + 1, '#cbd5d4', 'rgba(0,0,0,.25)');
    // red cross on roof
    const center = this.p(gx + 1.0, gy + 0.95, h + 1.5);
    const s = this.s;
    const c = this.ctx;
    c.fillStyle = '#d94c44';
    c.fillRect(center.x - 3.5 * s, center.y - 11 * s, 7 * s, 22 * s);
    c.fillRect(center.x - 11 * s, center.y - 3.5 * s, 22 * s, 7 * s);
    // ambulance
    const a = this.p(gx + 1.62, gy + 1.62);
    c.fillStyle = '#d7dedd';
    c.fillRect(a.x - 8 * s, a.y - 10 * s, 16 * s, 9 * s);
    c.fillStyle = '#c9433b';
    c.fillRect(a.x - 8 * s, a.y - 10 * s, 16 * s, 2 * s);
    c.fillStyle = '#26363c';
    c.fillRect(a.x - 5 * s, a.y - 7 * s, 4 * s, 3 * s);
    this.flag(gx + 1.72, gy + 0.55, 4, '#d94c44', 0.65);
  }

  drawWall(gx, gy, lv) {
    const c = this.ctx;
    const h = 16 + Math.min(12, lv * 1.5);
    for (let i = 0; i < 3; i++) {
      const x = gx + 0.15 + i * 0.58;
      this.prism(x, gy + 0.65, 0.44, 0.55, h, '#7b888c', '#566367', '#435054');
      // top spikes
      for (let k = 0; k < 2; k++) {
        const p = this.p(x + 0.1 + k * 0.2, gy + 0.9, h);
        c.fillStyle = '#93a0a3';
        c.beginPath(); c.moveTo(p.x - 3 * this.s, p.y); c.lineTo(p.x, p.y - 6 * this.s); c.lineTo(p.x + 3 * this.s, p.y); c.fill();
      }
    }
    // gate
    this.poly([
      this.p(gx + 0.72, gy + 1.42, 0), this.p(gx + 1.18, gy + 1.42, 0),
      this.p(gx + 1.18, gy + 1.42, h), this.p(gx + 0.72, gy + 1.42, h)
    ], 'rgba(22,30,32,.85)', 'rgba(242,166,59,.3)');
    this.flag(gx + 1.65, gy + 1.45, 4, '#8f9dab', 0.6);
    this.sandbags(gx + 0.25, gy + 1.48);
  }

  drawPlot(def) {
    const c = this.ctx;
    const { gx, gy, w, d } = def;
    const p = this.p(gx + w / 2, gy + d / 2, 0);
    // foundation
    this.diamond(gx + 0.25, gy + 0.25, w - 0.5, d - 0.5, 0, 'rgba(33,42,44,.6)', 'rgba(180,195,190,.18)', 1.5);
    c.save();
    c.setLineDash([5 * this.s, 5 * this.s]);
    this.diamond(gx + 0.4, gy + 0.4, w - 0.8, d - 0.8, 0, null, 'rgba(242,166,59,.45)', 1.5);
    c.restore();
    // hazard corners
    c.fillStyle = 'rgba(242,166,59,.7)';
    for (const [cx, cy] of [[gx + 0.32, gy + 0.32], [gx + w - 0.38, gy + 0.32], [gx + w - 0.38, gy + d - 0.38], [gx + 0.32, gy + d - 0.38]]) {
      const pt = this.p(cx, cy);
      c.fillRect(pt.x - 2 * this.s, pt.y - 2 * this.s, 4 * this.s, 4 * this.s);
    }
    // crates
    this.crates(gx + 0.5, gy + d - 0.55, 2, 5);
    // scaffolding
    const sx = gx + w - 0.62, sy = gy + 0.55;
    const a = this.p(sx, sy);
    c.strokeStyle = 'rgba(200,190,160,.4)';
    c.lineWidth = 1.5 * this.s;
    c.beginPath();
    c.moveTo(a.x, a.y); c.lineTo(a.x, a.y - 20 * this.s);
    c.moveTo(a.x + 10 * this.s, a.y + 4 * this.s); c.lineTo(a.x + 10 * this.s, a.y - 16 * this.s);
    c.moveTo(a.x, a.y - 20 * this.s); c.lineTo(a.x + 10 * this.s, a.y - 16 * this.s);
    c.stroke();
    // sign
    const s = this.p(gx + 1, gy + 1, 14);
    c.fillStyle = 'rgba(8,13,18,.75)';
    c.fillRect(s.x - 13 * this.s, s.y - 5 * this.s, 26 * this.s, 10 * this.s);
    c.strokeStyle = 'rgba(242,166,59,.6)';
    c.strokeRect(s.x - 13 * this.s, s.y - 5 * this.s, 26 * this.s, 10 * this.s);
    c.fillStyle = 'rgba(255,210,130,.85)';
    c.font = `700 ${7.5 * this.s}px "Barlow Condensed",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('CONSTRUIR', s.x, s.y);
  }

  destroy() {
    this.stop();
    this.canvas.removeEventListener('pointermove', this._onMove);
    this.canvas.removeEventListener('pointerleave', this._onLeave);
    this.canvas.removeEventListener('pointerdown', this._onDown);
    this._ro.disconnect();
  }
}
