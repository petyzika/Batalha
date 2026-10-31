/* ============================================================
   Interface, painéis e modais — COMANDO GLOBAL
   ============================================================ */
import {
  BUILDING_DEFS, BUILDING_BY_KEY, UNIT_DEFS, UNIT_BY_KEY, TECH_DEFS, TECH_BY_KEY,
  HERO_DEFS, HERO_BY_KEY, HERO_SKILLS, TARGETS, TARGET_BY_ID, MISSIONS,
  RANKING, ALLIANCE_MEMBERS, CHAT_LINES, FACTION_COLORS, RESOURCES, RES_KEYS,
  fmt, fmtTime, fmtTimeShort, targetLoot, targetTravel, heroPortrait, clamp
} from './data.js';
import {
  state, subscribe, production, capacity, energyInfo, troopCap, troopPower, totalPower,
  conqueredCount, domination, marchSlots, targetState, targetOdds, buildingUpgradeInfo,
  queueForBuilding, buildingProductionNow, canAfford, missingResources, upgradeBuilding,
  collectBuilding, trainUnits, unitUnlocked, unlockRequirement, researchCost, researchTime,
  startResearch, selectHero, unlockHero, levelSkill, sendMarch, missionProgress, claimMission,
  resolveArrival, activeBattle, selectBuilding, selectTarget, setView, toggleSetting,
  buildingLevel, armyCount, queuedTroops
} from './state.js';
import {
  click, open, close, success, error, coin, buildStart, buildDone, march, alarm, levelUp, setSound, setMusic
} from './audio.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const ico = (name, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const byId = (id) => document.getElementById(id);
const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

function resIcon(k) { return RESOURCES[k]?.icon || 'credit'; }
function resColor(k) { return RESOURCES[k]?.color || '#f2a63b'; }
function pct(a, b) { return clamp(Math.round((a / Math.max(1, b)) * 100), 0, 100); }

function costChips(cost) {
  return Object.entries(cost).map(([k, v]) => `
    <span class="cost-item ${state.resources[k] < v ? 'missing' : ''}" style="--rc:${resColor(k)}">
      ${ico(resIcon(k))}${fmt(v)}
    </span>`).join('');
}

function lootChips(loot) {
  return Object.entries(loot).filter(([, v]) => v > 0).map(([k, v]) => `
    <span class="loot-item" style="--rc:${resColor(k)}">${ico(resIcon(k))}+${fmt(v)}</span>`).join('');
}

function progressBar(start, finish, cls = '') {
  const now = Date.now();
  const p = clamp(((now - start) / Math.max(1, finish - start)) * 100, 0, 100);
  return `<div class="progress ${cls}"><i data-bar data-start="${start}" data-finish="${finish}" style="width:${p}%"></i></div>`;
}

function timerTag(finish, prefix = '') {
  return `<span class="btn-timer" data-finish="${finish}">${prefix}${fmtTime(finish - Date.now())}</span>`;
}

function heroName() { return HERO_BY_KEY[state.activeHero]?.name || 'COMANDANTE'; }
function distanceToBase(target) { return Math.hypot((target.x - 53) * 1.6, target.y - 48); }

export class UI {
  constructor({ iso, world, battle }) {
    this.iso = iso;
    this.world = world;
    this.battle = battle;
    this.hudResources = byId('hud-resources');
    this.context = byId('context');
    this.dock = byId('dock');
    this.modalRoot = byId('modal-root');
    this.toasts = byId('toasts');
    this.battleRoot = byId('battle-root');
    this.chatFeed = byId('chat-feed');
    this.chatMessages = [];
    this.chatSeed = CHAT_LINES.length - 7;
    this.modalData = null;
    this.attack = null;
    this._lastHud = 0;
    this._toastSeq = 0;
    this.bindEvents();
    this.subscribeState();
    this.seedChat();
    this.renderAll();
    this.startIntervals();
  }

  /* ============================================================
     Eventos
     ============================================================ */
  bindEvents() {
    document.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#modal-root .modal')) return;
        this.closeModal();
      }
    });
    byId('rail').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;
      click();
      setView(btn.dataset.view);
    });
    this.iso.onSelect = (key) => {
      click();
      selectBuilding(key);
      this.iso.select(key);
      this.renderContext();
      if (isMobile()) this.openContext();
    };
    this.world.onSelect = (id) => {
      click();
      selectTarget(id);
      this.world.setSelected(id);
      this.renderContext();
      if (isMobile()) this.openContext();
    };
    this.battleRoot.addEventListener('click', () => { /* battle controla seus botões */ });
    this.chatFeed.addEventListener('click', () => {});
    window.addEventListener('resize', () => {
      if (state.view === 'base') this.iso.resize();
      if (state.view === 'world') this.world.resize();
    });
    // formulário de chat é recriado a cada render da aliança
    document.addEventListener('submit', (e) => {
      const form = e.target.closest('#chat-form');
      if (!form) return;
      e.preventDefault();
      const input = form.querySelector('#chat-input');
      const text = (input?.value || '').trim();
      if (!text) return;
      click();
      this.sendChat(text);
      input.value = '';
      input.focus();
    });
  }

  onClick(e) {
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn && !viewBtn.closest('#rail')) {
      e.preventDefault();
      setView(viewBtn.dataset.view);
      this.closeModal();
      return;
    }
    const actEl = e.target.closest('[data-action]');
    if (!actEl) return;
    const act = actEl.dataset.action;
    const data = actEl.dataset;
    switch (act) {
      case 'toggle-sound': {
        const on = toggleSetting('sound');
        setSound(on);
        this.renderSound();
        this.showToast(on ? 'SOM ATIVADO' : 'SOM DESATIVADO', '', on ? 'good' : '');
        break;
      }
      case 'open-reports': this.openReports(); break;
      case 'open-settings': this.openSettings(); break;
      case 'open-more': this.openMore(); break;
      case 'close-modal': this.closeModal(); break;
      case 'close-context': this.closeContext(); break;
      case 'go-view': setView(data.view); this.closeContext(); this.closeModal(); break;
      case 'upgrade-building': {
        const res = upgradeBuilding(data.building);
        if (!res.ok) { error(); this.showToast('OPERAÇÃO BLOQUEADA', res.msg, 'bad'); }
        else { buildStart(); this.renderAll(); }
        break;
      }
      case 'collect-building': {
        const res = collectBuilding(data.building);
        if (res.ok) coin(); else { error(); this.showToast('COLETA INDISPONÍVEL', res.msg, 'bad'); }
        break;
      }
      case 'open-train': this.openTrain(data.unit); break;
      case 'quick-train': this.quickTrain(data.unit); break;
      case 'train-confirm': this.confirmTrain(); break;
      case 'qty-inc': this.changeQty(parseInt(data.delta, 10)); break;
      case 'qty-max': this.setMaxQty(); break;
      case 'research-tech': this.doResearch(data.tech); break;
      case 'claim-mission': {
        const res = claimMission(data.mission);
        if (res.ok) success(); else { error(); this.showToast('MISSÃO INCOMPLETA', res.msg, 'bad'); }
        break;
      }
      case 'select-hero': {
        const res = selectHero(data.hero);
        if (!res.ok) { error(); this.showToast('COMANDANTE BLOQUEADO', res.msg, 'bad'); }
        else open();
        break;
      }
      case 'unlock-hero': {
        const res = unlockHero(data.hero);
        if (!res.ok) { error(); this.showToast('RECRUTAMENTO BLOQUEADO', res.msg, 'bad'); }
        else { success(); this.renderAll(); }
        break;
      }
      case 'level-skill': {
        const res = levelSkill(data.skill);
        if (!res.ok) { error(); this.showToast('SEM PONTOS', res.msg, 'bad'); }
        else levelUp();
        break;
      }
      case 'attack-target': this.openAttack(data.target); break;
      case 'attack-confirm': this.confirmAttack(); break;
      case 'attack-qty': this.changeAttackQty(data.unit, parseInt(data.delta, 10)); break;
      case 'attack-max': this.maxAttack(data.unit); break;
      case 'world-center': {
        selectTarget(null);
        this.world.setSelected(null);
        this.renderContext();
        break;
      }
      case 'toggle-music': {
        const on = toggleSetting('music');
        setMusic(on);
        this.openSettings();
        break;
      }
      case 'reset-game': this.confirmReset(); break;
      case 'confirm-reset': {
        localStorage.removeItem('comando-global-save-v3');
        location.reload();
        break;
      }
      case 'open-reports-from-battle': this.openReports(); break;
      case 'show-battle': {
        const b = activeBattle();
        if (b) this.openBattle(b);
        break;
      }
      case 'dismiss-modal': this.closeModal(); break;
      default: break;
    }
  }

  subscribeState() {
    subscribe((type, payload) => {
      if (type === 'toast') this.showToast(payload.title, payload.text, payload.kind);
      if (type === 'change') this.onChange();
      if (type === 'tick') this.onTick();
      if (type === 'view') this.applyView(payload.view);
      if (type === 'select') this.renderContext();
      if (type === 'selectTarget') { this.world.setSelected(payload.id); this.renderContext(); }
      if (type === 'arrival') this.queueBattle(payload);
      if (type === 'complete') {
        if (state.view === 'base') this.iso.layout();
        this.world.refresh();
        this.renderContext();
      }
      if (type === 'march') { march(); this.world.refresh(); this.renderDock(); }
    });
  }

  onChange() {
    this.renderHud();
    this.renderView();
    this.renderContext();
    this.renderDock();
    this.world.refresh();
    if (state.view === 'base') this.iso.layout();
  }

  onTick() {
    const now = Date.now();
    if (now - this._lastHud > 950) {
      this._lastHud = now;
      this.renderHud();
    }
    this.updateTimers();
    this.renderDock();
    if ((state.view === 'base' || state.view === 'world') && (!this._lastCtx || now - this._lastCtx > 1200)) {
      this._lastCtx = now;
      // Só recria o painel quando algo relevante muda: recriar a cada tique
      // fazia botões perderem foco e "pularem" sob o cursor.
      this.refreshContextIfNeeded();
    }
  }

  contextSignature() {
    if (state.view === 'base') {
      const key = state.selectedBuilding || 'hq';
      const info = buildingUpgradeInfo(key);
      const q = queueForBuilding(key);
      const energy = energyInfo();
      const collectReady = info.def?.prod && info.level > 0 && Date.now() >= (state.collect[key] || 0) ? 1 : 0;
      return [key, info.level, info.maxed, q?.finishAt || 0, energy.deficit ? 1 : 0, collectReady,
        canAfford(info.cost) ? 1 : 0, state.buildQueue.length, state.trainQueue.length].join('|');
    }
    if (state.view === 'world') {
      const id = state.selectedTarget || '';
      const owner = id ? state.targets[id]?.owner || 'enemy' : '';
      return [id, owner, state.marches.length, state.arrivals.length, armyCount(), conqueredCount(), domination()].join('|');
    }
    return '';
  }

  refreshContextIfNeeded() {
    const sig = this.contextSignature();
    if (sig !== this._ctxSig) this.renderContext();
  }

  /* ============================================================
     HUD / DOCK
     ============================================================ */
  renderHud() {
    const prod = production();
    this.hudResources.innerHTML = [...RES_KEYS, 'gems'].map((k) => {
      const r = RESOURCES[k];
      const amount = state.resources[k] || 0;
      const cap = capacity();
      const near = k !== 'gems' && amount >= cap * 0.96;
      return `<div class="res-chip" style="--rc:${r.color}" title="${r.name}${k !== 'gems' ? ` · capacidade ${fmt(cap)}` : ''}">
        <span class="res-ico">${ico(r.icon)}</span>
        <span class="res-info"><b class="${near ? 'red' : ''}">${fmt(amount)}</b>
        <small class="${k !== 'gems' ? 'rate' : ''}">${k === 'gems' ? 'DIAMANTES' : `+${fmt(prod[k])}/h`}</small></span>
      </div>`;
    }).join('');
    const energy = energyInfo();
    const eEl = byId('hud-energy');
    eEl.classList.toggle('deficit', energy.deficit);
    eEl.innerHTML = `${ico('bolt')}<b>${energy.free}</b>`;
    eEl.title = `Energia: ${energy.use}/${energy.prod} · ${energy.deficit ? 'déficit' : 'estável'}`;
    byId('hud-level').textContent = state.player.level;
    byId('hud-name').textContent = state.player.name;
    byId('hud-power').textContent = fmt(totalPower());
    const badge = byId('report-badge');
    const pending = state.reports.length + state.arrivals.length;
    badge.textContent = pending > 99 ? '99+' : pending;
    badge.dataset.zero = pending ? '0' : '1';
    this.renderSound();
  }

  renderSound() {
    const use = byId('sound-icon')?.querySelector('use');
    if (use) use.setAttribute('href', state.settings.sound ? '#i-volume' : '#i-mute');
  }

  renderDock() {
    if (!this.dock) return;
    const slots = [];
    const build = state.buildQueue[0];
    slots.push({
      kind: 'OBRAS', icon: 'home', cls: '',
      label: build ? `${BUILDING_BY_KEY[build.buildingKey].name} · Nv ${build.toLevel}` : 'Nenhuma obra em andamento',
      item: build, empty: 'ENGENHEIROS LIVRES', view: 'base',
      start: build?.startAt, finish: build?.finishAt, extra: state.buildQueue.length > 1 ? `+${state.buildQueue.length - 1}` : ''
    });
    const train = state.trainQueue[0];
    slots.push({
      kind: 'TREINAMENTO', icon: 'army', cls: 'teal',
      label: train ? `${train.qty}× ${UNIT_BY_KEY[train.unitKey].name}` : 'Quartel aguardando ordens',
      item: train, empty: 'FILA LIVRE', view: 'army',
      start: train?.startAt, finish: train?.finishAt, extra: state.trainQueue.length > 1 ? `+${state.trainQueue.length - 1}` : ''
    });
    const tech = state.researchQueue[0];
    slots.push({
      kind: 'PESQUISA', icon: 'flask', cls: 'blue',
      label: tech ? `${TECH_BY_KEY[tech.techKey].name} · Nv ${tech.toLevel}` : 'Laboratório em espera',
      item: tech, empty: 'LABORATÓRIO LIVRE', view: 'research',
      start: tech?.startAt, finish: tech?.finishAt,
    });
    const m = state.marches[0];
    const target = m ? TARGET_BY_ID[m.targetId] : null;
    slots.push({
      kind: 'MARCHAS', icon: 'sword', cls: 'red',
      label: m ? `Força → ${target.name}` : `${marchSlots()} frentes disponíveis`,
      item: m, empty: 'NENHUMA MARCHA', view: 'world',
      start: m?.sentAt, finish: m?.arriveAt, extra: state.marches.length > 1 ? `+${state.marches.length - 1}` : ''
    });
    this.dock.innerHTML = slots.map((s) => {
      if (!s.item) {
        return `<button class="dock-slot" data-view="${s.view}">
          <span class="dock-ico ${s.cls}">${ico(s.icon)}</span>
          <span class="dock-info"><small>${s.kind}</small><span class="dock-empty"><b>${s.empty}</b></span></span>
        </button>`;
      }
      return `<button class="dock-slot active" data-view="${s.view}">
        <span class="dock-ico ${s.cls}">${ico(s.icon)}</span>
        <span class="dock-info">
          <span class="dk-top"><small>${s.kind}</small><span class="dk-time" data-finish="${s.finish}">${fmtTime(s.finish - Date.now())}</span></span>
          <b>${s.label}</b>
          ${progressBar(s.start, s.finish, s.cls === 'teal' ? 'teal' : s.cls === 'red' ? 'red' : '')}
          ${s.extra ? `<span class="dock-more">${s.extra}</span>` : ''}
        </span>
      </button>`;
    }).join('');
  }

  updateTimers() {
    const now = Date.now();
    $$('[data-finish]').forEach((el) => {
      const finish = Number(el.dataset.finish);
      const left = finish - now;
      if (!Number.isFinite(finish)) return;
      el.textContent = left <= 0 ? 'PRONTO' : fmtTime(left);
      if (left <= 0) el.classList.add('ready');
    });
    $$('[data-bar]').forEach((el) => {
      const start = Number(el.dataset.start);
      const finish = Number(el.dataset.finish);
      if (!Number.isFinite(finish)) return;
      const p = clamp(((now - start) / Math.max(1, finish - start)) * 100, 0, 100);
      el.style.width = `${p}%`;
    });
  }

  /* ============================================================
     Painel de contexto
     ============================================================ */
  renderContext() {
    if (state.view !== 'base' && state.view !== 'world') {
      this.context.innerHTML = '';
      return;
    }
    this.context.innerHTML = state.view === 'base' ? this.baseContext() : this.worldContext();
    this._ctxSig = this.contextSignature();
    this.updateTimers();
  }

  baseContext() {
    const key = state.selectedBuilding || 'hq';
    const def = BUILDING_BY_KEY[key];
    if (!def) return '';
    const info = buildingUpgradeInfo(key);
    const lvl = info.level;
    const q = queueForBuilding(key);
    const prod = lvl > 0 ? buildingProductionNow(key) : null;
    const energy = energyInfo();
    const ready = def.prod && lvl > 0 && Date.now() >= (state.collect[key] || 0);
    const nextLocked = key !== 'hq' && lvl + 1 > buildingLevel('hq');
    const stat = (label, value, iconName) => `<div class="ctx-stat"><small>${label}</small><b>${iconName ? ico(iconName) : ''}${value}</b></div>`;
    let stats = '';
    if (prod) {
      stats = Object.entries(prod).map(([k, v]) => stat(RESOURCES[k].short, `+${fmt(v)}/h`, RESOURCES[k].icon)).join('');
      stats += stat('NÍVEL', `${lvl}<span class="muted"> / ${def.max}</span>`, 'up');
    } else if (def.key === 'hq') {
      stats = stat('NÍVEL', `${lvl}<span class="muted"> / ${def.max}</span>`, 'star')
        + stat('PRODUÇÃO GLOBAL', `+${lvl * 4}%`, 'bolt')
        + stat('OBRAS ATIVAS', `${state.buildQueue.length}/2`, 'home')
        + stat('COMANDANTE', `Nv ${state.player.level}`, 'medal');
    } else {
      stats = stat('NÍVEL', `${lvl}<span class="muted"> / ${def.max}</span>`, 'up')
        + stat('ENERGIA', def.powerGive ? `+${def.powerGive * lvl}` : `−${(def.powerUse || 0) * lvl}`, 'bolt')
        + stat('EFEITO', def.effect.replace(/^[−+-]?/, m => m), 'star')
        + stat('PODER', `+${lvl * 55}`, 'shield');
    }
    const queueBlock = q ? `
      <div class="ctx-effect" style="color:var(--gold-2)">${ico('clock')} ${q.kind === 'build' ? 'Construção' : 'Evolução'} para nível ${q.toLevel} ${timerTag(q.finish, '· ')}</div>
      ${progressBar(q.startAt, q.finishAt)}
    ` : '';

    let action = '';
    if (ready) {
      action = `<button class="btn full" data-action="collect-building" data-building="${key}">${ico('credit')} COLETAR RECURSOS</button>`;
    }
    if (q) {
      action += `<button class="btn full ghost" disabled style="margin-top:6px">${ico('clock')} EM OBRAS ${timerTag(q.finish, '· ')}</button>`;
    } else if (info.maxed) {
      action += `<button class="btn full ghost" disabled style="margin-top:6px">${ico('check')} NÍVEL MÁXIMO ALCANÇADO</button>`;
    } else if (nextLocked) {
      action += `<button class="btn full ghost" disabled style="margin-top:6px">${ico('lock')} REQUER QG NÍVEL ${lvl + 1}</button>`;
    } else {
      action += `<div class="cost-grid">${costChips(info.cost)}</div>
        <button class="btn full" data-action="upgrade-building" data-building="${key}">
          ${ico(lvl === 0 ? 'plus' : 'up')} ${lvl === 0 ? 'CONSTRUIR' : 'EVOLUIR PARA NÍVEL ' + (lvl + 1)}
          ${timerTag(Date.now() + info.time * 1000, '· ')}
        </button>`;
    }

    const objectives = MISSIONS.filter(m => !state.claimedMissions.includes(m.id)).slice(0, 3);
    const objHtml = objectives.map((m) => {
      const p = missionProgress(m.id);
      return `<button class="objective" data-action="go-view" data-view="campaign">
        <span class="ob-ico">${ico(p.done ? 'check' : 'target')}</span>
        <span class="ob-txt"><b>${m.name}</b><small>${p.text}</small></span>
        <span class="ob-go">${ico('arrow')}</span>
      </button>`;
    }).join('') || `<p class="ctx-footnote">Todos os objetivos concluídos. O planeta é seu.</p>`;

    return `
      <div class="ctx-card">
        <div class="ctx-eyebrow">${ico('target')} CENTRO DE COMANDO</div>
        <div class="ctx-head">
          <span class="ctx-icon">${ico(def.icon)}</span>
          <div class="ctx-name"><h2>${def.name}</h2><p>${def.tag} · ${lvl > 0 ? 'OPERACIONAL' : 'AGUARDANDO CONSTRUÇÃO'}</p></div>
          <span class="ctx-level">NV ${lvl}</span>
        </div>
        <div class="ctx-stats">${stats}</div>
        ${queueBlock}
        <p class="ctx-desc">${def.desc}</p>
        <div class="ctx-effect">${ico('bolt')} ${def.effect}</div>
        ${action}
        <div class="cost-grid" style="margin-top:8px">
          <span class="cost-item ${energy.deficit ? 'missing' : ''}">${ico('bolt')} ${energy.use}/${energy.prod} ENERGIA</span>
          <span class="cost-item">${ico('clock')} ${def.time}s BASE</span>
        </div>
      </div>
      <div class="ctx-card">
        <div class="ctx-eyebrow">${ico('flag')} OBJETIVOS ATIVOS</div>
        <div class="ctx-objectives">${objHtml}</div>
        <p class="ctx-footnote">${marchSlots()} frentes de marcha · ${state.buildQueue.length}/2 engenheiros · ${state.trainQueue.length}/3 filas de treino</p>
      </div>`;
  }

  worldContext() {
    const id = state.selectedTarget;
    const t = id ? targetState(id) : null;
    if (!t) {
      const openTargets = TARGETS.filter(x => !x.player && state.targets[x.id]?.owner !== 'player')
        .sort((a, b) => distanceToBase(a) - distanceToBase(b)).slice(0, 4);
      const rows = openTargets.map((x) => `
        <button class="objective" data-action="attack-target" data-target="${x.id}">
          <span class="ob-ico" style="color:${FACTION_COLORS[x.faction]};border-color:${FACTION_COLORS[x.faction]}55;background:${FACTION_COLORS[x.faction]}12">${ico('flag')}</span>
          <span class="ob-txt"><b>${x.name}</b><small>${x.faction} · DEF ${fmt(x.def)} · ${targetTravel(x)}s</small></span>
          <span class="ob-go">${ico('sword')}</span>
        </button>`).join('');
      return `
        <div class="ctx-card">
          <div class="ctx-eyebrow">${ico('map')} TEATRO DE GUERRA</div>
          <div class="dom-row"><div><small>DOMÍNIO MUNDIAL</small><b>${domination()}%</b></div><div style="text-align:right"><small>SETORES</small><b>${conqueredCount()}/17</b></div></div>
          <div class="progress"><i style="width:${domination()}%"></i></div>
          <p class="ctx-desc">Conquiste setores no mapa para aumentar sua produção global, receber tributos de guerra e liberar novas frentes de ataque.</p>
          <div class="ctx-effect" style="color:var(--teal)">${ico('bolt')} +${(conqueredCount() * 3)}% de produção global</div>
          <div class="cost-grid"><span class="cost-item">${ico('flag')} +${(conqueredCount() * 1.5).toFixed(1)}%/h de tributo</span><span class="cost-item">${ico('sword')} ${state.marches.length}/${marchSlots()} marchas</span></div>
        </div>
        <div class="ctx-card">
          <div class="ctx-eyebrow">${ico('target')} ALVOS PRÓXIMOS</div>
          <div class="ctx-objectives">${rows || '<p class="ctx-footnote">Todos os setores foram dominados.</p>'}</div>
          <p class="ctx-footnote">Selecione um marcador no mapa para ver defesa, espólio e probabilidade de vitória.</p>
        </div>`;
    }
    if (t.player) {
      return `
        <div class="ctx-card">
          <div class="ctx-eyebrow">${ico('crown')} SUA FORTALEZA</div>
          <div class="ctx-head">
            <span class="ctx-icon" style="color:var(--teal);border-color:rgba(69,211,198,.4)">${ico('crown')}</span>
            <div class="ctx-name"><h2>${t.name}</h2><p>${t.faction} · CAPITAL</p></div>
            <span class="ctx-level">NV ${t.level}</span>
          </div>
          <div class="ctx-stats">
            <div class="ctx-stat"><small>PODER TOTAL</small><b>${fmt(totalPower())}</b></div>
            <div class="ctx-stat"><small>EXÉRCITO</small><b>${fmt(armyCount())}/${fmt(troopCap())}</b></div>
            <div class="ctx-stat"><small>SETORES</small><b>${conqueredCount()}/17</b></div>
            <div class="ctx-stat"><small>MARCHAS</small><b>${state.marches.length}/${marchSlots()}</b></div>
          </div>
          <p class="ctx-desc">Seu quartel-general no mapa mundial. Proteja a fortaleza evoluindo a Muralha de Aço e o Hospital de Campanha.</p>
          <button class="btn full" data-action="go-view" data-view="base">${ico('home')} VOLTAR À BASE</button>
        </div>`;
    }
    const conquer = t.owner === 'player';
    const odds = targetOdds(t.id, state.troops);
    const oddsPct = Math.min(999, odds.percent);
    const oddsColor = oddsPct >= 100 ? 'var(--teal)' : oddsPct >= 70 ? 'var(--gold)' : 'var(--red)';
    const loot = targetLoot(t);
    const marches = state.marches.filter(m => m.targetId === t.id);
    return `
      <div class="ctx-card">
        <div class="ctx-eyebrow">${ico(conquer ? 'check' : 'flag')} ${conquer ? 'SETOR DOMINADO' : 'ALVO HOSTIL'}</div>
        <div class="ctx-head">
          <span class="ctx-icon" style="color:${FACTION_COLORS[t.faction]};border-color:${FACTION_COLORS[t.faction]}55">${ico(conquer ? 'flag' : 'target')}</span>
          <div class="ctx-name"><h2>${t.name}</h2><p>${t.faction}</p></div>
          <span class="ctx-level" style="color:${FACTION_COLORS[t.faction]};border-color:${FACTION_COLORS[t.faction]}55">NV ${t.level}</span>
        </div>
        <div class="target-faction">${ico('map-pin')} SETOR ${t.id.replace('t', '')} · ${targetTravel(t)}s DE MARCHA</div>
        <div class="ctx-stats">
          <div class="ctx-stat"><small>DEFESA</small><b>${fmt(t.def)}</b></div>
          <div class="ctx-stat"><small>SEU PODER</small><b>${fmt(odds.atk)}</b></div>
          <div class="ctx-stat"><small>PROBABILIDADE</small><b style="color:${oddsColor}">${oddsPct}%</b></div>
          <div class="ctx-stat"><small>ESPÓLIO</small><b>${fmt(Object.values(loot).reduce((a, b) => a + b, 0))}</b></div>
        </div>
        <div class="odds">
          <span class="odds-label">FORÇA DE ATAQUE × DEFESA</span>
          <span class="odo-bar"><i style="width:${clamp(oddsPct, 0, 100)}%;background:${oddsColor}"></i></span>
          <b style="color:${oddsColor}">${oddsPct}%</b>
        </div>
        <div class="loot-row">${lootChips(loot)}</div>
        ${marches.map(m => `<div class="ctx-effect" style="color:var(--teal)">${ico('sword')} ${Object.values(m.units).reduce((a, b) => a + b, 0)} unidades a caminho ${timerTag(m.arriveAt, '· ')}</div>`).join('')}
        ${conquer
          ? `<div class="ctx-effect" style="color:var(--teal)">${ico('check')} Tributo ativo · produção global reforçada</div>
             <button class="btn full ghost" data-action="world-center">${ico('map')} ESCOLHER NOVO ALVO</button>`
          : `<button class="btn full" data-action="attack-target" data-target="${t.id}" ${conquer ? 'disabled' : ''}>${ico('sword')} MOBILIZAR ATAQUE</button>`}
        <p class="ctx-footnote">${conquer ? 'Este setor agora produz tributos para sua nação.' : 'A probabilidade usa todo o seu exército disponível. Você pode escolher menos tropas na tela de ataque.'}</p>
      </div>
      <div class="ctx-card">
        <div class="ctx-eyebrow">${ico('army')} INTELIGÊNCIA DO SETOR</div>
        <p class="ctx-desc" style="margin-top:0">${t.faction} mantém ${fmt(t.def)} pontos de defesa. ${oddsPct >= 100 ? 'Seu exército tem vantagem decisiva neste alvo.' : oddsPct >= 70 ? 'A batalha será dura. Reforce o ataque antes de marchar.' : 'A defesa supera sua força atual. Treine mais tropas e pesquise tecnologias militares.'}</p>
        <div class="cost-grid">
          <span class="cost-item">${ico('shield')} ${t.faction}</span>
          <span class="cost-item">${ico('target')} ${Math.round(t.def / 100)} defesa/100</span>
        </div>
        <button class="btn full ghost" data-action="go-view" data-view="army">${ico('army')} REFORÇAR EXÉRCITO</button>
      </div>`;
  }

  /* ============================================================
     Views
     ============================================================ */
  applyView(view) {
    this.game = byId('game');
    $$('#main .view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    $$('#rail .rail-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const wide = !['base', 'world'].includes(view);
    this.game.classList.toggle('wide', wide);
    this.closeContext();
    if (view === 'base') {
      this.iso.start();
      requestAnimationFrame(() => this.iso.resize());
    } else {
      this.iso.stop();
    }
    if (view === 'world') {
      this.world.start();
      requestAnimationFrame(() => { this.world.resize(); this.world.refresh(); });
    } else {
      this.world.stop();
    }
    this.renderView();
    this.renderContext();
  }

  renderView() {
    const view = state.view;
    if (view === 'army') byId('view-army').innerHTML = this.armyView();
    if (view === 'research') byId('view-research').innerHTML = this.researchView();
    if (view === 'campaign') byId('view-campaign').innerHTML = this.campaignView();
    if (view === 'hero') byId('view-hero').innerHTML = this.heroView();
    if (view === 'alliance') byId('view-alliance').innerHTML = this.allianceView();
  }

  renderAll() {
    this.renderHud();
    this.renderDock();
    this.renderView();
    this.renderContext();
    this.world.refresh();
    if (state.view === 'base') this.iso.layout();
  }

  armyView() {
    const cap = troopCap();
    const total = armyCount();
    const queued = queuedTroops();
    const q = state.trainQueue[0];
    const cards = UNIT_DEFS.map((u) => {
      const unlocked = unitUnlocked(u.key);
      const count = state.troops[u.key] || 0;
      const maxQty = this.maxTrainable(u.key);
      return `<article class="unit-card">
        <div class="unit-top">
          <span class="unit-icon">${ico(u.icon)}</span>
          <div class="unit-name"><h3>${u.name}</h3><span>${u.role}</span></div>
          <div class="unit-count"><b>${fmt(count)}</b><small>UNIDADES</small></div>
        </div>
        <div class="unit-stats">
          <div class="unit-stat"><small>ATAQUE</small><b>${u.attack}</b></div>
          <div class="unit-stat"><small>CUSTO</small><b>${Object.entries(u.cost).map(([k, v]) => `${fmt(v)}${k === 'food' ? 'A' : k === 'steel' ? 'AÇ' : k === 'oil' ? 'P' : 'C'}`).join(' ')}</b></div>
          <div class="unit-stat"><small>TEMPO / 10</small><b>${ico('clock')}${u.timePer10}s</b></div>
        </div>
        <p class="unit-desc">${u.desc}</p>
        <div class="unit-actions">
          <button class="btn small" data-action="open-train" data-unit="${u.key}" ${!unlocked ? 'disabled' : ''}>${ico('plus')} TREINAR</button>
          <button class="btn small ghost" data-action="quick-train" data-unit="${u.key}" ${!unlocked || maxQty <= 0 ? 'disabled' : ''}>MAX</button>
        </div>
        ${!unlocked ? `<div class="unit-locked">${ico('lock')} ${unlockRequirement(u.key)}</div>` : ''}
      </article>`;
    }).join('');
    return `
      <div class="view-head">
        <div class="vb"><span class="view-icon">${ico('army')}</span><div><h1>EXÉRCITO</h1><p>Recrute, treine e mobilize sua força de combate.</p></div></div>
        <div class="vh-stats">
          <div class="vh-stat"><small>EFETIVO</small><b>${fmt(total)}</b></div>
          <div class="vh-stat"><small>CAPACIDADE</small><b>${fmt(cap)}</b></div>
          <div class="vh-stat"><small>PODER DE TROPA</small><b>${fmt(troopPower())}</b></div>
        </div>
      </div>
      <div class="train-summary">
        <div class="ts-item"><small>OCUPAÇÃO DO QUARTEL</small><b>${fmt(total + queued)} <span>/ ${fmt(cap)}</span></b></div>
        <div class="ts-item"><small>FILA DE TREINO</small><b>${state.trainQueue.length}/3 <span>${q ? `· ${q.qty}× ${UNIT_BY_KEY[q.unitKey].name}` : ''}</span></b></div>
        <div class="progress teal">${q ? `<i data-bar data-start="${q.startAt}" data-finish="${q.finishAt}" style="width:${pct(Date.now() - q.startAt, q.finishAt - q.startAt)}%"></i>` : '<i style="width:0"></i>'}</div>
        <div class="quick-train">
          <button class="btn small ghost" data-action="quick-train" data-unit="infantry">${ico('plus')} 10 INFANTARIA</button>
          <button class="btn small" data-action="open-train" data-unit="tank">${ico('sword')} TANQUES</button>
        </div>
      </div>
      <div class="section-label">UNIDADES DE COMBATE · ${UNIT_DEFS.length} CLASSES</div>
      <div class="army-grid">${cards}</div>`;
  }

  researchView() {
    const queue = state.researchQueue[0];
    const done = Object.values(state.research).reduce((a, b) => a + b, 0);
    const cards = TECH_DEFS.map((t) => {
      const lvl = state.research[t.key] || 0;
      const maxed = lvl >= t.max;
      const active = queue?.techKey === t.key;
      const cost = researchCost(t.key);
      const time = researchTime(t.key);
      return `<article class="tech-card ${maxed ? 'maxed' : ''}">
        <div class="tech-head">
          <span class="tech-icon">${ico(t.icon)}</span>
          <div><h3>${t.name}</h3><small>${t.branch} · NÍVEL ${lvl}/${t.max}</small></div>
        </div>
        <div class="tech-pips">${Array.from({ length: t.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        <p class="tech-desc">${t.effect}</p>
        <div class="tech-effect">${lvl > 0 ? `BÔNUS ATUAL: ${(lvl * parseFloat(t.effect.match(/[+\-−]?([\d.]+)%/)?.[1] || 0)).toFixed(0)}%` : 'AINDA NÃO PESQUISADO'}</div>
        <div class="tech-foot">
          ${maxed ? `<span class="tech-max">${ico('check')} CONCLUÍDO</span>` : `<div class="tech-cost">${costChips(cost)}</div>`}
          ${active
            ? `<button class="btn tiny ghost" disabled>${ico('clock')} ${fmtTime(queue.finishAt - Date.now())}</button>`
            : maxed
              ? `<button class="btn tiny ghost" disabled>MAX</button>`
              : `<button class="btn tiny" data-action="research-tech" data-tech="${t.key}">${ico('flask')} PESQUISAR ${time}s</button>`}
        </div>
      </article>`;
    }).join('');
    const lab = buildingLevel('lab');
    return `
      <div class="view-head">
        <div class="vb"><span class="view-icon">${ico('flask')}</span><div><h1>PESQUISA BÉLICA</h1><p>Desbloqueie tecnologias que multiplicam o poder da sua nação.</p></div></div>
        <div class="vh-stats">
          <div class="vh-stat"><small>NÍVEIS PESQUISADOS</small><b>${done}</b></div>
          <div class="vh-stat"><small>BÔNUS DE ATAQUE</small><b>+${Math.round(state.research.ballistics * 5)}%</b></div>
          <div class="vh-stat"><small>LABORATÓRIO</small><b>NV ${lab}</b></div>
        </div>
      </div>
      ${lab < 1 ? `<div class="empty-state" style="margin-bottom:12px">${ico('lock')}<b>LABORATÓRIO BÉLICO NÃO CONSTRUÍDO</b><span>Construa o laboratório na base para iniciar pesquisas militares.</span><button class="btn small" data-action="go-view" data-view="base">IR PARA A BASE</button></div>` : ''}
      ${queue ? `<div class="train-summary">
        <div class="ts-item"><small>PESQUISA EM ANDAMENTO</small><b>${TECH_BY_KEY[queue.techKey].name} · Nv ${queue.toLevel}</b></div>
        <div class="ts-item"><small>TEMPO RESTANTE</small><b data-finish="${queue.finishAt}">${fmtTime(queue.finishAt - Date.now())}</b></div>
        <div class="progress teal"><i data-bar data-start="${queue.startAt}" data-finish="${queue.finishAt}" style="width:${pct(Date.now() - queue.startAt, queue.finishAt - queue.startAt)}%"></i></div>
      </div>` : ''}
      <div class="section-label">RAMO DE PESQUISA · ECONOMIA E MILITAR</div>
      <div class="tech-grid">${cards}</div>`;
  }

  campaignView() {
    const doneCount = MISSIONS.filter(m => state.claimedMissions.includes(m.id)).length;
    const claimed = new Set(state.claimedMissions);
    const cards = MISSIONS.map((m, i) => {
      const p = missionProgress(m.id);
      const claimedM = claimed.has(m.id);
      return `<article class="mission-card ${p.done && !claimedM ? 'ready' : ''} ${claimedM ? 'claimed' : ''}">
        <div class="mission-num"><span>${String(i + 1).padStart(2, '0')}</span></div>
        <div class="mission-info"><h3>${m.name}</h3><p>${m.desc}</p></div>
        <div class="mission-progress">
          <div class="progress ${p.done ? 'teal' : ''}"><i style="width:${pct(p.current, p.target)}%"></i></div>
          <div class="progress-label"><span>${p.text}</span><b>${pct(p.current, p.target)}%</b></div>
        </div>
        <div class="mission-reward">${lootChips(m.reward)}<span class="loot-item">${ico('star')}+${fmt(m.xp)} XP</span></div>
        ${claimedM
          ? `<button class="btn small ghost" disabled>${ico('check')} COLETADO</button>`
          : p.done
            ? `<button class="btn small" data-action="claim-mission" data-mission="${m.id}">${ico('medal')} RESGATAR</button>`
            : `<button class="btn small ghost" disabled>${ico('lock')} EM ANDAMENTO</button>`}
      </article>`;
    }).join('');
    return `
      <div class="view-head">
        <div class="vb"><span class="view-icon">${ico('flag')}</span><div><h1>CAMPANHA</h1><p>Missões de guerra que constroem a lenda do seu comando.</p></div></div>
        <div class="vh-stats">
          <div class="vh-stat"><small>MISSÕES CONCLUÍDAS</small><b>${doneCount}/8</b></div>
          <div class="vh-stat"><small>SETORES DOMINADOS</small><b>${conqueredCount()}/17</b></div>
          <div class="vh-stat"><small>VITÓRIAS</small><b>${state.stats.battlesWon}</b></div>
        </div>
      </div>
      <div class="section-label">OPERAÇÕES ATIVAS · FRENTE ÔMEGA</div>
      <div class="mission-list">${cards}</div>`;
  }

  heroView() {
    const h = HERO_BY_KEY[state.activeHero];
    const hs = state.heroes[state.activeHero];
    const bonus = {
      atk: Math.round((h.baseAtk + (hs.level - 1) * 0.015 + hs.skills.assault * 0.03) * 100),
      def: Math.round((h.baseDef + hs.skills.tactics * 0.02) * 100),
      loot: Math.round((h.baseLoot + hs.skills.charisma * 0.04) * 100)
    };
    const xpNext = 100 + hs.level * 70;
    const skills = HERO_SKILLS.map((s) => {
      const rank = hs.skills[s.key] || 0;
      return `<div class="skill-row">
        <span class="skill-ico">${ico(s.icon)}</span>
        <div class="skill-info"><b>${s.name}</b><small>${s.desc}</small></div>
        <span class="skill-rank">${rank}/10</span>
        <button class="btn tiny ${hs.points > 0 ? '' : 'ghost'}" data-action="level-skill" data-skill="${s.key}" ${hs.points > 0 ? '' : 'disabled'}>${ico('plus')}</button>
      </div>`;
    }).join('');
    const commanders = HERO_DEFS.map((c) => {
      const cs = state.heroes[c.key];
      const active = state.activeHero === c.key;
      return `<button class="commander-card ${active ? 'active' : ''}" data-action="${cs.unlocked ? 'select-hero' : 'unlock-hero'}" data-hero="${c.key}">
        <span class="cc-ava">${heroPortrait(c.key, 120)}</span>
        <h4>${c.name}</h4><small>${c.title}</small><b>${c.bonusText}</b>
        ${active ? '<span class="cc-active">ATIVO</span>' : ''}
        ${!cs.unlocked ? `<span class="cc-lock">${ico('lock')} ${fmt(c.cost)} DIAMANTES</span>` : ''}
      </button>`;
    }).join('');
    return `
      <div class="view-head">
        <div class="vb"><span class="view-icon">${ico('medal')}</span><div><h1>COMANDANTES</h1><p>Heróis lendários alteram o curso de cada batalha.</p></div></div>
        <div class="vh-stats">
          <div class="vh-stat"><small>COMANDANTE ATIVO</small><b>${h.name}</b></div>
          <div class="vh-stat"><small>PONTOS DISPONÍVEIS</small><b>${hs.points}</b></div>
          <div class="vh-stat"><small>DIAMANTES</small><b>${fmt(state.resources.gems)}</b></div>
        </div>
      </div>
      <div class="hero-layout">
        <div class="hero-showcase">
          <span class="hero-badge">${ico('crown')} ${h.nation}</span>
          <div class="hero-portrait">
            ${heroPortrait(h.key, 340)}
            <div class="hero-name"><h2>${h.name}</h2><p>${h.title}</p></div>
          </div>
          <div class="hero-xp">
            <div class="progress"><i style="width:${pct(hs.xp, xpNext)}%"></i></div>
            <div class="progress-label"><span>NÍVEL ${hs.level} · ${hs.xp}/${xpNext} XP</span><b>PRÓXIMO NÍVEL</b></div>
          </div>
          <div class="hero-stats">
            <div class="hero-stat"><small>ATAQUE</small><b>+${bonus.atk}%</b></div>
            <div class="hero-stat"><small>DEFESA</small><b>+${bonus.def}%</b></div>
            <div class="hero-stat"><small>ESPÓLIO</small><b>+${bonus.loot}%</b></div>
          </div>
          <p class="ctx-desc">${h.desc}</p>
        </div>
        <div class="hero-right">
          <div class="ctx-card">
            <div class="ctx-eyebrow">${ico('star')} HABILIDADES DE COMANDO</div>
            <div class="skill-list">${skills}</div>
            <p class="ctx-footnote">${hs.points} ponto(s) de habilidade disponível(is). Vença batalhas para promover ${h.name}.</p>
          </div>
          <div class="ctx-card">
            <div class="ctx-eyebrow">${ico('users')} COALIZÃO DE COMANDANTES</div>
            <div class="commander-grid">${commanders}</div>
          </div>
        </div>
      </div>`;
  }

  allianceView() {
    const totalMembers = ALLIANCE_MEMBERS.length;
    const power = ALLIANCE_MEMBERS.reduce((a, m) => a + m.power, 0);
    const members = ALLIANCE_MEMBERS.map((m, i) => `<div class="member-row">
      <span class="member-rank">${String(i + 1).padStart(2, '0')}</span>
      <span class="member-ava">${m.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
      <span class="member-name">${m.name}</span>
      <span class="member-role">${m.role}</span>
      <span class="member-power">${fmt(m.power)}</span>
    </div>`).join('');
    const playerPower = totalPower();
    const all = [...RANKING, { name: state.player.name, tag: 'ÔMEGA', power: playerPower, level: state.player.level, me: true }]
      .sort((a, b) => b.power - a.power);
    const ranks = all.map((r, i) => `<div class="rank-row ${r.me ? 'me' : ''}">
      <span class="rank-pos">${i + 1}</span>
      <span class="rank-name"><span class="alliance-tag">${r.tag}</span>${r.name}</span>
      <span class="rank-power">${fmt(r.power)}</span>
      <span class="rank-lvl">Nv ${r.level}</span>
    </div>`).join('');
    const chat = this.chatMessages.slice(-9).map(m => `<div class="chat-msg"><span class="cname">${m.name}:</span><span class="ctext">${m.text}</span><span class="ctime">${m.time}</span></div>`).join('');
    return `
      <div class="view-head">
        <div class="vb"><span class="view-icon">${ico('users')}</span><div><h1>ALIANÇA ÔMEGA</h1><p>Coordene operações, compartilhe inteligência e domine o ranking.</p></div></div>
        <div class="vh-stats">
          <div class="vh-stat"><small>MEMBROS</small><b>${totalMembers}/20</b></div>
          <div class="vh-stat"><small>PODER DA ALIANÇA</small><b>${fmt(power + playerPower)}</b></div>
          <div class="vh-stat"><small>SUA POSIÇÃO</small><b>#${all.findIndex(r => r.me) + 1}</b></div>
        </div>
      </div>
      <div class="alliance-layout">
        <div class="alliance-banner">
          <span class="alliance-emblem">${ico('star')}</span>
          <div><h2>FORÇA ÔMEGA</h2><p>Aliança de elite · 4 guerras vencidas nesta temporada</p></div>
          <div class="ali-stats">
            <div class="vh-stat"><small>DOMÍNIO</small><b>${domination()}%</b></div>
            <div class="vh-stat"><small>TRIBUTO</small><b>+${(conqueredCount() * 1.5).toFixed(1)}%/h</b></div>
          </div>
        </div>
        <div class="ctx-card" style="margin-top:0">
          <div class="ctx-eyebrow">${ico('users')} OFICIAIS E MEMBROS</div>
          <div class="member-list">${members}</div>
        </div>
        <div class="ctx-card" style="margin-top:0">
          <div class="ctx-eyebrow">${ico('mail')} CANAL DE COMANDO</div>
          <div class="chat-list" id="chat-list">${chat}</div>
          <form class="chat-input" id="chat-form">
            <input id="chat-input" maxlength="120" placeholder="Transmitir para a aliança..." autocomplete="off" aria-label="Mensagem para a aliança">
            <button class="btn small" type="submit">${ico('arrow')} ENVIAR</button>
          </form>
        </div>
        <div class="ctx-card" style="grid-column:1/-1">
          <div class="ctx-eyebrow">${ico('medal')} RANKING GLOBAL DE COMANDANTES</div>
          <div class="rank-list">
            <div class="rank-row head"><span>#</span><span>COMANDANTE</span><span>PODER</span><span>NÍVEL</span></div>
            ${ranks}
          </div>
        </div>
      </div>`;
  }

  /* ============================================================
     Interações de treino / pesquisa / ataque
     ============================================================ */
  maxTrainable(key) {
    const def = UNIT_BY_KEY[key];
    if (!def || !unitUnlocked(key)) return 0;
    const capLeft = troopCap() - armyCount() - queuedTroops();
    let byRes = Infinity;
    for (const [k, v] of Object.entries(def.cost)) byRes = Math.min(byRes, Math.floor((state.resources[k] || 0) / v));
    return clamp(Math.min(capLeft, byRes, 500), 0, 500);
  }

  openTrain(key) {
    const u = UNIT_BY_KEY[key];
    if (!u) return;
    open();
    const max = this.maxTrainable(key);
    this.modalData = { type: 'train', key, qty: Math.max(1, Math.min(10, max)) };
    const time = Math.max(2, Math.round((u.timePer10 * this.modalData.qty) / 10));
    this.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-label="Treinar ${u.name}">
        <div class="modal-head">
          <span class="modal-ico">${ico(u.icon)}</span>
          <div class="modal-title"><small>TREINAMENTO MILITAR</small><h2>${u.name}</h2></div>
          <button class="modal-close" data-action="close-modal" aria-label="Fechar">${ico('close')}</button>
        </div>
        <div class="modal-body">
          <div class="modal-hero">
            <span class="mh-ico">${ico('army')}</span>
            <div><h3>${u.name}</h3><p>${u.desc}</p></div>
            <div class="mh-right"><small>ATAQUE / UNIDADE</small><b>${u.attack}</b></div>
          </div>
          <div class="train-modal-row">
            <span class="tm-ava">${ico(u.icon)}</span>
            <div class="tm-info"><b>QUANTIDADE</b><small>Máximo disponível: ${max} · Capacidade ${fmt(armyCount() + queuedTroops())}/${fmt(troopCap())}</small></div>
            <div class="tm-controls">
              <button class="qty-btn" data-action="qty-inc" data-delta="-10" aria-label="Menos 10">−</button>
              <span class="qty-val" id="train-qty">${this.modalData.qty}</span>
              <button class="qty-btn" data-action="qty-inc" data-delta="10" aria-label="Mais 10">+</button>
              <button class="qty-max" data-action="qty-max">MAX</button>
            </div>
          </div>
          <div class="army-total">
            <div class="at-item"><small>CUSTO TOTAL</small><b id="train-cost">${costChips(this.trainingCost(key, this.modalData.qty))}</b></div>
            <div class="at-item"><small>TEMPO</small><b id="train-time">${time}s</b></div>
            <div class="at-item"><small>PODER ADICIONAL</small><b id="train-power" class="teal">+${fmt(u.attack * this.modalData.qty)}</b></div>
          </div>
          <p class="modal-note" style="margin-top:10px">As unidades entram na fila do quartel. Você pode manter até 3 treinamentos simultâneos.</p>
        </div>
        <div class="modal-foot">
          <span class="modal-note">${ico('shield')} Fila: ${state.trainQueue.length}/3</span>
          <span class="spacer"></span>
          <button class="btn ghost" data-action="close-modal">CANCELAR</button>
          <button class="btn" data-action="train-confirm">${ico('check')} TREINAR</button>
        </div>
      </div>`;
  }

  trainingCost(key, qty) {
    const u = UNIT_BY_KEY[key];
    const out = {};
    for (const [k, v] of Object.entries(u.cost)) out[k] = v * qty;
    return out;
  }

  changeQty(delta) {
    if (!this.modalData || this.modalData.type !== 'train') return;
    const max = this.maxTrainable(this.modalData.key);
    const step = Math.max(1, Math.abs(delta));
    let q = this.modalData.qty + (delta > 0 ? step : -step);
    q = clamp(q, 1, Math.max(1, max));
    this.modalData.qty = q;
    this.refreshTrainModal();
  }

  setMaxQty() {
    if (!this.modalData || this.modalData.type !== 'train') return;
    this.modalData.qty = Math.max(1, this.maxTrainable(this.modalData.key));
    this.refreshTrainModal();
  }

  refreshTrainModal() {
    const { key, qty } = this.modalData;
    const u = UNIT_BY_KEY[key];
    const qEl = byId('train-qty');
    if (!qEl) return;
    qEl.textContent = qty;
    const costEl = byId('train-cost');
    if (costEl) costEl.innerHTML = costChips(this.trainingCost(key, qty));
    const timeEl = byId('train-time');
    if (timeEl) timeEl.textContent = `${Math.max(2, Math.round((u.timePer10 * qty) / 10))}s`;
    const powerEl = byId('train-power');
    if (powerEl) powerEl.textContent = `+${fmt(u.attack * qty)}`;
    const confirm = $('[data-action="train-confirm"]', this.modalRoot);
    if (confirm) confirm.disabled = !canAfford(this.trainingCost(key, qty));
  }

  confirmTrain() {
    if (!this.modalData || this.modalData.type !== 'train') return;
    const { key, qty } = this.modalData;
    const res = trainUnits(key, qty);
    if (!res.ok) { error(); this.showToast('TREINAMENTO BLOQUEADO', res.msg, 'bad'); return; }
    success();
    this.closeModal();
  }

  quickTrain(key, qty = null) {
    const amount = qty || Math.max(1, Math.min(10, this.maxTrainable(key)));
    const res = trainUnits(key, amount);
    if (!res.ok) { error(); this.showToast('TREINAMENTO BLOQUEADO', res.msg, 'bad'); }
    else { success(); this.renderAll(); }
  }

  doResearch(key) {
    const res = startResearch(key);
    if (!res.ok) { error(); this.showToast('PESQUISA BLOQUEADA', res.msg, 'bad'); }
    else { success(); this.renderAll(); }
  }

  openAttack(targetId) {
    const t = targetState(targetId);
    if (!t || t.player) return;
    if (t.owner === 'player') { this.showToast('SETOR DOMINADO', 'Este setor já pertence à sua nação.', 'bad'); return; }
    if (state.marches.length >= marchSlots()) { error(); this.showToast('FRENTES OCUPADAS', 'Todas as marchas estão em campo.', 'bad'); return; }
    if (armyCount() <= 0) { error(); this.showToast('SEM TROPAS', 'Treine unidades antes de atacar.', 'bad'); return; }
    open();
    this.attack = {
      targetId,
      qty: Object.fromEntries(UNIT_DEFS.map(u => [u.key, state.troops[u.key] || 0]))
    };
    this.modalRoot.innerHTML = this.attackModalHtml();
    this.refreshAttackSummary();
  }

  attackModalHtml() {
    const t = TARGET_BY_ID[this.attack.targetId];
    const rows = UNIT_DEFS.filter(u => (state.troops[u.key] || 0) > 0).map((u) => `
      <div class="train-modal-row">
        <span class="tm-ava">${ico(u.icon)}</span>
        <div class="tm-info"><b>${u.name}</b><small>${fmt(state.troops[u.key])} disponíveis · ataque ${u.attack}</small></div>
        <div class="tm-controls">
          <button class="qty-btn" data-action="attack-qty" data-unit="${u.key}" data-delta="-10">−</button>
          <span class="qty-val" data-aq="${u.key}">${this.attack.qty[u.key]}</span>
          <button class="qty-btn" data-action="attack-qty" data-unit="${u.key}" data-delta="10">+</button>
          <button class="qty-max" data-action="attack-max" data-unit="${u.key}">MAX</button>
        </div>
      </div>`).join('');
    return `
      <div class="modal-backdrop" data-action="close-modal"></div>
      <div class="modal wide" role="dialog" aria-modal="true" aria-label="Mobilizar ataque">
        <div class="modal-head">
          <span class="modal-ico">${ico('sword')}</span>
          <div class="modal-title"><small>OPERAÇÃO OFENSIVA · SETOR ${t.id.replace('t', '')}</small><h2>MOBILIZAR ATAQUE</h2></div>
          <button class="modal-close" data-action="close-modal" aria-label="Fechar">${ico('close')}</button>
        </div>
        <div class="modal-body">
          <div class="modal-hero">
            <span class="mh-ico" style="color:${FACTION_COLORS[t.faction]};border-color:${FACTION_COLORS[t.faction]}55">${ico('flag')}</span>
            <div><h3>${t.name}</h3><p>${t.faction} · defesa ${fmt(t.def)} · ${targetTravel(t)}s de viagem</p></div>
            <div class="mh-right"><small>NÍVEL DO SETOR</small><b>${t.level}</b></div>
          </div>
          <div class="selection-list">${rows}</div>
          <div class="army-total">
            <div class="at-item"><small>PODER ENVIADO</small><b id="a-power">0</b></div>
            <div class="at-item"><small>UNIDADES</small><b id="a-count">0</b></div>
            <div class="at-item"><small>CHANCE ESTIMADA</small><b id="a-odds" class="teal">0%</b></div>
            <div class="spacer"></div>
            <div class="progress" style="width:110px"><i id="a-bar" style="width:0%"></i></div>
          </div>
          <div class="loot-row" style="margin-top:12px">${lootChips(targetLoot(t))}</div>
        </div>
        <div class="modal-foot">
          <span class="modal-note">${ico('clock')} Chegada em ${targetTravel(t)}s · marchas ${state.marches.length}/${marchSlots()}</span>
          <span class="spacer"></span>
          <button class="btn ghost" data-action="close-modal">CANCELAR</button>
          <button class="btn" data-action="attack-confirm">${ico('sword')} ENVIAR FORÇA</button>
        </div>
      </div>`;
  }

  attackUnits() {
    if (!this.attack) return {};
    const out = {};
    for (const [k, v] of Object.entries(this.attack.qty)) if (v > 0) out[k] = v;
    return out;
  }

  changeAttackQty(key, delta) {
    if (!this.attack) return;
    const max = state.troops[key] || 0;
    const step = Math.max(1, Math.abs(delta));
    this.attack.qty[key] = clamp((this.attack.qty[key] || 0) + (delta > 0 ? step : -step), 0, max);
    this.refreshAttackSummary();
  }

  maxAttack(key) {
    if (!this.attack) return;
    this.attack.qty[key] = state.troops[key] || 0;
    this.refreshAttackSummary();
  }

  refreshAttackSummary() {
    if (!this.attack) return;
    const units = this.attackUnits();
    const power = troopPower(units);
    const count = Object.values(units).reduce((a, b) => a + b, 0);
    const t = TARGET_BY_ID[this.attack.targetId];
    const pctOdds = Math.round((power / Math.max(1, t.def)) * 100);
    for (const [k, v] of Object.entries(this.attack.qty)) {
      const el = $(`[data-aq="${k}"]`, this.modalRoot);
      if (el) el.textContent = v;
    }
    const pw = byId('a-power'); if (pw) pw.textContent = fmt(power);
    const ct = byId('a-count'); if (ct) ct.textContent = fmt(count);
    const odds = byId('a-odds');
    if (odds) {
      odds.textContent = `${pctOdds}%`;
      odds.className = pctOdds >= 100 ? 'teal' : pctOdds >= 70 ? 'gold' : 'red';
    }
    const bar = byId('a-bar');
    if (bar) {
      bar.style.width = `${clamp(pctOdds, 0, 100)}%`;
      bar.style.background = pctOdds >= 100 ? 'linear-gradient(90deg,#1c8b83,#45d3c6)' : pctOdds >= 70 ? 'linear-gradient(90deg,#c77c1e,#f2a63b)' : 'linear-gradient(90deg,#9e2f26,#e3594c)';
    }
    const confirm = $('[data-action="attack-confirm"]', this.modalRoot);
    if (confirm) confirm.disabled = count <= 0;
  }

  confirmAttack() {
    if (!this.attack) return;
    const units = this.attackUnits();
    const id = this.attack.targetId;
    const res = sendMarch(id, units);
    if (!res.ok) { error(); this.showToast('MARCHA BLOQUEADA', res.msg, 'bad'); return; }
    success();
    this.closeModal();
    setView('world');
    selectTarget(id);
  }

  /* ============================================================
     Modais auxiliares
     ============================================================ */
  closeModal() {
    if (this.modalRoot.innerHTML) close();
    this.modalRoot.innerHTML = '';
    this.modalData = null;
    this.attack = null;
  }

  openReports() {
    open();
    const reports = state.reports;
    const pending = state.arrivals.length;
    const list = reports.length ? reports.map((r) => {
      const d = new Date(r.time);
      return `<div class="report-item ${r.win ? 'win' : 'loss'}">
        <span class="rp-ico">${ico(r.win ? 'flag' : 'shield')}</span>
        <div class="rp-info"><b>${r.win ? 'VITÓRIA' : 'DERROTA'} · ${r.targetName}</b><small>${r.faction} · ${fmt(r.sentCount)} unidades · ${fmt(r.lost)} baixas${r.win ? ` · espólio ${fmt(Object.values(r.loot || {}).reduce((a, b) => a + b, 0))}` : ''}</small></div>
        <span class="rp-time">${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>`;
    }).join('') : `<div class="empty-state">${ico('mail')}<b>NENHUM RELATÓRIO</b><span>Suas operações de guerra aparecerão aqui.</span></div>`;
    this.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal"></div>
      <div class="modal wide" role="dialog" aria-modal="true" aria-label="Relatórios">
        <div class="modal-head">
          <span class="modal-ico">${ico('mail')}</span>
          <div class="modal-title"><small>CENTRAL DE INTELIGÊNCIA</small><h2>RELATÓRIOS DE GUERRA</h2></div>
          <button class="modal-close" data-action="close-modal" aria-label="Fechar">${ico('close')}</button>
        </div>
        <div class="modal-body">
          ${pending ? `<div class="modal-hero" style="border-color:rgba(242,166,59,.35)"><span class="mh-ico">${ico('sword')}</span><div><h3>${pending} confronto(s) aguardando</h3><p>Assuma o comando da batalha para ver o resultado.</p></div><div class="mh-right"><button class="btn small" data-action="show-battle">${ico('target')} ENTRAR</button></div></div>` : ''}
          ${list}
        </div>
        <div class="modal-foot"><span class="modal-note">${reports.length} relatório(s) · mantidos os últimos 30</span><span class="spacer"></span><button class="btn ghost" data-action="close-modal">FECHAR</button></div>
      </div>`;
  }

  openSettings() {
    open();
    const energy = energyInfo();
    this.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal"></div>
      <div class="modal narrow" role="dialog" aria-modal="true" aria-label="Configurações">
        <div class="modal-head">
          <span class="modal-ico">${ico('gear')}</span>
          <div class="modal-title"><small>SISTEMA DE COMANDO</small><h2>CONFIGURAÇÕES</h2></div>
          <button class="modal-close" data-action="close-modal" aria-label="Fechar">${ico('close')}</button>
        </div>
        <div class="modal-body">
          <div class="settings-row">
            <span class="sr-ico">${ico('volume')}</span>
            <div class="sr-info"><b>EFEITOS SONOROS</b><small>Armas, construções e alertas</small></div>
            <button class="toggle ${state.settings.sound ? 'on' : ''}" data-action="toggle-sound" aria-label="Alternar efeitos sonoros"></button>
          </div>
          <div class="settings-row">
            <span class="sr-ico">${ico('bolt')}</span>
            <div class="sr-info"><b>TRILHA AMBIENTAL</b><small>Música de guerra contínua</small></div>
            <button class="toggle ${state.settings.music ? 'on' : ''}" data-action="toggle-music" aria-label="Alternar música"></button>
          </div>
          <div class="settings-row">
            <span class="sr-ico">${ico('radar')}</span>
            <div class="sr-info"><b>ENERGIA DA BASE</b><small>${energy.use} em uso · ${energy.prod} produzidos</small></div>
            <span class="ctx-level" style="color:${energy.deficit ? 'var(--red-2)' : 'var(--teal)'}">${energy.deficit ? 'DÉFICIT' : 'ESTÁVEL'}</span>
          </div>
          <div class="settings-row">
            <span class="sr-ico">${ico('shield')}</span>
            <div class="sr-info"><b>SALVAMENTO AUTOMÁTICO</b><small>Progresso local neste dispositivo · v${state.version}</small></div>
            <span class="ctx-level">ATIVO</span>
          </div>
          <div class="settings-row">
            <span class="sr-ico" style="color:var(--red-2)">${ico('close')}</span>
            <div class="sr-info"><b>REINICIAR OPERAÇÃO</b><small>Apaga todo o progresso permanentemente</small></div>
            <button class="btn tiny danger" data-action="reset-game">REINICIAR</button>
          </div>
        </div>
        <div class="modal-foot"><span class="modal-note">COMANDO GLOBAL · v3.0 · ${state.reports.length} relatórios salvos</span><span class="spacer"></span><button class="btn" data-action="close-modal">CONCLUÍDO</button></div>
      </div>`;
  }

  openMore() {
    open();
    this.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal"></div>
      <div class="modal narrow" role="dialog" aria-modal="true" aria-label="Mais opções">
        <div class="modal-head">
          <span class="modal-ico">${ico('menu')}</span>
          <div class="modal-title"><small>CENTRAL DE OPERAÇÕES</small><h2>MAIS COMANDOS</h2></div>
          <button class="modal-close" data-action="close-modal" aria-label="Fechar">${ico('close')}</button>
        </div>
        <div class="modal-body">
          <div class="ctx-objectives">
            <button class="objective" data-action="go-view" data-view="campaign"><span class="ob-ico">${ico('flag')}</span><span class="ob-txt"><b>Campanha</b><small>Missões e recompensas</small></span><span class="ob-go">${ico('arrow')}</span></button>
            <button class="objective" data-action="go-view" data-view="alliance"><span class="ob-ico">${ico('users')}</span><span class="ob-txt"><b>Aliança Ômega</b><small>Membros, chat e ranking</small></span><span class="ob-go">${ico('arrow')}</span></button>
            <button class="objective" data-action="open-reports"><span class="ob-ico">${ico('mail')}</span><span class="ob-txt"><b>Relatórios</b><small>Histórico de batalhas</small></span><span class="ob-go">${ico('arrow')}</span></button>
            <button class="objective" data-action="open-settings"><span class="ob-ico">${ico('gear')}</span><span class="ob-txt"><b>Configurações</b><small>Som, música e progresso</small></span><span class="ob-go">${ico('arrow')}</span></button>
          </div>
          <p class="ctx-footnote">COMANDO GLOBAL — Guerra pelo Planeta. Estratégia em tempo real no navegador.</p>
        </div>
        <div class="modal-foot"><span class="modal-note">Setores dominados: ${conqueredCount()}/17</span><span class="spacer"></span><button class="btn ghost" data-action="close-modal">FECHAR</button></div>
      </div>`;
  }

  confirmReset() {
    this.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal"></div>
      <div class="modal narrow" role="dialog" aria-modal="true" aria-label="Confirmar reinício">
        <div class="modal-head">
          <span class="modal-ico" style="color:var(--red-2);border-color:rgba(227,89,76,.4)">${ico('lock')}</span>
          <div class="modal-title"><small>ALERTA DE COMANDO</small><h2>REINICIAR OPERAÇÃO?</h2></div>
          <button class="modal-close" data-action="close-modal" aria-label="Fechar">${ico('close')}</button>
        </div>
        <div class="modal-body"><p class="ctx-desc" style="margin:0">Todo o progresso, edifícios, exércitos e conquistas serão apagados. Esta ação não pode ser desfeita.</p></div>
        <div class="modal-foot"><span class="spacer"></span><button class="btn ghost" data-action="close-modal">CANCELAR</button><button class="btn danger" data-action="confirm-reset">${ico('close')} APAGAR TUDO</button></div>
      </div>`;
  }

  /* ============================================================
     Contexto móvel / batalha / toasts / chat
     ============================================================ */
  openContext() {
    this.context.classList.add('open');
    if (!this.context.querySelector('.ctx-mobile-close')) {
      const b = document.createElement('button');
      b.className = 'ctx-mobile-close';
      b.dataset.action = 'close-context';
      b.setAttribute('aria-label', 'Fechar painel');
      b.innerHTML = `<svg class="ico"><use href="#i-close"/></svg>`;
      this.context.prepend(b);
    }
  }

  closeContext() {
    this.context.classList.remove('open');
  }

  queueBattle(outcome) {
    this._battleQueue = this._battleQueue || [];
    this._battleQueue.push(outcome);
    this.tryBattle();
  }

  tryBattle() {
    if (this.battle.active || !this._battleQueue?.length) return;
    const outcome = this._battleQueue.shift();
    this.openBattle(outcome);
  }

  openBattle(outcome) {
    if (this.battle.active) return;
    this.battle.play(outcome);
  }

  battleFinished(outcome) {
    const result = resolveArrival(outcome.id);
    if (result?.report?.win) {
      this.showToast('SETOR CONQUISTADO', `${outcome.targetName} agora pertence à sua nação.`, 'good');
    }
    this.renderAll();
    setTimeout(() => this.tryBattle(), 900);
  }

  showToast(title, text = '', kind = '') {
    if (!this.toasts) return;
    const id = ++this._toastSeq;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.dataset.id = id;
    el.innerHTML = `<span class="toast-ico">${ico(kind === 'good' ? 'check' : kind === 'bad' ? 'close' : 'info')}</span>
      <span class="toast-text"><b>${title}</b>${text ? `<span>${text}</span>` : ''}</span>`;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 3800);
  }

  seedChat() {
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const [name, text] = CHAT_LINES[(this.chatSeed + i) % CHAT_LINES.length];
      const d = new Date(now.getTime() - (7 - i) * 4 * 60000);
      this.chatMessages.push({ name, text, time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
    }
    this.chatSeed = (this.chatSeed + 7) % CHAT_LINES.length;
    this.renderChatFeed();
  }

  renderChatFeed() {
    if (!this.chatFeed) return;
    const last = this.chatMessages.slice(-3);
    this.chatFeed.innerHTML = last.map(m => `<div class="chat-feed-item"><b>${m.name}:</b>${m.text}</div>`).join('');
  }

  sendChat(text) {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    this.chatMessages.push({ name: state.player.name, text, time });
    this.renderChatFeed();
    if (state.view === 'alliance') {
      const list = byId('chat-list');
      if (list) {
        list.insertAdjacentHTML('beforeend', `<div class="chat-msg"><span class="cname">${state.player.name}:</span><span class="ctext">${text}</span><span class="ctime">${time}</span></div>`);
        list.scrollTop = list.scrollHeight;
      }
    }
    setTimeout(() => {
      const [name, reply] = CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)];
      const t2 = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      this.chatMessages.push({ name, text: reply, time: t2 });
      this.renderChatFeed();
      if (state.view === 'alliance') this.renderView();
    }, 2200);
  }

  startIntervals() {
    setInterval(() => {
      if (state.view === 'alliance') return;
      const [name, text] = CHAT_LINES[this.chatSeed % CHAT_LINES.length];
      this.chatSeed++;
      const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      this.chatMessages.push({ name, text, time });
      this.chatMessages = this.chatMessages.slice(-24);
      this.renderChatFeed();
    }, 16000);
    setInterval(() => {
      if (state.arrivals.length && !this.battle.active && !this._battleQueue?.length) {
        this._battleQueue = [...state.arrivals];
        this.tryBattle();
      }
    }, 4000);
  }
}
