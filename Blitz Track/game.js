'use strict';

const $ = id => document.getElementById(id);
const teams = ['Hot Dogs', 'Turbo Toads'];
const colors = ['#ff8562', '#6df2ca'];
const cpuNames = [['Frank Furter', 'Mustard Mike', 'Relish Randy', 'Bun Jovi'], ['Hop Scotch', 'Wart Simpson', 'Croak Hogan', 'Ribbit De Niro']];
const byId = new Map(events.map(event => [event.id, event]));
const players = new Map([['keyboard', {id: 'keyboard', name: 'Keyboard', team: 0}]]);
const claims = new Map();
const held = new Set();
const touches = new Map();
const previousPads = new Map();
const padActions = [[0, 'j'], [1, 'k'], [3, 'i'], [2, 'l']];
const gateActions = {jump: 'Jump', splash: 'Hold Splash', pass: 'Pass baton', cup: 'Grab cup'};
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(value, maximum));
let program = [...quickMeet];
let connected = new Set();
let nextPlayer = 2;
let keyboardTeam = 0;
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

function element(tag, label, className) {
  const node = document.createElement(tag);
  node.textContent = label;
  if (className) node.className = className;
  return node;
}

function button(label, action, pressed) {
  const node = element('button', label);
  node.type = 'button';
  node.onclick = action;
  if (pressed !== undefined) node.setAttribute('aria-pressed', pressed);
  return node;
}

function available(team) {
  return [...players.values()].filter(player =>
    (team === undefined || team === player.team) && (player.id === 'keyboard' || connected.has(player.id)));
}

function enableSound() {
  if (!soundOn || !window.AudioContext) return;
  audio ??= new window.AudioContext();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
}

function tones(notes, type = 'triangle', duration = .11) {
  if (!soundOn || audio?.state !== 'running') return;
  notes.forEach((frequency, i) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + i * duration * .88;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.085, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  });
}

function setStatus(message) {
  if ($('status').textContent !== message) $('status').textContent = message;
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

function selectPlayer(select, team, selected) {
  select.append(new Option(team === undefined ? 'Captain assigns' : 'CPU', ''));
  for (const player of available(team)) {
    select.append(new Option(team === undefined ? `${player.name} · ${teams[player.team]}` : player.name, player.id));
  }
  select.value = selected ?? '';
}

function renderSetup() {
  const keyboard = players.get('keyboard');
  $('keyboard').setAttribute('aria-pressed', Boolean(keyboard));
  $('keyboard').textContent = keyboard ? 'Keyboard joined' : 'Join keyboard';
  $('switch').disabled = !keyboard;
  $('rosters').replaceChildren(...teams.map((name, team) => {
    const names = available(team).map((player, i) => player.name + (i === 0 ? ' ★' : ''));
    return element('div', `${name} · ${names.join(', ') || 'CPU'}`, team ? 'cool' : 'hot');
  }));
  $('program').replaceChildren(...program.map((id, index) => {
    const row = element('li', '');
    const name = byId.get(id).name;
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Choose the player for ${name}`);
    selectPlayer(select, undefined, claims.get(id));
    select.onchange = () => {
      if (select.value) claims.set(id, select.value);
      else claims.delete(id);
    };
    const remove = button('×', () => setProgram(program.filter(event => event !== id)));
    remove.setAttribute('aria-label', `Remove ${name} from position ${index + 1}`);
    row.append(element('span', name), select, remove);
    return row;
  }));
  $('groups').replaceChildren(...groups.map((group, i) => {
    const category = document.createElement('details');
    category.open = document.querySelectorAll('#groups details')[i]?.open ?? i === 0;
    category.append(element('summary', group));
    const chips = element('div', '', 'button-row');
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

function startMeet() {
  if (screen !== 'setup' || $('start').disabled) return;
  enableSound();
  scores = [0, 0];
  results = [];
  round = 0;
  openDesk();
}

function openDesk() {
  const event = byId.get(program[round]);
  const assigned = lockedEntry();
  chosen = [null, null];
  if (assigned) chosen[assigned.team] = assigned.id;
  else {
    const firstTeam = round % 2;
    const captain = available(firstTeam)[0] ?? available(1 - firstTeam)[0];
    if (captain) chosen[captain.team] = captain.id;
  }
  screen = 'desk';
  $('setup').hidden = true;
  $('desk').hidden = false;
  $('results').hidden = true;
  $('reset').hidden = true;
  $('assignments').hidden = false;
  $('desk-title').textContent = event.name;
  $('briefing').textContent = event.briefing + ' Dirty trick · ' + event.trick + '.';
  $('advance').textContent = 'Start event';
  refreshScore(`EVENT ${round + 1} / ${program.length}`, event.name);
  renderAssignments();
  $('advance').focus();
  setStatus('Clerk of the course: athletes to your marks.');
}

function lockedEntry() {
  const roster = available();
  return roster.length === 1 ? roster[0] : roster.find(player => player.id === claims.get(program[round]));
}

function renderAssignments() {
  const locked = lockedEntry();
  $('assignments').replaceChildren(...teams.map((team, index) => {
    const caption = element('label', team + ' ', index ? 'cool' : 'hot');
    const select = document.createElement('select');
    const entry = locked ? (locked.team === index ? locked.id : null) : chosen[index];
    selectPlayer(select, index, available(index).some(player => player.id === entry) ? entry : null);
    select.disabled = Boolean(locked) || available(index).length === 0;
    select.onchange = () => assign(index, select.value);
    caption.append(select);
    return caption;
  }));
  $('desk-help').textContent = locked
    ? `${locked.name} represents ${teams[locked.team]}${available().length === 1 ? ' in solo play' : ' by event claim'}.`
    : 'One human per event. A team captain can press Y to cycle their entry. Picking a human moves the other team to CPU.';
}

function assign(team, id) {
  chosen[team] = id || null;
  if (id) chosen[1 - team] = null;
  renderAssignments();
  $('assignments').querySelectorAll('select')[team].focus();
}

function beginHeat() {
  const event = byId.get(program[round]);
  const representative = lockedEntry() ?? available().find(player => chosen.includes(player.id));
  heat = {
    event, t: -2.6, call: '', callUntil: -5, refOffset: Math.random() * .8,
    runners: teams.map((_, team) => {
      const player = representative?.team === team ? representative : null;
      return {
        id: player?.id, name: player?.name ?? cpuNames[team][round % cpuNames[team].length],
        team, p: 0, tank: .83, cadence: 0, lastStride: -10, boost: 0, slow: 0, loaded: 0,
        gateIndex: 0, gateUsed: false, kick: 0, strikes: 0, cooldown: 0, heat: 0,
        finish: null, mark: 0, stage: -1, taps: 0, charge: 0, cheatMark: 0,
        cpuPace: .96 + Math.random() * .12, cpuTrick: 3.4 + Math.random() * 3,
      };
    }),
  };
  screen = 'live';
  paused = false;
  $('desk').hidden = true;
  $('pause').hidden = false;
  $('pause').textContent = 'Pause';
  $('touch').classList.toggle('playing', representative?.id === 'keyboard');
  setStatus(`Dirty trick · ${event.trick}. Watch the official!`);
}

function announce(message, duration = 1) {
  heat.call = message;
  heat.callUntil = heat.t + duration;
}

function watching() {
  const clock = Math.max(0, heat.t) + heat.refOffset;
  return clock % 4.2 >= 2.75;
}

function foul(runner, call) {
  runner.strikes++;
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
  const rival = heat.runners[1 - runner.team];
  if (heat.event.stages) runner.cheatMark = .34;
  else {
    const baton = heat.event.gate === 'pass';
    const spike = heat.event.prank === 'spike';
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
    if (event.walk) {
      const clean = walkBeat(event, runner) < .30;
      runner.cadence = clean ? 1 : runner.cadence * .52;
    } else if (interval >= (event.rhythm ? .22 : .105)) {
      const clean = !event.rhythm || interval < .48;
      runner.cadence = clamp(runner.cadence + (clean ? .37 : .13));
      if (clean && event.rhythm) runner.tank = clamp(runner.tank + .075);
      runner.kick = clamp(runner.kick + .07);
    } else if (event.rhythm) {
      runner.cadence *= .82;
    }
    if (t < .31 && runner.lastStride < -3 && !event.walk) {
      runner.boost = event.launch ?? .68;
      announce('QUICK START!', .65);
    }
    if (interval >= .105 || event.rhythm || event.walk) runner.lastStride = t;
  }
  if (down && key === 'k' && event.kick && runner.p >= .72 && runner.kick > .3) {
    runner.boost = 1.8 * runner.kick;
    runner.kick = 0;
  }
  if (down && key === 'i') {
    const gate = readGate(event, runner);
    if (gate.inZone && gate.kind !== 'splash' && !runner.gateUsed) clearGate(runner, gate.kind);
  }
}

function walkBeat(event, runner) {
  const period = event.shift && runner.p >= .5 ? event.shift : event.walk;
  return Math.max(0, heat.t) % period / period;
}

function clearGate(runner, kind) {
  runner.gateUsed = true;
  if (activeHuman(runner)) tones(kind === 'pass' ? [392, 588] : [587]);
  if (kind === 'cup') runner.tank = clamp(runner.tank + .54);
  else runner.boost = kind === 'pass' ? .58 : .43;
}

function activeHuman(runner) {
  return runner.id && (runner.id === 'keyboard' ? players.has('keyboard') : connected.has(runner.id));
}

function downFor(runner, key) {
  if (runner.id === 'keyboard') return held.has(key) || [...touches.values()].includes(key);
  const index = {j: 0, k: 1, i: 3, l: 2}[key];
  return previousPads.get(runner.id)?.has(index) ?? false;
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
  if (human && !runner.gateUsed && gate.kind === 'splash' && gate.inZone && downFor(runner, 'i')) {
    runner.loaded += dt;
    if (runner.loaded >= .14) clearGate(runner, 'splash');
  }
  if (gate.point !== undefined && runner.p > gate.point + gate.width) {
    if (!human && Math.random() < .84) clearGate(runner, gate.kind);
    if (!runner.gateUsed && gate.kind !== 'cup') {
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
  const turboPower = usingTurbo ? (runner.p < (event.bend ?? 0) ? -.23 : surge ? .74 : .39) : 0;
  const stridePower = human ? .62 + .58 * runner.cadence : runner.cpuPace * (event.walk ? .91 : 1);
  const multiplier = runner.slow > 0 ? .45 : 1;
  const pace = (stridePower + turboPower + (runner.boost > 0 ? .49 : 0)) * multiplier;
  runner.p = clamp(runner.p + pace * dt / event.seconds);
  if (runner.p >= 1 && runner.finish === null) runner.finish = t;
  runner.cadence = Math.max(0, runner.cadence - dt * (event.walk ? 1.1 : 1.02));
}

function fieldTiming(event, seconds) {
  // Every station gets a full meter pass and a moment to read the next action.
  const span = event.period ? 2.35 : 2.65;
  const stage = Math.floor(Math.max(0, seconds) / span);
  const elapsed = Math.max(0, seconds) % span;
  const period = event.chain ? Math.max(.56, event.period - stage * .06) : event.period ?? 1.08;
  const cursor = 1 - Math.abs(1 - 2 * Math.max(0, elapsed - .48) / period % 2);
  const mode = event.modes?.[stage] ?? 'tap';
  const width = event.widths?.[stage] ?? .145;
  return {stage, elapsed, cursor, mode, width, ready: elapsed >= .48};
}

function fieldAction(event, runner, key, down) {
  if (key !== 'j' || runner.slow > 0) return;
  const timing = fieldTiming(event, heat.t);
  if (!timing.ready || runner.stage === timing.stage) return;
  if (timing.mode === 'mash') {
    if (down && heat.t - runner.lastStride > .105) {
      runner.taps++;
      runner.lastStride = heat.t;
    }
    return;
  }
  if ((timing.mode === 'tap' && down) || (timing.mode === 'release' && !down && runner.charge > .06)) {
    const error = Math.abs(timing.cursor - .69);
    const accuracy = error <= timing.width ? 1 : clamp(.72 - error);
    const power = timing.mode === 'release' ? .66 + .34 * clamp(runner.charge * 4) : 1;
    runner.mark += accuracy * power + runner.cheatMark;
    runner.cheatMark = 0;
    runner.stage = timing.stage;
    if (accuracy === 1 && event.chain) runner.mark += .09;
    announce(accuracy === 1 ? 'NAILED IT!' : 'WOBBLY!', .53);
  }
}

function updateField(runner, dt) {
  const {event, t} = heat;
  const timing = fieldTiming(event, t);
  if (runner.timingStage !== timing.stage) {
    if (runner.timingStage !== undefined && runner.stage < runner.timingStage) {
      const previousMode = event.modes?.[runner.timingStage];
      if (previousMode === 'mash' && activeHuman(runner)) {
        runner.mark += clamp(runner.taps / 10) + runner.cheatMark;
        runner.cheatMark = 0;
      }
    }
    runner.timingStage = timing.stage;
    runner.taps = 0;
    runner.charge = 0;
  }
  if (timing.stage >= event.stages.length) {
    runner.finish = t;
    return;
  }
  if (!activeHuman(runner) && timing.elapsed >= 1.34 && runner.stage < timing.stage) {
    runner.mark += Math.max(0, .49 + Math.random() * .41 + runner.cheatMark - (runner.slow > 0 ? .34 : 0));
    runner.cheatMark = 0;
    runner.stage = timing.stage;
  }
  if (timing.ready && timing.mode === 'release' && downFor(runner, 'j')) runner.charge += dt;
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
  const headline = winner >= 0 ? `${teams[winner]} take it!` : a.finish === Infinity ? 'Double DQ!' : 'Dead heat!';
  results.push(`${heat.event.name} · ${headline} ${a.name} ${showMark(a)} / ${b.name} ${showMark(b)}`);
  screen = 'result';
  $('touch').classList.remove('playing');
  $('desk').hidden = false;
  $('pause').hidden = true;
  $('assignments').hidden = true;
  $('results').hidden = false;
  $('results').replaceChildren(...results.map(result => element('li', result)));
  const last = round + 1 === program.length;
  const champion = scores[0] === scores[1] ? 'Meet tied!' : `${teams[scores[0] > scores[1] ? 0 : 1]} win the meet!`;
  $('desk-title').textContent = last ? champion : headline;
  $('briefing').textContent = results.at(-1);
  $('desk-help').textContent = '3 meet points for a win · 1 each for a tie · 0 for a double DQ';
  $('advance').hidden = last;
  $('advance').textContent = 'Next event';
  $('reset').hidden = !last;
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
  const locked = screen === 'desk' ? lockedEntry() : null;
  const entry = screen === 'desk' ? locked ?? roster.find(candidate => chosen.includes(candidate.id)) : null;
  for (const player of roster) {
    if (!window.couchJoinstick.label(Number(player.id))) continue;
    const buttons = {};
    const description = {player: player.name, team: teams[player.team], buttons, hint: ''};
    descriptions[player.id] = description;
    if (screen === 'setup') {
      buttons[5] = 'Switch team';
      if (!$('start').disabled) buttons[9] = 'Start meet';
      description.hint = 'Pick events and claim entries on the shared screen.';
    } else if (screen === 'desk') {
      buttons[9] = 'Start event';
      if (!locked && available(player.team)[0] === player) buttons[3] = 'Choose athlete';
      description.hint = entry === player ? 'You’re up. Start the event and watch the stadium.'
        : buttons[3] ? 'Cycle through your teammates or CPU. The shared screen shows the entry.'
          : 'Watch the shared screen for the next event.';
    } else if (screen === 'result') {
      buttons[9] = round + 1 < program.length ? 'Next event' : 'Back to setup';
      description.hint = 'The result is on the shared screen.';
    } else {
      const runner = heat.runners.find(candidate => candidate.id === player.id);
      if (roster[0] === player) buttons[9] = paused ? 'Resume' : 'Pause';
      if (paused) description.hint = 'Event paused.';
      else if (!runner || runner.finish !== null) description.hint = 'Watch the rest of the event on the shared screen.';
      else if (heat.event.stages) {
        const timing = fieldTiming(heat.event, heat.t);
        const stage = heat.event.stages[timing.stage];
        buttons[0] = timing.mode === 'release' ? 'Hold / release' : timing.mode === 'mash' ? 'Build power' : 'Time it';
        buttons[2] = 'Dirty trick';
        description.hint = timing.mode === 'release' ? `${stage} · Hold, then release in green on the shared screen.`
          : `${stage} · Follow the meter on the shared screen.`;
      } else {
        const gate = readGate(heat.event, runner);
        buttons[0] = heat.event.walk ? 'Step' : 'Stride';
        buttons[1] = 'Turbo';
        buttons[2] = 'Dirty trick';
        if (gate.point !== undefined) buttons[3] = gateActions[gate.kind];
        description.hint = heat.t < 0 ? 'Eyes up. Tap on GO on the shared screen.'
          : gate.kind === 'splash' && gate.point !== undefined ? 'Hold through the blue zone on the shared screen.'
            : 'Watch the shared screen for timing and the official.';
      }
    }
  }
  return descriptions;
}

function managePads() {
  const pads = [...(navigator.getGamepads?.() ?? []), ...(window.couchJoinstick?.sample() ?? [])].filter(Boolean);
  const nextConnected = new Set(pads.map(pad => String(pad.index)));
  const changed = [...connected].some(id => !nextConnected.has(id)) || [...nextConnected].some(id => !connected.has(id));
  if (screen === 'live') {
    for (const runner of heat.runners) {
      if (!runner.id || runner.id === 'keyboard') continue;
      if (connected.has(runner.id) && !nextConnected.has(runner.id)) {
        runner.charge = runner.loaded = 0;
        announce(`${teams[runner.team]} · CPU TAKES OVER`, 1.5);
      } else if (!connected.has(runner.id) && nextConnected.has(runner.id)) {
        announce(`${teams[runner.team]} · PLAYER BACK IN`, 1.2);
      }
    }
  }
  connected = nextConnected;
  for (const pad of pads) {
    const id = String(pad.index);
    const last = previousPads.get(id) ?? new Set();
    const down = new Set(pad.buttons.flatMap((value, index) => value.pressed ? [index] : []));
    const press = index => down.has(index) && !last.has(index);
    previousPads.set(id, down);
    if (pad.inputCanceled) {
      const runner = screen === 'live' && heat.runners.find(candidate => candidate.id === id);
      if (runner) runner.charge = runner.loaded = 0;
      continue;
    }
    if (screen === 'setup' && !players.has(id) && press(0)) {
      const roster = available();
      const team = roster.filter(player => player.team === 0).length > roster.filter(player => player.team === 1).length ? 1 : 0;
      const name = window.couchJoinstick?.label(pad.index) ?? `Pad ${pad.index + 1}`;
      players.set(id, {id, name: `P${nextPlayer++} · ${name}`, team});
      renderSetup();
      continue;
    }
    const player = players.get(id);
    if (!player) continue;
    if (screen === 'setup' && press(5)) {
      player.team = 1 - player.team;
      renderSetup();
    }
    if (screen === 'desk' && press(3) && available(player.team)[0] === player) {
      const select = $('assignments').querySelectorAll('select')[player.team];
      if (!select.disabled) assign(player.team, select.options[(select.selectedIndex + 1) % select.options.length].value);
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
        if (down.has(index) !== last.has(index)) action(runner, key, down.has(index));
      }
    }
  }
  if (changed) {
    for (const id of previousPads.keys()) if (!connected.has(id)) previousPads.delete(id);
    if (screen === 'setup') renderSetup();
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
  if (!['j', 'k', 'i', 'l'].includes(key) || screen !== 'live') return;
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
$('start').onclick = startMeet;
$('advance').onclick = advance;
$('reset').onclick = reset;
$('pause').onclick = pause;
$('quick').onclick = () => setProgram([...quickMeet]);
$('full').onclick = () => setProgram(events.map(event => event.id));
$('clear').onclick = () => setProgram([]);
$('keyboard').onclick = () => {
  if (players.has('keyboard')) players.delete('keyboard');
  else players.set('keyboard', {id: 'keyboard', name: 'Keyboard', team: keyboardTeam});
  renderSetup();
};
$('switch').onclick = () => {
  keyboardTeam = 1 - keyboardTeam;
  players.get('keyboard').team = keyboardTeam;
  renderSetup();
};

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

function mascot(x, floor, team, time, {jump = 0, slow = false, stick = false, official = false} = {}) {
  const color = official ? '#fff0cb' : colors[team];
  const step = Math.sin(time * (slow ? 14 : 25));
  const y = floor - 27 - Math.abs(step) * 3 - jump;
  oval(x, floor + 3, 22, 5, '#301e2988');
  ctx.save();
  ctx.translate(x, y);
  line([[-6, 11], [-8 + step * 13, 18], [-12 + step * 18, 23]], '#2e2032', 7);
  line([[6, 11], [8 - step * 13, 17], [12 - step * 18, 23]], '#452d42', 7);
  oval(-11 + step * 17, 24, 7, 3.5, '#fff5df');
  oval(14 - step * 17, 24, 7, 3.5, '#fff5df');
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

function stadium() {
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
    const hint = gate.inZone && !runner.gateUsed ? command : boost ?? (event.bend && runner.p < event.bend ? 'BANKED TURN' : 'TURBO');
    words(hint, left, 317, 17, hint === command ? '#d7ff9b' : colors[runner.team]);
    box(left, 326, 390, 7, '#534557');
    box(left, 326, 390 * runner.tank, 7, colors[runner.team]);
    if (event.walk) {
      const beat = walkBeat(event, runner);
      box(left + 145, 305, 132, 10, '#554253');
      box(left + 145, 305, 40, 10, '#7bc79b');
      box(left + 145 + 130 * beat, 302, 3, 16, '#fff5df');
    }
    words(`${runner.strikes}/3 flags`, left + 390, 316, 15, '#ffdeb5', 'right');
  }
}

function fieldView() {
  const {event, t} = heat;
  const timing = fieldTiming(event, t);
  const label = event.stages[timing.stage] ?? 'Results';
  box(0, 119, 960, 174, '#435d42');
  box(0, 186, 960, 3, '#a9bc7970');
  box(0, 249, 960, 3, '#a9bc7970');
  const jumping = ['long', 'triple', 'high', 'pole'].includes(event.id);
  box(642, 182, 230, 73, jumping ? '#dba869' : '#64774a');
  if (event.id === 'high' || event.id === 'pole') {
    line([[702, 235], [702, 184], [799, 184], [799, 235]], '#fff19c', 4);
  }
  const mode = {tap: 'TAP J / A IN GREEN', release: 'HOLD J / A · RELEASE IN GREEN', mash: 'TAP J / A FAST'}[timing.mode];
  words(label.toUpperCase(), 480, 157, 35, '#fff5df', 'center');
  words(timing.ready ? mode : 'GET SET', 480, 181, 19, '#f7e6a3', 'center');
  for (const runner of heat.runners) {
    const x = runner.team ? 408 : 187;
    const active = t >= 0 && timing.ready && runner.finish === null;
    const flight = active && runner.stage === timing.stage ? Math.sin(Math.PI * clamp(timing.elapsed / 2.65)) : 0;
    mascot(x + 26 * flight, 260, runner.team, active ? t : 0, {jump: jumping ? flight * 35 : 0, stick: event.id === 'pole' || event.id === 'javelin'});
    if (flight && !jumping && event.group === 'Field') oval(x + 240 * timing.elapsed, 220 - flight * 25, 7, 4, colors[runner.team]);
    words(runner.name, x, 281, 18, colors[runner.team], 'center');
    words(runner.finish === Infinity ? 'DQ' : `${Math.round(runner.mark * 100)} PTS · ${runner.strikes}/3 FLAGS`, runner.team ? 932 : 28, 315, 18, colors[runner.team], runner.team ? 'right' : 'left');
  }
  const human = heat.runners.find(activeHuman);
  const meter = timing.mode === 'mash' ? clamp((human?.taps ?? 0) / 10) : timing.cursor;
  box(320, 317, 320, 15, '#594659');
  if (timing.mode !== 'mash') {
    box(320 + (.69 - timing.width) * 320, 317, timing.width * 640, 15, '#b0e888');
    box(318 + meter * 320, 313, 5, 23, '#fff8e8');
  } else box(320, 317, 320 * meter, 15, '#b0e888');
}

function draw() {
  stadium();
  if (heat?.event.stages) fieldView();
  else raceView();
  const observed = heat && watching();
  box(716, 16, 220, 57, observed ? '#772f47' : '#29283c');
  mascot(748, 69, 1, 0, {official: true});
  words('RACE OFFICIAL', 782, 36, 14, '#fff0d1');
  words(observed ? 'WATCHING!' : 'LOOKING AWAY', 782, 57, 19, observed ? '#ff947c' : '#a9f797');
  const runner = heat?.runners.find(activeHuman);
  if (runner && screen === 'live') {
    words(runner.cooldown > 0 ? `TRICK READY IN ${Math.ceil(runner.cooldown)}` : runner.heat > .75 ? 'TOO SUSPICIOUS' : 'TRICK READY', 20, 28, 17, '#ffedb7');
    box(20, 35, 98, 4, '#2a2034');
    box(20, 35, 98 * clamp(runner.heat), 4, '#ffa955');
  }
  let message = '';
  if (screen === 'live') {
    if (paused) message = 'PAUSED';
    else if (heat.callUntil > heat.t) message = heat.call;
    else if (heat.t < 0) message = String(Math.ceil(-heat.t));
    else if (heat.t < .4) message = 'GO!';
  }
  if ($('call').textContent !== message) $('call').textContent = message;
}

function frame(now) {
  const dt = Math.min(.042, (now - lastFrame) / 1000);
  lastFrame = now;
  managePads();
  if (screen === 'live') updateHeat(dt);
  draw();
  requestAnimationFrame(frame);
}

renderSetup();
window.couchJoinstick?.describe(describePhones);
requestAnimationFrame(frame);
