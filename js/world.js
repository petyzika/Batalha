/* ============================================================
   Mapa estratégico mundial — COMANDO GLOBAL
   ============================================================ */
import { TARGETS, TARGET_BY_ID, FACTION_COLORS, targetTravel, clamp } from './data.js';
import { state } from './state.js';

const BASE = { x: 53, y: 48 };

function smoothPath(c, pts, close = true) {
  const n = pts.length;
  if (n < 3) return;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const first = mid(pts[n - 1], pts[0]);
  c.beginPath();
  c.moveTo(first.x, first.y);
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const m = mid(cur, next);
    c.quadraticCurveTo(cur.x, cur.y, m.x, m.y);
  }
  if (close) c.closePath();
}

function ring(c, x, y, r, color, lw = 1, dash = null) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = lw;
  if (dash) c.setLineDash(dash);
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}

const LAND = [
  [17, 12], [30, 7], [46, 9], [62, 8], [78, 14], [90, 24], [94, 38],
  [91, 53], [85, 67], [76, 81], [60, 91], [45, 90], [31, 84], [19, 72],
  [10, 57], [7, 41], [10, 25]
];

const ISLANDS = [
  [[6, 66], [11, 62], [14, 68], [12, 75], [7, 73]],
  [[88, 79], [93, 76], [96, 82], [92, 87], [88, 85]],
  [[63, 3], [67, 1], [70, 4], [66, 6]]
];

export class WorldRenderer {
  constructor(canvas, markerLayer, opts = {}) {
    this.canvas = canvas;
    this.layer = markerLayer;
    this.ctx = canvas.getContext('2d');
    this.onSelect = opts.onSelect || (() => {});
    this.dpr = 1;
    this.w = 1;
    this.h = 1;
    this.t = 0;
    this.running = false;
    this.static = null;
    this.markers = new Map();
    this.selected = null;
    this._raf = 0;
    this._last = 0;
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas.parentElement || canvas);
    this.buildMarkers();
    this.resize();
  }

  buildMarkers() {
    this.layer.innerHTML = '';
    for (const t of TARGETS) {
      const b = document.createElement('button');
      b.className = 'wmarker enemy';
      b.dataset.target = t.id;
      b.style.left = `${t.x}%`;
      b.style.top = `${t.y}%`;
      b.setAttribute('aria-label', `${t.name}, nível ${t.level}, ${t.faction}`);
      b.innerHTML = `
        <span class="wm-diamond">
          <svg class="ico" aria-hidden="true"><use href="#${t.player ? 'i-crown' : 'i-flag'}"/></svg>
          <span class="wm-lvl">${t.player ? 'BASE' : t.level}</span>
        </span>
        <span class="wm-label">${t.name} · ${t.player ? 'SEU QG' : 'Nv ' + t.level}</span>
        ${t.player ? '<span class="wm-player-ring"></span><span class="wm-player-ring d2"></span>' : ''}`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelect(t.id);
      });
      this.layer.appendChild(b);
      this.markers.set(t.id, b);
    }
    this.refresh();
  }

  refresh() {
    for (const t of TARGETS) {
      const el = this.markers.get(t.id);
      if (!el) continue;
      const owner = state.targets[t.id]?.owner || 'enemy';
      el.classList.toggle('player', !!t.player);
      el.classList.toggle('conquered', !t.player && owner === 'player');
      el.classList.toggle('enemy', !t.player && owner !== 'player');
      el.classList.toggle('selected', this.selected === t.id);
      const lvl = el.querySelector('.wm-lvl');
      if (lvl) lvl.textContent = t.player ? 'BASE' : (owner === 'player' ? '✓' : t.level);
      const label = el.querySelector('.wm-label');
      if (label) label.textContent = `${t.name} · ${t.player ? 'SEU QG' : owner === 'player' ? 'DOMINADO' : 'Nv ' + t.level}`;
    }
  }

  setSelected(id) {
    this.selected = id;
    this.refresh();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.buildStatic();
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
      this.draw();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  /* ---------------- static terrain ---------------- */
  buildStatic() {
    const w = this.w, h = this.h, dpr = this.dpr;
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    const X = (p) => (p / 100) * w;
    const Y = (p) => (p / 100) * h;

    // ocean
    const bg = c.createRadialGradient(w * 0.52, h * 0.46, 20, w * 0.52, h * 0.46, Math.max(w, h) * 0.8);
    bg.addColorStop(0, '#102e3d');
    bg.addColorStop(0.55, '#091a25');
    bg.addColorStop(1, '#040f18');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);

    // sea texture
    c.save();
    c.globalAlpha = 0.22;
    c.strokeStyle = 'rgba(115,175,195,.27)';
    c.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = (i * 37.7) % w;
      const y = (i * 61.3) % h;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 12, y - 4, x + 26, y);
      c.stroke();
    }
    c.restore();

    // faction territories (soft glows)
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const t of TARGETS) {
      if (t.player) continue;
      const col = FACTION_COLORS[t.faction] || '#e3594c';
      const g = c.createRadialGradient(X(t.x), Y(t.y), 2, X(t.x), Y(t.y), Math.max(70, w * 0.09));
      g.addColorStop(0, this.hexA(col, 0.17));
      g.addColorStop(0.6, this.hexA(col, 0.07));
      g.addColorStop(1, this.hexA(col, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(X(t.x), Y(t.y), Math.max(70, w * 0.09), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // main landmass
    const pts = LAND.map(([x, y]) => ({ x: X(x), y: Y(y) }));
    c.save();
    c.shadowColor = 'rgba(0,0,0,.75)';
    c.shadowBlur = 30;
    c.shadowOffsetY = 12;
    smoothPath(c, pts);
    const lg = c.createLinearGradient(0, 0, w, h);
    lg.addColorStop(0, '#33483f');
    lg.addColorStop(0.42, '#2b3d35');
    lg.addColorStop(0.7, '#3a4031');
    lg.addColorStop(1, '#233631');
    c.fillStyle = lg;
    c.fill();
    c.restore();
    // coast glow layers
    smoothPath(c, pts);
    c.strokeStyle = 'rgba(96,195,200,.34)';
    c.lineWidth = 7;
    c.stroke();
    smoothPath(c, pts);
    c.strokeStyle = 'rgba(150,230,225,.55)';
    c.lineWidth = 1.2;
    c.stroke();

    // islands
    for (const isl of ISLANDS) {
      const ip = isl.map(([x, y]) => ({ x: X(x), y: Y(y) }));
      smoothPath(c, ip);
      c.fillStyle = '#293c36';
      c.fill();
      c.strokeStyle = 'rgba(120,190,190,.3)';
      c.lineWidth = 1;
      c.stroke();
    }

    // terrain bands / ridges
    c.save();
    smoothPath(c, pts);
    c.clip();
    // desert (south-west)
    const dg = c.createRadialGradient(X(22), Y(68), 10, X(22), Y(68), w * 0.18);
    dg.addColorStop(0, 'rgba(142,122,68,.52)');
    dg.addColorStop(1, 'rgba(120,105,62,0)');
    c.fillStyle = dg;
    c.fillRect(0, 0, w, h);
    // northern forests
    const fg = c.createRadialGradient(X(35), Y(22), 10, X(35), Y(22), w * 0.26);
    fg.addColorStop(0, 'rgba(60,102,63,.62)');
    fg.addColorStop(1, 'rgba(54,84,56,0)');
    c.fillStyle = fg;
    c.fillRect(0, 0, w, h);
    // red plains (east)
    const rg = c.createRadialGradient(X(78), Y(52), 10, X(78), Y(52), w * 0.24);
    rg.addColorStop(0, 'rgba(116,66,48,.5)');
    rg.addColorStop(1, 'rgba(94,58,44,0)');
    c.fillStyle = rg;
    c.fillRect(0, 0, w, h);

    // rivers
    c.strokeStyle = 'rgba(92,175,185,.3)';
    c.lineWidth = Math.max(1.5, w * 0.0022);
    c.beginPath();
    c.moveTo(X(41), Y(11));
    c.bezierCurveTo(X(47), Y(28), X(38), Y(42), X(46), Y(58));
    c.bezierCurveTo(X(52), Y(70), X(44), Y(80), X(51), Y(90));
    c.stroke();
    c.beginPath();
    c.moveTo(X(86), Y(28));
    c.bezierCurveTo(X(78), Y(40), X(82), Y(55), X(72), Y(66));
    c.stroke();

    // mountain ranges
    this.mountains(c, [
      [31, 27, 26], [36, 24, 20], [41, 26, 23], [26, 34, 17], [22, 42, 15],
      [70, 26, 15], [74, 31, 20], [78, 36, 17], [62, 68, 18], [68, 72, 15]
    ], X, Y);
    // forests
    c.fillStyle = 'rgba(57,93,61,.62)';
    for (let i = 0; i < 120; i++) {
      const x = 14 + (i * 17.3) % 70;
      const y = 12 + (i * 29.7) % 72;
      if (y > 34 && y < 58 && x > 55) continue;
      c.beginPath();
      c.arc(X(x), Y(y), 1.4 + (i % 3) * 0.6, 0, Math.PI * 2);
      c.fill();
    }
    // roads network
    const edges = [
      ['t1', 't2'], ['t2', 't14'], ['t14', 't13'], ['t13', 't12'], ['t12', 't11'],
      ['t11', 't10'], ['t10', 't9'], ['t9', 't8'], ['t8', 't7'], ['t7', 't6'],
      ['t6', 't5'], ['t5', 't4'], ['t4', 't3'], ['t3', 't15'], ['t15', 't16'],
      ['t16', 't17'], ['t17', 't14'], ['t16', 't18'], ['t15', 't18'], ['t5', 't16']
    ];
    c.save();
    c.lineWidth = Math.max(1.2, w * 0.0016);
    c.strokeStyle = 'rgba(220,198,148,.25)';
    for (const [a, b] of edges) {
      const ta = TARGET_BY_ID[a], tb = TARGET_BY_ID[b];
      if (!ta || !tb) continue;
      c.beginPath();
      c.moveTo(X(ta.x), Y(ta.y));
      c.quadraticCurveTo(X((ta.x + tb.x) / 2 + 2), Y((ta.y + tb.y) / 2 - 2), X(tb.x), Y(tb.y));
      c.stroke();
    }
    c.restore();
    c.restore();

    // latitude / longitude grid
    c.save();
    c.strokeStyle = 'rgba(130,180,200,.06)';
    c.lineWidth = 1;
    c.setLineDash([3, 7]);
    for (let i = 1; i < 10; i++) {
      c.beginPath(); c.moveTo((w * i) / 10, 0); c.lineTo((w * i) / 10, h); c.stroke();
      c.beginPath(); c.moveTo(0, (h * i) / 10); c.lineTo(w, (h * i) / 10); c.stroke();
    }
    c.restore();

    // labels
    const labels = [
      ['PLANÍCIE VERMELHA', 72, 44, 'rgba(227,120,100,.55)'],
      ['DESERTO DE VIDRO', 19, 70, 'rgba(232,193,90,.5)'],
      ['FLORESTA NEGRA', 30, 20, 'rgba(140,170,130,.42)'],
      ['MAR DE CINZAS', 51, 68, 'rgba(150,180,190,.32)'],
      ['PORTO NEGRO', 81, 58, 'rgba(190,200,210,.35)']
    ];
    c.save();
    c.textAlign = 'center';
    c.font = `600 ${Math.max(7, w * 0.0072)}px "Barlow Condensed",sans-serif`;
    for (const [txt, x, y, col] of labels) {
      c.fillStyle = col;
      c.save();
      c.translate(X(x), Y(y));
      c.letterSpacing = '2px';
      c.fillText(txt, 0, 0);
      c.restore();
    }
    c.restore();

    // map border ticks
    c.save();
    c.strokeStyle = 'rgba(180,200,210,.16)';
    c.lineWidth = 1;
    for (let i = 0; i < 25; i++) {
      const x = (w * i) / 24;
      c.beginPath(); c.moveTo(x, h - 8); c.lineTo(x, h - 2); c.stroke();
      const y = (h * i) / 24;
      c.beginPath(); c.moveTo(w - 8, y); c.lineTo(w - 2, y); c.stroke();
    }
    c.restore();

    this.static = cv;
  }

  mountains(c, list, X, Y) {
    for (const [x, y, s] of list) {
      const px = X(x), py = Y(y);
      const size = s * (this.w / 900) * 1.4;
      c.fillStyle = 'rgba(46,58,52,.88)';
      c.beginPath();
      c.moveTo(px - size, py + size * 0.4);
      c.lineTo(px, py - size * 0.65);
      c.lineTo(px + size, py + size * 0.4);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(82,99,86,.78)';
      c.beginPath();
      c.moveTo(px - size * 0.15, py - size * 0.28);
      c.lineTo(px, py - size * 0.65);
      c.lineTo(px + size * 0.5, py + size * 0.1);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(190,205,190,.22)';
      c.beginPath();
      c.moveTo(px - size * 0.18, py - size * 0.42);
      c.lineTo(px, py - size * 0.65);
      c.lineTo(px + size * 0.18, py - size * 0.42);
      c.closePath();
      c.fill();
    }
  }

  hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------------- dynamic frame ---------------- */
  draw() {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    if (this.static) c.drawImage(this.static, 0, 0, this.w, this.h);
    const X = (p) => (p / 100) * this.w;
    const Y = (p) => (p / 100) * this.h;
    const bx = X(BASE.x), by = Y(BASE.y);

    // radar sweep at player base
    c.save();
    c.globalCompositeOperation = 'lighter';
    const sweep = (this.t / 4200) % 1;
    const rad = Math.max(55, this.w * 0.075);
    c.fillStyle = 'rgba(69,211,198,.035)';
    c.beginPath();
    c.arc(bx, by, rad, 0, Math.PI * 2);
    c.fill();
    const sg = c.createRadialGradient(bx, by, 3, bx, by, rad);
    sg.addColorStop(0, 'rgba(69,211,198,.18)');
    sg.addColorStop(1, 'rgba(69,211,198,0)');
    c.fillStyle = sg;
    c.beginPath();
    c.moveTo(bx, by);
    c.arc(bx, by, rad, sweep * Math.PI * 2, sweep * Math.PI * 2 + 0.55);
    c.closePath();
    c.fill();
    c.restore();
    ring(c, bx, by, rad * 0.55, 'rgba(69,211,198,.18)', 1, [4, 7]);
    ring(c, bx, by, rad, 'rgba(69,211,198,.12)', 1, [2, 9]);

    // selection route
    if (this.selected && TARGET_BY_ID[this.selected] && !TARGET_BY_ID[this.selected].player) {
      const t = TARGET_BY_ID[this.selected];
      const tx = X(t.x), ty = Y(t.y);
      this.rotateDash(c, bx, by, tx, ty, this.t, 'rgba(242,166,59,.55)', Math.max(1, this.w * 0.002));
      const midx = (bx + tx) / 2, midy = (by + ty) / 2;
      const travel = targetTravel(t);
      this.tag(c, midx, midy - 8, `${travel}s · MARCHA`, 'rgba(242,166,59,.8)', 'rgba(8,13,18,.8)');
      const pulse = 4 + Math.sin(this.t / 250) * 2;
      ring(c, tx, ty, 16 + pulse, 'rgba(242,166,59,.55)', 1.5);
    }

    // active marches
    for (const m of state.marches) {
      const t = TARGET_BY_ID[m.targetId];
      if (!t) continue;
      const tx = X(t.x), ty = Y(t.y);
      const remain = clamp((m.arriveAt - Date.now()) / (m.travel * 1000), 0, 1);
      const progress = 1 - remain;
      this.rotateDash(c, bx, by, tx, ty, this.t, 'rgba(69,211,198,.35)', Math.max(1, this.w * 0.002));
      // moving convoy marker
      const px = bx + (tx - bx) * progress, py = by + (ty - by) * progress;
      c.save();
      c.fillStyle = '#45d3c6';
      c.shadowColor = '#45d3c6';
      c.shadowBlur = 10;
      c.beginPath();
      c.arc(px, py, 3.5, 0, Math.PI * 2);
      c.fill();
      c.restore();
      // arrowhead near target
      const ang = Math.atan2(ty - by, tx - bx);
      c.save();
      c.fillStyle = 'rgba(69,211,198,.7)';
      c.translate(tx, ty);
      c.rotate(ang);
      c.beginPath();
      c.moveTo(-2, 0); c.lineTo(-9, -4); c.lineTo(-9, 4);
      c.closePath(); c.fill();
      c.restore();
      this.tag(c, (bx + tx) / 2, (by + ty) / 2 + 8, `${Math.ceil((m.arriveAt - Date.now()) / 1000)}s`, 'rgba(130,235,225,.9)', 'rgba(6,16,20,.85)');
    }

    // moving clouds / smoke
    c.save();
    c.globalAlpha = 0.05;
    c.fillStyle = '#d9e8ee';
    for (let i = 0; i < 5; i++) {
      const x = ((this.t / 90 + i * 260) % (this.w + 300)) - 150;
      const y = this.h * (0.15 + i * 0.16);
      c.beginPath();
      c.ellipse(x, y, 90 + i * 20, 24 + i * 4, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // vignette
    const vg = c.createRadialGradient(this.w / 2, this.h / 2, this.w * 0.2, this.w / 2, this.h / 2, this.w * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.36)');
    c.fillStyle = vg;
    c.fillRect(0, 0, this.w, this.h);
  }

  rotateDash(c, x1, y1, x2, y2, t, color, lw) {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.setLineDash([6, 8]);
    c.lineDashOffset = -(t / 45) % 14;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.restore();
  }

  tag(c, x, y, text, color, bg) {
    c.save();
    c.font = `700 ${Math.max(8, this.w * 0.0072)}px "Barlow Condensed",sans-serif`;
    const w = c.measureText(text).width + 10;
    c.fillStyle = bg;
    c.fillRect(x - w / 2, y - 7, w, 14);
    c.strokeStyle = color;
    c.globalAlpha = 0.5;
    c.lineWidth = 1;
    c.strokeRect(x - w / 2, y - 7, w, 14);
    c.globalAlpha = 1;
    c.fillStyle = color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, x, y + 0.5);
    c.restore();
  }

  destroy() {
    this.stop();
    this._ro.disconnect();
  }
}
