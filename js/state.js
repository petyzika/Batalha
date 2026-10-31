import {
  SAVE_KEY, GAME_VERSION, BUILDING_DEFS, BUILDING_BY_KEY, UNIT_DEFS, UNIT_BY_KEY,
  TECH_DEFS, TECH_BY_KEY, HERO_DEFS, HERO_BY_KEY, TARGETS, TARGET_BY_ID,
  RES_KEYS, clamp, upgradeCost, upgradeTime, buildingProduction, targetLoot,
  targetTravel, round, MISSIONS, fmt
} from './data.js';

/* ============================================================
   Estado central + regras de jogo
   ============================================================ */

const START_LEVELS = { hq: 3, oil: 2, steel: 2, farm: 2, power: 2, barracks: 2, factory: 1, warehouse: 1, lab: 1 };

function initialState() {
  const buildings = {};
  for (const def of BUILDING_DEFS) buildings[def.key] = { level: START_LEVELS[def.key] || 0 };
  const heroes = {};
  for (const h of HERO_DEFS) {
    heroes[h.key] = {
      unlocked: h.key === 'valkyrie',
      level: h.key === 'valkyrie' ? 4 : 1,
      xp: 0,
      points: h.key === 'valkyrie' ? 1 : 0,
      skills: { assault: h.key === 'valkyrie' ? 1 : 0, tactics: 0, charisma: 0 }
    };
  }
  const targets = {};
  for (const t of TARGETS) targets[t.id] = { owner: t.player ? 'player' : 'enemy' };

  return {
    version: GAME_VERSION,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    player: { name: 'COMANDANTE', level: 5, xp: 120, xpNext: 500 },
    resources: { oil: 24000, steel: 28000, food: 20000, credits: 16000, gems: 340 },
    buildings,
    buildQueue: [],
    trainQueue: [],
    researchQueue: [],
    research: { extraction: 0, agriculture: 0, commerce: 0, logistics: 0, ballistics: 0, armor: 0, intel: 0, medicine: 0 },
    troops: { infantry: 140, tank: 36, artillery: 10, helicopter: 3, commando: 0 },
    heroes,
    activeHero: 'valkyrie',
    targets,
    marches: [],
    arrivals: [],
    reports: [],
    claimedMissions: [],
    collect: {},
    stats: { trained: 0, battlesWon: 0, battlesLost: 0, researchCount: 0, built: 0 },
    settings: { sound: true, music: true },
    view: 'base',
    selectedBuilding: 'hq',
    selectedTarget: null,
    introSeen: false
  };
}

/* ---------------- persistence ---------------- */
export let state = initialState();

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

export function loadState() {
  try {
    const saved = safeParse(localStorage.getItem(SAVE_KEY));
    if (!saved || saved.version !== GAME_VERSION) return;
    const base = initialState();
    state = {
      ...base,
      ...saved,
      player: { ...base.player, ...saved.player },
      resources: { ...base.resources, ...saved.resources },
      buildings: { ...base.buildings, ...saved.buildings },
      research: { ...base.research, ...saved.research },
      troops: { ...base.troops, ...saved.troops },
      heroes: { ...base.heroes, ...saved.heroes },
      targets: { ...base.targets, ...saved.targets },
      stats: { ...base.stats, ...saved.stats },
      settings: { ...base.settings, ...saved.settings }
    };
    // merge nested hero fields individually
    for (const h of HERO_DEFS) {
      const prev = saved.heroes?.[h.key];
      if (prev) state.heroes[h.key] = { ...base.heroes[h.key], ...prev, skills: { ...base.heroes[h.key].skills, ...(prev.skills || {}) } };
    }
    // offline production (max 6h)
    const elapsed = Math.max(0, Math.min(Date.now() - (saved.lastSeen || Date.now()), 6 * 3600 * 1000));
    if (elapsed > 30_000) applyProduction(elapsed);
    state.arrivals = Array.isArray(state.arrivals) ? state.arrivals : [];
    state.marches = Array.isArray(state.marches) ? state.marches : [];
    state.reports = Array.isArray(state.reports) ? state.reports : [];
  } catch (e) {
    console.warn('Falha ao carregar salvamento', e);
  }
}

let saveAt = 0;
export function save(force = false) {
  const now = Date.now();
  if (!force && now - saveAt < 1500) return;
  saveAt = now;
  state.lastSeen = now;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage cheio */ }
}

export function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  location.reload();
}

/* ---------------- event bus ---------------- */
const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function emit(type, payload) {
  for (const fn of [...listeners]) {
    try { fn(type, payload); } catch (e) { console.error(e); }
  }
}
function toast(title, text = '', kind = '') {
  emit('toast', { title, text, kind });
}
function changed() {
  save();
  emit('change');
}

/* ---------------- derived values ---------------- */
export function buildingLevel(key) { return state.buildings[key]?.level || 0; }

export function production() {
  const rates = { oil: 0, steel: 0, food: 0, credits: 0 };
  for (const def of BUILDING_DEFS) {
    const lvl = buildingLevel(def.key);
    if (!def.prod || lvl <= 0) continue;
    const p = buildingProduction(def, lvl);
    for (const k of Object.keys(p)) rates[k] += p[k];
  }
  const hq = buildingLevel('hq');
  const techs = state.research;
  const conquered = conqueredCount();
  const energy = energyInfo();
  const globalMult = (1 + hq * 0.04) * (1 + conquered * 0.03) * (energy.deficit ? 0.7 : 1);
  rates.oil *= globalMult * (1 + techs.extraction * 0.06);
  rates.steel *= globalMult * (1 + techs.extraction * 0.06);
  rates.food *= globalMult * (1 + techs.agriculture * 0.06);
  rates.credits *= globalMult * (1 + techs.commerce * 0.06);
  for (const k of RES_KEYS) rates[k] = Math.round(rates[k]);
  return rates;
}

export function capacity() {
  const w = buildingLevel('warehouse');
  const base = 100000 + w * 30000;
  return Math.round(base * (1 + state.research.logistics * 0.10));
}

export function energyInfo() {
  let prod = 40 + buildingLevel('power') * 120;
  let use = 0;
  for (const def of BUILDING_DEFS) use += (def.powerUse || 0) * buildingLevel(def.key);
  return { prod, use, deficit: use > prod, free: Math.max(0, prod - use) };
}

export function troopCap() {
  return 200 + buildingLevel('barracks') * 240;
}

export function armyCount(units = state.troops) {
  return UNIT_DEFS.reduce((n, u) => n + (units[u.key] || 0), 0);
}

export function queuedTroops() {
  return state.trainQueue.reduce((n, q) => n + q.qty, 0);
}

export function attackBonus() {
  const tech = state.research.ballistics * 0.05;
  const radar = buildingLevel('radar') * 0.02;
  const hero = heroBonuses();
  return tech + radar + hero.atk;
}

export function lossReduction() {
  const tech = state.research.armor * 0.04;
  const hosp = buildingLevel('hospital') * 0.03;
  const hero = heroBonuses();
  return clamp(tech + hosp + hero.def, 0, 0.72);
}

export function lootBonus() {
  const tech = state.research.intel * 0.06;
  const hero = heroBonuses();
  return tech + hero.loot;
}

export function recoveryRate() {
  return clamp(state.research.medicine * 0.05 + buildingLevel('hospital') * 0.02, 0, 0.6);
}

export function heroBonuses() {
  const h = HERO_BY_KEY[state.activeHero] || HERO_DEFS[0];
  const hs = state.heroes[state.activeHero];
  if (!hs) return { atk: 0, def: 0, loot: 0 };
  return {
    atk: (h.baseAtk || 0) + (hs.level - 1) * 0.015 + hs.skills.assault * 0.03,
    def: (h.baseDef || 0) + hs.skills.tactics * 0.02,
    loot: (h.baseLoot || 0) + hs.skills.charisma * 0.04
  };
}

export function troopPower(units = state.troops) {
  const raw = UNIT_DEFS.reduce((n, u) => n + (units[u.key] || 0) * u.attack, 0);
  return Math.round(raw * (1 + attackBonus()));
}

export function buildingPower() {
  let p = 0;
  for (const def of BUILDING_DEFS) p += buildingLevel(def.key) * 55;
  return p;
}

export function totalPower(units = state.troops) {
  const researchTotal = Object.values(state.research).reduce((a, b) => a + b, 0);
  return troopPower(units) + buildingPower() + researchTotal * 140 + state.player.level * 110;
}

export function conqueredCount() {
  return TARGETS.filter(t => !t.player && state.targets[t.id]?.owner === 'player').length;
}

export function domination() {
  return Math.round(((conqueredCount() + 1) / TARGETS.length) * 100);
}

export function marchSlots() {
  return 2 + Math.floor(buildingLevel('hq') / 6);
}

export function targetState(id) {
  const t = TARGET_BY_ID[id];
  if (!t) return null;
  return { ...t, owner: state.targets[id]?.owner || 'enemy' };
}

export function targetOdds(id, units) {
  const t = TARGET_BY_ID[id];
  if (!t) return { atk: 0, def: 1, ratio: 0, percent: 0 };
  const atk = troopPower(units);
  const ratio = atk / t.def;
  return { atk, def: t.def, ratio, percent: Math.round(ratio * 100) };
}

export function buildingUpgradeInfo(key) {
  const def = BUILDING_BY_KEY[key];
  const lvl = buildingLevel(key);
  return {
    def, level: lvl, nextLevel: lvl + 1,
    cost: upgradeCost(def, lvl), time: upgradeTime(def, lvl),
    maxed: lvl >= def.max
  };
}

export function isUpgrading(key) {
  return state.buildQueue.some(q => q.buildingKey === key);
}

export function queueForBuilding(key) {
  return state.buildQueue.find(q => q.buildingKey === key) || null;
}

export function buildingProductionNow(key) {
  const def = BUILDING_BY_KEY[key];
  const lvl = buildingLevel(key);
  if (!def?.prod || lvl <= 0) return null;
  const base = buildingProduction(def, lvl);
  const rates = production();
  // proportional share for this building (uses global multipliers)
  const totalBase = { oil: 1, steel: 1, food: 1, credits: 1 };
  for (const d of BUILDING_DEFS) {
    if (!d.prod) continue;
    const p = buildingProduction(d, buildingLevel(d.key));
    if (p) for (const k of Object.keys(p)) totalBase[k] += p[k];
  }
  const out = {};
  for (const k of Object.keys(base)) out[k] = Math.round(rates[k] * (base[k] / Math.max(1, totalBase[k])));
  return out;
}

export function canAfford(cost) {
  return Object.entries(cost).every(([k, v]) => (state.resources[k] || 0) >= v);
}

export function missingResources(cost) {
  return Object.entries(cost).filter(([k, v]) => (state.resources[k] || 0) < v).map(([k]) => k);
}

function spend(cost) {
  for (const [k, v] of Object.entries(cost)) state.resources[k] = Math.max(0, (state.resources[k] || 0) - v);
}

function addResource(key, amount) {
  if (key === 'gems') { state.resources.gems += Math.round(amount); return; }
  state.resources[key] = Math.min(capacity(), (state.resources[key] || 0) + amount);
}

export function addResources(rewards) {
  for (const [k, v] of Object.entries(rewards)) if (v) addResource(k, v);
}

export function applyProduction(ms) {
  if (ms <= 0) return;
  const rates = production();
  for (const k of RES_KEYS) addResource(k, rates[k] * (ms / 3600000));
}

/* ---------------- player progression ---------------- */
function addPlayerXp(amount) {
  if (!amount) return;
  state.player.xp += Math.round(amount);
  let levels = 0;
  while (state.player.xp >= state.player.xpNext) {
    state.player.xp -= state.player.xpNext;
    state.player.level += 1;
    state.player.xpNext = Math.round(state.player.xpNext * 1.22);
    state.resources.gems += 25;
    levels++;
  }
  if (levels) toast('NOVO NÍVEL DE COMANDANTE', `Você alcançou o nível ${state.player.level}. +25 diamantes.`, 'good');
}

function addHeroXp(amount) {
  if (!amount) return;
  const hs = state.heroes[state.activeHero];
  hs.xp += Math.round(amount);
  let next = 100 + hs.level * 70;
  while (hs.xp >= next) {
    hs.xp -= next;
    hs.level += 1;
    hs.points += 1;
    next = 100 + hs.level * 70;
    toast('HERÓI PROMOVIDO', `${HERO_BY_KEY[state.activeHero].name} alcançou o nível ${hs.level}. +1 ponto de habilidade.`, 'good');
  }
}

/* ---------------- buildings ---------------- */
export function upgradeBuilding(key) {
  const def = BUILDING_BY_KEY[key];
  if (!def) return { ok: false, msg: 'Edifício inválido.' };
  const b = state.buildings[key];
  if (b.level >= def.max) return { ok: false, msg: 'Este edifício já está no nível máximo.' };
  if (isUpgrading(key)) return { ok: false, msg: 'Este edifício já está em obras.' };
  if (state.buildQueue.length >= 2) return { ok: false, msg: 'Todos os engenheiros estão ocupados.' };
  const target = b.level + 1;
  if (key !== 'hq' && target > buildingLevel('hq')) {
    return { ok: false, msg: 'Evolua o Quartel-General para liberar este nível.' };
  }
  const cost = upgradeCost(def, b.level);
  if (!canAfford(cost)) return { ok: false, msg: 'Recursos insuficientes.' };
  spend(cost);
  const time = upgradeTime(def, b.level);
  const kind = b.level === 0 ? 'build' : 'upgrade';
  state.buildQueue.push({
    id: 'b' + Date.now() + Math.random().toString(36).slice(2, 6),
    buildingKey: key, toLevel: target, kind, cost, time,
    startAt: Date.now(), finishAt: Date.now() + time * 1000
  });
  toast(kind === 'build' ? 'CONSTRUÇÃO INICIADA' : 'EVOLUÇÃO INICIADA', `${def.name} → nível ${target} · ${time}s`, 'good');
  changed();
  return { ok: true };
}

export function collectBuilding(key) {
  const def = BUILDING_BY_KEY[key];
  const lvl = buildingLevel(key);
  if (!def?.prod || lvl <= 0) return { ok: false, msg: 'Este edifício não produz recursos.' };
  const ready = state.collect[key] || 0;
  if (Date.now() < ready) return { ok: false, msg: 'Coleta recarregando.' };
  const hourly = buildingProductionNow(key);
  if (!hourly) return { ok: false, msg: 'Nada para coletar.' };
  let total = 0;
  const gains = {};
  for (const [k, v] of Object.entries(hourly)) {
    const amt = Math.round(v * 0.25);
    const before = state.resources[k];
    addResource(k, amt);
    const got = state.resources[k] - before;
    if (got > 0) { gains[k] = got; total += got; }
  }
  state.collect[key] = Date.now() + 45000;
  if (total <= 0) { toast('ARMAZÉM LOTADO', 'Gaste recursos antes de coletar.', 'bad'); return { ok: false }; }
  toast('RECURSOS COLETADOS', Object.entries(gains).map(([k, v]) => `+${fmt(v)} ${k === 'oil' ? 'petróleo' : k === 'steel' ? 'aço' : k === 'food' ? 'alimentos' : 'créditos'}`).join(' · '), 'good');
  emit('collect', { key, gains });
  changed();
  return { ok: true, gains };
}

/* ---------------- training ---------------- */
export function unitUnlocked(key) {
  const def = UNIT_BY_KEY[key];
  if (!def) return false;
  return buildingLevel(def.unlock.building) >= def.unlock.level;
}

export function unlockRequirement(key) {
  const def = UNIT_BY_KEY[key];
  const b = BUILDING_BY_KEY[def.unlock.building];
  return `Requer ${b.name} nível ${def.unlock.level}`;
}

export function trainUnits(key, qty) {
  const def = UNIT_BY_KEY[key];
  if (!def) return { ok: false, msg: 'Unidade inválida.' };
  qty = Math.floor(qty);
  if (qty <= 0) return { ok: false, msg: 'Quantidade inválida.' };
  if (!unitUnlocked(key)) return { ok: false, msg: unlockRequirement(key) };
  if (state.trainQueue.length >= 3) return { ok: false, msg: 'A fila de treinamento está cheia.' };
  const cap = troopCap();
  if (armyCount() + queuedTroops() + qty > cap) {
    return { ok: false, msg: `Capacidade de tropa insuficiente (${fmt(armyCount() + queuedTroops())}/${fmt(cap)}).` };
  }
  const cost = {};
  for (const [k, v] of Object.entries(def.cost)) cost[k] = v * qty;
  if (!canAfford(cost)) return { ok: false, msg: 'Recursos insuficientes.' };
  spend(cost);
  const time = Math.max(2, Math.round((def.timePer10 * qty) / 10));
  state.trainQueue.push({
    id: 'u' + Date.now() + Math.random().toString(36).slice(2, 6),
    unitKey: key, qty, startAt: Date.now(), finishAt: Date.now() + time * 1000, time
  });
  toast('TREINAMENTO INICIADO', `${qty}× ${def.name} · ${time}s`, 'good');
  changed();
  return { ok: true };
}

/* ---------------- research ---------------- */
export function researchCost(key) {
  const def = TECH_BY_KEY[key];
  const lvl = state.research[key] || 0;
  const mult = Math.pow(1.7, lvl);
  const out = {};
  for (const [k, v] of Object.entries(def.cost)) out[k] = round(v * mult, 10);
  return out;
}

export function researchTime(key) {
  const def = TECH_BY_KEY[key];
  const lvl = state.research[key] || 0;
  return Math.round(def.time * Math.pow(1.35, lvl));
}

export function startResearch(key) {
  const def = TECH_BY_KEY[key];
  if (!def) return { ok: false, msg: 'Pesquisa inválida.' };
  if (buildingLevel('lab') < 1) return { ok: false, msg: 'Construa o Laboratório Bélico primeiro.' };
  const lvl = state.research[key] || 0;
  if (lvl >= def.max) return { ok: false, msg: 'Pesquisa já concluída.' };
  if (state.researchQueue.length > 0) return { ok: false, msg: 'O laboratório já está pesquisando.' };
  const cost = researchCost(key);
  if (!canAfford(cost)) return { ok: false, msg: 'Recursos insuficientes.' };
  spend(cost);
  const time = researchTime(key);
  state.researchQueue.push({ id: 'r' + Date.now(), techKey: key, toLevel: lvl + 1, cost, time, startAt: Date.now(), finishAt: Date.now() + time * 1000 });
  toast('PESQUISA INICIADA', `${def.name} nível ${lvl + 1} · ${time}s`, 'good');
  changed();
  return { ok: true };
}

/* ---------------- heroes ---------------- */
export function selectHero(key) {
  const hs = state.heroes[key];
  if (!hs?.unlocked) return { ok: false, msg: 'Comandante bloqueado.' };
  state.activeHero = key;
  toast('COMANDANTE ATIVO', `${HERO_BY_KEY[key].name} assumiu o comando.`, 'good');
  changed();
  return { ok: true };
}

export function unlockHero(key) {
  const h = HERO_BY_KEY[key];
  const hs = state.heroes[key];
  if (!h || !hs) return { ok: false, msg: 'Comandante inválido.' };
  if (hs.unlocked) return { ok: false, msg: 'Comandante já desbloqueado.' };
  if (state.resources.gems < h.cost) return { ok: false, msg: `Faltam ${fmt(h.cost - state.resources.gems)} diamantes.` };
  state.resources.gems -= h.cost;
  hs.unlocked = true;
  toast('NOVO COMANDANTE', `${h.name} juntou-se à sua coalizão.`, 'good');
  changed();
  return { ok: true };
}

export function levelSkill(skill) {
  const hs = state.heroes[state.activeHero];
  if (!hs) return { ok: false };
  if (hs.points <= 0) return { ok: false, msg: 'Sem pontos de habilidade. Vença batalhas para evoluir.' };
  hs.points -= 1;
  hs.skills[skill] = (hs.skills[skill] || 0) + 1;
  toast('HABILIDADE EVOLUÍDA', `${heroSkillName(skill)} melhorada.`, 'good');
  changed();
  return { ok: true };
}

function heroSkillName(key) {
  return { assault: 'Doutrina de Assalto', tactics: 'Táticas Defensivas', charisma: 'Carisma de Guerra' }[key] || key;
}

/* ---------------- marches & battle ---------------- */
export function sendMarch(targetId, units) {
  const target = targetState(targetId);
  if (!target) return { ok: false, msg: 'Alvo inválido.' };
  if (target.player) return { ok: false, msg: 'Você não pode atacar sua própria base.' };
  if (target.owner === 'player') return { ok: false, msg: 'Este setor já foi conquistado.' };
  if (state.marches.length >= marchSlots()) return { ok: false, msg: 'Todas as frentes de marcha estão ocupadas.' };
  const clean = {};
  let count = 0;
  for (const def of UNIT_DEFS) {
    const q = Math.max(0, Math.floor(units?.[def.key] || 0));
    const avail = state.troops[def.key] || 0;
    const take = Math.min(q, avail);
    if (take > 0) { clean[def.key] = take; count += take; }
  }
  if (count <= 0) return { ok: false, msg: 'Selecione ao menos uma unidade.' };
  for (const [k, v] of Object.entries(clean)) state.troops[k] -= v;
  const travel = targetTravel(target);
  const power = troopPower(clean);
  state.marches.push({
    id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6),
    targetId, units: clean, sentAt: Date.now(),
    arriveAt: Date.now() + travel * 1000, travel, power
  });
  toast('FORÇA EM MARCHA', `${count} unidades a caminho de ${target.name}. Chegada em ${travel}s.`, 'good');
  emit('march', { targetId });
  changed();
  return { ok: true };
}

function rngFrom(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computeOutcome(march) {
  const target = TARGET_BY_ID[march.targetId];
  const atk = troopPower(march.units);
  const def = target.def;
  const ratio = atk / def;
  const win = ratio >= 1;
  const rng = rngFrom(hashString(march.id + target.id));
  const baseLoss = win
    ? clamp(0.52 / Math.max(ratio, 0.2), 0.06, 0.58)
    : clamp(0.6 + 0.25 * (1 - Math.min(ratio, 1)), 0.55, 0.9);
  const netLossRate = baseLoss * (1 - lossReduction());
  const recover = recoveryRate();
  const losses = {};
  const recovered = {};
  const survivors = {};
  let totalLost = 0;
  let totalRecovered = 0;
  for (const u of UNIT_DEFS) {
    const q = march.units[u.key] || 0;
    if (!q) continue;
    const raw = Math.min(q, Math.round(q * netLossRate * (0.82 + rng() * 0.36)));
    const rec = Math.min(raw, Math.floor(raw * recover * (0.7 + rng() * 0.6)));
    losses[u.key] = raw - rec;
    recovered[u.key] = rec;
    survivors[u.key] = q - raw + rec;
    totalLost += raw - rec;
    totalRecovered += rec;
  }
  const loot = {};
  if (win) {
    const base = targetLoot(target);
    const mult = 1 + lootBonus();
    for (const [k, v] of Object.entries(base)) loot[k] = Math.round(v * mult);
  }
  const xp = win ? Math.round(30 + target.level * 32 + def / 160) : Math.round(10 + def / 320);
  const heroXp = win ? Math.round(18 + target.level * 16) : 6;
  const sentCount = Object.values(march.units).reduce((a, b) => a + b, 0);
  return {
    id: 'a' + march.id,
    marchId: march.id,
    targetId: target.id,
    targetName: target.name,
    faction: target.faction,
    level: target.level,
    atk, def, ratio, win,
    losses, recovered, survivors,
    loot, xp, heroXp,
    lost: totalLost, recoveredTotal: totalRecovered,
    sentCount,
    sentUnits: { ...march.units },
    applied: false,
    time: Date.now()
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function processArrivals() {
  const now = Date.now();
  for (let i = state.marches.length - 1; i >= 0; i--) {
    const m = state.marches[i];
    if (now >= m.arriveAt) {
      state.marches.splice(i, 1);
      const outcome = computeOutcome(m);
      state.arrivals.push(outcome);
      emit('arrival', outcome);
      toast('TROPAS NO ALVO', `Confronto em ${outcome.targetName}.`, '');
    }
  }
}

export function resolveArrival(id) {
  const a = state.arrivals.find(x => x.id === id);
  if (!a || a.applied) return null;
  a.applied = true;
  // survivors return to the army
  for (const [k, v] of Object.entries(a.survivors || {})) {
    if (v > 0) state.troops[k] = (state.troops[k] || 0) + v;
  }
  const target = TARGET_BY_ID[a.targetId];
  if (a.win) {
    for (const [k, v] of Object.entries(a.loot || {})) addResource(k, v);
    state.targets[a.targetId] = { owner: 'player' };
    state.stats.battlesWon += 1;
    addPlayerXp(a.xp);
    addHeroXp(a.heroXp);
  } else {
    state.stats.battlesLost += 1;
    addPlayerXp(a.xp);
    addHeroXp(a.heroXp);
  }
  const report = {
    id: a.id, targetId: a.targetId, targetName: a.targetName, faction: a.faction,
    win: a.win, atk: a.atk, def: a.def, lost: a.lost, recovered: a.recoveredTotal,
    loot: a.loot, sentCount: a.sentCount, time: Date.now()
  };
  state.reports.unshift(report);
  state.reports = state.reports.slice(0, 30);
  state.arrivals = state.arrivals.filter(x => x.id !== id);
  changed();
  return { report, outcome: a };
}

export function activeBattle() {
  return state.arrivals.find(a => !a.applied) || null;
}

/* ---------------- missions ---------------- */
export function missionProgress(id) {
  const stat = state.stats;
  switch (id) {
    case 'm1': {
      const max = Math.max(...BUILDING_DEFS.map(d => buildingLevel(d.key)));
      return { current: Math.min(max, 4), target: 4, done: max >= 4, text: `Edifício nível ${Math.min(max, 4)}/4` };
    }
    case 'm2': return { current: Math.min(stat.trained, 50), target: 50, done: stat.trained >= 50, text: `${Math.min(stat.trained, 50)}/50 treinados` };
    case 'm3': { const c = conqueredCount(); return { current: Math.min(c, 1), target: 1, done: c >= 1, text: `${Math.min(c, 1)}/1 setor` }; }
    case 'm4': { const l = buildingLevel('radar'); return { current: Math.min(l, 1), target: 1, done: l >= 1, text: l >= 1 ? 'Radar operacional' : 'Radar não construído' }; }
    case 'm5': return { current: Math.min(stat.researchCount, 2), target: 2, done: stat.researchCount >= 2, text: `${Math.min(stat.researchCount, 2)}/2 pesquisas` };
    case 'm6': { const l = buildingLevel('hq'); return { current: Math.min(l, 5), target: 5, done: l >= 5, text: `QG nível ${Math.min(l, 5)}/5` }; }
    case 'm7': { const c = conqueredCount(); return { current: Math.min(c, 5), target: 5, done: c >= 5, text: `${Math.min(c, 5)}/5 setores` }; }
    case 'm8': { const l = state.player.level; return { current: Math.min(l, 8), target: 8, done: l >= 8, text: `Nível ${Math.min(l, 8)}/8` }; }
    default: return { current: 0, target: 1, done: false, text: '' };
  }
}

export function claimMission(id) {
  const m = MISSIONS.find(x => x.id === id);
  if (!m) return { ok: false };
  if (state.claimedMissions.includes(id)) return { ok: false, msg: 'Recompensa já coletada.' };
  const p = missionProgress(id);
  if (!p.done) return { ok: false, msg: 'Objetivo ainda não concluído.' };
  state.claimedMissions.push(id);
  addResources(m.reward);
  if (m.xp) addPlayerXp(m.xp);
  toast('MISSÃO CONCLUÍDA', `${m.name} · recompensas creditadas.`, 'good');
  emit('mission', { id });
  changed();
  return { ok: true };
}

/* ---------------- tick ---------------- */
let tickTimer = null;
let lastTick = Date.now();
let saveTimer = 0;

export function startTicker() {
  if (tickTimer) return;
  lastTick = Date.now();
  tickTimer = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(now - lastTick, 8 * 3600 * 1000);
    lastTick = now;
    applyProduction(dt);

    let structural = false;
    // buildings
    for (let i = state.buildQueue.length - 1; i >= 0; i--) {
      const q = state.buildQueue[i];
      if (now >= q.finishAt) {
        state.buildQueue.splice(i, 1);
        const b = state.buildings[q.buildingKey];
        if (b) {
          if (b.level === 0) state.stats.built += 1;
          b.level = q.toLevel;
        }
        structural = true;
        const def = BUILDING_BY_KEY[q.buildingKey];
        toast('OBRA CONCLUÍDA', `${def.name} agora está no nível ${q.toLevel}.`, 'good');
        emit('complete', { type: 'building', key: q.buildingKey, level: q.toLevel });
      }
    }
    // training
    for (let i = state.trainQueue.length - 1; i >= 0; i--) {
      const q = state.trainQueue[i];
      if (now >= q.finishAt) {
        state.trainQueue.splice(i, 1);
        state.troops[q.unitKey] = (state.troops[q.unitKey] || 0) + q.qty;
        state.stats.trained += q.qty;
        structural = true;
        const def = UNIT_BY_KEY[q.unitKey];
        toast('TREINAMENTO CONCLUÍDO', `${q.qty}× ${def.name} prontos para o combate.`, 'good');
        emit('complete', { type: 'training', key: q.unitKey, qty: q.qty });
      }
    }
    // research
    for (let i = state.researchQueue.length - 1; i >= 0; i--) {
      const q = state.researchQueue[i];
      if (now >= q.finishAt) {
        state.researchQueue.splice(i, 1);
        state.research[q.techKey] = q.toLevel;
        state.stats.researchCount += 1;
        structural = true;
        toast('PESQUISA CONCLUÍDA', `${TECH_BY_KEY[q.techKey].name} nível ${q.toLevel}.`, 'good');
        emit('complete', { type: 'research', key: q.techKey, level: q.toLevel });
      }
    }
    // arrivals
    const before = state.arrivals.length + state.marches.length;
    processArrivals();
    if (before !== state.arrivals.length + state.marches.length) structural = true;

    emit('tick', { now, dt });
    if (structural) changed();
    else if (now - saveTimer > 5000) { saveTimer = now; save(); }
  }, 500);
}

export function stopTicker() {
  clearInterval(tickTimer);
  tickTimer = null;
}

/* ---------------- misc ---------------- */
export function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  changed();
  return state.settings[key];
}

export function setView(view) {
  state.view = view;
  state.selectedTarget = null;
  save();
  emit('view', { view });
}

export function selectBuilding(key) {
  state.selectedBuilding = key;
  save();
  emit('select', { key });
}

export function selectTarget(id) {
  state.selectedTarget = id;
  save();
  emit('selectTarget', { id });
}

export function markIntroSeen() {
  state.introSeen = true;
  save();
}

export function nowTime() { return Date.now(); }
