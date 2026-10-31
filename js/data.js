/* ============================================================
   Dados do jogo — COMANDO GLOBAL
   ============================================================ */

export const SAVE_KEY = 'comando-global-save-v3';
export const GAME_VERSION = 3;

export const RESOURCES = {
  oil:     { name: 'Petróleo', short: 'PETRÓLEO', color: '#f0a33a', icon: 'oil' },
  steel:   { name: 'Aço', short: 'AÇO', color: '#a9bfd2', icon: 'steel' },
  food:    { name: 'Alimentos', short: 'ALIMENTOS', color: '#8fc45b', icon: 'food' },
  credits: { name: 'Créditos', short: 'CRÉDITOS', color: '#e8c15a', icon: 'credit' },
  gems:    { name: 'Diamantes', short: 'DIAMANTES', color: '#59d6e6', icon: 'gem' }
};
export const RES_KEYS = ['oil', 'steel', 'food', 'credits'];

export const BUILDING_DEFS = [
  {
    key: 'hq', name: 'Quartel-General', tag: 'COMANDO', icon: 'star', gx: 4, gy: 4, w: 2, d: 2,
    desc: 'O coração da sua nação. Define o nível máximo dos demais edifícios e coordena toda a operação.',
    cost: { steel: 900, oil: 700, credits: 500 }, time: 28, max: 15, powerUse: 14, powerGive: 0,
    effect: '+4% produção global por nível', color: '#f2a63b'
  },
  {
    key: 'oil', name: 'Poço de Petróleo', tag: 'ECONOMIA', icon: 'oil', gx: 1, gy: 1, w: 2, d: 2,
    desc: 'Extração contínua de petróleo bruto. Mantém os veículos e a força aérea em operação.',
    cost: { steel: 320, credits: 220 }, time: 12, max: 15, powerUse: 8, prod: { oil: 9000 },
    effect: 'Produção de petróleo por hora', color: '#f0a33a'
  },
  {
    key: 'steel', name: 'Siderúrgica', tag: 'ECONOMIA', icon: 'steel', gx: 4, gy: 8, w: 2, d: 2,
    desc: 'Fundição de alta capacidade. Transforma minério em aço para blindados e fortificações.',
    cost: { oil: 320, credits: 220 }, time: 12, max: 15, powerUse: 8, prod: { steel: 8000 },
    effect: 'Produção de aço por hora', color: '#a9bfd2'
  },
  {
    key: 'farm', name: 'Fazenda Militar', tag: 'ECONOMIA', icon: 'food', gx: 1, gy: 8, w: 2, d: 2,
    desc: 'Campos cultivados e silos de grãos. Sem comida, nenhum exército marcha.',
    cost: { steel: 260, credits: 200 }, time: 11, max: 15, powerUse: 7, prod: { food: 10000 },
    effect: 'Produção de alimentos por hora', color: '#8fc45b'
  },
  {
    key: 'power', name: 'Usina Elétrica', tag: 'INFRAESTRUTURA', icon: 'bolt', gx: 7, gy: 1, w: 2, d: 2,
    desc: 'Reator e torres de refrigeração. Fornece energia para toda a fortaleza.',
    cost: { steel: 420, oil: 300 }, time: 16, max: 15, powerUse: 0, powerGive: 120,
    effect: '+120 de energia por nível', color: '#6aa9ff'
  },
  {
    key: 'barracks', name: 'Quartel', tag: 'MILITAR', icon: 'army', gx: 4, gy: 1, w: 2, d: 2,
    desc: 'Centro de recrutamento e treinamento da infantaria. Aumenta a capacidade do seu exército.',
    cost: { steel: 380, food: 300 }, time: 16, max: 15, powerUse: 8, troopCap: 240,
    effect: '+240 de capacidade de tropa por nível', color: '#83c65a'
  },
  {
    key: 'factory', name: 'Fábrica de Guerra', tag: 'MILITAR', icon: 'truck', gx: 8, gy: 4, w: 2, d: 2,
    desc: 'Linha de montagem de blindados e artilharia pesada. A espinha dorsal do avanço terrestre.',
    cost: { steel: 550, oil: 420 }, time: 20, max: 15, powerUse: 10,
    effect: 'Desbloqueia tanques e artilharia', color: '#c08d55'
  },
  {
    key: 'warehouse', name: 'Armazém Central', tag: 'INFRAESTRUTURA', icon: 'steel', gx: 6, gy: 8, w: 2, d: 2,
    desc: 'Contêineres e silos de reserva. Protege seus recursos contra saques e aumenta a capacidade.',
    cost: { steel: 320, credits: 240 }, time: 13, max: 15, powerUse: 4, storage: 30000,
    effect: '+30.000 de capacidade de armazenamento', color: '#b7a47a'
  },
  {
    key: 'lab', name: 'Laboratório Bélico', tag: 'PESQUISA', icon: 'flask', gx: 2, gy: 3, w: 2, d: 2,
    desc: 'Engenheiros e cientistas desenvolvem novas tecnologias para o campo de batalha.',
    cost: { steel: 520, credits: 380 }, time: 22, max: 15, powerUse: 8,
    effect: 'Desbloqueia e acelera pesquisas', color: '#45d3c6'
  },
  {
    key: 'market', name: 'Mercado Negro', tag: 'ECONOMIA', icon: 'credit', gx: 8, gy: 8, w: 2, d: 2,
    desc: 'Rede de comércio clandestino. Gera créditos e conecta sua base ao mercado global.',
    cost: { steel: 460, oil: 340, credits: 200 }, time: 18, max: 15, powerUse: 5, prod: { credits: 7000 },
    effect: 'Produção de créditos por hora', color: '#e8c15a'
  },
  {
    key: 'radar', name: 'Estação Radar', tag: 'MILITAR', icon: 'radar', gx: 0, gy: 6, w: 2, d: 2,
    desc: 'Varredura de longo alcance. Revela alvos e coordena ataques com precisão cirúrgica.',
    cost: { steel: 480, oil: 380 }, time: 18, max: 15, powerUse: 6, attackBonus: 0.02,
    effect: '+2% de ataque por nível', color: '#59d6e6'
  },
  {
    key: 'airbase', name: 'Base Aérea', tag: 'MILITAR', icon: 'target', gx: 9, gy: 1, w: 2, d: 2,
    desc: 'Pista de pouso e hangares blindados. Dá asas à sua ofensiva com helicópteros de combate.',
    cost: { steel: 900, oil: 750, credits: 400 }, time: 26, max: 15, powerUse: 12,
    effect: 'Desbloqueia helicópteros de combate', color: '#e3594c'
  },
  {
    key: 'hospital', name: 'Hospital de Campanha', tag: 'DEFESA', icon: 'plus', gx: 4, gy: 6, w: 2, d: 2,
    desc: 'Equipes médicas recuperam soldados feridos. Cada nível reduz as baixas permanentes.',
    cost: { steel: 520, food: 380 }, time: 20, max: 15, powerUse: 5, lossReduction: 0.03,
    effect: '−3% de baixas por nível', color: '#e37f7f'
  },
  {
    key: 'wall', name: 'Muralha de Aço', tag: 'DEFESA', icon: 'shield', gx: 0, gy: 4, w: 2, d: 2,
    desc: 'Bunkers e barreiras de concreto. Protege a fortaleza contra ataques inimigos.',
    cost: { steel: 650, oil: 420 }, time: 20, max: 15, powerUse: 2, defenseBonus: 0.05,
    effect: '+5% de defesa da base por nível', color: '#8f9dab'
  }
];

export const BUILDING_BY_KEY = Object.fromEntries(BUILDING_DEFS.map(b => [b.key, b]));

export const UNIT_DEFS = [
  {
    key: 'infantry', name: 'Infantaria', role: 'Linha de frente', icon: 'army', attack: 12,
    cost: { food: 50, steel: 30 }, timePer10: 4, unlock: { building: 'barracks', level: 1 },
    desc: 'Soldados equipados com fuzis de assalto. Baratos, rápidos e essenciais para segurar terreno.'
  },
  {
    key: 'tank', name: 'Tanque de Assalto', role: 'Blindado', icon: 'shield', attack: 55,
    cost: { oil: 90, steel: 140 }, timePer10: 9, unlock: { building: 'factory', level: 1 },
    desc: 'Blindagem pesada e canhão de 120 mm. Rompe linhas defensivas e abre caminho para a infantaria.'
  },
  {
    key: 'artillery', name: 'Artilharia Pesada', role: 'Fogo indireto', icon: 'target', attack: 115,
    cost: { steel: 220, oil: 80 }, timePer10: 14, unlock: { building: 'factory', level: 2 },
    desc: 'Obuses autopropulsados que bombardeiam alvos a quilômetros de distância antes do avanço.'
  },
  {
    key: 'helicopter', name: 'Helicóptero de Combate', role: 'Aéreo', icon: 'radar', attack: 210,
    cost: { oil: 260, credits: 130 }, timePer10: 20, unlock: { building: 'airbase', level: 1 },
    desc: 'Caçador de blindados com mísseis guiados. Domina o céu e ataca onde o inimigo menos espera.'
  },
  {
    key: 'commando', name: 'Comandos de Elite', role: 'Forças especiais', icon: 'sword', attack: 320,
    cost: { food: 220, credits: 300 }, timePer10: 28, unlock: { building: 'barracks', level: 4 },
    desc: 'Operadores de elite treinados para infiltração e sabotagem. Poucos, silenciosos, letais.'
  }
];
export const UNIT_BY_KEY = Object.fromEntries(UNIT_DEFS.map(u => [u.key, u]));

export const TECH_DEFS = [
  { key: 'extraction', name: 'Extração Profunda', icon: 'oil', branch: 'ECONOMIA', max: 5, cost: { steel: 600, credits: 400 }, time: 24, effect: '+6% de petróleo e aço por nível' },
  { key: 'agriculture', name: 'Agricultura Intensiva', icon: 'food', branch: 'ECONOMIA', max: 5, cost: { steel: 500, credits: 300 }, time: 22, effect: '+6% de alimentos por nível' },
  { key: 'commerce', name: 'Rede Comercial', icon: 'credit', branch: 'ECONOMIA', max: 5, cost: { steel: 540, oil: 320 }, time: 24, effect: '+6% de créditos por nível' },
  { key: 'logistics', name: 'Logística de Guerra', icon: 'truck', branch: 'ECONOMIA', max: 5, cost: { steel: 700, credits: 500 }, time: 28, effect: '+10% de capacidade de estoque por nível' },
  { key: 'ballistics', name: 'Munição Perfurante', icon: 'sword', branch: 'MILITAR', max: 5, cost: { steel: 800, oil: 500 }, time: 30, effect: '+5% de ataque por nível' },
  { key: 'armor', name: 'Blindagem Reativa', icon: 'shield', branch: 'MILITAR', max: 5, cost: { steel: 900, oil: 400 }, time: 30, effect: '−4% de baixas por nível' },
  { key: 'intel', name: 'Inteligência Militar', icon: 'radar', branch: 'MILITAR', max: 5, cost: { credits: 600, oil: 400 }, time: 26, effect: '+6% de espólio por nível' },
  { key: 'medicine', name: 'Medicina de Campo', icon: 'plus', branch: 'MILITAR', max: 5, cost: { food: 600, credits: 500 }, time: 26, effect: '+5% de feridos recuperados por nível' }
];
export const TECH_BY_KEY = Object.fromEntries(TECH_DEFS.map(t => [t.key, t]));

export const HERO_DEFS = [
  {
    key: 'valkyrie', name: 'VALQUÍRIA', title: 'COMANDO DE ASSALTO', nation: 'FORÇA ÔMEGA',
    color: '#f2a63b', accent: '#ffd48a', cost: 0,
    desc: 'Especialista em ofensivas relâmpago. Sua presença no campo eleva a letalidade de toda a força de ataque.',
    bonusText: '+12% de ataque', baseAtk: 0.12, baseDef: 0, baseLoot: 0
  },
  {
    key: 'titan', name: 'TITÃ', title: 'MURALHA HUMANA', nation: 'GUARDA DE FERRO',
    color: '#e3594c', accent: '#ff9d91', cost: 450,
    desc: 'Veterano de dezenas de cercos. Inspira suas tropas a resistir e reduz as baixas permanentes em combate.',
    bonusText: '−12% de baixas', baseAtk: 0, baseDef: 0.12, baseLoot: 0
  },
  {
    key: 'corvo', name: 'CORVO', title: 'ESPECIALISTA EM SAQUE', nation: 'SOMBRA TÁTICA',
    color: '#45d3c6', accent: '#9ffff2', cost: 650,
    desc: 'Fantasma dos campos de batalha. Conhece cada depósito inimigo e transforma vitórias em riqueza.',
    bonusText: '+25% de espólio', baseAtk: 0, baseDef: 0, baseLoot: 0.25
  }
];
export const HERO_BY_KEY = Object.fromEntries(HERO_DEFS.map(h => [h.key, h]));

export const HERO_SKILLS = [
  { key: 'assault', name: 'Doutrina de Assalto', desc: '+3% de ataque por ponto', icon: 'sword' },
  { key: 'tactics', name: 'Táticas Defensivas', desc: '−2% de baixas por ponto', icon: 'shield' },
  { key: 'charisma', name: 'Carisma de Guerra', desc: '+4% de espólio por ponto', icon: 'crown' }
];

export const TARGETS = [
  { id: 't1',  name: 'Posto Vigia',          faction: 'LEGIÃO RUBRA',     level: 1, def: 900,   x: 28, y: 29, lootMult: 1.0 },
  { id: 't2',  name: 'Acampamento Cinza',    faction: 'LEGIÃO RUBRA',     level: 1, def: 1500,  x: 40, y: 20, lootMult: 1.1 },
  { id: 't3',  name: 'Depósito Norte',       faction: 'CARTEL DE FERRO',  level: 2, def: 2600,  x: 61, y: 17, lootMult: 1.2 },
  { id: 't4',  name: 'Vila de Ferro',        faction: 'CARTEL DE FERRO',  level: 2, def: 3400,  x: 77, y: 27, lootMult: 1.1 },
  { id: 't5',  name: 'Base Falcão',          faction: 'NOVA ORDEM',       level: 3, def: 5200,  x: 85, y: 40, lootMult: 1.3 },
  { id: 't6',  name: 'Porto Negro',          faction: 'CARTEL DE FERRO',  level: 3, def: 6100,  x: 76, y: 54, lootMult: 1.4 },
  { id: 't7',  name: 'Complexo K-9',         faction: 'NOVA ORDEM',       level: 4, def: 8800,  x: 83, y: 66, lootMult: 1.5 },
  { id: 't8',  name: 'Fortaleza Sul',        faction: 'LEGIÃO RUBRA',     level: 4, def: 10400, x: 64, y: 77, lootMult: 1.4 },
  { id: 't9',  name: 'Capital Sombria',      faction: 'NOVA ORDEM',       level: 5, def: 14800, x: 48, y: 85, lootMult: 1.8 },
  { id: 't10', name: 'Muralha Vermelha',     faction: 'LEGIÃO RUBRA',     level: 5, def: 16500, x: 32, y: 76, lootMult: 1.6 },
  { id: 't11', name: 'Deserto de Vidro',     faction: 'FILHOS DO SOL',    level: 4, def: 11800, x: 19, y: 64, lootMult: 1.5 },
  { id: 't12', name: 'Nó de Radar',          faction: 'NOVA ORDEM',       level: 3, def: 7200,  x: 14, y: 49, lootMult: 1.3 },
  { id: 't13', name: 'Ruínas de Ur',         faction: 'FILHOS DO SOL',    level: 2, def: 3800,  x: 19, y: 36, lootMult: 1.2 },
  { id: 't14', name: 'Passo do Corvo',       faction: 'FILHOS DO SOL',    level: 3, def: 5600,  x: 36, y: 33, lootMult: 1.2 },
  { id: 't15', name: 'Base Aérea 13',        faction: 'NOVA ORDEM',       level: 4, def: 9600,  x: 61, y: 33, lootMult: 1.5 },
  { id: 't16', name: 'Fábrica de Armas',     faction: 'CARTEL DE FERRO',  level: 3, def: 7400,  x: 68, y: 45, lootMult: 1.4 },
  { id: 't17', name: 'Depósito de Aço',      faction: 'LEGIÃO RUBRA',     level: 2, def: 3000,  x: 43, y: 58, lootMult: 1.1 },
  { id: 't18', name: 'Fortaleza Ômega',      faction: 'FORÇA ÔMEGA',      level: 8, def: 32000, x: 53, y: 48, lootMult: 2.4, player: true }
];

export const TARGET_BY_ID = Object.fromEntries(TARGETS.map(t => [t.id, t]));

export const MISSIONS = [
  { id: 'm1', name: 'Reforçar a Base', desc: 'Evolua qualquer edifício para o nível 4.', reward: { gems: 60, steel: 4000, credits: 3000 }, xp: 120 },
  { id: 'm2', name: 'Mobilização Geral', desc: 'Treine 50 unidades no quartel.', reward: { gems: 50, food: 5000, oil: 3000 }, xp: 100 },
  { id: 'm3', name: 'Primeira Conquista', desc: 'Conquiste 1 setor no mapa mundial.', reward: { gems: 80, oil: 6000, steel: 6000 }, xp: 180 },
  { id: 'm4', name: 'Olho no Céu', desc: 'Construa uma Estação Radar.', reward: { gems: 70, credits: 4000, oil: 4000 }, xp: 140 },
  { id: 'm5', name: 'Cientistas de Guerra', desc: 'Conclua 2 pesquisas no laboratório.', reward: { gems: 90, steel: 7000, credits: 5000 }, xp: 160 },
  { id: 'm6', name: 'Coração de Aço', desc: 'Evolua o Quartel-General para o nível 5.', reward: { gems: 120, oil: 9000, steel: 9000 }, xp: 240 },
  { id: 'm7', name: 'Domínio Regional', desc: 'Conquiste 5 setores.', reward: { gems: 150, food: 10000, credits: 8000 }, xp: 300 },
  { id: 'm8', name: 'Marechal do Caos', desc: 'Alcance o nível 8 de comandante.', reward: { gems: 200, oil: 12000, steel: 12000 }, xp: 0 }
];

export const RANKING = [
  { name: 'General Kray', tag: 'RUBRA', power: 28600, level: 14 },
  { name: 'Comandante Vega', tag: 'ÔMEGA', power: 24300, level: 13 },
  { name: 'Loba de Aço', tag: 'FERRO', power: 21100, level: 12 },
  { name: 'Marechal Vex', tag: 'SOMBRA', power: 18700, level: 11 },
  { name: 'Rainha Rubra', tag: 'RUBRA', power: 16900, level: 11 },
  { name: 'Sentinela-7', tag: 'ÔMEGA', power: 15200, level: 10 },
  { name: 'Duque de Ferro', tag: 'FERRO', power: 13100, level: 9 },
  { name: 'Spectre', tag: 'SOMBRA', power: 11400, level: 9 },
  { name: 'Hidra', tag: 'RUBRA', power: 9800, level: 8 },
  { name: 'Barão do Caos', tag: 'FERRO', power: 8200, level: 7 },
  { name: 'Águia de Fogo', tag: 'ÔMEGA', power: 7000, level: 7 },
  { name: 'Vulture', tag: 'SOMBRA', power: 6100, level: 6 },
  { name: 'César Negro', tag: 'RUBRA', power: 5200, level: 6 },
  { name: 'Titã do Sul', tag: 'FERRO', power: 4300, level: 5 },
  { name: 'Omega-9', tag: 'ÔMEGA', power: 3600, level: 5 }
];

export const ALLIANCE_MEMBERS = [
  { name: 'General Kray', role: 'LÍDER', power: 28600 },
  { name: 'Comandante Vega', role: 'OFICIAL', power: 24300 },
  { name: 'Sentinela-7', role: 'OFICIAL', power: 15200 },
  { name: 'Águia de Fogo', role: 'MEMBRO', power: 7000 },
  { name: 'Vulture', role: 'MEMBRO', power: 6100 },
  { name: 'Titã do Sul', role: 'MEMBRO', power: 4300 },
  { name: 'Omega-9', role: 'MEMBRO', power: 3600 },
  { name: 'Falcão de Aço', role: 'MEMBRO', power: 3200 },
  { name: 'Nyx', role: 'MEMBRO', power: 2900 }
];

export const CHAT_LINES = [
  ['General Kray', 'Convoy de aço chegando ao setor 07. Reforcem as defesas.'],
  ['Sentinela-7', 'Radar detectou movimento na fronteira norte.'],
  ['Águia de Fogo', 'Preciso de 2k de aço para concluir a Base Aérea.'],
  ['Comandante Vega', 'Aliança Ômega abriu vagas. Recrutando comandantes nível 5+.'],
  ['Vulture', 'Alvo nível 3 no porto. Espólio limpo, quem vai?'],
  ['Loba de Aço', 'A Legião Rubra está concentrando forças no leste.'],
  ['Titã do Sul', 'Minha muralha aguentou três cercos seguidos. Aço é tudo.'],
  ['Nyx', 'Nova tecnologia de munição disponível no laboratório.'],
  ['Omega-9', 'Bom caça, comandante. O planeta não vai se dominar sozinho.'],
  ['Rainha Rubra', 'A guerra não espera. Treine tropas antes de dormir.'],
  ['Hidra', 'Setor 12 conquistado. Tributo de guerra ativado.'],
  ['Falcão de Aço', 'Quem tiver petróleo sobrando, chama no mercado.'],
  ['General Kray', 'Lembrete: evolua o Quartel-General para desbloquear novos níveis.'],
  ['Sentinela-7', 'Relatório: forças hostis recuando na planície vermelha.']
];

export const FACTION_COLORS = {
  'LEGIÃO RUBRA': '#e3594c',
  'CARTEL DE FERRO': '#f0a33a',
  'NOVA ORDEM': '#a98bff',
  'FILHOS DO SOL': '#e8c15a',
  'FORÇA ÔMEGA': '#45d3c6'
};

export function targetDefense(level, base = 900) {
  return Math.round(base * Math.pow(1.34, level - 1));
}

/* ---------- helpers ---------- */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const round = (n, step = 1) => Math.round(n / step) * step;

export function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace('.', ',') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace('.', ',') + 'K';
  return Math.round(n).toLocaleString('pt-BR');
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

export function fmtTimeShort(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function upgradeCost(def, currentLevel) {
  const mult = currentLevel === 0 ? 0.6 : Math.pow(1.72, currentLevel - 1);
  const out = {};
  for (const [k, v] of Object.entries(def.cost)) out[k] = round(v * mult, 10);
  return out;
}

export function upgradeTime(def, currentLevel) {
  const mult = currentLevel === 0 ? 0.55 : Math.pow(1.5, currentLevel - 1);
  return Math.min(600, Math.max(6, Math.round(def.time * mult)));
}

export function buildingProduction(def, level) {
  if (!def.prod || level <= 0) return null;
  const scale = level * (1 + 0.12 * (level - 1));
  return Object.fromEntries(Object.entries(def.prod).map(([k, v]) => [k, Math.round(v * scale)]));
}

export function targetLoot(target, level = target.level) {
  const mult = target.lootMult || 1;
  return {
    oil: Math.round(900 * level * mult),
    steel: Math.round(800 * level * mult),
    food: Math.round(700 * level * mult),
    credits: Math.round(520 * level * mult)
  };
}

export function targetTravel(target) {
  const dx = (target.x - 53) / 100;
  const dy = (target.y - 48) / 100;
  return Math.round((6 + Math.sqrt(dx * dx + dy * dy) * 34) * 10) / 10;
}

export function heroPortrait(heroKey, size = 220) {
  const h = HERO_BY_KEY[heroKey] || HERO_DEFS[0];
  const c = h.color;
  const c2 = h.accent;
  const common = `
    <defs>
      <linearGradient id="hpbg-${heroKey}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c}" stop-opacity=".25"/><stop offset=".6" stop-color="#0b121b" stop-opacity=".2"/><stop offset="1" stop-color="#05080d"/>
      </linearGradient>
      <linearGradient id="hpm-${heroKey}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c2}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="#5a3410"/>
      </linearGradient>
      <linearGradient id="hpv-${heroKey}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c2}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity=".15"/>
      </linearGradient>
      <radialGradient id="hpg-${heroKey}" cx=".5" cy=".42" r=".5">
        <stop offset="0" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#hpbg-${heroKey})"/>
    <circle cx="${size * .5}" cy="${size * .37}" r="${size * .34}" fill="url(#hpg-${heroKey})"/>
    <g opacity=".2" stroke="${c}" fill="none" stroke-width="1">
      <circle cx="${size * .5}" cy="${size * .4}" r="${size * .39}"/>
      <circle cx="${size * .5}" cy="${size * .4}" r="${size * .47}" stroke-dasharray="3 9"/>
      <path d="M0 ${size * .28}h${size}M0 ${size * .62}h${size}M${size * .2} 0v${size}M${size * .8} 0v${size}"/>
    </g>`;
  const bodies = {
    valkyrie: `
      <path d="M${size*.13} ${size*.98} L${size*.2} ${size*.67} Q${size*.5} ${size*.55} ${size*.8} ${size*.67} L${size*.87} ${size*.98}Z" fill="#131c26" stroke="${c}" stroke-opacity=".4"/>
      <path d="M${size*.26} ${size*.98} L${size*.3} ${size*.7} L${size*.38} ${size*.74} L${size*.35} ${size*.98}Z" fill="url(#hpm-${heroKey})" opacity=".8"/>
      <path d="M${size*.74} ${size*.98} L${size*.7} ${size*.7} L${size*.62} ${size*.74} L${size*.65} ${size*.98}Z" fill="url(#hpm-${heroKey})" opacity=".8"/>
      <path d="M${size*.34} ${size*.66} Q${size*.5} ${size*.57} ${size*.66} ${size*.66} L${size*.63} ${size*.74} Q${size*.5} ${size*.68} ${size*.37} ${size*.74}Z" fill="#1b2735" stroke="${c}" stroke-opacity=".5"/>
      <path d="M${size*.35} ${size*.5} Q${size*.34} ${size*.31} ${size*.5} ${size*.24} Q${size*.66} ${size*.31} ${size*.65} ${size*.5} L${size*.62} ${size*.63} Q${size*.5} ${size*.69} ${size*.38} ${size*.63}Z" fill="#22303f" stroke="${c}" stroke-opacity=".55"/>
      <path d="M${size*.37} ${size*.45} Q${size*.5} ${size*.4} ${size*.63} ${size*.45} L${size*.62} ${size*.5} Q${size*.5} ${size*.46} ${size*.38} ${size*.5}Z" fill="url(#hpv-${heroKey})"/>
      <path d="M${size*.43} ${size*.54}h${size*.14}" stroke="${c}" stroke-width="2" opacity=".8"/>
      <path d="M${size*.5} ${size*.24} L${size*.52} ${size*.14} L${size*.56} ${size*.24}" fill="${c}" opacity=".8"/>
      <path d="M${size*.31} ${size*.48} Q${size*.27} ${size*.4} ${size*.32} ${size*.34} M${size*.69} ${size*.48} Q${size*.73} ${size*.4} ${size*.68} ${size*.34}" stroke="${c2}" stroke-width="1" fill="none" opacity=".5"/>`,
    titan: `
      <path d="M${size*.08} ${size*.98} L${size*.16} ${size*.63} Q${size*.5} ${size*.48} ${size*.84} ${size*.63} L${size*.92} ${size*.98}Z" fill="#15191f" stroke="${c}" stroke-opacity=".4"/>
      <path d="M${size*.2} ${size*.98} L${size*.25} ${size*.66} L${size*.37} ${size*.73} L${size*.32} ${size*.98}Z" fill="url(#hpm-${heroKey})" opacity=".8"/>
      <path d="M${size*.8} ${size*.98} L${size*.75} ${size*.66} L${size*.63} ${size*.73} L${size*.68} ${size*.98}Z" fill="url(#hpm-${heroKey})" opacity=".8"/>
      <path d="M${size*.3} ${size*.59} Q${size*.5} ${size*.48} ${size*.7} ${size*.59} L${size*.66} ${size*.71} Q${size*.5} ${size*.61} ${size*.34} ${size*.71}Z" fill="#20262e" stroke="${c}" stroke-opacity=".45"/>
      <path d="M${size*.33} ${size*.47} Q${size*.32} ${size*.27} ${size*.5} ${size*.21} Q${size*.68} ${size*.27} ${size*.67} ${size*.47} L${size*.64} ${size*.62} Q${size*.5} ${size*.7} ${size*.36} ${size*.62}Z" fill="#2a3038" stroke="${c}" stroke-opacity=".55"/>
      <path d="M${size*.36} ${size*.42} L${size*.46} ${size*.38} L${size*.48} ${size*.45} L${size*.38} ${size*.48}Z" fill="url(#hpv-${heroKey})"/>
      <path d="M${size*.64} ${size*.42} L${size*.54} ${size*.38} L${size*.52} ${size*.45} L${size*.62} ${size*.48}Z" fill="url(#hpv-${heroKey})"/>
      <path d="M${size*.41} ${size*.54} h${size*.18}" stroke="#0a0d11" stroke-width="4"/>
      <path d="M${size*.41} ${size*.54} h${size*.18}" stroke="${c}" stroke-width="1" opacity=".6"/>
      <path d="M${size*.5} ${size*.21} v${size*.05}" stroke="${c2}" stroke-width="2"/>`,
    corvo: `
      <path d="M${size*.1} ${size*.98} L${size*.18} ${size*.62} Q${size*.5} ${size*.49} ${size*.82} ${size*.62} L${size*.9} ${size*.98}Z" fill="#101820" stroke="${c}" stroke-opacity=".45"/>
      <path d="M${size*.24} ${size*.98} L${size*.28} ${size*.67} L${size*.4} ${size*.74} L${size*.36} ${size*.98}Z" fill="url(#hpm-${heroKey})" opacity=".65"/>
      <path d="M${size*.76} ${size*.98} L${size*.72} ${size*.67} L${size*.6} ${size*.74} L${size*.64} ${size*.98}Z" fill="url(#hpm-${heroKey})" opacity=".65"/>
      <path d="M${size*.3} ${size*.56} Q${size*.5} ${size*.45} ${size*.7} ${size*.56} L${size*.65} ${size*.69} Q${size*.5} ${size*.58} ${size*.35} ${size*.69}Z" fill="#16212a" stroke="${c}" stroke-opacity=".45"/>
      <path d="M${size*.34} ${size*.46} Q${size*.33} ${size*.26} ${size*.5} ${size*.2} Q${size*.67} ${size*.26} ${size*.66} ${size*.46} L${size*.64} ${size*.6} Q${size*.5} ${size*.67} ${size*.36} ${size*.6}Z" fill="#1b2833" stroke="${c}" stroke-opacity=".5"/>
      <path d="M${size*.32} ${size*.34} Q${size*.5} ${size*.18} ${size*.68} ${size*.34} L${size*.63} ${size*.46} Q${size*.5} ${size*.51} ${size*.37} ${size*.46}Z" fill="#0d141b" stroke="${c}" stroke-opacity=".35"/>
      <path d="M${size*.39} ${size*.42} Q${size*.5} ${size*.38} ${size*.61} ${size*.42} L${size*.6} ${size*.46} Q${size*.5} ${size*.43} ${size*.4} ${size*.46}Z" fill="url(#hpv-${heroKey})"/>
      <path d="M${size*.42} ${size*.57} h${size*.16}" stroke="${c}" stroke-width="2" opacity=".7"/>
      <path d="M${size*.3} ${size*.6} L${size*.5} ${size*.74} L${size*.7} ${size*.6}" fill="none" stroke="${c}" stroke-opacity=".3"/>`
  };
  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${common}${bodies[heroKey] || bodies.valkyrie}</svg>`;
}
