'use strict';

const $ = id => document.getElementById(id);
const teams = ['Hot Dogs', 'Turbo Toads'];
const colors = ['#ff8562', '#6df2ca'];
const cpuNames = [['Frank Furter', 'Mustard Mike', 'Relish Randy', 'Bun Jovi'], ['Hop Scotch', 'Wart Simpson', 'Croak Hogan', 'Ribbit De Niro']];
const byId = new Map(events.map(event => [event.id, event]));
const players = new Map([['keyboard', {id: 'keyboard', name: 'Keyboard', team: 0}]]);
const claims = new Map();
const draftPresets = cups.map(cup => cup.ids);
const cpuSettings = [
  {name: 'Rookie', pace: .88, timing: .68, mark: .47},
  {name: 'Arcade', pace: 1, timing: .82, mark: .65},
  {name: 'All-Star', pace: 1.10, timing: .93, mark: .79},
];
const controlLabels = {j: 'A / J', k: 'B / K', i: 'Y / I'};
const recordKey = 'blitz-track-records-v1';
const records = loadRecords();
const held = new Set();
const touches = new Map();
const previousPads = new Map();
const padActions = [[0, 'j'], [1, 'k'], [3, 'i'], [2, 'l']];
const buttonByKey = new Map(padActions.map(([index, key]) => [key, index]));
const gateActions = {jump: 'Jump', splash: 'Hold Splash', pass: 'Pass baton', cup: 'Grab cup'};
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(value, maximum));
let program = [...quickMeet];
let connected = new Set();
let nextPlayer = 2;
let keyboardTeam = 0;
let keyboardAutomatic = true;
let draftIndex = 0;
let draftPreset = 0;
let scores = [0, 0];
let results = [];
let round = 0;
let screen = 'setup';
let chosen = [null, null];
let heat;
let paused = false;
let soundOn = true;
let audio;
let lastFrame = performance.now();
let lastPaint = -Infinity;
let paintedScreen;
let difficulty = 1;
let heatNumber = 0;
let stadiumVisible = true;
let ready = new Set();

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(recordKey) || '{}');
    return Object.fromEntries(events.filter(event => Number.isFinite(saved?.[event.id])).map(event => [event.id, saved[event.id]]));
  } catch {
    return {};
  }
}

function saveRecords() {
  try { localStorage.setItem(recordKey, JSON.stringify(records)); } catch {}
}

function formatMark(event, value) {
  return event.stages ? `${Math.round(value * 100)} pts` : `${value.toFixed(2)}s`;
}

function renderRecords() {
  $('record-count').textContent = `${Object.keys(records).length} of ${events.length} events recorded`;
  $('records-list').replaceChildren(...events.filter(event => records[event.id] !== undefined).map(event =>
    gameElement('li', {text: `${event.name} · ${formatMark(event, records[event.id])}`})));
}

function cycleDifficulty() {
  difficulty = (difficulty + 1) % cpuSettings.length;
  renderSetup();
}

function button(label, action, pressed) {
  const node = gameElement('button', {text: label});
  node.onclick = action;
  if (pressed !== undefined) node.setAttribute('aria-pressed', pressed);
  return node;
}

function available(team) {
  const roster = [...players.values()].filter(player => player.id === 'keyboard' || connected.has(player.id));
  const useKeyboard = !keyboardAutomatic || roster.length === 1;
  return roster.filter(player => (useKeyboard || player.id !== 'keyboard') &&
    (team === undefined || team === player.team));
}

function balanceDuel() {
  const [first, second, extra] = available();
  if (!second || extra || first.team !== second.team) return;
  second.team = 1 - first.team;
}

function switchTeam(player) {
  const roster = available();
  const rival = roster.length === 2 && roster.find(candidate => candidate !== player);
  player.team = 1 - player.team;
  if (rival) rival.team = 1 - player.team;
  if (players.has('keyboard')) keyboardTeam = players.get('keyboard').team;
  if (screen === 'setup') renderSetup();
}

function enableSound() {
  if (!soundOn || !window.AudioContext) return;
  audio ??= new window.AudioContext();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
}

function tones(notes, type = 'triangle', duration = .11) {
  if (!soundOn || audio?.state !== 'running') return;
  notes.forEach((frequency, i) => playGameTone(audio, frequency, duration, type, .085, i * duration * .88));
}

function setStatus(message) {
  updateGameText($('status'), message);
}

function refreshScore(label, name) {
  $('round').textContent = label;
  $('event-name').textContent = name;
  scores.forEach((score, team) => { $('score' + team).textContent = String(score).padStart(2, '0'); });
}

function setProgram(list) {
  program = list;
  renderSetup();
}

function selectPlayer(select, team, selected, defaultLabel = 'CPU') {
  select.append(new Option(defaultLabel, ''));
  for (const player of available(team)) select.append(new Option(player.name, player.id));
  select.value = selected ?? '';
}

function renderSetup() {
  $('difficulty').textContent = `CPU · ${cpuSettings[difficulty].name}`;
  renderRecords();
  const keyboard = available().find(player => player.id === 'keyboard');
  $('keyboard').setAttribute('aria-pressed', Boolean(keyboard));
  $('keyboard').textContent = keyboard ? 'Keyboard joined' : 'Join keyboard';
  $('switch').disabled = !keyboard;
  $('rosters').replaceChildren(...teams.map((name, team) => {
    const names = available(team).map((player, i) => player.name + (i === 0 ? ' ★' : ''));
    return gameElement('div', {text: `${name} · ${names.join(', ') || 'CPU'}`, className: team ? 'cool' : 'hot'});
  }));
  $('program').replaceChildren(...program.map((id, index) => {
    const row = gameElement('li');
    const name = byId.get(id).name;
    row.append(gameElement('span', {text: name}));
    for (const [team, side] of teams.entries()) {
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Choose the ${side} player for ${name}`);
      const picks = claims.get(id) ?? [null, null];
      selectPlayer(select, team, picks[team], side + ' captain');
      select.onchange = () => {
        const updated = claims.get(id) ?? [null, null];
        updated[team] = select.value || null;
        claims.set(id, updated);
      };
      row.append(select);
    }
    const remove = button('×', () => setProgram(program.filter(event => event !== id)));
    remove.setAttribute('aria-label', `Remove ${name} from position ${index + 1}`);
    row.append(remove);
    return row;
  }));
  $('groups').replaceChildren(...groups.map((group, i) => {
    const category = document.createElement('details');
    category.open = document.querySelectorAll('#groups details')[i]?.open ?? i === 0;
    category.append(gameElement('summary', {text: group}));
    const chips = gameElement('div', {text: '', className: 'button-row'});
    for (const event of events.filter(candidate => candidate.group === group)) {
      const selected = program.includes(event.id);
      chips.append(button(event.name, () => {
        setProgram(selected ? program.filter(id => id !== event.id) : [...program, event.id]);
        [...$('groups').querySelectorAll('button')].find(node => node.textContent === event.name)?.focus();
      }, selected));
    }
    category.append(chips);
    return category;
  }));
  $('start').disabled = program.length === 0 || available().length === 0;
}

function renderDraft() {
  const event = events[draftIndex];
  const selected = program.includes(event.id);
  $('draft-category').textContent = `${event.group} · ${draftIndex + 1} of ${events.length}`;
  $('draft-event').textContent = event.name;
  $('draft-preset').textContent = `Next preset · ${cups[(draftPreset + 1) % cups.length].name}`;
  $('draft-order').textContent = program.length ? program.map(id => byId.get(id).name).join(' → ') : 'Choose at least one event.';
  $('draft-toggle').textContent = selected ? 'Remove event' : 'Add event';
  $('draft-toggle').setAttribute('aria-pressed', selected);
  $('draft-start').disabled = program.length === 0 || available().length === 0;
}

function openDraft() {
  screen = 'draft';
  $('setup').hidden = true;
  $('draft').hidden = false;
  draftIndex = Math.max(0, events.findIndex(event => event.id === program[0]));
  draftPreset = draftPresets.findIndex(preset => preset.length === program.length && preset.every((id, index) => program[index] === id));
  renderDraft();
  $('draft-toggle').focus();
}

function moveDraft(offset) {
  draftIndex = (draftIndex + offset + events.length) % events.length;
  renderDraft();
}

function toggleDraftEvent() {
  const id = events[draftIndex].id;
  program = program.includes(id) ? program.filter(entry => entry !== id) : [...program, id];
  renderDraft();
}

function nextPreset() {
  draftPreset = (draftPreset + 1) % draftPresets.length;
  program = [...draftPresets[draftPreset]];
  renderDraft();
}

function closeDraft() {
  screen = 'setup';
  $('draft').hidden = true;
  $('setup').hidden = false;
  renderSetup();
  $('open-draft').focus();
}

function startMeet() {
  if (!['setup', 'draft'].includes(screen) || !program.length || !available().length) return;
  balanceDuel();
  enableSound();
  scores = [0, 0];
  results = [];
  round = 0;
  openDesk();
}

function openDesk() {
  const event = byId.get(program[round]);
  balanceDuel();
  chosen = [undefined, undefined];
  screen = 'desk';
  $('setup').hidden = true;
  $('draft').hidden = true;
  $('desk').hidden = false;
  $('results').hidden = true;
  $('reset').hidden = true;
  $('assignments').hidden = false;
  ready = new Set();
  $('rematch').hidden = true;
  $('recap').hidden = true;
  $('desk-title').textContent = event.name;
  $('briefing').textContent = event.briefing;
  renderTutorial(event);
  $('advance').textContent = 'Start event';
  refreshScore(`EVENT ${round + 1} / ${program.length}`, event.name);
  renderAssignments();
  $('advance').focus();
  setStatus('Clerk of the course: athletes to your marks.');
}

function eventEntry(team) {
  const roster = available(team);
  const claim = roster.find(player => player.id === claims.get(program[round])?.[team]);
  const locked = available().length <= 2 || Boolean(claim);
  const selected = chosen[team];
  const player = claim ?? (locked ? roster[0] : selected === '' ? null :
    roster.find(candidate => candidate.id === selected) ?? roster[0]);
  return {player, locked, roster};
}

function markReady(player) {
  if (!player || !teams.some((_, team) => eventEntry(team).player === player)) return;
  ready.add(player.id);
  const entries = teams.map((_, team) => eventEntry(team).player).filter(Boolean);
  if (entries.every(entry => ready.has(entry.id))) beginHeat();
  else renderAssignments();
}

function renderAssignments() {
  balanceDuel();
  $('assignments').replaceChildren(...teams.map((team, index) => {
    const entry = eventEntry(index);
    const caption = gameElement('label', {text: team + ' ', className: index ? 'cool' : 'hot'});
    const select = document.createElement('select');
    selectPlayer(select, index, entry.player?.id);
    select.disabled = entry.locked || !entry.roster.length;
    select.onchange = () => assign(index, select.value);
    caption.append(select);
    if (entry.player && ready.has(entry.player.id)) caption.append(gameElement('strong', {text: ' Ready'}));
    return caption;
  }));
  const roster = available();
  $('desk-help').textContent = roster.length === 2 ? 'Head-to-head · one player on each team.'
    : roster.length === 1 ? 'Solo · you enter every event against the CPU.'
      : 'Team captains can press Y / Event to cycle their athlete or CPU.';
  $('desk-help').textContent += ' · A / J readies your athlete. Start begins immediately.';
}

function assign(team, id) {
  ready.clear();
  chosen[team] = id;
  renderAssignments();
  $('assignments').querySelectorAll('select')[team].focus();
}

function cycleAthlete(player) {
  const {roster, locked, player: entrant} = eventEntry(player.team);
  if (locked || roster[0] !== player) return;
  const options = ['', ...roster.map(candidate => candidate.id)];
  assign(player.team, options[(options.indexOf(entrant?.id ?? '') + 1) % options.length]);
}

function renderTutorial(event) {
  const rows = [];
  if (event.stages) {
    const skills = event.stages.map((stage, i) => [stage, fieldSkill(event, i)]);
    const distinct = new Set();
    for (const [, skill] of skills) {
      if (distinct.has(skill)) continue;
      distinct.add(skill);
      const stations = skills.filter(([, candidate]) => candidate === skill).map(([name]) => name).join(', ');
      rows.push([stations, skill.help]);
    }
  } else {
    rows.push(['A / J · Stride', event.walk ? 'Tap in green and build a clean-step streak.' :
      'Wait for GO, then tap at a smooth cadence. Green strides build flow and refill stamina.']);
    rows.push(['B / K · Turbo', event.walk ? 'Holding this is a jog. The official can flag it.' :
      'Hold to accelerate and release to recover. Time your bursts around bends and marked surges.']);
    rows.push(['Y / I · Event', {
      jump: 'Tap at the hurdle. A centered jump earns a clean boost.',
      steeple: 'Tap in green to jump a barrier. Hold through the blue water zone.',
      pass: 'Tap in green to hand off. Hit the center to launch the next runner.',
      cup: 'Tap at an aid station to refill turbo. A centered grab recovers more.',
    }[event.gate] ?? 'Press at 85% or later for a finish lean. The closer you are to the tape, the bigger the kick.']);
  }
  const payoff = event.stages ? 'Boosts your next mark.' : {
    'Hurdles & chase': 'Clears your next obstacle.',
    'Race walks': 'Gives you a burst of speed.',
    Distance: 'Restores turbo and gives you a burst.',
    Relays: 'Bonks a rival if they are within reach.',
  }[event.group] ?? 'Boosts you and can slow a nearby rival.';
  rows.push(['X / L · Dirty trick', `${event.trick}. ${payoff} Try it while the official looks away. Three flags disqualify you.`]);
  $('tutorial-controls').replaceChildren(...rows.map(([control, instructions]) => {
    const row = gameElement('li');
    row.append(gameElement('kbd', {text: control}), gameElement('span', {text: instructions}));
    return row;
  }));
  $('tutorial-goal').textContent = event.group === 'Field' ? 'Two attempts · best mark wins.' :
    event.stages ? 'Highest total wins.' : 'First across the finish wins.';
  $('event-record').textContent = records[event.id] === undefined ? '' : `Local record · ${formatMark(event, records[event.id])}`;
  $('tutorial').hidden = false;
}

function beginHeat() {
  const event = byId.get(program[round]);
  balanceDuel();
  const entries = teams.map((_, team) => eventEntry(team).player);
  heat = {
    event, number: ++heatNumber, t: -2.6, call: '', callUntil: -5, refOffset: Math.random() * .8,
    runners: teams.map((_, team) => {
      const player = entries[team];
      return {
        id: player?.id, name: player?.name ?? cpuNames[team][round % cpuNames[team].length],
        team, p: 0, tank: .83, cadence: 0, lastStride: -10, boost: 0, slow: 0, loaded: 0,
        gateIndex: 0, gateUsed: false, kick: 0, strikes: 0, cooldown: 0, heat: 0,
        finish: null, mark: 0, stage: -1, taps: 0, charge: 0, cheatMark: 0,
        flow: 0, bestFlow: 0, clean: 0, missed: 0, tricks: 0, leaned: false,
        sequence: 0, balance: .32, stable: 0, bestMark: 0, attempts: [],
        cpuPace: cpuSettings[difficulty].pace * (.97 + Math.random() * .06), cpuTrick: 3.4 + Math.random() * 3,
      };
    }),
  };
  screen = 'live';
  paused = false;
  $('desk').hidden = true;
  $('pause').hidden = false;
  canvas.scrollIntoView({block: 'nearest'});
  $('pause').textContent = 'Pause';
  $('touch').classList.toggle('playing', entries.some(player => player?.id === 'keyboard'));
  setStatus(`Dirty trick · ${event.trick}. Watch the official!`);
}

function announce(message, duration = 1) {
  heat.call = message;
  heat.callUntil = heat.t + duration;
}

function athleteFeedback(runner, kind) {
  runner.feedback = {id: (runner.feedback?.id ?? 0) + 1, kind, expires: heat.t + .75};
}

function watching() {
  const clock = Math.max(0, heat.t) + heat.refOffset;
  return clock % 4.2 >= 2.75;
}

function foul(runner, call) {
  runner.strikes++;
  athleteFeedback(runner, 'flag');
  tones([1440, 1040], 'sine', .14);
  runner.slow = Math.max(runner.slow, 1.15);
  runner.boost = 0;
  if (heat.event.stages) runner.mark = Math.max(0, runner.mark - .52);
  announce(runner.strikes >= 3 ? `${teams[runner.team]} DQ · ${call}` : call, 1.3);
  if (runner.strikes >= 3) runner.finish = Infinity;
}

function tryTrick(runner) {
  if (runner.cooldown > 0) return;
  runner.cooldown = 2.5;
  if (watching() || runner.heat > .75) {
    foul(runner, 'WHISTLE! Excessive nonsense.');
    return;
  }
  runner.heat += .58;
  runner.tricks++;
  const rival = heat.runners[1 - runner.team];
  const {event} = heat;
  if (event.stages) runner.cheatMark = .34;
  else if (event.group === 'Hurdles & chase') {
    // Film-prop obstacles fall apart when the runner reaches the marked zone.
    runner.shortcutGate = runner.gateIndex;
    runner.boost = .54;
  } else if (event.group === 'Race walks') {
    runner.boost = 1.25;
    runner.tank = clamp(runner.tank + .24);
  } else if (event.group === 'Distance') {
    runner.tank = clamp(runner.tank + .43);
    runner.boost = .73;
  } else {
    const baton = event.gate === 'pass';
    const spike = event.prank === 'spike';
    const range = baton || spike ? .115 : .19;
    if (Math.abs(runner.p - rival.p) < range && rival.finish === null) {
      rival.slow = baton ? 1.14 : spike ? .93 : .65;
      rival.hitUntil = heat.t + .65;
      if (spike) rival.tank = Math.max(0, rival.tank - .25);
      runner.swingUntil = heat.t + .48;
    }
    runner.boost = baton || spike ? .43 : .94;
  }
  tones([196, 112], 'square', .08);
  announce(heat.event.trick.toUpperCase() + '!', .95);
}

function readGate(event, runner) {
  const index = runner.gateIndex;
  const point = event.gates?.[index];
  const splash = event.splashes ? event.splashes.includes(index) : index % 2 === 1;
  const kind = event.gate === 'steeple' ? (splash ? 'splash' : 'jump') : event.gate;
  const width = event.windows?.[index] ?? event.window ?? .034;
  return {point, kind, width, inZone: point !== undefined && Math.abs(point - runner.p) <= width};
}

function strideTarget(event) {
  return event.rhythm ? .34 : event.seconds <= 11 ? .18 : .25;
}

function action(runner, key, down) {
  if (!runner || runner.finish !== null || screen !== 'live' || paused) return;
  const {event, t} = heat;
  if (t < 0) {
    if (down && key === 'j' && !event.stages && runner.lastStride < -3) {
      runner.lastStride = t;
      foul(runner, 'FALSE START · The starter saw that.');
    }
    return;
  }
  if (down && key === 'l') tryTrick(runner);
  if (event.stages) {
    fieldAction(event, runner, key, down);
    return;
  }
  if (down && key === 'j') {
    const interval = t - runner.lastStride;
    const target = strideTarget(event);
    if (interval < (event.walk ? .18 : .10)) return;
    const clean = event.walk ? walkBeat(event, runner) < .32 : Math.abs(interval - target) < target * .38;
    runner.flow = clean ? Math.min(12, runner.flow + 1) : 0;
    runner.bestFlow = Math.max(runner.bestFlow, runner.flow);
    if (clean) runner.tank = clamp(runner.tank + (event.rhythm ? .065 : .032));
    if (event.walk) runner.cadence = clean ? 1 : runner.cadence * .55;
    else runner.cadence = clamp(runner.cadence + (clean ? .44 : .20));
    runner.kick = clamp(runner.kick + (clean ? .09 : .03));
    if (t < .31 && runner.lastStride < -3 && !event.walk) {
      runner.boost = event.launch ?? .68;
      announce('QUICK START!', .65);
    }
    runner.lastStride = t;
  }
  if (down && key === 'k' && event.kick && runner.p >= .72 && runner.kick > .3) {
    runner.boost = 1.8 * runner.kick;
    runner.kick = 0;
  }
  if (down && key === 'i') {
    const gate = readGate(event, runner);
    if (gate.inZone && gate.kind !== 'splash' && !runner.gateUsed) clearGate(runner, gate.kind, Math.abs(gate.point - runner.p) < gate.width * .38);
    if (!event.gate && !runner.leaned && runner.p >= .85) {
      runner.leaned = true;
      runner.boost = runner.p >= .94 ? .92 : .43;
      announce(runner.p >= .94 ? 'PHOTO-FINISH LEAN!' : 'FINISH LEAN!', .55);
    }
  }
}

function walkBeat(event, runner) {
  const period = event.shift && runner.p >= .5 ? event.shift : event.walk;
  return Math.max(0, heat.t) % period / period;
}

function clearGate(runner, kind, perfect = false) {
  runner.gateUsed = true;
  if (activeHuman(runner)) tones(kind === 'pass' ? [392, 588] : [587]);
  runner.clean++;
  athleteFeedback(runner, 'clean');
  if (kind === 'cup') runner.tank = clamp(runner.tank + (perfect ? .80 : .54));
  else runner.boost = (kind === 'pass' ? .58 : .43) + (perfect ? .31 : 0);
  if (perfect && activeHuman(runner)) announce({cup: 'FULL REFILL!', pass: 'PERFECT EXCHANGE!', jump: 'CLEAN HURDLE!'}[kind], .60);
}

function activeHuman(runner) {
  return runner.id && (runner.id === 'keyboard' ? players.has('keyboard') : connected.has(runner.id));
}

function downFor(runner, key) {
  if (runner.id === 'keyboard') return held.has(key) || [...touches.values()].includes(key);
  return Boolean(previousPads.get(runner.id) & (1 << buttonByKey.get(key)));
}

function inBend(event, progress) {
  return progress < (event.bend ?? 0) ||
    Boolean(event.secondBend && progress >= event.secondBend[0] && progress <= event.secondBend[1]);
}

function updateRace(runner, dt) {
  const {event, t} = heat;
  const rival = heat.runners[1 - runner.team];
  const gate = readGate(event, runner);
  const surge = event.surges?.find(([from, to]) => runner.p >= from && runner.p <= to);
  const drafting = event.draft && rival.p >= runner.p && rival.p - runner.p < .095;
  const human = activeHuman(runner);
  const turbo = human ? downFor(runner, 'k') : (!event.walk && (Boolean(surge) || (runner.p > .61 && !event.bend)));
  const usingTurbo = turbo && runner.tank > .04;
  const bend = inBend(event, runner.p);
  const terrain = event.terrain?.find(([from, to]) => runner.p >= from && runner.p <= to);
  if (runner.shortcutGate === runner.gateIndex && gate.inZone && !runner.gateUsed) {
    clearGate(runner, gate.kind);
    if (human) announce('PROP BARRIER!', .49);
  }
  if (human && !runner.gateUsed && gate.kind === 'splash' && gate.inZone && downFor(runner, 'i')) {
    runner.loaded += dt;
    if (runner.loaded >= .14) clearGate(runner, 'splash');
  }
  if (gate.point !== undefined && runner.p > gate.point + gate.width) {
    if (!human && Math.random() < cpuSettings[difficulty].timing) clearGate(runner, gate.kind);
    if (!runner.gateUsed && gate.kind !== 'cup') {
      runner.missed++;
      runner.slow = gate.kind === 'pass' ? .95 : .7;
      if (human) announce(gate.kind === 'pass' ? 'BATON DOWN!' : 'BONK!', .63);
    }
    if (event.refill) runner.tank = 1;
    runner.gateIndex++;
    runner.gateUsed = false;
    runner.loaded = 0;
  }

  if (usingTurbo) runner.tank = clamp(runner.tank - dt * (event.drain ?? .43));
  else runner.tank = clamp(runner.tank + dt * (drafting ? .48 : (event.regen ?? .24)));
  if (human && event.walk && usingTurbo && watching() && runner.cooldown <= 0) {
    runner.cooldown = 2.5;
    foul(runner, 'WHISTLE! That was a jog.');
  }
  const turboPower = usingTurbo ? (bend ? -.23 : surge ? .74 : .39) : 0;
  const stridePower = human ? .69 + .47 * runner.cadence + runner.flow * .011 : runner.cpuPace * (event.walk ? .91 : 1);
  const multiplier = runner.slow > 0 ? .45 : 1;
  const terrainPower = terrain && !usingTurbo ? terrain[2] : 0;
  const pace = (stridePower + turboPower + terrainPower + (runner.boost > 0 ? .49 : 0)) * multiplier;
  const increment = pace * dt / event.seconds;
  const previous = runner.p;
  runner.p = clamp(previous + increment);
  if (runner.p >= 1 && runner.finish === null) runner.finish = t - dt * (1 - (1 - previous) / increment);
  runner.cadence = Math.max(0, runner.cadence - dt * (event.walk ? 1.1 : 1.02));
}

function fieldSkill(event, stage) {
  return fieldSkills[fieldPrograms[event.id]?.[stage] ?? 'meter'];
}

function fieldTiming(event, seconds) {
  const span = event.group === 'Combined' ? 2.18 : 2.45;
  const clock = Math.max(0, seconds);
  const count = event.stages.length;
  const index = Math.floor(clock / span);
  const attempt = Math.floor(index / count);
  const stage = index % count;
  const elapsed = clock % span;
  const period = event.chain ? Math.max(.62, (event.period ?? .95) - stage * .06) : event.period ?? 1.12;
  const cursor = 1 - Math.abs(1 - 2 * Math.max(0, elapsed - .40) / period % 2);
  const width = (event.widths?.[stage] ?? .15) * (attempt ? .91 : 1);
  const skill = fieldSkill(event, stage);
  const done = attempt >= (event.group === 'Field' ? 2 : 1);
  return {index, attempt, stage, span, elapsed, cursor, width, skill, done, ready: elapsed >= .40 && !done};
}

function fieldKey(timing, runner) {
  return timing.skill.mode === 'sequence' ? (runner.sequence % 2 ? 'i' : 'j') : timing.skill.key;
}

function fieldAction(event, runner, key, down) {
  const timing = fieldTiming(event, heat.t);
  const {mode} = timing.skill;
  if (key === 'l' || runner.slow > 0 || !timing.ready || runner.stage === timing.index) return;
  if (mode === 'sequence' && down && ['j', 'i'].includes(key) && heat.t - runner.lastStride > .085) {
    if (key === fieldKey(timing, runner)) runner.sequence++;
    else runner.sequence = Math.max(0, runner.sequence - 1);
    runner.lastStride = heat.t;
    return;
  }
  if (key !== fieldKey(timing, runner)) return;
  if (mode === 'mash' && down && heat.t - runner.lastStride > .09) {
    runner.taps++;
    runner.lastStride = heat.t;
  }
  if ((mode === 'tap' && down) || (mode === 'release' && !down && runner.charge > .06)) {
    const error = Math.abs(timing.cursor - .69);
    const accuracy = error <= timing.width ? 1 - error * .38 : clamp(.73 - error);
    const power = mode === 'release' ? .60 + .40 * clamp(runner.charge * 3.4) : 1;
    recordStation(runner, timing.index, accuracy * power);
    if (error <= timing.width) tones([494, 659], 'sine', .08);
    announce(error <= timing.width ? 'NAILED IT!' : 'WOBBLY!', .53);
  }
}

function recordStation(runner, index, mark) {
  runner.mark += Math.max(0, mark + runner.cheatMark);
  runner.cheatMark = 0;
  runner.stage = index;
  if (mark >= .90) {
    runner.clean++;
    athleteFeedback(runner, 'clean');
  }
  else if (mark <= .16) runner.missed++;
}

function settleStation(event, runner, index, previousMode) {
  if (runner.stage !== index) {
    const mark = previousMode === 'mash' ? clamp(runner.taps / 12) :
      previousMode === 'sequence' ? clamp(runner.sequence / 9) :
        previousMode === 'balance' ? clamp(runner.stable / 1.33) : 0;
    recordStation(runner, index, mark);
  }
  if (event.group === 'Field' && (index + 1) % event.stages.length === 0) {
    runner.attempts.push(runner.mark);
    runner.bestMark = Math.max(runner.bestMark, runner.mark);
    runner.mark = 0;
  }
}

function updateField(runner, dt) {
  const {event, t} = heat;
  const timing = fieldTiming(event, t);
  if (runner.timingStage !== timing.index) {
    const previous = runner.timingStage;
    if (previous !== undefined) settleStation(event, runner, previous, fieldSkill(event, previous % event.stages.length).mode);
    runner.timingStage = timing.index;
    runner.taps = runner.sequence = runner.charge = runner.stable = 0;
    runner.balance = .31;
  }
  if (timing.done) {
    if (event.group === 'Field') runner.mark = runner.bestMark;
    runner.finish = t;
    return;
  }
  if (!activeHuman(runner) && timing.elapsed >= 1.38 && runner.stage !== timing.index) {
    recordStation(runner, timing.index, cpuSettings[difficulty].mark + (Math.random() - .46) * .40 - (runner.slow > 0 ? .30 : 0));
    return;
  }
  if (!timing.ready || !activeHuman(runner)) return;
  if (timing.skill.mode === 'release' && downFor(runner, timing.skill.key)) runner.charge += dt;
  if (timing.skill.mode === 'balance') {
    const lift = downFor(runner, timing.skill.key);
    runner.balance = clamp(runner.balance + (lift ? .68 : -.49) * dt);
    if (runner.balance >= .51 && runner.balance <= .79 && runner.slow <= 0) runner.stable += dt;
  }
}

function updateHeat(dt) {
  if (paused) return;
  const before = heat.t;
  heat.t += dt;
  if (Math.floor(-before) > Math.floor(-heat.t) && heat.t < 0) tones([392], 'sine');
  if (before < 0 && heat.t >= 0) tones([880], 'square', .16);
  if (heat.t < 0) return;
  const {event} = heat;
  for (const runner of heat.runners) {
    if (runner.finish !== null) continue;
    runner.cooldown -= dt;
    runner.heat = Math.max(0, runner.heat - dt * .09);
    runner.slow -= dt;
    runner.boost -= dt;
    if (!activeHuman(runner) && heat.t > runner.cpuTrick) {
      runner.cpuTrick += 5.8 + Math.random() * 4;
      if (Math.random() < .5) tryTrick(runner);
      if (runner.finish !== null) continue;
    }
    if (event.stages) updateField(runner, dt);
    else updateRace(runner, dt);
  }
  const elapsed = heat.t > (event.seconds ?? 40) * 1.85;
  const finished = heat.runners.every(runner => runner.finish !== null);
  if (finished || elapsed) finishHeat();
}

function finishHeat() {
  const [a, b] = heat.runners;
  const value = runner => {
    if (runner.finish === Infinity) return -Infinity;
    if (heat.event.stages) return Math.round(runner.mark * 100);
    return runner.finish === null ? runner.p : 2 - runner.finish / 1000;
  };
  const winner = value(a) === value(b) ? -1 : value(a) > value(b) ? 0 : 1;
  if (winner >= 0) scores[winner] += 3;
  else if (a.finish !== Infinity || b.finish !== Infinity) {
    scores[0]++;
    scores[1]++;
  }
  const showMark = runner => {
    if (runner.finish === Infinity) return 'DQ';
    if (heat.event.stages) return `${value(runner)} pts`;
    return runner.finish === null ? `${Math.floor(runner.p * 100)}% finished` : `${runner.finish.toFixed(2)}s`;
  };
  tones(winner === -1 ? [349, 277] : [392, 523, 659]);
  const difference = !heat.event.stages && Number.isFinite(a.finish) && a.finish !== null &&
    Number.isFinite(b.finish) && b.finish !== null ? Math.abs(a.finish - b.finish) : null;
  const photo = winner >= 0 && difference !== null && difference < .18;
  heat.photo = photo;
  const headline = winner >= 0 ? `${teams[winner]} take it${photo ? ' by ' + difference.toFixed(3) + 's' : ''}!` :
    a.finish === Infinity ? 'Double DQ!' : heat.event.stages ? 'Tied marks!' : 'Dead heat!';
  const marks = heat.runners.map(runner => {
    const event = heat.event;
    const mark = event.stages ? runner.mark : runner.finish;
    const valid = runner.id && !runner.hadCpu && Number.isFinite(mark) && mark > 0 && runner.finish !== Infinity;
    const old = records[event.id];
    const record = valid && (old === undefined || (event.stages ? mark > old : mark < old));
    return {runner, record, mark};
  });
  const contenders = marks.filter(entry => entry.record);
  if (contenders.length) {
    records[heat.event.id] = (heat.event.stages ? Math.max : Math.min)(...contenders.map(entry => entry.mark));
    for (const entry of contenders) entry.record = entry.mark === records[heat.event.id];
    saveRecords();
  }
  $('recap').replaceChildren(...marks.map(({runner, record}) => {
    const card = gameElement('article', {className: runner.team ? 'cool' : 'hot'});
    const attempts = runner.attempts.length ? ` · Attempts ${runner.attempts.map(mark => Math.round(mark * 100)).join(' / ')}` : '';
    const skill = heat.event.stages || heat.event.gate ? `${runner.clean} clean · ${runner.missed} missed` :
      `Best flow ×${runner.bestFlow}`;
    card.append(gameElement('h3', {text: runner.name}), gameElement('strong', {text: showMark(runner) + (record ? ' · Local record' : '')}),
      gameElement('p', {text: `${skill} · ${runner.tricks} tricks · ${runner.strikes} flags${attempts}`}));
    return card;
  }));
  $('recap').hidden = false;
  results.push(`${heat.event.name} · ${headline} ${a.name} ${showMark(a)} / ${b.name} ${showMark(b)}`);
  screen = 'result';
  $('touch').classList.remove('playing');
  $('desk').hidden = false;
  $('pause').hidden = true;
  $('assignments').hidden = true;
  $('tutorial').hidden = true;
  $('results').hidden = false;
  $('results').replaceChildren(...results.map(result => gameElement('li', {text: result})));
  const last = round + 1 === program.length;
  const champion = scores[0] === scores[1] ? 'Meet tied!' : `${teams[scores[0] > scores[1] ? 0 : 1]} win the meet!`;
  $('event-record').textContent = '';
  $('desk-title').textContent = last ? champion : headline;
  $('briefing').textContent = results.at(-1);
  $('desk-help').textContent = '3 meet points for a win · 1 each for a tie · 0 for a double DQ';
  $('advance').hidden = last;
  $('advance').textContent = 'Next event';
  $('reset').hidden = !last;
  $('rematch').hidden = !last;
  (last ? $('reset') : $('advance')).focus();
  refreshScore(last ? 'FINAL' : `EVENT ${round + 1} / ${program.length}`, heat.event.name);
  setStatus(last ? champion : headline);
}

function reset() {
  screen = 'setup';
  heat = undefined;
  scores = [0, 0];
  $('advance').hidden = false;
  $('desk').hidden = true;
  $('setup').hidden = false;
  refreshScore('MEET SETUP', 'TRACK & FIELD');
  renderSetup();
  $('start').focus();
  setStatus('Press A on a controller to join, or play on the keyboard.');
}

function advance() {
  if (screen === 'desk') beginHeat();
  else if (screen === 'result' && round + 1 < program.length) {
    round++;
    openDesk();
  } else if (screen === 'result') reset();
}

function pause() {
  if (screen !== 'live') return;
  paused = !paused;
  $('pause').textContent = paused ? 'Resume' : 'Pause';
  setStatus(paused ? 'Paused' : `Dirty trick · ${heat.event.trick}. Watch the official!`);
}

function describePhones() {
  const roster = available();
  const descriptions = {};
  const entries = screen === 'desk' ? teams.map((_, team) => eventEntry(team)) : [];
  for (const player of roster) {
    if (!window.couchJoinstick.label(Number(player.id))) continue;
    const buttons = {};
    const description = {player: player.name, team: teams[player.team], buttons, hint: ''};
    descriptions[player.id] = description;
    if (screen === 'setup') {
      if (draftController(player)) {
        buttons[1] = 'CPU · ' + cpuSettings[difficulty].name;
        buttons[2] = 'Draft events';
      }
      buttons[5] = 'Switch team';
      if (!$('start').disabled) buttons[9] = 'Start meet';
      description.hint = 'Draft events or start with the lineup on the shared screen.';
    } else if (screen === 'draft') {
      if (draftController(player)) {
        buttons[0] = program.includes(events[draftIndex].id) ? 'Remove event' : 'Add event';
        buttons[1] = 'Previous';
        buttons[2] = 'Back to lobby';
        buttons[3] = 'Next';
        buttons[5] = 'Change preset';
        if (program.length) buttons[9] = 'Start meet';
      }
      description.hint = `${events[draftIndex].name} · ${program.length} events drafted`;
    } else if (screen === 'desk') {
      buttons[9] = 'Start event';
      const entry = entries[player.team];
      if (!entry.locked && entry.roster[0] === player) buttons[3] = 'Choose athlete';
      if (entry.player === player && !ready.has(player.id)) buttons[0] = 'Ready';
      description.primary = buttons[0] ? 0 : 9;
      description.hint = entry.player === player ? (ready.has(player.id) ? 'Ready. Waiting for the other athlete.' : 'Read the tutorial, then tap Ready.')
        : buttons[3] ? 'Cycle through your teammates or CPU. The shared screen shows the entry.'
          : 'The tutorial and lineup are on the shared screen.';
    } else if (screen === 'result') {
      buttons[9] = round + 1 < program.length ? 'Next event' : 'Back to setup';
      if (round + 1 === program.length) buttons[0] = 'Rematch';
      description.hint = `${heat.event.name} · ${teams[0]} ${scores[0]}–${scores[1]} ${teams[1]}`;
    } else {
      const runner = heat.runners.find(candidate => candidate.id === player.id);
      if (runner?.feedback && runner.feedback.expires > heat.t && !paused) {
        description.cue = {id: `${heat.number}:${runner.feedback.id}`, kind: runner.feedback.kind};
      }
      if (roster[0] === player) buttons[9] = paused ? 'Resume' : 'Pause';
      if (paused) description.hint = 'Event paused.';
      else if (!runner || runner.finish !== null) description.hint = 'Watch the rest of the event on the shared screen.';
      else if (heat.event.stages) {
        const timing = fieldTiming(heat.event, heat.t);
        const stage = heat.event.stages[timing.stage];
        const {skill} = timing;
        if (skill.mode === 'sequence') {
          buttons[0] = 'Step A';
          buttons[3] = 'Step Y';
        } else buttons[buttonByKey.get(skill.key)] = skill.label;
        description.primary = buttonByKey.get(fieldKey(timing, runner));
        buttons[2] = 'Dirty trick';
        description.hint = `${stage} · ${skill.help}`;
      } else {
        const gate = readGate(heat.event, runner);
        buttons[0] = heat.event.walk ? 'Step' : 'Stride';
        buttons[1] = 'Turbo';
        buttons[2] = 'Dirty trick';
        if (gate.point !== undefined) buttons[3] = gateActions[gate.kind];
        else if (!heat.event.gate && !runner.leaned) buttons[3] = 'Finish lean';
        const leanReady = !heat.event.gate && !runner.leaned && runner.p >= .85;
        if ((gate.inZone && !runner.gateUsed) || leanReady) description.primary = 3;
        description.hint = heat.t < 0 ? 'Eyes up. Tap on GO on the shared screen.'
          : gate.kind === 'splash' && gate.point !== undefined ? 'Hold through the blue zone on the shared screen.'
            : 'Watch the shared screen for timing and the official.';
      }
    }
  }
  return descriptions;
}

function draftController(player) {
  return available().find(candidate => candidate.id !== 'keyboard') === player;
}

function managePads() {
  const phase = screen;
  const pads = gameControllerInputs();
  const nextConnected = new Set(pads.map(pad => String(pad.index)));
  const changed = connected.size !== nextConnected.size || [...connected].some(id => !nextConnected.has(id));
  if (screen === 'live') {
    for (const runner of heat.runners) {
      if (!runner.id || runner.id === 'keyboard') continue;
      if (connected.has(runner.id) && !nextConnected.has(runner.id)) {
        runner.charge = runner.loaded = 0;
        runner.hadCpu = true;
        announce(`${teams[runner.team]} · CPU TAKES OVER`, 1.5);
      } else if (!connected.has(runner.id) && nextConnected.has(runner.id)) {
        announce(`${teams[runner.team]} · PLAYER BACK IN`, 1.2);
      }
    }
  }
  connected = nextConnected;
  for (const pad of pads) {
    const id = String(pad.index);
    const last = previousPads.get(id) ?? 0;
    let down = 0;
    for (let index = 0; index <= 15; index++) {
      if (pad.buttons[index]?.pressed) down |= 1 << index;
    }
    const changedButtons = down ^ last;
    const press = index => Boolean(down & changedButtons & (1 << index));
    previousPads.set(id, down);
    if (screen !== phase) continue;
    if (pad.inputCanceled) {
      const runner = screen === 'live' && heat.runners.find(candidate => candidate.id === id);
      if (runner) runner.charge = runner.loaded = 0;
      continue;
    }
    if (['setup', 'draft', 'desk'].includes(screen) && !players.has(id) && press(0)) {
      const roster = keyboardAutomatic ? available().filter(player => player.id !== 'keyboard') : available();
      const team = roster.filter(player => player.team === 0).length > roster.filter(player => player.team === 1).length ? 1 : 0;
      const name = window.couchJoinstick?.label(pad.index) ?? `Pad ${pad.index + 1}`;
      players.set(id, {id, name: `P${nextPlayer++} · ${name}`, team});
      balanceDuel();
      if (screen === 'setup') renderSetup();
      if (screen === 'draft') renderDraft();
      if (screen === 'desk') renderAssignments();
      continue;
    }
    const player = players.get(id);
    if (!player) continue;
    if (screen === 'setup' && press(5)) switchTeam(player);
    if (screen === 'setup' && press(1) && draftController(player)) cycleDifficulty();
    if (screen === 'setup' && press(2) && draftController(player)) {
      openDraft();
      continue;
    }
    if (screen === 'draft') {
      if (draftController(player)) {
        if (press(2)) closeDraft();
        else if (press(9)) startMeet();
        else if (press(5)) nextPreset();
        else if (press(0)) toggleDraftEvent();
        else if (press(1) || press(14)) moveDraft(-1);
        else if (press(3) || press(15)) moveDraft(1);
      }
      continue;
    }
    if (screen === 'desk' && press(3)) cycleAthlete(player);
    if (screen === 'desk' && press(0)) {
      markReady(player);
      continue;
    }
    if (screen === 'result' && round + 1 === program.length && press(0)) {
      rematch();
      continue;
    }
    if (press(9) && (available()[0] === player || screen !== 'live')) {
      if (screen === 'setup') startMeet();
      else if (screen === 'live') pause();
      else advance();
      continue;
    }
    const runner = screen === 'live' && heat.runners.find(candidate => candidate.id === id);
    if (runner) {
      for (const [index, key] of padActions) {
        const bit = 1 << index;
        if (changedButtons & bit) action(runner, key, Boolean(down & bit));
      }
    }
  }
  if (changed) {
    for (const id of previousPads.keys()) if (!connected.has(id)) previousPads.delete(id);
    if (screen === 'setup') {
      balanceDuel();
      renderSetup();
    }
    if (screen === 'draft') renderDraft();
    if (screen === 'desk') renderAssignments();
  }
}

function keyboardAction(key, down) {
  if (screen === 'live') action(heat.runners.find(runner => runner.id === 'keyboard'), key, down);
}

document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (document.querySelector('dialog[open]')) return;
  if (screen === 'live' && key === 'escape' && !event.repeat) pause();
  if (!buttonByKey.has(key) || screen !== 'live') return;
  event.preventDefault();
  if (!held.has(key)) {
    held.add(key);
    keyboardAction(key, true);
  }
});
document.addEventListener('keyup', event => {
  const key = event.key.toLowerCase();
  if (held.delete(key)) keyboardAction(key, false);
});
window.addEventListener('blur', () => {
  held.clear();
  touches.clear();
  if (screen === 'live' && !paused) pause();
});
for (const node of $('touch').querySelectorAll('button')) {
  node.addEventListener('pointerdown', event => {
    event.preventDefault();
    node.setPointerCapture(event.pointerId);
    touches.set(event.pointerId, node.dataset.key);
    keyboardAction(node.dataset.key, true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    node.addEventListener(type, event => {
      if (touches.delete(event.pointerId)) keyboardAction(node.dataset.key, false);
    });
  }
}

$('sound').onclick = () => {
  soundOn = !soundOn;
  $('sound').setAttribute('aria-pressed', soundOn);
  if (soundOn) enableSound();
};
function rematch() {
  reset();
  startMeet();
}

$('start').onclick = startMeet;
$('rematch').onclick = rematch;
$('difficulty').onclick = cycleDifficulty;
$('cups').replaceChildren(...cups.map(cup => button(cup.name, () => setProgram([...cup.ids]))));
$('open-draft').onclick = openDraft;
$('draft-back').onclick = closeDraft;
$('draft-previous').onclick = () => moveDraft(-1);
$('draft-next').onclick = () => moveDraft(1);
$('draft-toggle').onclick = toggleDraftEvent;
$('draft-preset').onclick = nextPreset;
$('draft-start').onclick = startMeet;
$('advance').onclick = advance;
$('reset').onclick = reset;
$('pause').onclick = pause;
$('keyboard').onclick = () => {
  const joined = available().some(player => player.id === 'keyboard');
  keyboardAutomatic = false;
  if (joined) players.delete('keyboard');
  else players.set('keyboard', {id: 'keyboard', name: 'Keyboard', team: keyboardTeam});
  balanceDuel();
  renderSetup();
};
$('switch').onclick = () => switchTeam(players.get('keyboard'));

function box(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function words(text, x, y, size = 16, color = '#fff5df', align = 'left') {
  ctx.font = `900 ${size}px "Barlow Condensed", Impact, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function line(points, color, width = 3) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function oval(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, 2 * Math.PI);
  ctx.fill();
}

function mascot(x, floor, team, time, {jump = 0, slow = false, stick = false, official = false, shoes = '#fff5df'} = {}) {
  const color = official ? '#fff0cb' : colors[team];
  const step = Math.sin(time * (slow ? 14 : 25));
  const y = floor - 27 - Math.abs(step) * 3 - jump;
  oval(x, floor + 3, 22, 5, '#301e2988');
  ctx.save();
  ctx.translate(x, y);
  line([[-6, 11], [-8 + step * 13, 18], [-12 + step * 18, 23]], '#2e2032', 7);
  line([[6, 11], [8 - step * 13, 17], [12 - step * 18, 23]], '#452d42', 7);
  oval(-11 + step * 17, 24, 7, 3.5, shoes);
  oval(14 - step * 17, 24, 7, 3.5, shoes);
  oval(0, 1, 17, 17, color);
  box(-13, 0, 25, 9, official ? '#233342' : '#27223b');
  oval(-1, -13, 19, 13, color);
  if (team === 1 && !official) {
    oval(-9, -23, 7, 7, color);
    oval(8, -23, 8, 8, color);
  }
  if (team === 0 && !official) {
    oval(-13, -16, 10, 6, '#f5a83b');
    line([[-13, -10], [-7, -17], [0, -11]], '#ffe46c', 3);
  }
  oval(10, -16, 8, 6, '#fff5df');
  oval(13, -16, 3, 4, '#1a1728');
  oval(17, -8, 5, 2, '#302135');
  const arm = step * 8;
  line([[7, 0], [13, 9], [24 + arm, 3]], color, 7);
  if (stick) line([[21 + arm, 8], [30 + arm, -10]], '#ffed73', 5);
  if (official) {
    box(-18, -27, 31, 6, '#233342');
    box(-3, -34, 15, 8, '#233342');
    oval(17, -6, 4, 3, '#ecaf35');
  }
  ctx.restore();
}

const stadium = document.createElement('canvas');
stadium.width = canvas.width;
stadium.height = canvas.height;

function drawStadium() {
  const sky = ctx.createLinearGradient(0, 0, 0, 130);
  sky.addColorStop(0, '#241b43');
  sky.addColorStop(1, '#594263');
  box(0, 0, 960, 350, '#332537');
  box(0, 0, 960, 116, sky);
  // Deterministic crowd pattern. The stands stay fixed as the runners move.
  for (let row = 0; row < 4; row++) {
    box(0, 51 + row * 13, 960, 3, '#aa809b50');
    for (let i = 0; i < 81; i++) {
      const seed = (i * 37 + row * 19) % 71;
      oval(i * 12 + seed % 8, 43 + row * 13 + seed % 6, 2 + seed % 2, 3, ['#f8a184', '#ffe296', '#615483', '#79c7c1'][seed % 4]);
    }
  }
  box(0, 106, 960, 11, '#edd099');
  box(0, 117, 960, 233, '#ad4b43');
  box(0, 130, 960, 77, '#b75449');
  box(0, 211, 960, 77, '#9c413c');
  for (const y of [128, 208, 289]) box(0, y, 960, 3, '#ffead09e');
  box(0, 293, 960, 57, '#231c30');
  stadium.getContext('2d').drawImage(canvas, 0, 0);
}

function drawGate(gate, y) {
  const x = 82 + gate.point * 788;
  const width = gate.width * 788;
  const color = {jump: '#ffffba', pass: '#ffe769', cup: '#a9f1ff', splash: '#82e5ff'}[gate.kind];
  box(x - width, y - 41, width * 2, 52, gate.inZone ? '#baf9a899' : color + '36');
  if (gate.kind === 'jump') {
    line([[x - 10, y], [x - 10, y - 21], [x + 9, y - 21], [x + 9, y]], color);
  } else if (gate.kind === 'pass') {
    line([[x, y - 28], [x, y + 7]], color, 3);
    words('↔', x, y - 31, 20, color, 'center');
  } else if (gate.kind === 'cup') {
    box(x - 4, y - 16, 8, 13, color);
    line([[x, y - 16], [x + 4, y - 21]], color, 2);
  } else {
    oval(x, y - 3, width, 9, color);
    oval(x + 3, y - 10, 5, 4, '#ffe769');
  }
}

function raceView() {
  for (let x = 82; x <= 872; x += 79) {
    box(x, 133, 1.5, 152, '#ffdfb842');
    words(String(Math.round((x - 82) / 7.88)), x + 4, 151, 12, '#ffdfb8a0');
  }
  for (let y = 131; y < 289; y += 8) {
    box(870 + (y % 16 ? 8 : 0), y, 8, 8, '#fff4dc');
    box(870 + (y % 16 ? 0 : 8), y, 8, 8, '#38273c');
  }
  if (!heat) {
    mascot(160, 187, 0, 0);
    mascot(208, 266, 1, 0);
    words('ON YOUR MARKS', 550, 233, 63, '#ffead1', 'center');
    words('HOT DOGS', 28, 326, 20, colors[0]);
    words('TURBO TOADS', 932, 326, 20, colors[1], 'right');
    return;
  }
  const {event, t} = heat;
  for (const [from, to] of event.surges ?? []) {
    box(82 + 788 * from, 131, 788 * (to - from), 154, '#ffe78420');
  }
  for (const [from, to] of event.terrain ?? []) box(82 + 788 * from, 131, 788 * (to - from), 154, '#76c8e326');
  if (!event.gate) box(82 + 788 * .85, 131, 788 * .15, 154, '#bdff9520');
  for (const runner of heat.runners) {
    const base = 170 + 80 * runner.team;
    const x = 82 + 788 * runner.p;
    const gate = readGate(event, runner);
    if (gate.point !== undefined) drawGate(gate, base + 21);
    const relay = event.gate === 'pass';
    if (relay && gate.point !== undefined) {
      const nextX = Math.min(875, 82 + gate.point * 788 + 34);
      ctx.globalAlpha = .48;
      mascot(nextX, base + 25, runner.team, 0);
      ctx.globalAlpha = 1;
    }
    if (runner.boost > 0) {
      for (let i = 0; i < 3; i++) line([[x - 34, base + i * 6], [x - 56 - i * 5, base + i * 6]], '#ffe08d', 2);
    }
    mascot(x, base + 23, runner.team, t > 0 && runner.finish === null ? t + runner.team : 0, {
      jump: ['jump', 'splash'].includes(gate.kind) && runner.boost > .26 ? 21 : 0,
      slow: runner.slow > 0,
      stick: relay,
      shoes: window.couchJoinstick?.profile?.(Number(runner.id))?.accent,
    });
    if (t < runner.swingUntil && relay) {
      line([[x + 22, base - 10], [x + 41, base + 13]], '#fff379', 7);
      line([[x + 42, base - 9], [x + 55, base - 3]], '#fff6df', 2);
    }
    if (t < runner.hitUntil) {
      words(relay ? 'BONK!' : 'OOP!', x + 24, base + 10, 21, '#ffea9b');
    }
    const split = relay ? ` · LEG ${runner.gateIndex + 1}` : '';
    words(`${runner.name}${split}`, clamp(x, 94, 846), base - 20, 16, '#fff9e8', 'center');
    if (runner.finish !== null) words(runner.finish === Infinity ? 'DQ' : 'FINISH', 927, base + 10, 24, '#ffea9b', 'center');
    const left = runner.team ? 518 : 30;
    const command = {pass: 'PASS!', jump: 'JUMP!', cup: 'GRAB CUP!', splash: 'HOLD I / Y!'}[gate.kind];
    const boost = event.surges?.find(([from, to]) => runner.p >= from && runner.p <= to)?.[2];
    const lean = !event.gate && !runner.leaned && runner.p >= .85;
    const hint = gate.inZone && !runner.gateUsed ? command : lean ? 'Y / I · LEAN' :
      boost ?? event.terrain?.find(([from, to]) => runner.p >= from && runner.p <= to)?.[3] ??
      (inBend(event, runner.p) ? 'BANKED TURN' : 'TURBO');
    words(hint, left, 317, 17, hint === command ? '#d7ff9b' : colors[runner.team]);
    box(left, 326, 390, 7, '#534557');
    box(left, 326, 390 * runner.tank, 7, colors[runner.team]);
    if (event.walk) {
      const beat = walkBeat(event, runner);
      box(left + 145, 305, 132, 10, '#554253');
      box(left + 145, 305, 40, 10, '#7bc79b');
      box(left + 145 + 130 * beat, 302, 3, 16, '#fff5df');
    }
    if (!event.walk && activeHuman(runner) && runner.finish === null && t >= 0) {
      const cursor = clamp((t - runner.lastStride) / (strideTarget(event) * 1.6));
      box(left + 167, 307, 103, 7, '#554253');
      box(left + 207, 307, 49, 7, '#85ce77');
      box(left + 167 + 101 * cursor, 305, 3, 11, '#fff8df');
      if (runner.flow) words(`×${runner.flow}`, left + 281, 315, 17, '#d4fa87');
    }
    words(`${runner.strikes}/3 flags`, left + 390, 316, 15, '#ffdeb5', 'right');
  }
}

function fieldMeter(runner, timing) {
  const left = runner.team ? 518 : 30;
  const width = 408;
  const {mode} = timing.skill;
  box(left, 323, width, 11, '#5b485b');
  if (mode === 'mash' || mode === 'sequence') {
    const progress = mode === 'mash' ? runner.taps / 12 : runner.sequence / 9;
    box(left, 323, width * clamp(progress), 11, colors[runner.team]);
    if (mode === 'sequence' && timing.ready) {
      words(controlLabels[fieldKey(timing, runner)], left + width / 2, 333, 18, '#fffbda', 'center');
    }
    return;
  }
  const bound = mode === 'balance' ? [.51, .79] : [.69 - timing.width, .69 + timing.width];
  box(left + bound[0] * width, 323, (bound[1] - bound[0]) * width, 11, '#a6e67f');
  const value = mode === 'balance' ? runner.balance : timing.cursor;
  box(left + value * width - 2, 320, 5, 17, '#fff8e7');
  if (mode === 'release') box(left, 337, width * clamp(runner.charge * 3.4), 3, colors[runner.team]);
}

function fieldView() {
  const {event, t} = heat;
  const timing = fieldTiming(event, t);
  const label = timing.done ? 'Final marks' : event.stages[timing.stage];
  const jumping = ['long', 'triple', 'high', 'pole'].includes(event.id);
  box(0, 119, 960, 174, jumping ? '#4a6a52' : '#365a51');
  for (let x = 22; x < 960; x += 90) box(x, 188, 42, 3, '#cbe3b451');
  box(0, 247, 960, 4, '#e7e3a96e');
  box(636, 182, 242, 73, jumping ? '#dba869' : '#74964f');
  if (event.id === 'high' || event.id === 'pole') {
    line([[716, 237], [716, 184], [829, 184], [829, 237]], '#fff19c', 4);
  } else if (!jumping) {
    ctx.beginPath();
    ctx.arc(745, 222, 25, 0, Math.PI * 2);
    ctx.strokeStyle = '#e9eaa5';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  words(label.toUpperCase(), 480, 154, 34, '#fff5df', 'center');
  const step = event.group === 'Field' ? `ATTEMPT ${timing.attempt + 1} / 2` :
    `STATION ${timing.stage + 1} / ${event.stages.length}`;
  if (!timing.done) words(`${step} · ${timing.ready ? timing.skill.label.toUpperCase() : 'GET SET'}`, 480, 177, 17, '#f7e6a3', 'center');
  for (const runner of heat.runners) {
    const x = runner.team ? 425 : 179;
    const active = t >= 0 && timing.ready && runner.finish === null;
    const flight = active && runner.stage === timing.index ? Math.sin(Math.PI * clamp(timing.elapsed / timing.span)) : 0;
    mascot(x + flight * (jumping ? 110 : 28), 259, runner.team, active ? t : 0, {
      jump: jumping ? flight * 38 : 0, stick: event.id === 'pole' || event.id === 'javelin',
      shoes: window.couchJoinstick?.profile?.(Number(runner.id))?.accent,
    });
    if (flight && !jumping) {
      const distance = Math.min(390, 240 * timing.elapsed);
      oval(x + distance, 222 - flight * 43, event.id === 'discus' ? 12 : 7, 4, colors[runner.team]);
    }
    words(runner.name, x, 281, 18, colors[runner.team], 'center');
    const left = runner.team ? 518 : 30;
    const points = Math.round(runner.mark * 100);
    const best = Math.round(runner.bestMark * 100);
    words(runner.finish === Infinity ? 'DQ' : `${points} PTS${best && !timing.done ? ' · BEST ' + best : ''}`, left, 315, 18, colors[runner.team]);
    words(`${runner.strikes}/3 FLAGS`, left + 408, 315, 15, '#ffdeb5', 'right');
    if (!timing.done) fieldMeter(runner, timing);
  }
}

function draw() {
  ctx.drawImage(stadium, 0, 0);
  if (heat?.event.stages) fieldView();
  else raceView();
  const observed = heat && watching();
  box(716, 16, 220, 57, observed ? '#772f47' : '#29283c');
  mascot(748, 69, 1, 0, {official: true});
  words('RACE OFFICIAL', 782, 36, 14, '#fff0d1');
  words(observed ? 'WATCHING!' : 'LOOKING AWAY', 782, 57, 19, observed ? '#ff947c' : '#a9f797');
  if (screen === 'live') {
    for (const runner of heat.runners.filter(activeHuman)) {
      const x = 20 + 242 * runner.team;
      words(runner.cooldown > 0 ? `TRICK READY IN ${Math.ceil(runner.cooldown)}` : runner.heat > .75 ? 'TOO SUSPICIOUS' : 'TRICK READY', x, 28, 17, colors[runner.team]);
      box(x, 35, 98, 4, '#2a2034');
      box(x, 35, 98 * clamp(runner.heat), 4, colors[runner.team]);
    }
  }
  let message = '';
  if (screen === 'live') {
    if (paused) message = 'PAUSED';
    else if (heat.callUntil > heat.t) message = heat.call;
    else if (heat.t < 0) message = String(Math.ceil(-heat.t));
    else if (heat.t < .4) message = 'GO!';
  }
  if (screen === 'result' && heat.photo) message = 'PHOTO FINISH';
  updateGameText($('call'), message);
}

const touchButtons = [...$('touch').querySelectorAll('button')];

function labelTouchControls() {
  if (!$('touch').classList.contains('playing')) return;
  const event = heat.event;
  const labels = {j: event.walk ? 'Step' : 'Stride', k: 'Turbo', i: event.gate ? 'Event' : 'Finish lean', l: 'Dirty trick'};
  if (event.stages) {
    const {skill} = fieldTiming(event, heat.t);
    labels.j = labels.k = labels.i = '';
    if (skill.mode === 'sequence') {
      labels.j = 'Step A';
      labels.i = 'Step Y';
    } else labels[skill.key] = skill.label;
  }
  for (const node of touchButtons) {
    const label = labels[node.dataset.key];
    updateGameText(node, label);
    node.style.visibility = label ? '' : 'hidden';
  }
}

function frame(now) {
  const dt = Math.min(.042, (now - lastFrame) / 1000);
  lastFrame = now;
  managePads();
  if (screen === 'live') updateHeat(dt);
  const state = `${screen}:${paused}`;
  if (state !== paintedScreen || (screen === 'live' && stadiumVisible && !paused && now - lastPaint >= 15)) {
    draw();
    if (screen === 'live') labelTouchControls();
    paintedScreen = state;
    lastPaint = now;
  }
  requestAnimationFrame(frame);
}

if (window.IntersectionObserver) {
  new IntersectionObserver(([entry]) => { stadiumVisible = entry.isIntersecting; }).observe(canvas);
}

drawStadium();
renderSetup();
window.couchJoinstick?.describe(describePhones);
requestAnimationFrame(frame);
