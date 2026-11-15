'use strict';

const get = id => document.getElementById(id);
const ctx = get('field').getContext('2d');
const half = 18;
const controls = [
  ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyT'],
  ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyK', 'KeyL', 'Semicolon', 'Slash'],
];
const trickBindings = new Map();
const defaultTrick = new Map([[-2,'KeyY'],[-1,'Period']]);
let bindingSlot = null;
let bindingController = false;
const controllerTrickButtons = [4,5,6,7,8,10,11];
try {
  for (const [slot,key] of JSON.parse(localStorage.getItem('ringout-trick') || '[]')) trickBindings.set(slot,key);
} catch {}
const gameKeys = new Set([...controls.flat(), 'Escape', 'Enter','KeyY','Period']);
const keys = new Set();
const slots = [];
const joinMotion = new Set();
const keyboardSlots = new Map([['KeyW', -2], ['ArrowUp', -1]]);
const isLobby = () => state === 'menu' || state === 'match';
const minimumPlayers = (options = rules) => options.coop ? 1 : 2;
const previous = new Map();
let humanCount = 0;
let setup = true;
const looks = new Map();
const readyPlayers = new Set();
const lookFor = (i) => looks.get(slots[i]) || {color:i % palette.length, shape:0, accessory:0, emote:0};
const iceTime = 1.1;
const dodgeDuration = .20;
const parryDuration = .095;
const dodgeCooldown = 1.65;
const modeButtons = () => [...get('modeChoices').children];
const connectedPads = new Map();
const warningTime = 3;
const arenas = [
  {name:'Steel', color:'#222c39', grip:1, drag:4.6, speed:1, dash:1, effect:'Standard traction'},
  {name:'Ice', color:'#254d65', grip:.055, drag:2.1, speed:1.05, dash:1.08, effect:'Long slides and lingering knockback'},
  {name:'Rubber', color:'#48352e', grip:1, drag:10.5, speed:1, dash:.92, effect:'Heavy grip kills knockback fast'},
  {name:'Sand', color:'#665136', grip:.52, drag:5.8, speed:.58, dash:.68, effect:'Slower movement and dashes'},
  {name:'Boost', color:'#254e40', grip:1, drag:3.7, speed:1.30, dash:1.46, effect:'Faster movement and dashes'},
];

function terrainBlend() {
  if (arena === nextArena) return 0;
  const t = Math.max(0, Math.min(1, 1 - arenaTime / warningTime));
  return t * t * (3 - 2 * t);
}
let arena = 0;
let nextArena = 0;
let arenaTime = 0;
let windTime = 0;
let platformTime = 0;
const teamNames = ['Cyan', 'Coral'];
let teamScore = [0,0];
let objective;
const extraModes = {
  hill: {name:'King of the Hill', text:'Hold the zone alone'},
  crown: {name:'Crown Chase', text:'Take the crown with a push'},
  stocks: {name:'Last Stock', text:'Outlast everyone in a lives match'},
  crush: {name:'Closing Ring', text:'Fight inside a shrinking boundary'},
  fuse: {name:'Hot Potato', text:'Pass the fuse with a push'},
};
let obstacles = [];
let currentMap = maps[0];
const wallMaxIntegrity = 5;

function rollObstacles(random = Math.random, map = currentMap) {
  if (random() < .23) return [];
  const edges = map.edges.filter(edge => edge.length >= 75);
  const result = [];
  const edgeCount = Math.min(edges.length - 1, Math.floor(random() * (map.width > 1000 ? 6 : 4)));
  for (let i = 0; i < edgeCount; i++) {
    const edge = edges.splice(Math.floor(random() * edges.length), 1)[0];
    const full = random() < .30;
    const length = full ? edge.length : edge.length * (.22 + random() * .33);
    const offset = full ? 0 : random() * (edge.length - length);
    result.push({x:edge.x + (edge.across ? offset : -10), y:edge.y + (edge.across ? -10 : offset),
      w:edge.across ? length : 20, h:edge.across ? 20 : length});
  }
  const {center,width,height} = map;
  const centers = [[0,0], [-.16,-.18], [.16,-.18], [-.16,.18], [.16,.18],[-.32,0],[.32,0]]
    .map(([x,y]) => [center.x+x*width,center.y+y*height])
    .filter(([x,y]) => !map.hazardous(x,y) &&
      [-25,25].every(dx => [-25,25].every(dy=>map.floor(x+dx,y+dy))));
  const blockCount = Math.floor(random() * (map.width > 1000 ? 6 : 4));
  for (let i = 0; i < blockCount && centers.length; i++) {
    const [x,y] = centers.splice(Math.floor(random() * centers.length), 1)[0];
    const size = 32 + Math.floor(random() * 15);
    result.push({x:x - size / 2, y:y - size / 2, w:size, h:size});
  }
  const ferryRoutes = (map.ferries || []).map(([x,y,w,h,dx,dy]) =>
    [x+Math.min(0,dx),y+Math.min(0,dy),w+Math.abs(dx),h+Math.abs(dy)]);
  return result.filter(wall => !ferryRoutes.some(([x,y,w,h]) =>
    wall.x<x+w+18 && wall.x+wall.w>x-18 && wall.y<y+h+18 && wall.y+wall.h>y-18))
    .map(wall => {
      const roll = random();
      const integrity = roll < .09 ? Infinity
        : roll < .47 ? wallMaxIntegrity
        : roll < .80 ? 3.4 : 2;
      return {...wall, integrity};
    });
}

function damageWall(wall, damage, owner, generated = false) {
  if (!Number.isFinite(wall.integrity) || damage <= 0) return false;
  wall.integrity -= damage;
  const broken = wall.integrity <= 0;
  const point = {x:wall.x+wall.w/2,y:wall.y+wall.h/2};
  if (owner && !generated) fireCombo(owner,'wall',point);
  if (broken && !generated && owner?.stats.cornerStore) cardObject('bumper',null,point,4,{slow:.48});
  if (broken) obstacles.splice(obstacles.indexOf(wall), 1);
  flash('burst', wall.x + wall.w / 2, wall.y + wall.h / 2,
    broken ? '#ffe09b' : '#e1b96f', broken ? 38 : 16, .3);
  return broken;
}

function moveAxis(p, axis, amount, impact = 0) {
  if (!amount) return;
  const radius = p.radius || half;
  const across = axis === 'x' ? 'y' : 'x';
  const size = axis === 'x' ? 'w' : 'h';
  const acrossSize = axis === 'x' ? 'h' : 'w';
  let next = p[axis] + amount;
  const contacts = [];
  for (const wall of obstacles) {
    if (p[across] + radius <= wall[across] || p[across] - radius >= wall[across] + wall[acrossSize]) continue;
    const edge = amount > 0 ? wall[axis] - radius : wall[axis] + wall[size] + radius;
    if ((edge - p[axis]) * amount >= 0 && (next - edge) * amount > 0) contacts.push({wall, edge});
  }
  contacts.sort((a, b) => Math.sign(amount) * (a.edge - b.edge));
  for (const {wall, edge} of contacts) {
    next = edge;
    if (p.pinballActive && cardOnWall(p,axis)) break;
    if (damageWall(wall,impact,p,p.lastShove?.until>matchTime && p.lastShove.generated)) {
      next = p[axis]+amount;
      continue;
    }
    if (!kineticWall(p,axis) && !buildOnWall(p,axis) && !cardOnWall(p,axis)) {
      p['v' + axis] = 0;
      if (p.dash > 0 && Math.abs(p['d' + axis]) > .1) p.dash = 0;
    }
    break;
  }
  p[axis] = next;
}
let roundsMode = false;
let builds = [];
let draftQueue = [];
let sharedDraft = null;
let startingDraft = false;
let upcomingMap = null;
let upcomingWalls = null;
let roundPending = false;
let ghostImpactUntil = 0;
let draftDisconnectedAt = null;
let draftHandoffAt = null;
let choices = [];
let selected = 0;
const winsNeeded = () => rules.wins;

function statsFor(i) {
  const stats = {};
  for (const card of builds[i] || []) {
    for (const [name, value] of Object.entries(card[3])) stats[name] = (stats[name] || 0) + value;
  }
  return stats;
}
let score = [];
let endless = false;
let knockouts = 0;
let matchStats = [];
let matchTime = 0;
let wave = 1;
let waveBreak = null;
let waveEnemies = 0;
let transitionTime = 0;
const resultsDelay = 3000;
let peel;
let peelTimer;
const pickupTypes = [
  {label:'Sprint', color:'#c6f982', stat:'speed', value:1.35, seconds:5},
  {label:'Heavy Push', color:'#ffbc81', stat:'force', value:1.30, seconds:5},
  {label:'Quick Charge', color:'#95e6ff', stat:'charge', value:1.55, seconds:5},
  {label:'Brace', color:'#a8baff', stat:'guard', value:.70, seconds:5},
  {label:'Slowdown', color:'#f7a6cb', stat:'speed', value:.67, seconds:4},
  {label:'Featherweight', color:'#f4b4ac', stat:'guard', value:1.38, seconds:4},
];

function pickupFactor(player, stat) {
  const item = player.pickup;
  return item?.stat === stat && player.pickupUntil > matchTime ? item.value : 1;
}
const respawnDelay = 3;
let roundDelay = 0;
let menuFocus = 0;
let effects = [];
let echoes = [];
let comboProps = [];
const chargeMax = 1.10;
const fullChargeGrace = .40;
const superWindup = .42;
const pushCurve = charge => Math.expm1(3.5 * charge) / Math.expm1(3.5);
const pushCone = Math.PI / 4;

function pushPattern(p, radial) {
  if (radial) return {lanes:[0], arc:Math.PI, force:1};
  if (p.stats.trident) return {lanes:[-.64,0,.64], arc:.18, force:.92};
  if (p.stats.focusCone) return {lanes:[0], arc:.30, force:1.45};
  if (p.stats.sweepCone) return {lanes:[0], arc:1.32, force:.75};
  return {lanes:[0], arc:pushCone, force:1};
}

function inPushPattern(angle, aim, {lanes,arc}) {
  return lanes.some(offset => {
    const delta = angle - aim - offset;
    return Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta))) <= arc;
  });
}
let players;
const lastSpawn = new Map();
let state = 'menu';
let timer = 0;
let countdown = 0;
let last = 0;

function resetPlayers(randomize = false, walls = []) {
  const count = humanCount;
  const occupied = [];
  const {center,width,height} = currentMap;
  players = Array.from({ length: count }, (_, i) => {
    const angle = Math.PI + i / count * Math.PI * 2;
    const preferred = {x:center.x + width*.30*Math.cos(angle),y:center.y + height*.35*Math.sin(angle)};
    const slot = slots[i];
    const previousSpawn = lastSpawn.get(slot);
    const point = (randomize && randomRoundSpawn(currentMap,occupied,previousSpawn,walls))
      || safeSpawn(currentMap,occupied,preferred,walls) || currentMap.spawns[i % currentMap.spawns.length];
    const {x,y} = point;
    if (randomize) lastSpawn.set(slot,point);
    occupied.push(point);
    const facing = Math.atan2(center.y-y,center.x-x);
    return {
    color: palette[lookFor(i).color], look: lookFor(i),
    x, y, team: rules.teams ? i % 2 : endless ? 0 : null, stats: statsFor(i), saved: false,
    vx: 0, vy: 0, fx: Math.cos(facing), fy: Math.sin(facing),
    charge: 0, slide: 0, out: false, brain: 0,
    dx: 0, dy: 0, dash: 0, dashCooldown: 0, pushCooldown: 0, pulse: 0,
    };
  });
}

function show(next, eyebrow, title, subtitle, action) {
  state = next;
  transitionTime = performance.now() + (next === 'match' ? resultsDelay : next === 'draft' || next === 'round' ? 350 : 0);
  get('statTip').hidden = true;
  if (next === 'round') roundDelay = .65;
  menuFocus = 0;
  get('respawn').hidden = !endless || !['playing', 'paused'].includes(next);
  get('results').hidden = next !== 'match';
  get('resultsLobby').hidden = next !== 'match';
  get('resultsLobby').disabled = next === 'match';
  get('pauseMenu').hidden = next !== 'paused';
  get('overlay').classList.toggle('results-view', next === 'match');
  const choosingMode = !setup && next === 'menu';
  get('modeChoices').hidden = !choosingMode || editingMode !== null;
  get('modeSettings').hidden = !choosingMode || editingMode === null;
  get('modeBack').hidden = !choosingMode || editingMode === null;
  get('overlay').classList.toggle('mode-selection', choosingMode);
  get('overlay').classList.toggle('editing-mode', choosingMode && editingMode !== null);
  get('customize').hidden = !choosingMode || editingMode !== null;
  get('arenaNotice').hidden = next !== 'playing' || (nextArena === arena && arena === 0);
  get('lobby').hidden = next !== 'menu';
  updateStart();
  get('draft').hidden = next !== 'draft';
  get('draftSpotlight').hidden = next !== 'draft';
  get('kineticDraft').hidden = next !== 'kineticDraft';
  get('draftBuild').hidden = next !== 'draft';
  get('tryTrick').hidden = true;
  get('trickPreview').hidden = true;
  get('draftPick').hidden = true;
  get('draftPick').textContent = '';
  get('overlay').classList.remove('draft-locked');
  get('overlay').classList.toggle('drafting', next === 'draft');
  get('overlay').classList.toggle('counting-down', next === 'countdown');
  get('shortcut').textContent = '';
  document.body.classList.toggle('character-setup', setup && isLobby());
  get('overlay').hidden = next === 'playing';
  get('pause').hidden = next !== 'playing';
  get('eyebrow').textContent = eyebrow || '';
  get('title').textContent = title || '';
  get('title').dataset.beat = next === 'countdown' ? '3' : '';
  get('subtitle').textContent = subtitle || '';
  get('subtitle').hidden = !subtitle;
  get('eyebrow').hidden = !eyebrow;
  get('action').textContent = action || '';
  get('action').hidden = !action || setup || (choosingMode && editingMode === null);
  get('shortcut').hidden = !action || setup;
  if (next === 'round') get('shortcut').textContent = 'Get ready…';
  else if (next === 'match') updateResultsLock();
  else if (isLobby()) get('shortcut').textContent = editingMode ? 'A / × Select · B / ○ Back' : 'A / × Select';
  else if (next === 'paused') get('shortcut').textContent = 'Stick / D-pad to browse · A / × to select · Start to resume';
}

function scoreboard() {
  get('round').textContent = rules.story ? 'CHAPTER '+rules.chapter+' · '+wave+'/3' : endless ? 'WAVE ' + wave : 'ROUND ' + ((rules.teams ? teamScore : score).reduce((sum, value) => sum + value, 0) + 1);
  get('format').textContent = rules.teams ? teamNames[0] + ' ' + teamScore[0] + ' · ' + teamNames[1] + ' ' + teamScore[1] : endless ? knockouts + ' KOs · ' + waveEnemies + ' left' : (roundsMode ? 'ROUNDS · ' : '') + 'FIRST TO ' + winsNeeded();
  const metric = objective && ['hill','crown','stocks'].includes(rules.objective);
  if (objective) {
    get('round').textContent = extraModes[rules.objective].name;
    get('format').textContent = metric
      ? rules.objective === 'stocks' ? 'LIVES LEFT' : 'FIRST TO ' + rules.goal + 'S'
      : 'FIRST TO ' + winsNeeded();
  }
  const strip = get('scores');
  const scroll = strip.scrollLeft;
  strip.classList.toggle('compact', humanCount >= 5);
  strip.replaceChildren(...Array.from({length:humanCount}, (_, i) => {
    const entry = document.createElement('span');
    entry.className = 'score-entry';
    entry.style.setProperty('--player-color', palette[lookFor(i).color]);
    entry.dataset.player = i;
    if (!endless) entry.tabIndex = 0;
    const wins = rules.teams ? teamScore[i % 2] : score[i] || 0;
    const value = metric ? rules.objective === 'stocks' ? objective.lives[i] + ' lives' : Math.floor(wins) + 's' : wins + '/' + winsNeeded();
    if (humanCount >= 5) {
      entry.textContent = 'P' + (i + 1) + (endless ? '' : '  ' + value);
    } else {
      const badge = document.createElement('canvas');
      badge.width = badge.height = 64;
      badge.className = 'score-avatar';
      badge.setAttribute('aria-hidden', 'true');
      drawCharacter(badge.getContext('2d'), lookFor(i), 0, 0, 64);
      const name = document.createElement('strong');
      name.textContent = 'Player ' + (i + 1);
      const detail = document.createElement('small');
      detail.textContent = rules.teams ? 'Team ' + teamNames[i % 2] : deviceLabel(slots[i]);
      const identity = document.createElement('span');
      identity.className = 'score-identity';
      identity.append(name, detail);
      entry.append(badge, identity);
      if (metric) {
        const number = document.createElement('strong');
        number.className = 'objective-score';
        number.textContent = value;
        entry.append(number);
      } else if (!endless) {
        const progress = document.createElement('span');
        progress.className = 'score-progress';
        progress.setAttribute('aria-label', wins + ' of ' + winsNeeded() + ' wins');
        for (let point = 0; point < winsNeeded(); point++) {
          const pip = document.createElement('i');
          if (point < wins) pip.className = 'filled';
          progress.append(pip);
        }
        entry.append(progress);
      }
    }
    return entry;
  }));
  strip.scrollLeft = scroll;
}

function prepareArena() {
  upcomingMap = rules.story ? storyMap() : chooseMap(currentMap,humanCount+(endless ? Math.max(2,humanCount) : 0));
  upcomingWalls = rules.walls ? rollObstacles(Math.random,upcomingMap) : [];
  if (rules.kinetic) kineticArena();
  if (rules.divergence) {
    upcomingMap = buildArenas[buildFight % buildArenas.length];
    upcomingWalls = buildArenaWalls(upcomingMap,humanCount);
  }
}
function draftSettings() {
  return {...rules,walls:rules.walls && Boolean((upcomingWalls || obstacles).length)};
}
function begin() {
  kineticReset();
  buildEnd();
  buildStartedAt = matchTime;
  arena = nextArena = 0;
  windTime = 0;
  platformTime = 0;
  arenaTime = 5 + Math.random() * 3;
  get('arenaNotice').hidden = true;
  scoreboard();
  if (!upcomingMap) prepareArena();
  currentMap = upcomingMap;
  obstacles = upcomingWalls;
  upcomingMap = upcomingWalls = null;
  resetPlayers(true,obstacles);
  if (rules.divergence && builds.some(picks=>picks.some(card=>card[3].weld))) addNeutralBuildProp();
  if (endless) startWave();
  resetObjective();
  scoreboard();
  peel = null;
  peelTimer = 3 + Math.random() * 3;
  get('respawn').textContent = '';
  effects = [];
  echoes = [];
  comboProps = [];
  resetCardWorld();
  roundPending = false;
  ghostImpactUntil = 0;
  timer = rules.kinetic ? 1.18 : 2.35;
  countdown = 0;
  showEncounterCountdown();
}

function primary() {
  if (state === 'match' && performance.now() < transitionTime) return;
  if (state === 'menu' || state === 'match') {
    if (setup) return;
    const options = state === 'menu' ? modeSettings[editingMode] : rules;
    if (!options || !canStart(options)) return;
    if (state === 'match') {
      const connected = slots.filter(slot => slot < 0 || connectedPads.has(slot));
      slots.splice(0,slots.length,...connected);
    }
    rules = {...options};
    endless = rules.coop;
    roundsMode = rules.cards && !endless;
    humanCount = slots.length;
    score = Array(humanCount).fill(0);
    teamScore = [0,0];
    knockouts = 0;
    matchTime = 0;
    if (rules.kinetic) kineticStageOffset=Math.floor(Math.random()*kineticStages.length);
    buildFight = 0;
    buildStarterPool = [];
    matchStats = Array.from({length:humanCount}, () => ({pushes:0, attempts:0, landed:0, dashes:0, falls:0, emotes:0}));
    wave = 1;
    waveBreak = null;
    builds = Array.from({length:humanCount}, () => []);
    upcomingMap = upcomingWalls = null;
    startingDraft = Boolean(rules.roundsPreset);
    if (startingDraft || rules.preDraft) prepareArena();
    sharedDraft = rules.preDraft ? {pass:0, pool:[]} : null;
    if (sharedDraft) startDraftPass();
    else if (startingDraft) {
      draftQueue = Array.from({length:humanCount},(_,i)=>i);
      nextDraft();
    } else begin();
  } else if (state === 'round' && roundDelay <= 0 && performance.now() >= transitionTime) {
    if (endless) advanceWave();
    else begin();
  } else if (state === 'paused') {
    show('playing');
  }
}

function togglePause() {
  if (state === 'playing') show('paused', 'MATCH PAUSED', 'PAUSED', '', 'Resume');
  else if (state === 'paused') primary();
}

const baseRules = {wins:2, coop:false, teams:false, friendlyPush:true, cards:false, walls:true, terrain:true, hazards:true,
  bananas:true, superDash:true, dodge:true, difficulty:1, draftEvery:2};
const modeSettings = {
  versus:{...baseRules},
  rounds:{...baseRules,wins:5,cards:true,kinetic:true,terrain:false,bananas:false,hazards:false,superDash:false},
  tricks:{...baseRules,wins:3,cards:true,roundsPreset:true,divergence:true,mirrorTricks:false,minFights:4},
  classic:{...baseRules,wins:2,cards:true,radicalCards:true,roundsPreset:true},
  builds:{...baseRules,wins:2,cards:true,roundsPreset:true,divergence:true,mirrorTricks:false,minFights:3},
  story:{...baseRules,coop:true,story:true,chapter:1,cards:true,draftEvery:1,walls:false,friendlyPush:false},
  coop:{...baseRules,coop:true,cards:true,walls:false},
  team:{...baseRules,teams:true,friendlyPush:false},
  custom:{...baseRules},
  draft:{...baseRules,wins:3,preDraft:true,cardsPerPlayer:4},
  hill:{...baseRules,objective:'hill',walls:false,goal:20},
  crown:{...baseRules,objective:'crown',goal:24},
  stocks:{...baseRules,objective:'stocks',stocks:3},
  crush:{...baseRules,objective:'crush',walls:false,shrink:24},
  fuse:{...baseRules,objective:'fuse',fuse:9},
};
let rules = {...baseRules};
let editingMode = null;
const modeNames = {versus:'Versus',rounds:'Rounds',tricks:'Trick Draft',builds:'Rounds · Quick',classic:'Classic Rounds',team:'Team Battle',draft:'Draft Battle',coop:'Endless co-op',story:'Co-op Story',custom:'Custom',...Object.fromEntries(Object.entries(extraModes).map(([key,value])=>[key,value.name]))};
const settingChoices = {
  radicalCards:['Radical cards',[false,true]],
  mirrorTricks:['Duplicate Tricks',[false,true]],
  chapter:['Chapter',[1,2,3],['1 · The Foundry Signal','2 · Crosswind Courier','3 · The Drowned Archive']],
  goal:['Seconds to win',[12,20,24,30,45]],
  stocks:['Lives',[2,3,4,5]],
  shrink:['Time to close',[16,24,36,48],['16s','24s','36s','48s']],
  fuse:['Fuse length',[6,9,12,16],['6s','9s','12s','16s']],
  coop:['Team play',[false,true],['Free-for-all','Co-op']],
  cardsPerPlayer:['Cards per player',[1,2,3,4,5,6,7,8]],
  wins:['Wins to finish',[1,2,3,4,5,7]],
  cards:['Card drafts',[false,true]],
  difficulty:['CPU difficulty',[.8,1,1.25],['Relaxed','Standard','Intense']],
  draftEvery:['Draft every',[1,2,3,4],['1 wave','2 waves','3 waves','4 waves']],
  friendlyPush:['Friendly pushes',[false,true]],
  walls:['Walls',[false,true]], terrain:['Terrain changes',[false,true]],
  hazards:['Map hazards',[false,true]], bananas:['Arena pickups',[false,true]],
  superDash:['Super Dash',[false,true]], dodge:['Spot dodge',[false,true]],
};

function editMode(mode) {
  if (setup || state !== 'menu') return;
  editingMode = mode;
  show('menu', '', modeNames[mode], mode === 'story' ? storyChapters[modeSettings.story.chapter-1].intro : extraModes[mode]?.text || '', 'Start match');
  renderModeSettings();
  focusModeStart();
}

function focusModeStart() {
  const start = get('action');
  (start.disabled ? get('modeBack') : start).focus();
}

function leaveModeSettings() {
  if (state !== 'menu' || !editingMode) return;
  const previousMode = editingMode;
  setSetup(false);
  const button = modeButtons().find(item => item.dataset.mode === previousMode);
  if (!button?.disabled) button?.focus();
}

get('modeBack').addEventListener('click',leaveModeSettings);

function renderModeSettings() {
  const panel = get('modeSettings');
  const options = modeSettings[editingMode];
  const fields = editingMode === 'custom'
    ? ['coop', ...(options.coop ? ['difficulty','draftEvery','friendlyPush'] : ['wins']), 'cards','walls','terrain','hazards','bananas','superDash','dodge']
    : options.objective ? ({hill:['goal'],crown:['goal','walls'],stocks:['stocks','walls'],crush:['shrink','wins'],fuse:['fuse','wins']})[options.objective]
    : options.story ? ['chapter','difficulty'] : options.coop ? ['difficulty','draftEvery','friendlyPush'] : options.preDraft ? ['cardsPerPlayer','wins','walls'] : options.kinetic ? ['wins'] : options.divergence ? ['wins','mirrorTricks'] : options.roundsPreset ? ['wins','walls','radicalCards'] : ['wins','walls'];
  const groups = editingMode === 'custom'
    ? [['Match',fields.filter(key => ['coop','wins','difficulty','draftEvery','friendlyPush','cards'].includes(key))],
       ['Arena', ['walls','terrain','hazards','bananas']],
       ['Abilities',['superDash','dodge']]]
    : [['Match settings',fields]];
  panel.replaceChildren(...groups.map(([heading,keys]) => {
    const section = document.createElement('section');
    section.className = 'settings-group';
    const title = document.createElement('h2');
    title.textContent = heading;
    section.append(title);
    for (const key of keys) {
      const [label,values,names] = settingChoices[key];
      const row = document.createElement('fieldset');
      row.className = 'settings-row';
      const legend = document.createElement('legend');
      legend.textContent = label;
      row.append(legend);
      const optionsRow = document.createElement('div');
      optionsRow.className = 'settings-options';
      const pair = values.length === 2 && typeof values[0] === 'boolean';
      const buttons = values.map((value,index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.setting = key;
        if (key === 'chapter' && value > storyProgress()+1) {
          button.disabled = true;
          button.title = 'Clear Chapter ' + (value-1) + ' to unlock';
        }
        button.dataset.option = index;
        button.textContent = (names?.[index] ?? (pair ? value ? 'On' : 'Off' : value)) +
          (key === 'chapter' && button.disabled ? ' · Locked' : '');
        button.setAttribute('aria-pressed',value === options[key]);
        button.addEventListener('click',() => {
          if (button.disabled || options[key] === value) return;
          options[key] = value;
          if (key === 'chapter') get('subtitle').textContent = storyChapters[value-1].intro;
          if (key === 'coop') {
            renderModeSettings();
            get('modeSettings').querySelector(`[data-setting="coop"][data-option="${index}"]`)?.focus();
          } else {
            for (const [i,choice] of buttons.entries()) choice.setAttribute('aria-pressed', i === index);
          }
        });
        return button;
      });
      optionsRow.append(...buttons);
      row.append(optionsRow);
      section.append(row);
    }
    return section;
  }));
  updateStart();
}

for (const button of modeButtons()) button.addEventListener('click', () => editMode(button.dataset.mode));

function startDraftPass() {
  sharedDraft.pass++;
  if (sharedDraft.pass > rules.cardsPerPlayer) {
    sharedDraft = null;
    begin();
    return;
  }
  const order = Array.from({length:humanCount},(_,i)=>i);
  if (sharedDraft.pass % 2 === 0) order.reverse();
  draftQueue = order;
  sharedDraft.pool = makeSharedPool(humanCount + 2, builds.flat(), Math.random, draftSettings(), upcomingMap);
  nextDraft();
}

function nextDraft() {
  draftHandoffAt = null;
  if (!draftQueue.length) {
    if (sharedDraft) { startDraftPass(); return; }
    if (startingDraft) { startingDraft = false; begin(); return; }
    show('round', 'UPGRADES LOCKED IN', endless ? 'NEXT WAVE' : 'NEXT ROUND', '', 'Continue');
    return;
  }
  const player = draftQueue[0];
  const settings = draftSettings();
  const map = upcomingMap || currentMap;
  buildPractice=null;
  const owned = builds[player];
  choices = rules.divergence ? buildChoices(owned) : sharedDraft ? sharedDraft.pool.filter(card=>canDraftCard(card,owned)) :
    dealCards(owned,endless,Math.random,settings,map,startingDraft);
  if (sharedDraft && !choices.length) choices = dealCards(owned,false,Math.random,settings,map);
  if (!choices.length) {
    draftQueue.shift();
    nextDraft();
    return;
  }
  get('draft').classList.toggle('shared-pool', Boolean(sharedDraft));
  selected = 0;
  draftDisconnectedAt = null;
  show('draft', (sharedDraft ? 'PASS ' + sharedDraft.pass + ' / ' + rules.cardsPerPlayer + ' · ' : rules.divergence ? buildPhaseNames[owned.length]+' · ' : startingDraft ? 'STARTER · ' : endless ? 'WAVE ' + wave + ' CLEARED · ' : '') + 'PLAYER ' + (player + 1) + ' PICKS', 'CHOOSE A CARD',
    (slots[player] >= 0 ? 'Use your stick or D-pad · A / × to pick'
      : slots[player] === -2 ? 'Click a card, or browse with A / D and pick with F' : 'Click a card, or browse with ← / → and pick with K') + (!sharedDraft && builds[player].length >= 8 ? ' · Replaces your oldest card' : ''));
  const build = get('draftBuild');
  build.hidden = false;
  const trial = get('tryTrick');
  trial.hidden = !(rules.divergence && startingDraft);
  trial.textContent = slots[player]>=0 ? 'Try Trick · RB / R1' :
    'Try Trick · '+(trickBindings.get(slots[player]) || defaultTrick.get(slots[player]) || '').replace('Key','').replace('Period','.');

  build.textContent = owned.length ? 'Your build · '+owned.map(card=>card[0]).join(' · ') : 'Choose your first card';
  const spotlight = get('draftSpotlight');
  const look = lookFor(player);
  spotlight.style.setProperty('--fighter-color',palette[look.color]);
  const entrance = document.createElement('div');
  entrance.className = 'draft-fighter';
  const body = document.createElement('i');
  body.className = 'draft-body';
  const accessory = document.createElement('i');
  accessory.className = 'draft-accessory';
  placeSprite(body,look.shape,look.color);
  placeSprite(accessory,look.accessory,10);
  entrance.append(body,accessory);
  spotlight.replaceChildren(entrance);
  const slot = slots[player];
  get('draft').replaceChildren(...choices.map(([name, rarity, description, stats],i) => {
    const button = document.createElement(slot < 0 ? 'button' : 'article');
    if (slot < 0) {
      button.type = 'button';
      button.addEventListener('focus', () => highlightCard(i));
      button.addEventListener('click', () => pickCard(i,slot));
    }
    button.className = 'card ' + rarity.toLowerCase();
    button.style.setProperty('--deal-delay',Math.min(i,5)*38+'ms');
    const tier = document.createElement('small');
    tier.textContent = rarity + (isRadicalCard(choices[i]) ? ' · Radical' : '');
    const title = document.createElement('strong');
    title.textContent = name;
    const detail = document.createElement('span');
    const effects = Object.entries(stats).filter(([, value]) => value !== 1);
    let effectIndex = 0;
    for (const part of description.split(/([+−]\d+%)/)) {
      if (!/^[+−]/.test(part)) {
        detail.append(part);
        continue;
      }
      const value = document.createElement('b');
      const benefit = (effects[effectIndex++]?.[1] || 0) > 0;
      value.className = benefit ? 'benefit' : 'drawback';
      value.textContent = part;
      detail.append(value);
    }
    button.append(tier, title, makeCardPreview(stats), detail);
    const synergy = rules.divergence ? buildHint(choices[i],owned) : synergyNote(choices[i],owned);
    if (synergy) {
      const note = document.createElement('span');
      note.className = 'card-synergy';
      note.textContent = rules.divergence ? owned[0][0]+' · '+synergy : 'Combos with '+synergy;
      button.append(note);
    }
    return button;
  }));
  get('draft').focus({preventScroll:true});
  highlightCard(0);
}

function highlightCard(i) {
  if (draftHandoffAt !== null) return;
  selected = (i + choices.length) % choices.length;
  const buttons = [...get('draft').children];
  buttons.forEach((button, index) => button.classList.toggle('selected', index === selected));
  buttons[selected]?.scrollIntoView({block:'nearest', inline:'nearest'});
}

function pickCard(i, slot) {
  if (state !== 'draft' || draftHandoffAt !== null || slot === undefined || slots[draftQueue[0]] !== slot || performance.now() < transitionTime) return;
  if (!choices[i]) return;
  const build = builds[draftQueue.shift()];
  if (!sharedDraft && build.length >= 8) build.shift();
  const card = choices[i];
  if (sharedDraft) {
    const index = sharedDraft.pool.indexOf(card);
    if (index >= 0) sharedDraft.pool.splice(index,1);
  }
  if (rules.divergence && !build.length) buildStarterPool.push(card);
  build.push(card);
  get('draft').children[i].classList.add('locked-pick');
  get('overlay').classList.add('draft-locked');
  get('draftPick').hidden = false;
  get('draftPick').textContent = card[0] + ' locked in';
  draftHandoffAt = performance.now() + (reduceCountdownMotion?.matches ? 240 : 520);
  for (const card of get('draft').children) if (card.tagName === 'BUTTON') card.disabled = true;
}

function updateStart() {
  const options = state === 'menu' && editingMode ? modeSettings[editingMode] : rules;
  const required = setup ? 1 : minimumPlayers(options);
  get('action').disabled = isLobby() && slots.length < required;
  for (const button of modeButtons()) button.disabled = slots.length < (['coop','story','custom'].includes(button.dataset.mode) ? 1 : 2);
  get('joinCount').textContent = setup
    ? slots.filter(slot => readyPlayers.has(slot)).length + ' / ' + slots.length + ' ready'
    : slots.length + ' joined'
    + (slots.length < required ? ' · ' + required + ' needed' : '');
}

function setSetup(active) {
  objective = storyTask = null;
  setup = active;
  editingMode = null;
  if (!active) { endless = roundsMode = false; rules = {...baseRules}; }
  if (active) readyPlayers.clear();
  obstacles = [];
  show('menu', '', active ? 'Player setup' : 'Choose mode',
    active ? 'Press any controller button or move the stick to join. Keyboard: W or ↑.' : '',
    active ? '' : 'Start match');
  updateLobby();
}

const customFields = [
  {key:'color', label:'Color', choices:['Sky','Peach','Lime','Rose','Mint','Lilac','Coral','Pearl','Teal','Gold']},
  {key:'shape', label:'Shape', choices:shapes},
  {key:'accessory', label:'Accessory', choices:accessories},
  {key:'emote', label:'Emote', choices:emotes.map(emote=>emote[0])},
];
const customCursors = new Map();

function selectLook(slot, field, value) {
  const i = slots.indexOf(slot);
  if (i < 0 || !setup || !isLobby() || readyPlayers.has(slot)) return;
  const look = {...lookFor(i), [field]:value};
  looks.set(slot, look);
  saveLook(slot, look);
  renderLookMenu(slot);
}

function placeSprite(element, x, y) {
  element.style.backgroundPosition = `${x / (spriteColumns - 1) * 100}% ${y / (spriteRows - 1) * 100}%`;
}

function renderLookMenu(slot, reveal = false) {
  const i = slots.indexOf(slot);
  const row = get('roster').children[i];
  if (!row || !setup) return;
  const look = lookFor(i);
  const cursor = customCursors.get(slot);
  const field = customFields[cursor.tab];
  const locked = readyPlayers.has(slot);
  placeSprite(row.querySelector('.setup-avatar'), look.shape, look.color);
  placeSprite(row.querySelector('.setup-accessory'), look.accessory, 10);
  row.querySelector('.setup-preview').classList.toggle('emote-previewing', field.key === 'emote');
  for (const [index, tab] of [...row.querySelectorAll('.look-tab')].entries()) {
    tab.setAttribute('aria-pressed', index === cursor.tab);
    tab.classList.toggle('browsing', !locked && cursor.tabCursor === index);
    tab.disabled = locked;
  }
  const grid = row.querySelector('.look-grid');
  grid.setAttribute('aria-label', field.label + ' choices');
  const tiles = field.choices.map((label, index) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'look-tile';
    tile.setAttribute('aria-pressed', look[field.key] === index);
    tile.setAttribute('aria-label', label);
    tile.disabled = locked;
    tile.classList.toggle('browsing', slot >= 0 && cursor.tabCursor === undefined && cursor.option === index && !locked);
    const icon = document.createElement('span');
    icon.className = field.key === 'color' ? 'look-swatch' : 'look-icon';
    if (field.key === 'color') icon.style.backgroundColor = palette[index];
    else if (field.key === 'emote') icon.textContent = emotes[index][1];
    else if (field.key === 'accessory' && !index) icon.textContent = '—';
    else {
      icon.classList.add('sprite-icon');
      placeSprite(icon, index, field.key === 'shape' ? look.color : 10);
    }
    const text = document.createElement('small');
    text.textContent = label;
    tile.append(icon,text);
    tile.addEventListener('click', () => {
      cursor.option = index;
      selectLook(slot, field.key, index);
      grid.children[index].focus();
    });
    return tile;
  });
  grid.replaceChildren(...tiles);
  if (reveal) {
    const focused = cursor.tabCursor === undefined ? tiles[cursor.option] : row.querySelectorAll('.look-tab')[cursor.tabCursor];
    focused?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
}

function openLookTab(slot, tab, reveal = false) {
  const field = customFields[tab];
  const look = lookFor(slots.indexOf(slot));
  customCursors.set(slot, {tab, option:look[field.key]});
  renderLookMenu(slot, reveal);
}

function browseLook(slot, input) {
  if (input.start) {
    toggleReady(slot);
    return;
  }
  if (readyPlayers.has(slot)) return;
  const cursor = customCursors.get(slot);
  if (!cursor) return;
  if (input.accessory) {
    openLookTab(slot, (cursor.tab + 1) % customFields.length, true);
    return;
  }
  const field = customFields[cursor.tab];
  const count = field.choices.length;
  const columns = 4;
  if (cursor.tabCursor !== undefined) {
    if (input.dash) {
      openLookTab(slot,cursor.tabCursor,true);
      return;
    }
    if (input.down) delete cursor.tabCursor;
    else if (input.left || input.right) {
      cursor.tabCursor = Math.max(0,Math.min(customFields.length-1,cursor.tabCursor + (input.right ? 1 : -1)));
    }
    renderLookMenu(slot,true);
    return;
  }
  if (input.up && cursor.option < columns) {
    cursor.tabCursor = cursor.tab;
    renderLookMenu(slot,true);
    return;
  }
  const from = cursor.option;
  const column = from % columns;
  const row = Math.floor(from / columns);
  const horizontal = Number(Boolean(input.right)) - Number(Boolean(input.left));
  const vertical = Number(Boolean(input.down)) - Number(Boolean(input.up));
  if (vertical) {
    const targetRow = Math.max(0, Math.min(Math.ceil(count / columns) - 1, row + vertical));
    cursor.option = Math.min(count - 1, targetRow * columns + column);
  } else if (horizontal) {
    const rowStart = row * columns;
    const rowEnd = Math.min(count - 1, rowStart + columns - 1);
    cursor.option = Math.max(rowStart, Math.min(rowEnd, from + horizontal));
  }
  if (cursor.option !== from) renderLookMenu(slot, true);
  if (input.dash) selectLook(slot, field.key, cursor.option);
}

function refreshReady() {
  if (!setup || !isLobby()) return;
  if (slots.length && slots.every(slot => readyPlayers.has(slot))) {
    setSetup(false);
    return;
  }
  slots.forEach((slot, i) => {
    const row = get('roster').children[i];
    const ready = readyPlayers.has(slot);
    row.classList.toggle('ready', ready);
    const button = row.querySelector('.setup-ready');
    button.textContent = ready ? '✓ Ready' : 'Ready up';
    button.setAttribute('aria-pressed', ready);
    renderLookMenu(slot);
  });
  updateStart();
}

function toggleReady(slot) {
  if (!setup || !isLobby() || !slots.includes(slot)) return;
  if (!readyPlayers.delete(slot)) readyPlayers.add(slot);
  refreshReady();
}

get('customize').addEventListener('click', () => setSetup(true));

function updateLobby() {

  if (state === 'menu') {
    humanCount = slots.length;
    score = Array(humanCount).fill(0);
    resetPlayers();
    scoreboard();
  }
  get('roster').replaceChildren(...slots.map((slot, i) => {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'P' + (i + 1) + ' · ' + deviceLabel(slot) + ' ×';
    remove.setAttribute('aria-label', 'Remove player ' + (i + 1) + ', ' + deviceLabel(slot));
    remove.addEventListener('click', () => {
      if (!isLobby()) return;
      slots.splice(slots.indexOf(slot), 1);
      readyPlayers.delete(slot);
      customCursors.delete(slot);
      updateLobby();
      if (setup) get('lobby').focus();
    });
    if (!setup) return remove;
    const row = document.createElement('div');
    row.className = 'look-row';
    row.setAttribute('aria-label', 'Customize player ' + (i + 1));
    const heading = document.createElement('strong');
    heading.textContent = 'Player ' + (i + 1) + ' · ' + deviceLabel(slot);
    const preview = document.createElement('div');
    preview.className = 'setup-preview';
    const avatar = document.createElement('div');
    avatar.className = 'setup-avatar';
    const accessory = document.createElement('span');
    accessory.className = 'setup-accessory';
    const emote = document.createElement('canvas');
    emote.className = 'setup-emote';
    emote.width = emote.height = 146;
    emote.setAttribute('aria-hidden','true');
    preview.append(avatar,accessory,emote);
    const tabs = document.createElement('div');
    tabs.className = 'look-tabs';
    customFields.forEach((field, index) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'look-tab';
      tab.textContent = field.label;
      tab.addEventListener('click', () => openLookTab(slot,index));
      tabs.append(tab);
    });
    const grid = document.createElement('div');
    grid.className = 'look-grid';
    const ready = document.createElement('button');
    ready.type = 'button';
    ready.className = 'setup-ready';
    ready.addEventListener('click', () => toggleReady(slot));
    remove.textContent = 'Leave';
    const actions = document.createElement('div');
    actions.className = 'look-actions';
    actions.append(remove,ready);
    row.append(heading, preview, tabs, grid, actions);
    if (!customCursors.has(slot)) customCursors.set(slot, {tab:0,option:lookFor(i).color});
    return row;
  }));
  updateStart();
  refreshReady();
}

function deviceLabel(slot) {
  if (slot === -2) return 'WASD';
  if (slot === -1) return 'Arrow keys';
  return window.couchJoinstick?.label(slot) ?? ('Controller ' + (slot + 1));
}

function join(slot) {
  if (slots.includes(slot)) return false;
  if (!looks.has(slot)) {
    const saved = loadLook(slot);
    if (saved) looks.set(slot, saved);
  }
  slots.push(slot);
  // Put the two named keyboard layouts first, in their displayed order.
  if (slot < 0) slots.sort((a, b) => a < 0 || b < 0 ? a < 0 && b < 0 ? a - b : a < 0 ? -1 : 1 : 0);
  if (!setup) setSetup(true);
  else updateLobby();
  return true;
}

get('action').addEventListener('click', primary);
get('tryTrick').addEventListener('click',previewBuildTrick);
get('pause').addEventListener('click', togglePause);
get('bindTrickPad').addEventListener('click',()=>{bindingController=true;bindingSlot=null;get('trickBindStatus').textContent='On a controller, press a shoulder, trigger, Select, or stick button.';});
get('bindTrickW').addEventListener('click',()=>{bindingController=false;bindingSlot=-2;get('trickBindStatus').textContent='Press a free key for WASD Trick.';});
get('bindTrickArrows').addEventListener('click',()=>{bindingController=false;bindingSlot=-1;get('trickBindStatus').textContent='Press a free key for arrow-key Trick.';});
window.addEventListener('keydown', event => {
  if (bindingController && event.code==='Escape') {
    bindingController=false;get('trickBindStatus').textContent='Binding canceled.';return;
  }
  if (bindingSlot!==null) {
    if (event.code==='Escape') {bindingSlot=null;get('trickBindStatus').textContent='Binding canceled.';return;}
    const other=bindingSlot===-2?-1:-2;
    if (controls.flat().includes(event.code) || event.code===(trickBindings.get(other) || defaultTrick.get(other)) ||
        !/^(Key[A-Z]|Digit[0-9]|Period|Comma|BracketLeft|BracketRight)$/.test(event.code) || event.code==='KeyR') return;
    event.preventDefault();
    trickBindings.set(bindingSlot,event.code);
    bindingSlot=null;
    try {localStorage.setItem('ringout-trick',JSON.stringify([...trickBindings]));} catch {}
    get('trickBindStatus').textContent='Trick bound to '+event.key+'.';
    return;
  }
  if (state === 'menu' && !setup && editingMode && event.code === 'Escape') {
    event.preventDefault();
    leaveModeSettings();
    return;
  }
  if (state === 'menu' && !setup && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code)) {
    event.preventDefault();
    navigateMenu({left:event.code==='ArrowLeft',right:event.code==='ArrowRight',
      up:event.code==='ArrowUp',down:event.code==='ArrowDown'});
    return;
  }
  if (state === 'round' && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey &&
      (event.key?.length === 1 || gameKeys.has(event.code))) {
    event.preventDefault();
    primary();
    return;
  }
  if (state === 'kineticDraft') {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const i=slots.findIndex(slot=>slot<0 && controls[slot===-2?0:1].slice(2,5).includes(event.code));
    if (i>=0) {
      event.preventDefault();
      const [, , left,right,confirm]=controls[slots[i]===-2?0:1];
      if (event.code===confirm) kineticPick(i,kineticDraft?.picks[i]?.selected);
      else kineticBrowse(i,event.code===right ? 1 : event.code===left ? -1 : 0);
    }
    return;
  }
  if (state === 'draft') {
    if (gameKeys.has(event.code) || event.code === 'Space') event.preventDefault();
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const slot = slots[draftQueue[0]];
    if (slot !== -2 && slot !== -1) return;
    const [, , left, right, confirm] = controls[slot === -2 ? 0 : 1];
    if (event.code === left) highlightCard(selected - 1);
    if (event.code === right) highlightCard(selected + 1);
    if (startingDraft && event.code === (trickBindings.get(slot) || defaultTrick.get(slot))) previewBuildTrick();
    if (event.code === confirm) pickCard(selected, slot);
    return;
  }
  if (setup && isLobby() && ['KeyR', 'Slash'].includes(event.code)) {
    event.preventDefault();
    if (!event.repeat) toggleReady(event.code === 'KeyR' ? -2 : -1);
    return;
  }
  if (!gameKeys.has(event.code)) return;
  if (event.code === 'Enter' && event.target instanceof HTMLButtonElement && !event.target.hidden &&
      !event.target.disabled && event.target.getClientRects().length) return;
  event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (state === 'menu' && !editingMode && keyboardSlots.has(event.code)) join(keyboardSlots.get(event.code));
  if (event.code === 'Enter') primary();
  if (event.code === 'Escape') togglePause();
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => {
  keys.clear();
  if (state === 'playing') togglePause();
});

function gamepads() {
  let pads = [];
  try {
    pads = Array.from(navigator.getGamepads?.() || []).filter(pad => pad?.connected);
  } catch {
    // The keyboard remains available if the browser blocks gamepad access.
  }
  pads.push(...(window.couchJoinstick?.sample() || []));
  const byIndex = new Map(pads.map(pad => [pad.index, pad]));
  connectedPads.clear();
  for (const pad of pads) connectedPads.set(pad.index, pad);
  for (const index of joinMotion) {
    if (!byIndex.has(index)) joinMotion.delete(index);
  }
  for (const slot of previous.keys()) if (slot >= 0 && !byIndex.has(slot)) previous.delete(slot);
  if (state === 'menu') {
    const available = slots.filter(slot => slot < 0 || byIndex.has(slot));
    if (available.length !== slots.length) {
      for (const slot of slots) {
        if (available.includes(slot)) continue;
        readyPlayers.delete(slot);
        customCursors.delete(slot);
      }
      slots.splice(0, slots.length, ...available);
      updateLobby();
    }
  }
  for (const pad of pads) {
    if (pad.mapping !== 'standard') continue;
    const active = Math.hypot(pad.axes[0] || 0, pad.axes[1] || 0) > .48 ||
      pad.buttons.some(button => button.pressed);
    if (active && !joinMotion.has(pad.index) && state === 'menu' && !editingMode && join(pad.index)) {
      // Consume the joining input so it cannot also activate a menu control.
      readInput(slots.indexOf(pad.index), pad);
    }
    if (active) joinMotion.add(pad.index);
    else joinMotion.delete(pad.index);
  }
  return slots.map(slot => byIndex.get(slot));
}

function readInput(i, pad) {
  const slot = slots[i];
  const prior = previous.get(slot);
  const [up, down, left, right, dash, push, dodge, emote] = controls[slot === -2 ? 0 : slot === -1 ? 1 : -1] || [];
  const button = n => Number(Boolean(pad?.buttons[n]?.pressed));
  let x = (pad?.axes[0] || 0);
  let y = (pad?.axes[1] || 0);
  const length = Math.hypot(x, y);
  const scale = length > .19 ? (Math.min(1, length) - .19) / (.81 * length) : 0;
  x = x * scale + button(15) - button(14) + Number(keys.has(right)) - Number(keys.has(left));
  y = y * scale + button(13) - button(12) + Number(keys.has(down)) - Number(keys.has(up));
  const limit = Math.max(1, Math.hypot(x, y));
  const padButtons = Array.from(pad?.buttons || [], b => Boolean(b.pressed));
  if (bindingController && pad) {
    const choice=controllerTrickButtons.find(n=>padButtons[n] && !prior?.padButtons[n]);
    if (choice!==undefined) {
      trickBindings.set(slot,choice);
      bindingController=false;
      try {localStorage.setItem('ringout-trick',JSON.stringify([...trickBindings]));} catch {}
      get('trickBindStatus').textContent='Controller Trick updated.';
    }
  }
  const held = { any: padButtons.some((down, index) => down && !prior?.padButtons[index]),
    trick: keys.has(trickBindings.get(slot) || defaultTrick.get(slot)) || button(typeof trickBindings.get(slot)==='number' ? trickBindings.get(slot) : 5), accessory: button(1), emote: keys.has(emote) || button(3), dodge: keys.has(dodge) || button(1), up: y < -.55, down: y > .55, dash: keys.has(dash) || button(0), push: keys.has(push) || button(2), start: button(9), left: x < -.55, right: x > .55 };
  const aimX=pad?.axes[2] || 0, aimY=pad?.axes[3] || 0;
  const dedicated=Math.hypot(aimX,aimY)>.24;
  const input = { x: x / limit, y: y / limit,aimX:dedicated?aimX:undefined,aimY:dedicated?aimY:undefined, charging: Boolean(held.push), inputLost: slot >= 0 && !pad, dashHeld: Boolean(held.dash) };
  for (const name of Object.keys(held)) input[name] = held[name] && !prior?.[name];
  input.any = held.any;
  previous.set(slot, {...held, padButtons});
  return input;
}

function friendly(a,b) {
  return !rules.friendlyPush && a.team != null && a.team === b.team;
}

function onPlatform(x,y,player) {
  return fixedCardFloor(x,y) || cardPlatform(x,y,player) || Boolean(currentMap.ferryAt(x,y,platformTime));
}

function ferryProtected(player) {
  return !currentMap.floor(player.x,player.y) &&
    Boolean(currentMap.ferryAt(player.x,player.y,platformTime));
}

function carryFerries(dt) {
  if (!currentMap.ferries?.length) return;
  for (const p of players) {
    if (!ferryProtected(p)) p.wasFerryRider = false;
  }
  const before = currentMap.ferryRects(platformTime);
  platformTime += dt;
  const after = currentMap.ferryRects(platformTime);
  for (const p of players) {
    if (p.out || currentMap.floor(p.x,p.y)) continue;
    const index = before.findIndex(([x,y,w,h]) => p.x>=x && p.x<=x+w && p.y>=y && p.y<=y+h);
    if (index < 0) continue;
    if (!p.wasFerryRider) p.vx = p.vy = 0;
    moveAxis(p,'x',after[index][0]-before[index][0]);
    moveAxis(p,'y',after[index][1]-before[index][1]);
    p.wasFerryRider = true;
  }
}

function cpuInput(cpu, dt) {
  if (cpu.out) return { x: 0, y: 0 };
  const targets = players.slice(0, humanCount).filter(p => !p.out);
  const distance = p => Math.hypot(p.x - cpu.x, p.y - cpu.y);
  const target = targets.reduce((nearest, p) => !nearest || distance(p) < distance(nearest) ? p : nearest, null);
  if (!target) return { x: 0, y: 0 };
  const range = distance(target);
  // Use a safe waypoint when a straight chase would cross a hole.
  const pathClear = point => [0.25,0.5,0.75,1].every(t =>
    onPlatform(cpu.x+(point.x-cpu.x)*t,cpu.y+(point.y-cpu.y)*t));
  let aim = target;
  const direct = pathClear(target);
  if (!direct) {
    const candidates = currentMap.spawns.filter(point => distance(point) < 170 && distance(point) > 24 && pathClear(point));
    if (candidates.length) aim = candidates.reduce((best, point) =>
      Math.hypot(point.x-target.x,point.y-target.y) < Math.hypot(best.x-target.x,best.y-target.y) ? point : best);
    else return {x:0,y:0};
  }
  cpu.brain = Math.max(0, cpu.brain - dt);
  const charging = cpu.charge > 0 ? cpu.charge < chargeMax * (.65 + Math.min(.30, knockouts * .018)) && range < 105
    : range < 85 && cpu.pushCooldown <= 0;
  const dash = direct && range > 135 && range < 245 && cpu.brain === 0 && cpu.dashCooldown <= 0;
  if (dash) cpu.brain = 1.2 + Math.random();
  const speed = range > 44 ? (charging ? .44 : .84) : .05;
  const length = Math.max(1, distance(aim));
  return { x: (aim.x - cpu.x) / length * speed, y: (aim.y - cpu.y) / length * speed, charging, dash };
}

function flash(kind, x, y, color, radius, duration, endX = x, endY = y) {
  effects.push({kind, x, y, color, radius, duration, age: 0, endX, endY});
}

function pushFalloff(distance, range) {
  const t = Math.max(0, Math.min(1, (distance / range - .25) / .75));
  return 1 - .65 * t * t * (3 - 2 * t);
}

function areaPush(owner,x,y,range,force,skip,options = {}) {
  flash('burst',x,y,'#ffc283',range,.32);
  for (const target of players) {
    const dx = target.x-x;
    const dy = target.y-y;
    const distance = Math.hypot(dx,dy);
    if (distance > range) continue;
    const aim = distance >= 1 ? {x:dx/distance,y:dy/distance} : {x:-owner.fx,y:-owner.fy};
    cardShove(target,owner,aim.x,aim.y,force*pushFalloff(distance,range),{...options,skip,generated:true});
  }
}

function clearComboLanding(point, player, ignore) {
  const r = player.radius || half;
  return currentMap.safeFootprint(point.x,point.y,r) && fixedCardFloor(point.x,point.y) &&
    !obstacles.some(w=>point.x+r>w.x && point.x-r<w.x+w.w && point.y+r>w.y && point.y-r<w.y+w.h) &&
    !players.some(p=>p!==player && p!==ignore && !p.out &&
      Math.abs(p.x-point.x)<r+(p.radius || half) && Math.abs(p.y-point.y)<r+(p.radius || half));
}

function comboTeleport(player,point) {
  flash('trail',player.x,player.y,'#d6b8ff',26,.32,point.x,point.y);
  player.x=point.x;
  player.y=point.y;
}

function fireCombo(player,event,target,{generated = false} = {}) {
  if (event === 'wall' && matchTime < (player.wallComboAt || 0)) return;
  if (event === 'wall') player.wallComboAt = matchTime+.55;
  const bank = player.comboBank || (player.comboBank = {});
  for (const key of Object.keys(player.stats)) {
    const recipe = comboRecipes.get(key);
    if (recipe?.event !== event) continue;
    for (let i=0;i<recipe.effects.length;i+=2) {
      const [effect,value] = recipe.effects.slice(i,i+2);
      if (generated && ['dash','dodge','push','burst'].includes(effect)) continue;
      const origin = target || player;
      if (effect === 'burst') {
        echoes.push({owner:player,x:origin.x,y:origin.y,delay:.06,range:76,force:value,skip:target?.stats ? target : undefined});
      } else if (effect === 'shield') player.chargeShieldUntil = matchTime+1;
      else if (effect === 'speed') boostMovement(player,value,2);
      else if (effect === 'brace') {
        player.braceUntil = matchTime+2;
        player.braceStrength = Math.max(player.braceStrength || 0,value);
      } else if (effect === 'brake') {
        player.vx *= 1-value;
        player.vy *= 1-value;
      } else if (effect === 'clean') {
        player.slide = player.frozen = 0;
        player.slowUntil = 0;
        if ((player.pickup?.value < 1 && player.pickup.stat==='speed') ||
            (player.pickup?.value > 1 && player.pickup.stat==='guard')) player.pickupUntil = 0;
      } else if (effect === 'slowTarget' && target) {
        target.slowUntil = matchTime+1.4;
        target.slowStrength = value;
      } else if (effect === 'rally') {
        for (const ally of players) {
          if (!ally.out && (ally===player || (ally.team!=null && ally.team===player.team)) &&
              Math.hypot(ally.x-player.x,ally.y-player.y)<160) boostMovement(ally,value,2);
        }
      } else if (effect === 'swap' && target && matchTime >= (player.swapReady || 0)) {
        const origin = {x:player.x,y:player.y};
        if (clearComboLanding(target,player,target) && clearComboLanding(origin,target,player)) {
          comboTeleport(player,target);
          comboTeleport(target,origin);
          player.swapReady = matchTime+4;
        }
      } else if (effect === 'orbit' && target && matchTime >= (player.orbitReady || 0)) {
        const distance = (player.radius || half)+(target.radius || half)+8;
        const point = {x:target.x+player.dx*distance,y:target.y+player.dy*distance};
        if (clearComboLanding(point,player)) {
          comboTeleport(player,point);
          player.orbitReady = matchTime+3;
        }
      } else if (effect === 'afterimage') {
        if (player.dashOrigin && matchTime >= (player.recallReady || 0)) {
          player.recallPoint = {...player.dashOrigin,source:'afterimage'};
          player.recallReady = matchTime+4;
        }
      } else if (effect === 'sidestep') player.sideReady = true;
      else if (effect === 'link' && target) {
        const partner = players.find(p=>p!==player && p!==target && !p.out && !friendly(player,p) &&
          Math.hypot(p.x-target.x,p.y-target.y)<125);
        if (partner) player.domino = {a:target,b:partner,until:matchTime+3};
      } else if (effect === 'recall') {
        if (matchTime >= (player.recallReady || 0) && currentMap.safeFootprint(player.x,player.y,half)) {
          player.recallPoint = {x:player.x,y:player.y};
          player.recallReady = matchTime+5;
          flash('marker',player.x,player.y,'#d6b8ff',27,.65);
        }
      } else if (['double','slowPatch','mine','bomb','decoy','well','spring'].includes(effect)) {
        placeComboProp(player,effect,value,origin);
      } else if (['dash','dodge','push'].includes(effect)) {
        const timer = effect+'Cooldown';
        player[timer] = Math.max(0,(player[timer] || 0)-value);
      } else bank[effect] = Math.min(effect==='charge' ? .80 : 1.15,(bank[effect] || 0)+value);
    }
  }
}

function comboGuard(player) {
  if (player.braceUntil > matchTime) return 1-player.braceStrength;
  player.braceStrength = 0;
  return 1;
}

function placeComboProp(owner,kind,value,origin) {
  if (rules.radicalCards === false && radicalEffects.has(kind)) return;
  let point = origin;
  if (!point) return;
  if (kind === 'spring') point = {x:owner.x-40*owner.fx,y:owner.y-40*owner.fy};
  if (!onPlatform(point.x,point.y,owner)) {
    if (kind === 'spring' && onPlatform(owner.x,owner.y)) point = owner;
    else return;
  }
  const armed = ['mine','decoy','spring'].includes(kind);
  const timed = ['bomb','double'].includes(kind);
  const duration = armed ? 4 : timed ? 1.35 : 1.8;
  comboProps = comboProps.filter(prop=>prop.owner!==owner || prop.kind!==kind);
  comboProps.push({owner,kind,value,x:point.x,y:point.y,dx:-owner.fx,dy:-owner.fy,
    armedAt:matchTime+(armed ? .32 : kind==='double' ? .30 : .65),
    expires:matchTime+duration,timed,pulses:kind==='double'?2:1});
}

function updateComboProps(dt) {
  const pending = comboProps;
  comboProps = [];
  const active = pending.filter(prop=>{
    if (matchTime >= prop.expires) return false;
    if (prop.moving) {
      const distance = 230*dt;
      if (!wallRay(prop,{x:prop.dx,y:prop.dy},distance,8)) {
        prop.x += prop.dx*distance;
        prop.y += prop.dy*distance;
      } else prop.moving = false;
    }
    if (matchTime < prop.armedAt) return true;
    if (prop.timed) {
      areaPush(prop.owner,prop.x,prop.y,77,prop.value);
      prop.armedAt = matchTime+.36;
      return --prop.pulses > 0;
    }
    for (const p of players) {
      if (p.out || p.respawnGuard > matchTime || ferryProtected(p) || Math.hypot(p.x-prop.x,p.y-prop.y)>45) continue;
      if (prop.kind==='spring') {
        p.vx += prop.dx*prop.value;
        p.vy += prop.dy*prop.value;
        flash('burst',prop.x,prop.y,'#b9f58a',36,.32);
        return false;
      }
      if (p===prop.owner || friendly(prop.owner,p)) continue;
      if (prop.kind==='mine' || prop.kind==='decoy') {
        areaPush(prop.owner,prop.x,prop.y,85,prop.value);
        return false;
      }
      if (prop.kind==='slowPatch') {
        p.slowUntil = matchTime+.2;
        p.slowStrength = prop.value;
      } else if (prop.kind==='well') {
        const dx=prop.x-p.x, dy=prop.y-p.y, distance=Math.max(12,Math.hypot(dx,dy));
        p.vx += dx/distance*prop.value*dt;
        p.vy += dy/distance*prop.value*dt;
      }
    }
    return true;
  });
  comboProps = active.filter(prop=>!comboProps.some(next=>next.owner===prop.owner&&next.kind===prop.kind)).concat(comboProps);
}

function drawComboProps() {
  for (const prop of comboProps) {
    const label = ({mine:'MINE',bomb:'BOMB',double:'BEACON',spring:'SPRING',
      slowPatch:'SLOW',well:'PULL',decoy:'DECOY'})[prop.kind];
    const color = ['mine','bomb','double'].includes(prop.kind) ? '#ffae87' : '#aff2cf';
    ctx.save();
    ctx.beginPath();
    ctx.arc(prop.x,prop.y,prop.timed ? 32 : 24,0,Math.PI*2);
    ctx.fillStyle = '#142031d9';
    ctx.strokeStyle = color;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px monospace';
    const hint = prop.timed ? ' '+Math.max(0,prop.armedAt-matchTime).toFixed(1)+'s' : '';
    ctx.fillText(label+hint,prop.x,prop.y+3);
    ctx.restore();
  }
}

function finishDash(player) {
  if (!player.dashFinisher) return;
  player.dashFinisher = false;
  if (player.out) return;
  if (player.jamHop) {
    player.jamHop=false;
    directionalCardShove(player,player,{x:player.dx,y:player.dy},48,180,{lanes:[0],arc:.8,force:1});
    return;
  }
  buildDashFinish(player);
  if (!cardDashEnd(player)) return;
  fireCombo(player,'dashEnd');
  const guardBurst = player.guardBurstReady;
  player.guardBurstReady = false;
  if (!player.stats.dashBurst && !player.stats.pulseTrain && !guardBurst) return;
  const range = (guardBurst ? 106 : 82) * (1+(player.stats.range || 0)) * (1+(player.comboBank?.reach || 0));
  const force = (guardBurst ? 590 : 435) * (1+(player.stats.force || 0)) *
    (1+(player.comboBank?.power || 0)) * pickupFactor(player,'force');
  areaPush(player,player.x,player.y,range,force);
  if (player.stats.pulseTrain) {
    echoes.push({owner:player,x:player.x,y:player.y,delay:.45,range,force:force*.72});
    flash('marker',player.x,player.y,'#e8b4ff',range,.45);
  }
}

function updateEffects(dt) {
  updateComboProps(dt);
  effects = effects.filter(effect => (effect.age += dt) < effect.duration);
  echoes = echoes.filter(echo => {
    echo.delay -= dt;
    if (echo.delay > 0) return true;
    areaPush(echo.owner,echo.x,echo.y,echo.range || 82,echo.force || 360,echo.skip,{reflectable:echo.reflectable});
    return false;
  });
}

function drawEffects() {
  for (const effect of effects) {
    const {kind, x, y, color, radius, endX, endY} = effect;
    const t = effect.age / effect.duration;
    const ease = 1 - (1 - t) ** 2;
    ctx.save();
    ctx.globalAlpha = (1 - t) * .9;
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.lineWidth = 2 + 3 * (1 - t);
    ctx.beginPath();
    if (kind === 'parry') {
      const progress = reduceCountdownMotion?.matches ? .35 : ease;
      const ring = 20 + radius * progress;
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 3;
      ctx.arc(x, y, ring, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3 + .2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * ring, y + Math.sin(angle) * ring);
        ctx.lineTo(x + Math.cos(angle) * (ring + 8), y + Math.sin(angle) * (ring + 8));
        ctx.stroke();
      }
      ctx.globalAlpha = Math.min(1, (1 - t) * 2.5);
      ctx.textAlign = 'center';
      ctx.font = 'bold 17px monospace';
      ctx.strokeStyle = '#141923';
      ctx.lineWidth = 4;
      const labelY = y - 28 - 14 * progress;
      ctx.strokeText('PARRY!', x, labelY);
      ctx.fillText('PARRY!', x, labelY);
      ctx.restore();
      continue;
    }
    if (kind === 'trail') {
      ctx.moveTo(x, y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    } else {
      ctx.arc(x, y, Math.max(1, radius * (kind === 'marker' ? 1 - t * .45 : .22 + .78 * ease)), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (kind !== 'marker') {
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const r = radius * ease;
        ctx.fillRect(endX + Math.cos(angle) * r, endY + Math.sin(angle) * r, 3, 3);
      }
    }
    ctx.restore();
  }
}

function updateArena(dt) {
  arenaTime -= dt;
  if (arenaTime <= warningTime && nextArena === arena) {
    nextArena = (arena + 1 + Math.floor(Math.random() * (arenas.length - 1))) % arenas.length;
  }
  if (arenaTime <= 0) {
    arena = nextArena;
    arenaTime = 10 + Math.random() * 8;
  }
  const notice = get('arenaNotice');
  notice.hidden = nextArena === arena && arena === 0;
  if (!notice.hidden) {
    const incoming = arenas[nextArena];
    const label = incoming.name + ' · ' + incoming.effect + (nextArena === arena ? '' : ' · ' + Math.ceil(arenaTime) + 's');
    if (notice.textContent !== label) notice.textContent = label;
  }
}

let hapticsEnabled = true;
get('haptics').addEventListener('click', () => {
  hapticsEnabled = !hapticsEnabled;
  get('haptics').setAttribute('aria-pressed', hapticsEnabled);
  get('haptics').textContent = 'Controller vibration · ' + (hapticsEnabled ? 'On' : 'Off');
});

function rumble(player, duration, strong, weak = strong) {
  if (!hapticsEnabled) return;
  const slot = slots[players.indexOf(player)];
  const actuator = connectedPads.get(slot)?.vibrationActuator;
  if (!actuator?.playEffect) return;
  try {
    const effect = actuator.effects?.includes('dual-rumble') === false ? null : 'dual-rumble';
    if (effect) Promise.resolve(actuator.playEffect(effect, {duration, strongMagnitude:strong, weakMagnitude:weak})).catch(() => {});
  } catch {
    // Some browsers expose an actuator even when vibration is unavailable.
  }
}

function blockPush(target, source, x, y, hit = {}) {
  if (target!==source && friendly(target,source)) return false;
  if (ferryProtected(target)) {
    flash('marker',target.x,target.y,'#9ef3ec',29,.24);
    return true;
  }
  if (target.chargeShieldUntil > matchTime) {
    target.chargeShieldUntil = 0;
    flash('burst',target.x,target.y,'#93eaff',33,.28);
    return true;
  }
  const replay = !hit.echo && cardObjects.find(object=>object.owner===target && object.kind==='parryEcho' &&
    activeCardObject(object) && matchTime>=object.trigger && nearPoint(target,object,44));
  const echo = !(target.dodge > 0) && Boolean(replay);
  if (!(target.dodge > 0) && !echo) return false;
  if (!echo) {
    if (target.stats.secondStride) boostMovement(target,.35,1.8);
    if (target.stats.safetyValve && !hit.generated) {
      target.dashCooldown = 0;
      boostMovement(target,.25,1.4);
    }
  }
  if (echo) replay.until = 0;
  const parried = echo || target.dodge >= dodgeDuration - parryDuration * (1 + Math.min(.8, target.stats.parryWindow || 0));
  if (!echo) cardOnBlock(target,{x,y},hit,parried);
  if (parried && !echo) {buildOnParry(target,hit);kineticParry(target,hit);}
  if (parried && source!==target && !source.out && !hit.generated) {
    const impulse = 245;
    source.vx -= impulse * x;
    source.vy -= impulse * y;
  }
  if (parried && !echo) {
    fireCombo(target,'parry',undefined,{generated:hit.generated});
    if (target.stats.turntable) target.circleUntil = matchTime+3;
    if (target.stats.guardBurst && !hit.generated) target.guardBurstReady = true;
    if (target.stats.springStance && !hit.generated) {
      target.dashCooldown = 0;
      target.springReady = true;
    }
  }
  rumble(target, parried ? 100 : 55, parried ? .6 : .2);
  flash(parried ? 'parry' : 'burst', target.x, target.y, echo ? '#d9a9ff' : parried ? '#fff0a0' : '#7eeaff', 43, parried ? .55 : .26);
  return true;
}

function resolvePushes(attacks) {
  const landed = new Set();
  const hits = attacks.flatMap(attack => {
    const { p, power, radial = false } = attack;
    const caught = p.caughtForce || 0;
    p.caughtForce = 0;
    const stats = matchStats[players.indexOf(p)];
    if (stats) stats.attempts++;
    const combo = p.comboUntil > matchTime;
    p.comboUntil = 0;
    const strength = pushCurve(power);
    const gravity = Boolean(p.stats.gravity && power >= .85);
    const bank = p.comboBank || {};
    const bonusPower = bank.power || 0;
    const bonusReach = bank.reach || 0;
    const circle = p.circleUntil > matchTime || Boolean(bank.circle);
    bank.power = bank.reach = bank.circle = 0;
    p.circleUntil = 0;
    const basePattern = pushPattern(p, radial || gravity || circle);
    const baseRange = (66 + strength * 70) * (rules.divergence && p.stats.focusCone && basePattern.arc!==Math.PI ? 1.24 : 1) * (1 + (p.stats.range || 0)) * (1+bonusReach);
    const profile = rules.kinetic ? kineticPushProfile(p,power,basePattern,baseRange) : {pattern:basePattern,range:baseRange};
    const {pattern,range}=profile;
    if (combo) flash('burst',p.x,p.y,'#ffd783',range,.28);
    p.pulse = .23;
    p.pulseRange = range;
    p.pulseRadial = radial || gravity || circle;
    p.pulsePattern = pattern;
    p.pulseAngle = Math.atan2(p.fy, p.fx);
    if (gravity) flash('marker', p.x, p.y, '#ffc777', range, .36);
    const stored = rules.kinetic ? p.kinStored || 0 : 0;
    if (rules.kinetic) p.kinStored=0;
    cardOnManualPush(p,power,range,pattern);
    buildManual(p,power,range,pattern);
    for (const wall of [...obstacles]) {
      const x = Math.max(wall.x, Math.min(wall.x + wall.w, p.x)) - p.x;
      const y = Math.max(wall.y, Math.min(wall.y + wall.h, p.y)) - p.y;
      const distance = Math.hypot(x, y);
      if (distance <= range && inPushPattern(Math.atan2(y,x),p.pulseAngle,pattern)) {
        attack.hitWall = true;
        damageWall(wall, (.12 + 1.55 * strength) * (1 + (p.stats.force || 0)),p);
      }
    }
    if (radial || circle) flash('burst', p.x, p.y, '#e6a3ff', range, .32);
    const contacts = players.flatMap(target => {
      const x = target.x - p.x;
      const y = target.y - p.y;
      const length = Math.hypot(x, y);
      if (target.out || target === p || friendly(p,target) || length === 0 || length > range ||
          !inPushPattern(Math.atan2(y,x),p.pulseAngle,pattern)) return [];
      if (rules.kinetic && wallRay(p,{x:x/length,y:y/length},length)) return [];
      const sideLane = profile.triple && !inPushPattern(Math.atan2(y,x),p.pulseAngle,{lanes:[0],arc:pattern.arc});
      return [{p,target,x:x/length,y:y/length,power,strength,pattern,gravity,combo,attack,bonusPower,caught,stored,profile,sideLane,
        falloff:pushFalloff(length,range)}];
    });
    if (rules.kinetic) kineticCharge(p,power,contacts.map(hit=>hit.target),profile);
    return contacts;
  });
  for (const hit of hits) {
    const counter = hits.some(other => other.p === hit.target && other.target === hit.p);
    const force = ((rules.kinetic ? 345 : 260) + hit.stored*.55 + 1450 * hit.strength) * hit.pattern.force * (hit.sideLane ? .72 : 1) * (1+hit.bonusPower) * hit.falloff * (counter ? .92 : 1)
      * (1 + (hit.p.stats.force || 0)) * pickupFactor(hit.p,'force')
      * (rules.divergence && hit.p.stats.heavyHands && hit.power>=.99 ? 1.32 : 1)
      * (rules.divergence && hit.p.buildSlide>matchTime ? 1+Math.min(.55,buildSpeed(hit.p)/1000) : 1)
      * (hit.combo ? hit.p.stats.comboEngine ? 1.55 : 1.35 : 1);
    const impulse = (hit.gravity || hit.profile.reverse) ? -Math.min(900, force * .65) : force;
    const polarity = Math.sign(impulse);
    if (!cardShove(hit.target,hit.p,hit.x*polarity,hit.y*polarity,Math.abs(impulse),{applyGuard:true})) continue;
    buildOnHit(hit.p,hit.target,hit.power,Math.abs(impulse));
    if (rules.kinetic) {
      kineticDirect(hit.p,hit.target,hit.power,Math.abs(impulse));
      if(hit.profile.rocket && !landed.has(hit.attack)) hit.p.dashCooldown=Math.max(0,hit.p.dashCooldown-.38);
    }
    if (hit.p.buildSlide>matchTime) {hit.p.buildSlide=0;hit.p.vx*=.55;hit.p.vy*=.55;}
    if (hit.caught) cardShove(hit.target,hit.p,hit.p.fx,hit.p.fy,hit.caught,{unblocked:true,generated:true,noCredit:true});
    const link = hit.p.domino;
    const stats = matchStats[players.indexOf(hit.p)];
    if (!landed.has(hit.attack)) {
      cardOnManualHit(hit.p,hit.target,hit.power);
      fireCombo(hit.p,'push',hit.target);
      if (hit.power < .25) fireCombo(hit.p,'tap',hit.target);
      if (hit.power >= .99) fireCombo(hit.p,'full',hit.target);
      if (hit.p.stats.popCircuit && hit.power >= .99 && matchTime >= (hit.p.circuitReady || 0)) {
        hit.p.circuitReady = matchTime+3;
        hit.p.dashCooldown = hit.p.dodgeCooldown = 0;
        echoes.push({owner:hit.p,x:hit.target.x,y:hit.target.y,delay:.22,range:82,force:430});
      }
      if (hit.p.stats.chain && hit.power >= .98) {
        echoes.push({owner:hit.p,x:hit.target.x,y:hit.target.y,delay:.16,range:65,force:255,skip:hit.target});
      }
      if (hit.combo && hit.p.stats.comboEngine) hit.p.dashCooldown = 0;
      landed.add(hit.attack);
      if (stats) stats.landed++;
    }
    if (stats) {
      stats.pushes++;
    }
    rumble(hit.target, 45 + 65*hit.strength, .18 + .62*hit.strength);
    if (link?.until > matchTime) {
      const partner = link.a===hit.target ? link.b : link.b===hit.target ? link.a : null;
      if (partner && !partner.out && !ferryProtected(partner) && !friendly(hit.p,partner)) {
        cardShove(partner,hit.p,hit.x,hit.y,impulse*.45,{generated:true});
        flash('trail',hit.target.x,hit.target.y,'#d6b8ff',16,.28,partner.x,partner.y);
      }
    }
  }
  for (const attack of attacks) {
    if (attack.p.buildHeavyCheck) {attack.p.pushCooldown+=.34;attack.p.buildHeavyCheck=false;}
    if (!attack.hitWall && !hits.some(hit=>hit.attack===attack)) cardOnEmptyHit(attack.p,attack.power,attack.p.pulseRange);
  }
}

function updatePeel(dt) {
  peelTimer -= dt;
  if (peelTimer <= 0) {
    const spots = currentMap.spawns.filter(({x,y}) =>
      fixedCardFloor(x,y) && players.every(p => p.out || Math.hypot(p.x-x,p.y-y) > 36) &&
      obstacles.every(wall => x+15<=wall.x || x-15>=wall.x+wall.w ||
        y+15<=wall.y || y-15>=wall.y+wall.h));
    const spot = spots[Math.floor(Math.random()*spots.length)];
    const type = Math.random() < .28 ? null : pickupTypes[Math.floor(Math.random()*pickupTypes.length)];
    peel = spot ? {...spot,type} : null;
    peelTimer = peel ? 6 + Math.random()*4 : 1;
  }
  if (!peel) return;
  const p = players.find(player => !player.out && Math.hypot(player.x - peel.x, player.y - peel.y) < 26);
  if (!p) return;
  const {type,x,y} = peel;
  peel = null;
  if (type) {
    if (p.stats.delivery) {
      if (p.delivery) applyPickup(p,p.delivery.item);
      p.delivery={item:type,until:matchTime+2};
    } else applyPickup(p,type);
    return;
  }
  if (p.stats.soles && p.dash>0) {
    cardObject('banana',p,{x:x+p.dx*17,y:y+p.dy*17},2.6,{dx:p.dx,dy:p.dy,speed:290,trigger:matchTime+.15});
    flash('burst',x,y,'#ffd86c',34,.32);
    return;
  }
  slipOnPeel(p);
}

function applyPickup(p,type) {
  p.pickup = type;
  p.pickupUntil = matchTime + type.seconds;
  fireCombo(p,'pickup');
  flash('burst',p.x,p.y,type.color,30,.28);
}

function slipOnPeel(p) {
  const length = Math.hypot(p.vx, p.vy);
  p.vx = 560 * (length > 70 ? p.vx / length : p.fx);
  p.vy = 560 * (length > 70 ? p.vy / length : p.fy);
  p.slide = .52;
  p.dash = 0;
  p.dodge = 0;
  if (!p.stats.cleanShoes) p.charge = 0;
}

const cpuTypes = {
  grunt:{label:'CPU',color:'#e6a3ff',stats:{}},
  mini:{label:'MINI',color:'#90ecd4',stats:{speed:.36,force:-.28,guard:-.18}},
  bruiser:{label:'TANK',color:'#ffa36e',stats:{speed:-.19,force:.32,guard:.27}},
  striker:{label:'ACE',color:'#f5d777',stats:{dashRate:.34,dashForce:.22}},
  floodkeeper:{label:'FLOODKEEPER',color:'#81bfff',stats:{force:.32,guard:.22,save:1,ring:1}},
  warden:{label:'WARDEN',color:'#81dec9',stats:{range:.23,force:.34,guard:.30,save:1,windGuard:1,dashRate:.20}},
  boss:{label:'BOSS',color:'#ff85a8',stats:{range:.34,force:.45,guard:.38,save:1}},
};

function cpuTypeFor(index) {
  if (wave % 5 === 0 && index === 0) return cpuTypes.boss;
  const pool = ['grunt'];
  if (wave >= 2) pool.push('mini');
  if (wave >= 3) pool.push('bruiser');
  if (wave >= 4) pool.push('striker');
  return cpuTypes[pool[(index + wave - 1) % pool.length]];
}

const storyChapters = [
  {title:'The Foundry Signal',
    intro:'A distress signal brings your crew to a dark foundry. Restore its relay and find out who sent it.',
    ending:'The Sentinel falls. The restored relay plays a warning from the sky docks: “Someone’s turned the fans against us.”',
    encounters:[
      {map:'Foundry',name:'The silent foundry',brief:'Dispatcher Mara: “The patrol is all that’s between you and the relay. Clear the floor.”',enemies:['grunt','mini']},
      {map:'Reactor',name:'Restart the relay',brief:'Mara: “Stand on the relay pad to power it up. Keep the guards off it.”',enemies:['bruiser','striker','mini'],task:'relay'},
      {map:'The Ring',name:'The Sentinel',brief:'Mara: “The Sentinel has a recovery system. Its first ringout won’t finish it.”',enemies:['boss','striker']},
    ]},
  {title:'Crosswind Courier',
    intro:'The foundry signal led to the sky docks. Mara needs a flight recorder before the crew that sabotaged the fans sends it over the edge.',
    ending:'The Warden is down. The recorder points to a flooded archive where someone ordered both sabotages.',
    encounters:[
      {map:'Wind Tunnel',name:'Into the crosswind',brief:'Mara: “Follow the wind arrows. You can steer against the gusts, but watch the ledges.”',enemies:['mini','mini','striker']},
      {map:'Ferry Crossing',name:'Across the docks',brief:'Mara: “Grab the flight recorder on the west dock and ride the ferry to extraction.”',enemies:['bruiser','striker','mini'],task:'courier'},
      {map:'Pinwheel',name:'The Gale Warden',brief:'Mara: “That’s the Warden. It resists wind and can recover from one ringout. Keep it away from the recorder.”',enemies:['warden','mini']},
    ]},
  {title:'The Drowned Archive',
    intro:'The flight recorder names Operations Chief Vale. Mara guides your crew into the flooding archive to find his original orders before the pumps fail.',
    ending:'You recover Vale’s orders, but the archive logs show they were signed after he disappeared. Mara recognizes the forged signal: it came from the uplink tower.',
    encounters:[
      {map:'Archive Intake',name:'Below the waterline',brief:'Mara: “The intake is flooded. Clear the access deck so I can open the archive.”',enemies:['mini','bruiser','grunt']},
      {map:'Archive Locks',name:'Open the sluices',brief:'Mara: “The sluice controls must be turned in order. Follow the numbered valves.”',enemies:['striker','mini','bruiser'],task:'valves'},
      {map:'Archive Locks',name:'The floodkeeper',brief:'Mara: “The Floodkeeper is guarding the evidence. Its recovery system will bring it back once.”',enemies:['floodkeeper','bruiser']},
    ]},

];

function storyProgress() {
  try {
    const saved = document.cookie.match(/(?:^|;\s*)ringout_story_v1=(\d+)(?:;|$)/);
    return Math.min(storyChapters.length,Number(saved?.[1]) || 0);
  } catch { return 0; }
}

function storyChapter() {
  return storyChapters[(rules.chapter || 1)-1];
}

function storyMap(number = wave) {
  return maps.find(map=>map.name===storyChapter().encounters[number-1]?.map);
}

function showEncounterCountdown() {
  const encounter = rules.story && storyChapter().encounters[wave-1];
  if (encounter) show('countdown','Chapter '+rules.chapter+' · '+encounter.name,'3',encounter.brief);
  else show('countdown',currentMap.name,'3');
}

function windDrift(zone,x,y,time,resistant) {
  const [left,top,width,height] = zone;
  const border = Math.min(x-left,left+width-x, y-top,top+height-y);
  const fadeWidth = Math.min(22, width / 3, height / 3);
  const t = Math.max(0, Math.min(1, border / fadeWidth));
  const blend = t * t * (3 - 2 * t);
  const gust = 12 + 7 * Math.sin(time * 1.15 + left * .013 + top * .009);
  return blend * gust * (resistant ? .3 : 1);
}

let storyTask = null;

function setupStoryTask(encounter) {
  const type = encounter?.task;
  if (!type) return null;
  const preferred = type === 'relay' ? [{x:680,y:110}]
    : type === 'courier' ? [{x:298,y:230},{x:760,y:160}]
    : [{x:220,y:240},{x:500,y:95},{x:770,y:260}];
  const points = preferred.map(point=>safeSpawn(currentMap,[],point,obstacles));
  return {type,points,step:0,charge:0,carrier:null,done:false};
}

function updateStoryTask(dt) {
  const task = storyTask;
  if (!task || task.done) return;
  const humans = players.slice(0,humanCount).filter(p=>!p.out);
  const near = (p,point) => Math.hypot(p.x-point.x,p.y-point.y)<35;
  if (task.type === 'relay') {
    const pad = task.points[0];
    if (humans.some(p=>near(p,pad)) && !players.slice(humanCount).some(p=>!p.out&&near(p,pad))) {
      task.charge += dt;
    }
    task.done = task.charge>=5;
  } else if (task.type === 'courier') {
    if (task.carrier?.out) task.carrier = null;
    task.carrier ??= humans.find(p=>near(p,task.points[0]));
    task.done = Boolean(task.carrier && near(task.carrier,task.points[1]));
  } else {
    if (humans.some(p=>near(p,task.points[task.step]))) task.step++;
    task.done = task.step===task.points.length;
  }
}

function drawStoryTask() {
  const task = storyTask;
  if (!task || task.done) return;
  ctx.save();
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  const marker = (point,label) => {
    ctx.fillStyle = '#e9d17a35';
    ctx.strokeStyle = '#ffe293';
    ctx.beginPath();
    ctx.arc(point.x,point.y,28,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff3c1';
    ctx.fillText(label,point.x,point.y+4);
  };
  if (task.type==='relay') marker(task.points[0],Math.min(100,Math.floor(task.charge*20))+'%');
  else if (task.type==='courier') {
    if (!task.carrier) marker(task.points[0],'RECORDER');
    else {
      marker(task.points[1],'EXTRACT');
      ctx.fillText('RECORDER',task.carrier.x,task.carrier.y-32);
    }
  } else marker(task.points[task.step],'VALVE '+(task.step+1));
  ctx.restore();
}

function startWave() {
  const humans = players.slice(0, humanCount);
  const {center,width,height} = currentMap;
  const encounter = rules.story && storyChapter().encounters[wave-1];
  storyTask = setupStoryTask(encounter);
  const requested = encounter ? encounter.enemies.length + Math.max(0,humanCount-2)
    : Math.max(2, humanCount) + Math.min(10, Math.floor((wave - 1) * rules.difficulty));
  waveEnemies = 0;
  players = humans;
  for (let i = 0; i < requested; i++) {
    const type = encounter ? cpuTypes[encounter.enemies[i] || 'grunt'] : cpuTypeFor(i);
    const radius = type === cpuTypes.mini ? 12 : type.stats.save ? 27 : half;
    const angle = i / requested * Math.PI * 2;
    const spawn = safeSpawn(currentMap, players.filter(p=>!p.out),
      {x:center.x+width*.42*Math.cos(angle),y:center.y+height*.39*Math.sin(angle)}, obstacles, radius);
    if (!spawn) continue;
    waveEnemies++;
    players.push({
      ...spawn, team:1,
      vx:0, vy:0, fx:-Math.cos(angle), fy:-Math.sin(angle),
      dx:0, dy:0, out:false, charge:0, slide:0, pulse:0, dash:0,
      dashCooldown:.8, pushCooldown:.5, brain:.7 + i * .07,
      color:type.color, cpuLabel:type.label,
      radius,
      stats:{...type.stats, speed:(type.stats.speed || 0) + Math.min(.22,(wave-1)*.025) + (rules.difficulty-1)*.45,
        force:(type.stats.force || 0) + Math.min(.25,(wave-1)*.03) + (rules.difficulty-1)*.5},
    });
  }
  waveBreak = null;
  scoreboard();
}

function advanceWave() {
  wave++;
  upcomingMap = upcomingWalls = null;
  if (rules.story) {
    currentMap = storyMap();
    obstacles = [];
    platformTime = windTime = 0;
    arena = nextArena = 0;
    arenaTime = 5;
  }
  resetPlayers(true,obstacles);
  echoes = [];
  comboProps = [];
  resetCardWorld();
  effects = [];
  peel = null;
  peelTimer = 3 + Math.random() * 3;
  startWave();
  get('respawn').textContent = '';
  timer = 2.35;
  countdown = 0;
  if (rules.story) showEncounterCountdown();
  else show('countdown', 'WAVE ' + wave, '3');
}

function updateEndless(dt) {
  const humans = players.slice(0, humanCount);
  if (humans.every(p => p.out)) {
    showResults();
    return;
  }
  updateStoryTask(dt);
  if (waveEnemies === 0 && (!storyTask || storyTask.done) && waveBreak === null) {
    if (rules.story && wave === storyChapter().encounters.length) {
      showResults(undefined,true);
      return;
    }
    if (rules.cards && wave % rules.draftEvery === 0) {
      upcomingMap = rules.story ? storyMap(wave+1) || currentMap : currentMap;
      resetCardWorld(true);
      comboProps = [];
      echoes = [];
      draftQueue = Array.from({length:humanCount}, (_, i) => i);
      nextDraft();
      return;
    }
    waveBreak = 3;
  }
  if (waveBreak !== null) {
    waveBreak -= dt;
    if (waveBreak <= 0) {
      wave++;
      humans.forEach(p => { p.saved = false; });
      resetCardWorld(true);
      comboProps = [];
      echoes = [];
      startWave();
    }
  }
  const anchor = humans.find(p => !p.out);
  const waiting = [];
  if (rules.story && storyTask && !storyTask.done) {
    waiting.push(storyTask.type==='relay' ? 'Power the relay · '+Math.min(100,Math.floor(storyTask.charge*20))+'%'
      : storyTask.type==='courier' ? storyTask.carrier ? 'Carry the recorder to extraction' : 'Pick up the recorder'
      : 'Open valve '+(storyTask.step+1)+' / '+storyTask.points.length);
  }
  humans.forEach((p, i) => {
    if (!p.out) return;
    p.respawnIn = Math.max(0, p.respawnIn - dt);
    if (p.respawnIn > 0) {
      waiting.push('P' + (i + 1) + ' ↻ ' + Math.ceil(p.respawnIn) + 's');
      return;
    }
    const spawn = safeSpawn(currentMap, players.filter(other=>!other.out), anchor, obstacles);
    if (!spawn) return;
    resetPosition(p,spawn);
    p.dodgeCooldown = p.dashCooldown = p.pushCooldown = 0;
  });
  if (waveBreak !== null) waiting.unshift('Wave cleared · Next in ' + Math.ceil(waveBreak) + 's');
  const label = waiting.join('   ');
  if (get('respawn').textContent !== label) get('respawn').textContent = label;
}

function boostMovement(player, amount, duration) {
  if (!player.speedBoosts) player.speedBoosts = new Map();
  player.speedBoosts.set(amount, matchTime + duration);
  flash('marker',player.x,player.y,'#dafa74',26,.32);
}

function movementBoost(player) {
  let bonus = 0;
  for (const [amount, until] of player.speedBoosts || []) {
    if (until > matchTime) bonus = Math.max(bonus,amount);
  }
  return bonus;
}

function resetObjective() {
  const mode = rules.objective;
  objective = mode ? {
    start:matchTime, holder:Math.floor(Math.random()*humanCount), expires:matchTime+(rules.fuse || 0),
    lives:Array(humanCount).fill(rules.stocks || 0), tick:-1, zoneAt:matchTime+9,
    anchor:safeSpawn(currentMap,players,currentMap.center,obstacles) || currentMap.spawns[0],
  } : null;
  if (objective && mode === 'stocks') score = [...objective.lives];
}

function transferObjective(source,target) {
  if (!objective || source.out || matchTime < (objective.transferAt || 0)) return;
  const attacker = players.indexOf(source), defender = players.indexOf(target);
  if (rules.objective === 'crown' && defender === objective.holder) objective.holder = attacker;
  else if (rules.objective === 'fuse' && attacker === objective.holder) objective.holder = defender;
  else return;
  objective.transferAt = matchTime+.40;
  const holder = players[objective.holder];
  flash('burst',holder.x,holder.y,'#ffe694',35,.32);
}

function closingBounds() {
  const {left,right,top,bottom} = currentMap.bounds;
  const t = Math.min(1,(matchTime-objective.start)/rules.shrink);
  const x = objective.anchor.x, y = objective.anchor.y;
  const halfSize = 35 * Math.max(0,1-(matchTime-objective.start-rules.shrink)/10);
  const size = Math.min(35,halfSize);
  return {left:left+(x-size-left)*t,right:right+(x+size-right)*t,
    top:top+(y-size-top)*t,bottom:bottom+(y+size-bottom)*t};
}

function resetPosition(player,spot) {
  Object.assign(player,{...spot,vx:0,vy:0,walkX:0,walkY:0,dash:0,slide:0,dodge:0,
    frozen:0,charge:0,superCharge:0,superWindow:0,dashFinisher:false,
    pulse:0,zoneCooldown:0,hazardTime:0,comboBank:undefined,domino:undefined,sideReady:false,recallPoint:null,pushReleaseAt:undefined,fullSince:undefined,overchargeLatch:false,wasFerryRider:false,out:false,respawnGuard:matchTime+.65});
}

function respawnObjectivePlayer(player) {
  const spot = safeSpawn(currentMap,players.filter(p=>p!==player&&!p.out),currentMap.center,obstacles)
    || currentMap.spawns[0];
  resetPosition(player,spot);
}

function updateObjective(fallen,dt) {
  const mode = rules.objective;
  if (mode === 'crush') {
    const box = closingBounds();
    players.forEach((p,i) => {
      if (!p.out && (p.x<box.left || p.x>box.right || p.y<box.top || p.y>box.bottom)) fallen[i]=true;
    });
    return false;
  }
  if (mode === 'fuse') {
    if (matchTime >= objective.expires) fallen[objective.holder] = true;
    if (fallen[objective.holder]) {
      const eligible = players.map((p,i)=>i).filter(i=>!players[i].out&&!fallen[i]);
      if (eligible.length) objective.holder=eligible[Math.floor(Math.random()*eligible.length)];
      objective.expires=matchTime+rules.fuse;
      objective.transferAt=matchTime+.4;
    }
    return false;
  }
  fallen.forEach((fell,i) => {
    if (!fell) return;
    matchStats[i].falls++;
    rumble(players[i],240,.72);
    if (mode === 'stocks') {
      score[i] = --objective.lives[i];
      if (!score[i]) {players[i].out=true;return;}
    }
    respawnObjectivePlayer(players[i]);
    if (mode==='crown' && objective.holder===i) {
      const others = players.map((_,index)=>index).filter(index=>index!==i&&!fallen[index]);
      if (others.length) objective.holder=others[Math.floor(Math.random()*others.length)];
      objective.transferAt=matchTime+.65;
    }
  });
  if (mode==='stocks') {
    const survivors=players.map((p,i)=>i).filter(i=>!players[i].out);
    if (survivors.length<=1) {
      if (survivors.length) {scoreboard();showResults(survivors[0]);}
      else begin();
      return true;
    }
  } else {
    if (mode==='hill' && matchTime>=objective.zoneAt) {
      objective.anchor=safeSpawn(currentMap,[objective.anchor],currentMap.center,obstacles) || objective.anchor;
      objective.zoneAt=matchTime+9;
      flash('marker',objective.anchor.x,objective.anchor.y,'#b8f691',56,.65);
    }
    const occupants=mode==='hill' ? players.map((p,i)=>i).filter(i=>
      !fallen[i] && Math.hypot(players[i].x-objective.anchor.x,players[i].y-objective.anchor.y)<56) : fallen[objective.holder] ? [] : [objective.holder];
    if (occupants.length===1) {
      const i=occupants[0];
      score[i]+=dt;
      if (score[i]>=rules.goal) {score[i]=rules.goal;scoreboard();showResults(i);return true;}
    }
  }
  const tick=Math.floor(matchTime*2);
  if (tick!==objective.tick) {objective.tick=tick;scoreboard();}
  return true;
}

function drawObjective() {
  if (!objective) return;
  ctx.save();
  ctx.lineWidth=3;
  if (rules.objective==='hill') {
    const {x,y}=objective.anchor;
    ctx.fillStyle='#b8f69128';
    ctx.strokeStyle='#b8f691';
    ctx.beginPath();ctx.arc(x,y,56,0,Math.PI*2);ctx.fill();ctx.stroke();
  } else if (rules.objective==='crush') {
    const b=closingBounds();
    ctx.strokeStyle='#ff835f';
    ctx.setLineDash([8,6]);
    ctx.strokeRect(b.left,b.top,b.right-b.left,b.bottom-b.top);
  } else if (rules.objective==='crown' || rules.objective==='fuse') {
    const p=players[objective.holder];
    if (p && !p.out) {
      ctx.font='bold 18px sans-serif';ctx.textAlign='center';
      ctx.fillStyle='#fff1ac';ctx.strokeStyle='#111823';
      const label=rules.objective==='crown' ? '♛' : '● '+Math.max(0,Math.ceil(objective.expires-matchTime))+'s';
      ctx.strokeText(label,p.x,p.y-27);ctx.fillText(label,p.x,p.y-27);
    }
  }
  ctx.restore();
}

function move(inputs, dt) {
  matchTime += dt;
  windTime += dt;
  carryFerries(dt);
  if (rules.terrain) updateArena(dt);
  if (endless) inputs.push(...players.slice(humanCount).map(cpu => cpuInput(cpu, dt)));
  updateCardWorld(dt);
  const attacks = [];
  players.forEach((p, i) => {
    let input = inputs[i];
    if (p.out) {
      updateGhost(p,input);
      return;
    }
    cardTerrain(p,input);
    const aimX=input.aimX ?? input.x, aimY=input.aimY ?? input.y;
    const magnitude = Math.hypot(aimX,aimY);
    if (magnitude>.04 && !p.puppetControl) {
      p.fx=aimX/magnitude;
      p.fy=aimY/magnitude;
    }
    input = inputs[i] = buildControl(p,input,dt);
    if (input.emote && matchTime >= (p.emoteReady || 0)) {
      p.emoteUntil = matchTime + emoteDuration;
      p.emoteReady = matchTime + 2;
      if (p.recallPoint) {
        const spot = p.recallPoint;
        p.recallPoint = null;
        const blocked = obstacles.some(w=>spot.x+half>w.x && spot.x-half<w.x+w.w &&
          spot.y+half>w.y && spot.y-half<w.y+w.h);
        if (!blocked && clearComboLanding(spot,p)) {
          flash('trail',p.x,p.y,'#d6b8ff',26,.32,spot.x,spot.y);
          const sideReady = p.sideReady;
          resetPosition(p,spot);
          p.sideReady = sideReady;
        }
      }
      cardOnEmote(p);
      fireCombo(p,'emote');
      if (matchStats[i]) matchStats[i].emotes++;
    }
    if (input.inputLost) {
      p.charge = 0;
      p.fullSince = undefined;
      p.pushReleaseAt = undefined;
    }
    p.slide = Math.max(0, p.slide - dt);
    p.frozen = Math.max(0, (p.frozen || 0) - dt);
    p.dodge = Math.max(0, (p.dodge || 0) - dt);
    p.dodgeCooldown = Math.max(0, (p.dodgeCooldown || 0) - dt);
    p.dashCooldown -= dt;
    p.superWindow = Math.max(0, (p.superWindow || 0) - dt);
    p.pushCooldown -= dt;
    p.pulse -= dt;
    if ((p.slide > 0 && !p.stats.cleanShoes) || p.frozen > 0 || p.dodge > 0) {
      p.superCharge = 0;
      return;
    }
    if (rules.dodge && input.dodge && p.dodgeCooldown === 0 && p.dash <= 0 && p.slide <= 0) {
      cardOnDodge(p);
      if (rules.divergence || rules.kinetic) {p.vx*=.61;p.vy*=.61;}

      p.dodge = dodgeDuration;
      fireCombo(p,'dodge');
      if (p.stats.slipCharge) p.slipReady = true;
      if (p.stats.breather) p.dashCooldown = Math.max(0,p.dashCooldown-.3);
      p.dodgeReload = dodgeCooldown * (1 - Math.min(.55, p.stats.dodgeRate || 0));
      p.dodgeCooldown = p.dodgeReload;
      p.charge = 0;
      p.walkX = p.walkY = 0;
      flash('marker', p.x, p.y, '#7eeaff', 26, dodgeDuration);
      return;
    }
    const jammed = cardObjects.some(object=>object.kind==='jammer' && activeCardObject(object) && nearPoint(p,object,object.radius));
    if (jammed && p.superCharge>0) p.superCharge=0;
    if (rules.superDash && !jammed && p.slide<=0 && input.dash && p.superWindow > 0) {
      p.superWindow = 0;
      p.superCharge = superWindup;
    }
    let superDash = false;
    if (p.superCharge > 0) {
      if (input.dashHeld && p.frozen <= 0 && p.slide <= 0) {
        p.superCharge -= dt;
        superDash = p.superCharge <= 0;
      } else p.superCharge = 0;
    }
    if (jammed && p.dash>.12) {
      p.dash=.12;
      p.dashSpeed=315;
      p.jamHop=true;
    }
    if (p.slide<=0 && (superDash || (input.dash && p.dashCooldown <= 0 && !(p.superCharge > 0)))) {
      p.superWindow = superDash || i >= humanCount || jammed ? 0 : .24;
      rumble(p, superDash ? 120 : 45, superDash ? .46 : .16);
      p.dashSpeed = (superDash ? 910 : 610) * (1+(p.comboBank?.dashSpeed || 0));
      if (p.comboBank) p.comboBank.dashSpeed = 0;
      fireCombo(p,'dash');
      p.dashFinisher = true;
      p.dashOrigin = {x:p.x,y:p.y};
      if (p.stats.tailwind) boostMovement(p,.24,3);
      if (p.stats.quickSet) p.quickSetUntil = matchTime + 1.6;

      p.dash = (superDash ? .40 * (1 + (p.stats.superDuration || 0)) : .16) * (1 + (p.stats.duration || 0));
      const spring = p.springReady;
      p.springReady = false;
      p.dashReload = superDash ? 2.65 * (1 - Math.min(.65, p.stats.superRate || 0)) : .88;
      p.dashCooldown = p.dashReload * (1 - Math.min(.65, p.stats.dashRate || 0));
      p.dx = p.fx;
      p.dy = p.fy;
      if (superDash) flash('trail', p.x, p.y, '#fff29e', 30, .32, p.x + p.dx*85, p.y + p.dy*85);
      if (jammed) {
        p.jamHop = true;
        p.dashSpeed = 315;
        p.dash = .12;
        p.superWindow = 0;
        flash('burst',p.x,p.y,'#e4acff',31,.30);
      }
      if (p.stats.blink && !superDash && !jammed) {
        p.dashSpeed = 0;
        const x = p.x;
        const y = p.y;
        const {bounds} = currentMap;
        const destinationX = Math.max(bounds.left + 20, Math.min(bounds.right - 20, p.x + p.dx * (110 * (spring ? 1.5 : 1))));
        const destinationY = Math.max(bounds.top + 20, Math.min(bounds.bottom - 20, p.y + p.dy * (110 * (spring ? 1.5 : 1))));
        const steps = 22;
        for (let step = 1; step <= steps; step++) {
          const nx = x + (destinationX - x) * step / steps;
          const ny = y + (destinationY - y) * step / steps;
          if (!onPlatform(nx,ny,p)) break;
          moveAxis(p, 'x', nx - p.x);
          moveAxis(p, 'y', ny - p.y);
          if (p.x !== nx || p.y !== ny) break;
        }
        p.dash = .035;
        flash('trail', x, y, '#dca8ff', 25, .28, p.x, p.y);
      } else if (!jammed) p.dash *= (spring ? 1.5 : 1);
      if (!jammed) cardDashStart(p,superDash);
      buildDash(p);
      if (rules.kinetic) kineticHooks(p,'dash');
    }
    const maxCharge=rules.kinetic ? kineticChargeTime : chargeMax;
    if (rules.kinetic && input.charging && p.charge===0 && p.pushCooldown<=0) kineticSound('charge',.62);
    const dashBusy = input.dash || p.dash > 0 || p.superCharge > 0;
    if (input.charging || dashBusy) p.pushReleaseAt = undefined;
    else if (p.charge > 0) p.pushReleaseAt ??= matchTime;
    if (!input.charging && p.charge === 0) p.overchargeLatch = false;
    // Confirm a release after dash movement and super-dash windup have ended.
    const released = p.pushReleaseAt !== undefined && matchTime - p.pushReleaseAt >= (rules.kinetic ? 0 : .05);
    if (p.charge < maxCharge) p.fullSince = undefined;
    if (input.charging && !p.overchargeLatch && p.pushCooldown <= 0) {
      if (rules.kinetic && p.charge>.12) kineticChargePull(p,dt);
      const startingCharge = p.charge === 0;
      if (startingCharge && p.comboBank?.chargeRate) {
        p.comboChargeRate = p.comboBank.chargeRate;
        p.comboBank.chargeRate = 0;
      } else if (startingCharge) p.comboChargeRate = 0;
      if (p.slipReady) {
        p.charge = Math.max(p.charge,maxCharge*.25);
        p.slipReady = false;
      }
      if (startingCharge && p.comboBank?.charge) {
        p.charge = Math.max(p.charge,maxCharge*p.comboBank.charge);
        p.comboBank.charge = 0;
      }
      const wasFull = p.charge >= maxCharge;
      p.charge = Math.min(maxCharge, p.charge + dt * (p.stats.quickDraw && p.charge<maxCharge*.57 ? 1.37 : 1) * (1+(p.comboChargeRate || 0)) * pickupFactor(p,'charge') * (1 + (p.stats.charge || 0)) * (p.quickSetUntil > matchTime ? 1.65 : 1));
      if (p.charge >= maxCharge) {
        p.fullSince ??= matchTime;
        if (!wasFull && p.stats.chargeShield) {
          p.chargeShieldUntil = matchTime + .6;
          flash('marker',p.x,p.y,'#93eaff',30,.6);
        }
        if (!rules.kinetic && matchTime-p.fullSince >= fullChargeGrace) {
          cardOvercharge(p);
          p.vx -= 680*p.fx;
          p.vy -= 680*p.fy;
          p.charge = 0;
          p.fullSince = undefined;
          p.overchargeLatch = true;
          p.pushCooldown = p.pushReload = .45;
          fireCombo(p,'overcharge');
          flash('trail',p.x,p.y,'#ffb47e',24,.32,p.x-60*p.fx,p.y-60*p.fy);
          rumble(p,85,.42);
        }
      }
    } else if (released && p.charge > 0) {
      const power = p.charge / maxCharge;
      attacks.push({ p, power, radial: Boolean(p.stats.ring && power >= .75) });
      if (p.stats.echo && power >= .85) {
        echoes.push({owner:p, x:p.x, y:p.y, delay:.34,reflectable:true});
        flash('marker', p.x, p.y, '#ffc283', 82, .34);
      }
      if (p.stats.recoil && power >= (rules.divergence ? buildCharged : .8)) {
        flash('trail', p.x, p.y, '#ff9cb7', 27, .28, p.x - 45 * p.fx, p.y - 45 * p.fy);
        p.vx -= 285 * p.fx;
        p.vy -= 285 * p.fy;
      }
      p.charge = 0;
      p.fullSince = undefined;
      p.pushReload = (.20 + .36*pushCurve(power)) * (1 - Math.min(.65, p.stats.pushRate || 0));
      p.pushCooldown = p.pushReload;
    }
  });
  updateEffects(dt);
  if (attacks.length) resolvePushes(attacks);
  const blend = terrainBlend();
  const terrain = arenas[arena];
  const incoming = arenas[nextArena];
  const mix = (from, to) => from + (to - from) * blend;
  const drag = mix(terrain.drag, incoming.drag);
  const dashMultiplier = mix(terrain.dash, incoming.dash);
  const movementMultiplier = mix(terrain.speed, incoming.speed);
  players.forEach((p, i) => {
    if (p.out) return;
    const { x, y } = inputs[i];
    const zone = rules.hazards && currentMap.zoneAt(p.x,p.y);
    const speed = (p.slowUntil > matchTime ? 1-p.slowStrength : 1) * pickupFactor(p,'speed') * (zone?.[4] === 'tar' ? .44 : 1) * (p.superCharge > 0 ? 80 : p.charge ? 165 : 225) * (1 + Math.min(.85, (p.stats.speed || 0) + movementBoost(p)));
    const surfaceGrip = surface => p.stats.treads && surface.name === 'Ice' ? .80 : surface.grip;
    const grip = (p.iceSlideUntil > matchTime ? .18 : p.hitSlideUntil > matchTime ? .34 : 1) *
      mix(surfaceGrip(terrain), surfaceGrip(incoming));
    const steering = 1 - Math.exp(-(rules.kinetic ? 46 : 38) * grip * dt * (p.stats.lowCenter?.68:1));
    const locked = p.slide > 0 || p.frozen > 0 || p.dodge > 0;
    const moveSpeed=rules.kinetic && kineticHas(p,'weight') ? speed*.86 : speed;
    p.walkX = locked ? 0 : (p.walkX || 0) + (x * moveSpeed * movementMultiplier - (p.walkX || 0)) * steering;
    p.walkY = locked ? 0 : (p.walkY || 0) + (y * moveSpeed * movementMultiplier - (p.walkY || 0)) * steering;
    const dashSpeed = (p.dashSpeed ?? 610) * dashMultiplier;
    const dashing = p.dash > 0;
    const controlX = dashing ? p.dx * dashSpeed : p.walkX;
    const controlY = dashing ? p.dy * dashSpeed : p.walkY;
    const impact = velocity => Math.max(0, (Math.abs(velocity) - 320) / 270);
    const wind = rules.hazards && !ferryProtected(p) && currentMap.windAt(p.x,p.y);
    const counterSteer = wind ? Math.max(0, -(x * wind[4] + y * wind[5])) : 0;
    if (wind && p.stats.windGuard && inputs[i].charging) p.windStored = wind;
    const gust = wind && !dashing ? windDrift(wind, p.x, p.y, windTime, p.stats.windGuard && inputs[i].charging) *
      (1 - Math.min(1, counterSteer * 2)) : 0;
    const driftX = (wind?.[4] || 0) * gust;
    const driftY = (wind?.[5] || 0) * gust;
    const xVelocity = controlX + p.vx;
    const yVelocity = controlY + p.vy;
    moveAxis(p, 'x', (xVelocity + driftX) * dt, impact(xVelocity));
    const remainingY = dashing && p.dash <= 0 ? p.vy : yVelocity;
    moveAxis(p, 'y', (remainingY + driftY) * dt, impact(remainingY));
    p.dash -= dt;
    if (p.buildSlide>matchTime && Math.hypot(x,y)>.15) {
      const speed=buildSpeed(p);
      const turn=(p.stats.cornering?3.8:2.1)*dt/(1+speed/560);
      p.vx+=((x*speed)-p.vx)*turn;
      p.vy+=((y*speed)-p.vy)*turn;
    }
    const friction = Math.exp(-(p.buildSlide>matchTime ? 1 : p.slide > 0 ? .8 : p.iceSlideUntil > matchTime ? 2 : drag) * dt);
    p.vx *= friction;
    p.vy *= friction;
  });
  players.forEach((p, i) => {
    if (p.out) return;
    for (const other of players.slice(i + 1)) if (!other.out) collide(p, other);
  });
  for (const p of players) {
    if (p.dashFinisher && !onPlatform(p.x,p.y,p) && p.stats.pocketLedge && !p.ledgeUsed && rimAt(p,180)) p.airLedge = true;
    if (p.dash <= 0) {
      finishDash(p);
      p.airLedge = false;
    }
  }
  if (rules.bananas) updatePeel(dt);
  updateBuildWorld(dt);
  if (rules.kinetic) {
    for(const p of players) if(!p.out) kineticSurface(p,dt);
    kineticUpdate(dt);
    if(matchTime-kineticStarted>=kineticRoundLimit) {
      const center=currentMap.buildCenter || currentMap.center;
      const distance=p=>Math.hypot(p.x-center.x,p.y-center.y);
      const alive=players.filter(p=>!p.out && onPlatform(p.x,p.y,p)).sort((a,b)=>distance(a)-distance(b));
      const nearest=alive[0];
      finishRound(!nearest || (alive[1] && Math.abs(distance(nearest)-distance(alive[1]))<.5) ? -1 : players.indexOf(nearest),true);
      return;
    }
    for(const p of players) {
      if(p.out || p.kinSaved || !kineticHas(p,'rescue') || Math.hypot(p.vx,p.vy)<430 || !rimAt(p,32)) continue;
      p.kinSaved=true;p.vx*=.25;p.vy*=.25;
      const rim=rimAt(p,32);
      p.vx-=rim.dx*190;p.vy-=rim.dy*190;
      p.kinStored=Math.max(p.kinStored || 0,560);
      flash('burst',p.x,p.y,p.color,104,.38);
    }
  }
  if (rules.divergence && matchTime-buildStartedAt>=59) {
    const left=players.filter(p=>!p.out);
    const center=currentMap.buildCenter || currentMap.center;
    left.sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y));
    finishRound(players.indexOf(left[0]),true);
    return;
  }
  const fallen = players.map(p => !p.out && !p.airLedge && !(p.airUntil>matchTime) && (!onPlatform(p.x,p.y,p) || buildFall(p)));
  for (const p of players) {
    if (!rules.hazards || p.out || !currentMap.hazardous(p.x,p.y)) continue;
    p.hazardTime = (p.hazardTime || 0) - dt;
    if (p.hazardTime > 0) continue;
    const angle = Math.atan2(p.y - currentMap.center.y,p.x - currentMap.center.x);
    p.vx += Math.cos(angle) * 360;
    p.vy += Math.sin(angle) * 360;
    p.hazardTime = .85;
    flash('burst', p.x, p.y, '#ffa264', 32, .3);
  }
  for (const p of players) {
    if (!currentMap.hazardous(p.x,p.y)) p.hazardTime = 0;
    p.zoneCooldown = Math.max(0,(p.zoneCooldown || 0)-dt);
    const zone = rules.hazards && !p.out && currentMap.zoneAt(p.x,p.y);
    if (!zone || p.zoneCooldown > 0) continue;
    if (zone[4] === 'spring') {
      const angle = Math.atan2(p.y-zone[1]-zone[3]/2,p.x-zone[0]-zone[2]/2);
      p.vx += 540*Math.cos(angle);
      p.vy += 540*Math.sin(angle);
      p.zoneCooldown = 1;
      flash('burst',p.x,p.y,'#aeeb85',32,.32);
    } else if (zone[4] === 'shock' && shockActive(windTime)) {
      p.frozen = Math.max(p.frozen || 0,.65);
      p.dash = p.charge = 0;
      p.zoneCooldown = 1.8;
      flash('burst',p.x,p.y,'#d8a5ff',30,.34);
    }
  }
  fallen.forEach((fell, i) => {
    const p = players[i];
    if (!fell || !p.stats.save || p.saved) return;
    const recovery = safeSpawn(currentMap, players.filter(other=>other!==p&&!other.out), p, obstacles, p.radius || half);
    if (!recovery) return;
    flash('burst', p.x, p.y, '#a4ffb9', 42, .38);
    resetPosition(p,recovery);
    p.saved = true;
    p.slide = .35;
    flash('burst', p.x, p.y, '#a4ffb9', 36, .45);
    fallen[i] = false;
  });
  if (objective && updateObjective(fallen,dt)) return;
  if(rules.kinetic && fallen.some(Boolean)) {
    kineticSound('out');
    fallen.forEach((fell,i)=>{
      if(!fell) return;
      const p=players[i], launch=p.kinLaunch;
      flash('burst',p.x,p.y,p.color,48,.32);
      if(launch?.until>matchTime) flash('trail',p.x,p.y,launch.owner.color,28,.28,p.x-p.vx*.055,p.y-p.vy*.055);
    });
  }
  fallen.forEach((fell, i) => { if (fell && matchStats[i]) { matchStats[i].falls++; rumble(players[i], 240, .72); } });
  if (endless) {
    fallen.forEach((fell, i) => {
      if (!fell) return;
      clearCardFighter(players[i]);
      players[i].out = true;
      players[i].respawnIn = respawnDelay;
      if (i >= humanCount) {
        knockouts++;
        waveEnemies--;
      }
    });
    if (fallen.some(Boolean)) scoreboard();
    updateEndless(dt);
  } else if (fallen.some(Boolean) || roundPending) {
    fallen.forEach((fell, i) => {
      if (!fell) return;
      players[i].out = true;
      if (!objective) markLastWord(players[i]);
      clearCardFighter(players[i]);
    });
    roundPending = cardRoundPending();
    if (roundPending) return;
    const survivors = players.filter(p => !p.out);
    if (rules.teams) {
      const teams = new Set(survivors.map(p=>p.team));
      if (teams.size <= 1) finishTeamRound(survivors[0]?.team);
    } else if (survivors.length <= 1) finishRound(players.indexOf(survivors[0]));
  }
}

function collide(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const combined = (a.radius || half) + (b.radius || half);
  const overlapX = combined - Math.abs(dx);
  const overlapY = combined - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0 || ferryProtected(a) || ferryProtected(b)) return;
  buildContact(a,b);
  buildContact(b,a);
  cardOnCollision(a,b);
  cardOnCollision(b,a);
  if (friendly(a,b)) return;
  const axis = overlapX < overlapY ? 'x' : 'y';
  const sign = Math.sign(axis === 'x' ? dx : dy) || 1;
  const separation = Math.min(overlapX, overlapY) * sign / 2;
  const startA = a[axis];
  const startB = b[axis];
  moveAxis(a, axis, -separation);
  moveAxis(b, axis, separation);
  const remainder = 2 * separation - ((b[axis] - startB) - (a[axis] - startA));
  if (a[axis] === startA - separation) moveAxis(a, axis, -remainder);
  else moveAxis(b, axis, remainder);
  const aHits = a.dash > 0 && a['d' + axis] * sign > .1;
  const bHits = b.dash > 0 && b['d' + axis] * sign < -.1;
  if (aHits) a.buildDashContact=true;
  if (bHits) b.buildDashContact=true;
  if (aHits && !a.jamHop) dashHit(a, b, axis, sign);
  if (bHits && !b.jamHop) dashHit(b, a, axis, -sign);
}

function dashHit(attacker, target, axis, direction) {
  if (friendly(attacker,target) || target.respawnGuard > matchTime) return;
  const stats = matchStats[players.indexOf(attacker)];
  if (stats) stats.dashes++;
  fireCombo(attacker,'dashHit',target);
  if (attacker.stats.partingShot || attacker.stats.comboEngine) attacker.comboUntil = matchTime + 3;
  target['v' + axis] += direction * (attacker.stats.freeze ? 275 : 420) * (1 + (attacker.stats.dashForce || 0))
    * (1 - Math.min(.65, target.stats.guard || 0));
  if (attacker.stats.freeze) {
    target.iceSlideUntil = matchTime+.8;
    flash('burst', target.x, target.y, '#a5edff', 38, .4);
  }
  attacker.dash = 0;
}

const awards = [
  ['Marksman', s => s.attempts >= 5 && s.accuracy >= .7, s => `${s.percent}% push accuracy. The targeting department can take the day off.`, s => 1 + s.accuracy + Math.min(1, s.landed / 12)],
  ['No Eyes', s => s.attempts >= 5 && s.accuracy <= .25, s => `Landed ${s.landed} of ${s.attempts} pushes. The air took a beating.`, s => 1 + (1-s.accuracy) + Math.min(1, s.attempts / 14)],
  ['Dash Ace', s => s.dashes >= 3 && s.dashes > s.pushes, s => `${s.dashes} dash hits. Walking was apparently optional.`, s => 1.35 + Math.min(1.5, s.dashes / 8)],
  ['Frequent Flyer', s => s.falls >= 3, s => `${s.falls} falls. Your next trip off the map earns miles.`, s => 1.2 + Math.min(1.2, s.falls / 6)],
  ['Heavy Hitter', s => s.pushes >= 5, s => `${s.pushes} push hits. Personal space has filed a complaint.`, s => 1.25 + Math.min(1.5, s.pushes / 15)],
  ['Crowd Control', s => s.pushes > s.landed, s => `${s.pushes} hits across ${s.landed} landed pushes. Group discounts apply.`, s => 1.05 + Math.min(1.55, (s.pushes-s.landed) / 6)],
  ['Cliff Inspector', s => s.falls >= 2, s => `${s.falls} falls. The ledge has been thoroughly inspected from below.`, s => .85 + Math.min(.9, s.falls / 6)],
  ['Air Guitar', s => s.attempts >= 2 && s.landed === 0, s => `${s.attempts} pushes and zero hits. Great technique, wrong instrument.`, s => .85 + Math.min(1.1, s.attempts / 8)],
  ['Human Bumper', s => s.dashes >= 2, s => `${s.dashes} dash hits. The arena should put you on its insurance policy.`, s => .85 + Math.min(1, s.dashes / 8)],
  ['Push Enthusiast', s => s.attempts >= 8, s => `${s.attempts} pushes thrown. The button may need a union.`, s => .95 + Math.min(1.25, s.attempts / 18)],
  ['On the Board', s => s.wins > 0, s => `${s.wins} round wins. You made the scoreboard do something.`, s => 1 + Math.min(1.2, s.wins / 4)],
  ['Edge Whisperer', s => s.falls === 0, () => 'Zero falls. Whatever you told the ledge, it worked.', () => .95],
  ['One Good Shove', s => s.landed === 1, () => 'One push connected. That opponent will remember it.', () => .7],
  ['Drive-By', s => s.dashes === 1, () => 'One dash hit. You made your point on the way past.', () => .7],
  ['Close Enough', s => s.attempts > s.landed, s => `${s.attempts - s.landed} missed pushes. The replay can be cropped.`, s => .65 + Math.min(.8, (s.attempts-s.landed) / 12)],
  ['Gravity Tester', s => s.falls > 0, s => `${s.falls} falls. Gravity passed its field test.`, () => .65],
  ['Efficient Menace', s => s.landed > 0, s => `${s.landed} pushes connected. You kept the paperwork brief.`, s => .65 + Math.min(.9, s.landed / 12)],
  ['Light Touch', s => s.attempts === 0, () => 'Zero pushes thrown. The push button sends its regards.', () => .55],
  ['The Clown', s => s.emotes >= 4 && s.emotes === s.mostEmotes, s => `${s.emotes} emotes. The arena was apparently an open mic.`, s => 1 + Math.min(2, s.emotes / 5)],
];

function assignAwards(order) {
  const mostEmotes = order.reduce((max,i) => Math.max(max,matchStats[i].emotes || 0),0);
  const candidates = order.flatMap(i => {
    const stats = matchStats[i];
    const accuracy = stats.landed / Math.max(1, stats.attempts);
    const wins = endless || ['stocks','hill','crown'].includes(rules.objective) ? 0 : rules.teams ? teamScore[i%2] : score[i];
    const record = {...stats, accuracy, percent:Math.round(100*accuracy), wins, mostEmotes};
    return awards.filter(([, qualifies]) => qualifies(record)).map(([name,,describe,fit]) =>
      ({i,name,describe,record,strength:fit(record)}));
  });
  candidates.sort((a,b) => b.strength-a.strength);
  const used = new Set();
  const result = new Map();
  for (const {i,name,describe,record} of candidates) {
    if (used.has(name) || result.has(i)) continue;
    used.add(name);
    result.set(i,{name,line:describe(record)});
  }
  for (const i of order) {
    if (result.has(i)) continue;
    const {pushes,dashes,falls} = matchStats[i];
    result.set(i,{name:'Arena Oddity #' + (i+1),
      line:`${pushes} push hits, ${dashes} dash hits, ${falls} falls. The judges want a second look at that replay.`});
  }
  return result;
}

function resultCard(i, rank, award) {
  const stats = matchStats[i];
  const accuracy = stats.attempts ? Math.round(100 * stats.landed / stats.attempts) + '%' : '—';
  const card = document.createElement('article');
  card.className = 'result-card';
  if (rank) card.dataset.rank = rank;
  card.style.setProperty('--player-color', players[i].color);
  const stage = document.createElement('div');
  stage.className = 'podium-stage';
  const figure = document.createElement('canvas');
  figure.width = figure.height = 96;
  figure.setAttribute('aria-hidden', 'true');
  drawCharacter(figure.getContext('2d'), players[i].look, 0, 0, 96);
  stage.append(figure);
  const step = document.createElement('span');
  step.className = 'podium-step';
  step.textContent = rank ? '#' + rank : 'CO-OP';
  stage.append(step);
  const name = document.createElement('strong');
  name.textContent = 'Player ' + (i + 1);
  const title = document.createElement('span');
  title.className = 'result-nickname';
  title.textContent = award.name;
  const reason = document.createElement('p');
  reason.className = 'result-reason';
  reason.textContent = award.line;
  const numbers = document.createElement('dl');
  const values = [...(endless ? [] : [[rules.teams ? 'Team wins' : objective && ['hill','crown'].includes(rules.objective) ? 'Seconds held' : rules.objective === 'stocks' ? 'Lives left' : 'Round wins', rules.teams ? teamScore[i%2] : Math.floor(score[i])]]), ['Push hits', stats.pushes],
    ['Push accuracy', accuracy], ['Dash hits', stats.dashes], ['Falls', stats.falls], ['Emotes', stats.emotes || 0]];
  for (const [label, value] of values) {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    numbers.append(term, detail);
  }
  card.append(stage, name, title, reason, numbers);
  if ((roundsMode || endless || rules.preDraft) && builds[i]?.length) {
    const cards = document.createElement('small');
    cards.className = 'result-upgrades';
    cards.textContent = builds[i].map(item => item[0]).join(' · ');
    card.append(cards);
  }
  return card;
}

function coopRecordKey() {
  return 'ringout-coop-v1:' + JSON.stringify([humanCount,rules.difficulty,rules.cards,
    rules.cards ? rules.draftEvery : 0,rules.friendlyPush,rules.walls,rules.terrain,
    rules.hazards,rules.bananas,rules.superDash,rules.dodge]);
}

function coopRecord() {
  try {
    const prefix = encodeURIComponent(coopRecordKey()) + '=';
    const value = document.cookie.split(';').map(cookie=>cookie.trim()).find(cookie=>cookie.startsWith(prefix));
    if (!value) return null;
    const match = /^(\d+)\.(\d+)$/.exec(value.slice(prefix.length));
    return match ? {wave:Number(match[1]),knockouts:Number(match[2])} : null;
  } catch { return null; }
}

function saveCoopRecord() {
  const old = coopRecord();
  if (old && (old.wave > wave || (old.wave === wave && old.knockouts >= knockouts))) return old;
  const record = {wave,knockouts};
  try {
    document.cookie = encodeURIComponent(coopRecordKey()) + '=' + wave + '.' + knockouts +
      '; Max-Age=31536000; Path=/; SameSite=Strict';
  } catch {}
  return record;
}

function finishTeamRound(team) {
  resetCardWorld();
  comboProps = [];
  echoes = [];
  if (team === undefined) {
    finishRound(-1);
    return;
  }
  teamScore[team]++;
  scoreboard();
  if (teamScore[team] >= winsNeeded()) {
    showResults(team);
  } else {
    show('round','TEAM RINGOUT',teamNames[team] + ' wins',teamScore.join(' – '),'Next round');
  }
}

function showResults(winner, chapterCleared = false) {
  const elapsed = Math.floor(matchTime);
  const duration = Math.floor(elapsed / 60) + ':' + String(elapsed % 60).padStart(2, '0');
  const rounds = (rules.teams ? teamScore : score).reduce((sum, value) => sum + value, 0);
  const record = endless && !rules.story ? saveCoopRecord() : null;
  if (rules.story && chapterCleared) {
    const progress = Math.max(storyProgress(),rules.chapter);
    try { document.cookie = 'ringout_story_v1='+progress+'; Max-Age=31536000; Path=/; SameSite=Strict'; }
    catch {}
  }
  resetCardWorld();
  comboProps = [];
  echoes = [];
  show('match', rules.story ? storyChapter().title : endless ? 'CO-OP RUN COMPLETE' : 'VERSUS MATCH COMPLETE',
    rules.story ? chapterCleared ? 'Chapter cleared' : 'Chapter failed' : endless ? knockouts + ' CPU KOs' : rules.teams ? teamNames[winner] + ' wins' : 'PLAYER ' + (winner + 1) + ' WINS',
    (rules.story ? chapterCleared ? storyChapter().ending : 'Encounter ' + wave + ' of 3 · ' + knockouts + ' KOs' : endless ? 'Wave ' + wave + ' · Best for these rules: wave ' + record.wave + ', ' + record.knockouts + ' KOs' : rules.teams ? teamScore.join(' – ') : objective ? extraModes[rules.objective].name : rounds + ' scored rounds') + ' · ' + duration + ' played',
    rules.story ? 'Replay chapter' : 'Play again');
  const order = matchStats.map((_, i) => i);
  if (rules.teams) order.sort((a,b) => Number(b%2===winner)-Number(a%2===winner) || a-b);
  else if (!endless) order.sort((a, b) => score[b] - score[a] || a - b);
  const display = !endless && !rules.teams && order.length >= 3
    ? [order[1], order[0], order[2], ...order.slice(3)] : order;
  const honors = assignAwards(order);
  const podium = document.createElement('div');
  podium.className = 'results-podium';
  for (const i of display) {
    const rank = endless ? null : rules.teams ? (i%2===winner ? 1 : 2) : 1 + order.filter(other => score[other] > score[i]).length;
    podium.append(resultCard(i, rank, honors.get(i)));
  }
  get('results').replaceChildren(podium);
  get('results').scrollTop = 0;
}

get('pauseMenu').addEventListener('click', () => {
  if (state !== 'paused') return;
  builds = [];
  kineticReset();
  buildEnd();
  resetCardWorld();
  comboProps = [];
  echoes = [];
  peel = null;
  effects = [];
  arena = nextArena = 0;
  knockouts = 0;
  wave = 1;
  waveEnemies = 0;
  setSetup(false);
  get('action').focus();
});

function canStart(options) {
  const count = state === 'match' ? slots.filter(slot => slot < 0 || connectedPads.has(slot)).length : slots.length;
  return count >= minimumPlayers(options);
}

function updateResultsLock() {
  const remaining = Math.max(0, Math.ceil((transitionTime - performance.now()) / 1000));
  get('action').disabled = remaining > 0 || !canStart(rules);
  get('resultsLobby').disabled = remaining > 0;
  const label = remaining ? 'Continue in ' + remaining + 's'
    : 'Stick / D-pad to browse · A / × to select';
  if (get('shortcut').textContent !== label) get('shortcut').textContent = label;
}

get('resultsLobby').addEventListener('click', () => {
  if (state === 'match' && performance.now() >= transitionTime) setSetup(false);
});

function finishRound(winner, tiebreak = false) {
  roundPending = false;
  ghostImpactUntil = 0;
  resetCardWorld();
  comboProps = [];
  echoes = [];
  buildEnd();
  if (winner === -1) {
    if(rules.kinetic) kineticReset();
    if (rules.divergence && matchTime-buildStartedAt>=59) {
      show('round','TIME LIMIT','DRAW · TIEBREAK','Next fight uses the other arena.','Replay fight');
      upcomingMap=buildArenas.find(map=>map!==currentMap);
      upcomingWalls=buildArenaWalls(upcomingMap,humanCount);
      return;
    }
    show('round', 'SIMULTANEOUS RINGOUT', 'DRAW', 'Replay this round.', 'Replay round');
    return;
  }
  const round = (rules.teams ? teamScore : score).reduce((sum, value) => sum + value, 0) + 1;
  if (tiebreak && matchStats[winner]) matchStats[winner].tiebreaks=(matchStats[winner].tiebreaks || 0)+1;
  score[winner]++;
  scoreboard();
  get('round').textContent = 'ROUND ' + round;
  if (rules.divergence) buildFight++;
  const match = rules.kinetic ? score[winner]>=winsNeeded() && score.every((v,i)=>i===winner || v<score[winner]) : rules.divergence
    ? buildFight>=rules.minFights && score[winner]>=winsNeeded() && score.every((value,i)=>i===winner || value<score[winner])
    : score[winner]===winsNeeded();
  if (rules.divergence && !match && buildFight<rules.minFights) {
    prepareArena();
    draftQueue = Array.from({length:humanCount},(_,i)=>i).sort((a,b)=>Number(a===winner)-Number(b===winner) || score[a]-score[b]);
    nextDraft();
    if (tiebreak) get('subtitle').textContent='Tiebreak awarded to the fighter closest to center. '+get('subtitle').textContent;
    return;
  }
  if (rules.kinetic && !match) {kineticReset();startKineticDraft(winner,tiebreak);return;}
  if (roundsMode && !rules.divergence && !match) {
    prepareArena();
    draftQueue = players.map((_, i) => i).filter(i => i !== winner);
    nextDraft();
    return;
  }
  if (match) {
    if (rules.kinetic) kineticReset();
    showResults(winner);
    return;
  }
  show('round', tiebreak ? 'TIEBREAK · CLOSEST TO CENTER' : 'RINGOUT',
    'PLAYER ' + (winner + 1) + ' WINS', humanCount === 2 ? 'Score ' + score.join(' – ') : 'Player ' + (winner + 1) + ' · ' + score[winner] + ' of ' + winsNeeded() + ' wins', 'Next round');
}

const reduceCountdownMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

function spawnDrop(index) {
  if (state !== 'countdown' || index >= humanCount || reduceCountdownMotion?.matches) return 0;
  const elapsed = 2.35 - timer;
  const t = Math.max(0, Math.min(1, (elapsed - (index % 6)*.065)/.62));
  return (1 - t*t)*48 + Math.sin(Math.PI * Math.max(0,(t-.78)/.22))*5;
}

function drawSpawnMarkers() {
  const {center, zoom} = currentMap;
  const time = reduceCountdownMotion?.matches ? .32 : 2.35 - timer;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px monospace';
  players.slice(0,humanCount).forEach((player,i) => {
    if (player.out) return;
    const x = 500 + (player.x-center.x)*zoom;
    const y = 240 + (player.y-center.y)*zoom;
    const phase = (time*1.2 + i*.19) % 1;
    const drop = spawnDrop(i);
    const radius = Math.max(14,half*zoom + 7);
    ctx.save();
    ctx.translate(x,y);
    if (drop > 1) {
      ctx.globalAlpha = .65;
      ctx.strokeStyle = player.color;
      ctx.setLineDash([3,4]);
      ctx.beginPath();
      ctx.moveTo(0,-drop*zoom);
      ctx.lineTo(0,0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = ctx.fillStyle = player.color;
    ctx.lineWidth = 2;
    switch (i % 4) {
      case 0:
        ctx.globalAlpha = 1 - phase*.7;
        ctx.beginPath();
        ctx.arc(0,0,radius+phase*13,0,Math.PI*2);
        ctx.stroke();
        break;
      case 1:
        ctx.rotate(time*2.4);
        for (let point=0;point<4;point++) {
          ctx.rotate(Math.PI/2);
          ctx.fillRect(radius+4,-2,5,5);
        }
        break;
      case 2:
        for (const side of [-1,1]) {
          const offset = radius+4+Math.sin(time*7)*4;
          ctx.beginPath();
          ctx.moveTo(side*(offset+6),-6);
          ctx.lineTo(side*offset,0);
          ctx.lineTo(side*(offset+6),6);
          ctx.stroke();
        }
        break;
      default:
        for (let ray=0;ray<6;ray++) {
          const angle = ray*Math.PI/3 + time*.8;
          const inner = radius+phase*7;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);
          ctx.lineTo(Math.cos(angle)*(inner+6),Math.sin(angle)*(inner+6));
          ctx.stroke();
        }
    }
    ctx.restore();
    const bob = Math.sin(time*6+i)*3;
    const labelY = y-radius-12+bob-drop*zoom;
    const label = 'P'+(i+1);
    const width = ctx.measureText(label).width+14;
    ctx.fillStyle = '#111a29';
    ctx.fillRect(x-width/2,labelY-11,width,17);
    ctx.fillStyle = player.color;
    ctx.fillText(label,x,labelY+1);
    ctx.beginPath();
    ctx.moveTo(x-4,labelY+6);
    ctx.lineTo(x+4,labelY+6);
    ctx.lineTo(x,labelY+12);
    ctx.fill();
  });
  ctx.restore();
}

const pickupSprites = new Image();
pickupSprites.src = 'pickups.svg';
const floorSprites = new Image();
floorSprites.src = 'floor-sprites.svg';
const floorTileSize = 72;
const floorFrameCount = 8;
const floorPatterns = new Map();
const zoneFloor = {
  tar: {row:5, color:'#4b315e', ink:'#ddaaf2', label:'TAR', period:2.7},
  spring: {row:6, color:'#315843', ink:'#c1f892', label:'SPRING', period:1.15},
  shock: {row:7, color:'#57316b', ink:'#e7b1ff', label:'SHOCK'},
};
const floorPeriods = [0,1.35,1.7,3.1,.8];

function floorFrame(period, time, reduceMotion) {
  if (reduceMotion || !period) return 0;
  return Math.floor((time % period) / period * floorFrameCount);
}

function paintFloor(row, frame, color, x, y, w, h) {
  const key = row*floorFrameCount+frame;
  if (!floorPatterns.has(key) && floorSprites.complete && floorSprites.naturalWidth) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = floorTileSize;
    tile.getContext('2d').drawImage(floorSprites,frame*floorTileSize,row*floorTileSize,
      floorTileSize,floorTileSize,0,0,floorTileSize,floorTileSize);
    floorPatterns.set(key,ctx.createPattern(tile,'repeat'));
  }
  ctx.fillStyle = floorPatterns.get(key) || color;
  ctx.fillRect(x,y,w,h);
}

function shockActive(time) {
  return Math.sin(time*2.4) > .68;
}

function draw() {
  ctx.fillStyle = '#10151e';
  ctx.fillRect(0, 0, 1000, 480);
  ctx.fillStyle = '#313a4a';
  for (let x = 20; x < 1000; x += 24) {
    for (let y = 20; y < 480; y += 24) ctx.fillRect(x, y, 1.5, 1.5);
  }
  const {center, zoom, bounds, width: mapWidth} = currentMap;
  ctx.save();
  ctx.translate(500+(rules.kinetic && !reduceCountdownMotion?.matches ? Math.sin(matchTime*112)*kineticShake : 0),240);
  ctx.scale(zoom,zoom);
  ctx.translate(-center.x,-center.y);
  for (const [x,y,w,h] of currentMap.cells) {
    ctx.fillStyle = '#101722';
    ctx.fillRect(x,y+7,w,h);
  }
  const blend = terrainBlend();
  const reduceMotion = reduceCountdownMotion?.matches;
  const currentFrame = floorFrame(floorPeriods[arena],windTime,reduceMotion);
  const incomingFrame = floorFrame(floorPeriods[nextArena],windTime,reduceMotion);
  for (const [x,y,w,h] of currentMap.cells) {
    paintFloor(arena,currentFrame,arenas[arena].color,x,y,w,h);
    const reveal = Math.min(w,Math.max(0,bounds.left+mapWidth*blend-x));
    if (blend > 0 && reveal > 0) paintFloor(nextArena,incomingFrame,arenas[nextArena].color,x,y,reveal,h);
  }
  ctx.strokeStyle = '#8394a7';
  ctx.lineWidth = 1;
  for (const edge of currentMap.edges) {
    ctx.beginPath();
    ctx.moveTo(edge.x,edge.y);
    ctx.lineTo(edge.x+(edge.across?edge.length:0),edge.y+(edge.across?0:edge.length));
    ctx.stroke();
  }
  for (const [x,y,w,h] of currentMap.ferryRects(platformTime)) {
    ctx.fillStyle = '#405668';
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle = '#a9e8ef';
    ctx.strokeRect(x,y,w,h);
    ctx.fillStyle = '#bde9ed';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PROTECTED FERRY',x+w/2,y+h/2);
  }
  for (const [x,y,w,h,kind] of (rules.hazards ? currentMap.zones || [] : [])) {
    const {row,color,ink,label,period} = zoneFloor[kind];
    const live = kind === 'shock' && shockActive(windTime);
    paintFloor(row,floorFrame(period,windTime,reduceMotion),color,x,y,w,h);
    if (live) {
      ctx.fillStyle = '#e9baff38';
      ctx.fillRect(x,y,w,h);
    }
    ctx.strokeStyle = live ? '#ffe4ff' : ink;
    ctx.strokeRect(x,y,w,h);
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    const text = live ? 'SHOCK · LIVE' : label;
    const width = ctx.measureText(text).width+12;
    ctx.fillStyle = '#10151edb';
    ctx.fillRect(x+(w-width)/2,y+h/2-9,width,17);
    ctx.fillStyle = ink;
    ctx.fillText(text,x+w/2,y+h/2+3);
  }
  for (const [x,y,w,h,dx,dy] of (rules.hazards ? currentMap.winds || [] : [])) {
    ctx.fillStyle = '#7cd8ef1e';
    ctx.fillRect(x,y,w,h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x,y,w,h);
    ctx.clip();
    ctx.strokeStyle = '#a9ebfa';
    const strength = windDrift([x,y,w,h],x+w/2,y+h/2,windTime,false)/19;
    ctx.globalAlpha = .26 + .44 * strength;
    ctx.lineWidth = 2;
    const shift = reduceCountdownMotion?.matches ? 0 : (windTime * 28) % 36;
    for (let px=x+12;px<x+w;px+=36) for (let py=y+12;py<y+h;py+=36) {
      const ax=px+dx*shift, ay=py+dy*shift;
      ctx.beginPath();
      ctx.moveTo(ax-dx*11,ay-dy*11);
      ctx.lineTo(ax,ay);
      ctx.lineTo(ax-dx*6-dy*5,ay-dy*6+dx*5);
      ctx.moveTo(ax,ay);
      ctx.lineTo(ax-dx*6+dy*5,ay-dy*6-dx*5);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#93daeb74';
    ctx.setLineDash([5,5]);
    ctx.strokeRect(x,y,w,h);
    ctx.setLineDash([]);
  }
  for (const [x,y,w,h] of (rules.hazards ? currentMap.hazards || [] : [])) {
    ctx.fillStyle = '#9a503858';
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle = '#ffa264';
    ctx.setLineDash([6,5]);
    ctx.strokeRect(x,y,w,h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd0a3';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PULSE ZONE',x+w/2,y+h/2);
  }
  for (const wall of obstacles) {
    ctx.fillStyle = '#101722';
    ctx.fillRect(wall.x + 3, wall.y + 5, wall.w, wall.h);
    const reinforced = wall.integrity === Infinity;
    const health = reinforced ? 1 : wall.integrity / wallMaxIntegrity;
    ctx.fillStyle = reinforced ? '#49446c' : health > .75 ? '#596a7e' : health > .45 ? '#77634f' : '#775052';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.strokeStyle = reinforced ? '#d5bdff' : '#b4c5d6';
    ctx.strokeRect(wall.x + .5, wall.y + .5, wall.w - 1, wall.h - 1);
    if (reinforced) {
      ctx.strokeRect(wall.x + 3.5, wall.y + 3.5, wall.w - 7, wall.h - 7);
      ctx.fillStyle = '#e5d6ff';
      for (const x of [wall.x + 6, wall.x + wall.w - 8]) {
        for (const y of [wall.y + 6, wall.y + wall.h - 8]) ctx.fillRect(x, y, 2, 2);
      }
      continue;
    }
    const barWidth = Math.min(32, wall.w - 8);
    ctx.fillStyle = '#202936';
    ctx.fillRect(wall.x + 4, wall.y + 4, barWidth, 3);
    ctx.fillStyle = health > .75 ? '#a3e6ad' : health > .45 ? '#f7cf7c' : '#ff9993';
    ctx.fillRect(wall.x + 4, wall.y + 4, barWidth * health, 3);
    if (health < .85) {
      ctx.strokeStyle = '#222731';
      ctx.beginPath();
      ctx.moveTo(wall.x + wall.w * .42, wall.y);
      ctx.lineTo(wall.x + wall.w * .52, wall.y + wall.h * .48);
      ctx.lineTo(wall.x + wall.w * .45, wall.y + wall.h);
      if (health < .5) {
        ctx.moveTo(wall.x + wall.w * .52, wall.y + wall.h * .48);
        ctx.lineTo(wall.x + wall.w * .72, wall.y + wall.h * .68);
        ctx.lineTo(wall.x + wall.w * .76, wall.y + wall.h);
      }
      ctx.stroke();
    }
  }
  if (peel) {
    const bob = reduceCountdownMotion?.matches ? 0 : Math.sin(matchTime*4)*2.5;
    if (!peel.type) {
      ctx.font = '26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🍌', peel.x, peel.y + 9 + bob);
    } else if (pickupSprites.complete && pickupSprites.naturalWidth) {
      const frame = pickupTypes.indexOf(peel.type);
      ctx.drawImage(pickupSprites,frame*64,0,64,64,peel.x-20,peel.y-20+bob,40,40);
    } else {
      ctx.fillStyle = peel.type.color;
      ctx.beginPath();
      ctx.arc(peel.x,peel.y,12,0,Math.PI*2);
      ctx.fill();
    }
  }
  drawEffects();
  drawComboProps();
  drawCardWorld();
  if(rules.kinetic) kineticDraw();
  drawBuildWorld();
  drawObjective();
  if (rules.story) drawStoryTask();
  for (const [i, p] of players.entries()) {
    if (p.out) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.pulse > 0 && !p.pulseRadial) {
      ctx.beginPath();
      const angle = p.pulseAngle;
      const radius = 28 + (1 - p.pulse / .23) * (p.pulseRange - 28);
      const {lanes,arc} = p.pulsePattern || {lanes:[0],arc:pushCone};
      for (const lane of lanes) {
        ctx.moveTo(Math.cos(angle+lane-arc)*radius,Math.sin(angle+lane-arc)*radius);
        ctx.arc(0,0,radius,angle+lane-arc,angle+lane+arc);
      }
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = p.pulse / .23;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (p.superCharge > 0) {
      ctx.save();
      ctx.rotate(Math.atan2(p.fy,p.fx));
      ctx.strokeStyle = '#fff29e';
      ctx.lineWidth = 3;
      const tip = 39 + 25 * (1 - p.superCharge / superWindup);
      ctx.beginPath();
      ctx.moveTo(24,0);
      ctx.lineTo(tip,0);
      ctx.lineTo(tip-9,-7);
      ctx.moveTo(tip,0);
      ctx.lineTo(tip-9,7);
      ctx.stroke();
      ctx.restore();
    }
    const look = p.look || {shape:0, color:5, accessory:0};
    if (p.dash > 0) {
      ctx.globalAlpha = .28;
      drawCharacter(ctx, look, -32 - p.dx * 21, -32 - p.dy * 21, 64, false);
      ctx.globalAlpha = 1;
    }
    if (p.dodge > 0) ctx.globalAlpha = .48;
    const spriteSize = 64 * (p.radius || half) / half;
    const drop = spawnDrop(i) + (p.airUntil>matchTime ? 34*Math.sin(Math.PI*(p.airUntil-matchTime)/.70) : 0);
    if (p.emoteUntil > matchTime) {
      const progress = 1 - (p.emoteUntil-matchTime)/emoteDuration;
      drawEmote(ctx,p.stats.grin ? {...look,emote:1} : look,spriteSize,progress);
    } else drawCharacter(ctx, look, -spriteSize/2, -spriteSize/2-drop, spriteSize);
    ctx.globalAlpha = 1;
    if (p.dodgeCooldown > 0) {
      ctx.fillStyle = '#7eeaff';
      ctx.fillRect(-18, 31, 36 * (1 - p.dodgeCooldown / (p.dodgeReload || dodgeCooldown)), 2);
    }
    if (rules.teams && i < humanCount) {
      ctx.fillStyle = i%2 ? '#ff987f' : '#67e4fa';
      ctx.fillRect(-11,-24,22,3);
    }
    if (p.pickupUntil > matchTime) {
      ctx.save();
      const remaining = p.pickupUntil-matchTime;
      const text = p.pickup.label + ' ' + Math.ceil(remaining) + 's';
      ctx.font = 'bold 11px monospace';
      const width = ctx.measureText(text).width+12;
      ctx.fillStyle = '#172031';
      ctx.fillRect(-width/2,-43,width,16);
      ctx.fillStyle = p.pickup.color;
      ctx.fillText(text,0,-32);
      ctx.fillRect(-width/2,-27,width*remaining/p.pickup.seconds,2);
      ctx.restore();
    }
    if (p.cpuLabel) {
      ctx.fillStyle = '#111822';
      ctx.strokeStyle = '#ffffffa0';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px monospace';
      ctx.strokeText(p.cpuLabel, 0, 7-drop);
      ctx.fillText(p.cpuLabel, 0, 7-drop);
    }
    if (p.frozen > 0) {
      ctx.strokeStyle = '#b9f4ff';
      ctx.fillStyle = '#9aeaff55';
      ctx.beginPath();
      ctx.arc(0, 0, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#b9f4ff';
      ctx.fillRect(-20, 22, 40 * p.frozen / iceTime, 3);
    }
    if (p.charge > 0 || p.circleUntil > matchTime || p.comboBank?.circle) {
      const power = p.charge/(rules.kinetic ? kineticChargeTime : chargeMax);
      const radial = (p.stats.ring && power>=.75) || (p.stats.gravity && power>=.85) ||
        p.circleUntil>matchTime || Boolean(p.comboBank?.circle);
      const base = pushPattern(p,radial);
      const shape = rules.kinetic ? kineticPushProfile(p,power,base,66).pattern : base;
      ctx.beginPath();
      for (const lane of shape.lanes) {
        const angle=Math.atan2(p.fy,p.fx)+lane;
        ctx.moveTo(Math.cos(angle-shape.arc)*35,Math.sin(angle-shape.arc)*35);
        ctx.arc(0,0,35,angle-shape.arc,angle+shape.arc);
      }
      ctx.strokeStyle = radial ? '#ff9ee8' : '#ffd784';
      ctx.lineWidth=2;
      ctx.stroke();
    }
    if (p.charge > 0 || p.slide > 0) {
      ctx.beginPath();
      ctx.strokeStyle = p.fullSince === undefined ? '#ffdd5c' : '#ff947b';
      ctx.lineWidth = 3;
      ctx.arc(0, 0, 29, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (p.slide > 0 ? 1 : p.fullSince === undefined ? p.charge / (rules.kinetic ? kineticChargeTime : chargeMax) : rules.kinetic?1:Math.max(0,1-(matchTime-p.fullSince)/fullChargeGrace)));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.fx * 22, p.fy * 22, 3, 0, 2 * Math.PI);
    ctx.fillStyle = p.color;
    ctx.fill();
    for (const [j, fraction] of [1 - p.dashCooldown / (p.dashReload || .88), 1 - p.pushCooldown / (p.pushReload || .20)].entries()) {
      ctx.fillStyle = '#0e141d';
      ctx.fillRect(-18 + j * 19, 26, 17, 3);
      ctx.fillStyle = j ? '#dafa74' : p.color;
      ctx.fillRect(-18 + j * 19, 26, 17 * Math.min(1, Math.max(0, fraction)), 3);
    }
    ctx.restore();
  }
  ctx.restore();
  if (state === 'countdown') drawSpawnMarkers();
  drawBuildPractice();
}

function showStats(i, left, top) {
  const p = players[i];
  const tip = get('statTip');
  if (endless || !p) {
    tip.hidden = true;
    return;
  }
  const stat = (key, cap = Infinity) => Math.round(100 * Math.min(cap, p.stats[key] || 0));
  const percent = value => (value >= 0 ? '+' : '−') + Math.abs(value) + '%';
  const cards = (builds[i] || []).map(card => card[0]);
  tip.textContent = [
    'PLAYER ' + (i + 1) + (p.out ? ' · OUT' : ''),
    'Move ' + percent(stat('speed', .65)) + ' · Charge ' + percent(stat('charge')),
    'Push force ' + percent(stat('force')) + ' · Range ' + percent(stat('range')),
    'Incoming knockback ' + percent(-stat('guard', .65)),
    'Dash duration ' + percent(stat('duration')) + ' · Cooldown ' + percent(-stat('dashRate', .65)),
    'Push cooldown ' + percent(-stat('pushRate', .65)) + ' · Dodge cooldown ' + percent(-stat('dodgeRate', .55)),
    'Parry window ' + percent(stat('parryWindow', .8)),
    'Super duration ' + percent(stat('superDuration')) + ' · Super cooldown ' + percent(-stat('superRate', .65)),
    cards.length ? cards.join(' · ') : 'No upgrades',
  ].join('\n');
  tip.hidden = false;
  tip.style.left = Math.max(4, Math.min(left + 12, innerWidth - tip.offsetWidth - 6)) + 'px';
  tip.style.top = Math.max(4, Math.min(top + 12, innerHeight - tip.offsetHeight - 6)) + 'px';
}

get('scores').addEventListener('pointermove', event => {
  const entry = event.target.closest('[data-player]');
  showStats(entry ? Number(entry.dataset.player) : -1, event.clientX, event.clientY);
});
get('scores').addEventListener('focusin', event => {
  if (event.target.dataset.player === undefined) return;
  const rect = event.target.getBoundingClientRect();
  showStats(Number(event.target.dataset.player), rect.left, rect.bottom);
});
get('scores').addEventListener('pointerleave', () => { get('statTip').hidden = true; });
get('scores').addEventListener('focusout', () => { get('statTip').hidden = true; });

function menuRows() {
  if (state === 'match') return [[get('action'),get('resultsLobby')]];
  if (state === 'paused') return [[get('action'),get('pauseMenu')]];
  if (editingMode) {
    const settings = [...get('modeSettings').querySelectorAll('.settings-options')]
      .map(group=>[...group.children]);
    return [[get('modeBack'),get('action')],...settings];
  }
  const modes = modeButtons();
  const columns = window.matchMedia?.('(max-width:480px)').matches ? 1 : window.matchMedia?.('(max-width:760px)').matches ? 2 : 3;
  const rows = [];
  for (let i=0;i<modes.length;i+=columns) rows.push(modes.slice(i,i+columns));
  const themeMenu = get('themeMenu');
  return [...rows,[get('customize'),themeMenu.querySelector('summary'),get('gameHelp').querySelector('summary')],
    ...(themeMenu.open ? [[...themeMenu.querySelectorAll('[data-theme]')]] : [])];
}

function navigateMenu(input) {
  if (input.accessory && state === 'menu' && editingMode) {
    leaveModeSettings();
    return;
  }
  const rows = menuRows().map(row=>row.filter(button=>!button.hidden&&!button.disabled)).filter(row=>row.length);
  const buttons = rows.flat();
  if (!buttons.length) return;
  const active = buttons.includes(document.activeElement) ? document.activeElement : buttons[menuFocus] || buttons[0];
  const row = rows.findIndex(group=>group.includes(active));
  const column = rows[row].indexOf(active);
  const targetRow = Math.max(0,Math.min(rows.length-1,row + Number(Boolean(input.down))-Number(Boolean(input.up))));
  const targetColumn = Math.max(0,Math.min(rows[targetRow].length-1,
    column + Number(Boolean(input.right))-Number(Boolean(input.left))));
  const target = rows[targetRow][targetColumn];
  menuFocus = buttons.indexOf(target);
  if (input.left || input.right || input.up || input.down) target.focus();
  if (input.dash) target.click();
}

function drawLobbyEmotes(now) {
  if (!setup || !isLobby()) return;
  slots.forEach((slot,i) => {
    const cursor = customCursors.get(slot);
    if (customFields[cursor?.tab]?.key !== 'emote') return;
    const row = get('roster').children[i];
    const canvas = row.querySelector('.setup-emote');
    const preview = canvas.getContext('2d');
    preview.clearRect(0,0,146,146);
    preview.save();
    preview.translate(73,80);
    const progress = (now / 1000 % 2) / emoteDuration;
    drawEmote(preview,lookFor(i),84,Math.min(1,progress));
    preview.restore();
  });
}

function frame(now) {
  const dt = Math.min(.025, (now - (last || now)) / 1000);
  last = now;
  drawLobbyEmotes(now);
  const inputs = gamepads().map((pad, i) => readInput(i, pad));
  if (state === 'match') updateResultsLock();
  if (state === 'kineticDraft') {
    tickKineticDraft(inputs,now);
    draw();
    requestAnimationFrame(frame);
    return;
  }
  if (state === 'draft' && draftHandoffAt !== null) {
    if (performance.now() >= draftHandoffAt) nextDraft();
    draw();
    requestAnimationFrame(frame);
    return;
  }
  if (state === 'draft') {
    const player = draftQueue[0];
    const slot = slots[player];
    if (slot >= 0 && !connectedPads.has(slot)) {
      get('subtitle').textContent = 'Reconnect Player ' + (player+1) + '’s controller. An automatic pick follows in a moment.';
      draftDisconnectedAt ??= now;
      if (now-draftDisconnectedAt >= 4500) pickCard(selected,slot);
    } else if (slot >= 0) {
      if (draftDisconnectedAt !== null) {
        draftDisconnectedAt = null;
        get('subtitle').textContent = 'Use your stick or D-pad · A / × to pick';
      }
      const input = inputs[player];
      if (input?.trick && startingDraft) previewBuildTrick();
      if (input?.left) highlightCard(selected - 1);
      if (input?.right) highlightCard(selected + 1);
      if (input?.dash) pickCard(selected, slot);
    }
    draw();
    requestAnimationFrame(frame);
    return;
  }
  const settingUp = setup && isLobby();
  const stateBeforeMenuInput = state;
  const menuWasEditing = editingMode;
  if (state === 'round') {
    roundDelay = Math.max(0, roundDelay - dt);
    if (roundDelay === 0) {
      get('shortcut').textContent = 'Press any controller button or a key to continue';
      if (inputs.some(input => input.any)) primary();
    }
  } else if (isLobby() && setup) {
    inputs.forEach((input, i) => {
      if (setup && slots[i] >= 0) browseLook(slots[i], input);
    });
  } else if (isLobby() || state === 'paused') {
    const navigation = inputs.find((input, i) => slots[i] >= 0 &&
      (input.left || input.right || input.up || input.down || input.dash || (editingMode && input.accessory)));
    if (navigation) navigateMenu(navigation);
  }
  if (!settingUp && state === stateBeforeMenuInput && state !== 'round' && inputs.some(input => input.start)) {
    if (state === 'playing') togglePause();
    else if (state !== 'menu' || (editingMode && editingMode === menuWasEditing)) primary();
  }
  if (state === 'countdown') {
    timer -= dt;
    const remaining = Math.ceil(timer / (rules.kinetic?.4:.8));
    if (remaining <= 0) show('playing');
    else if (remaining !== countdown) {
      countdown = remaining;
      get('title').textContent = remaining;
      get('title').dataset.beat = remaining;
    }
  } else if (state === 'playing') {
    const hitStop=rules.kinetic && kineticImpact>0;
    if(hitStop) kineticImpact=Math.max(0,kineticImpact-dt);
    move(inputs,hitStop ? dt*.22 : dt);
  }
  if (!setup || !isLobby()) draw();
  requestAnimationFrame(frame);
}

sprites.addEventListener('load', scoreboard);
setSetup(true);
requestAnimationFrame(frame);
