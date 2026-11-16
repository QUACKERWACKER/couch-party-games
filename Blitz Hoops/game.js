'use strict';

const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const colors = ['#ff826f', '#72e6de'];
const names = ['HOT DOGS', 'TURBO TOADS'];
const basket = [854, 106];
const center = 250;
const three = 222;
const dunkRange = 55;
const shotTiers = [
  {name: 'CLOSE',   maxRange: 112,      center: .49, green: .092, amber: .215, odds: [.98, .74, .33]},
  {name: 'MIDRANGE', maxRange: 205,     center: .57, green: .065, amber: .175, odds: [.91, .56, .22]},
  {name: 'LONG',    maxRange: 275,      center: .65, green: .043, amber: .127, odds: [.77, .39, .12]},
  {name: 'DEEP',    maxRange: 385,      center: .75, green: .024, amber: .083, odds: [.54, .22, .055]},
  {name: 'HEAVE',   maxRange: Infinity, center: .85, green: .018, amber: .056, odds: [.28, .095, .02]}
];
const releaseNames = ['GREEN', 'AMBER', 'RED'];
const maxCharge = 1.25;
const possessionTime = 12;
const periodTime = 28;
const injuryReplayTime = 1.65;
const freeThrowStart = .35;
const freeThrowSpeed = 1.17;
const freeThrowWindow = .065;
const benchCheer = [0, 0];
const cpuArchetypes = [
  ['Sharpshooter', 68, 94, 49, 58, 71],
  ['Rim Runner', 83, 53, 94, 67, 61],
  ['Lockdown', 70, 54, 67, 95, 61],
  ['Playmaker', 79, 67, 58, 66, 95],
  ['Speedster', 96, 61, 73, 58, 68],
  ['Two-Way', 74, 77, 62, 86, 67],
  ['Slasher', 89, 51, 88, 58, 73],
  ['Floor General', 61, 79, 57, 71, 91]
];
const firstNames = ['Jalen', 'Drew', 'Kai', 'Micah', 'Avery', 'Cruz', 'Jules', 'Nico', 'Jordan', 'Remy', 'Sasha', 'Tate'];
const lastNames = ['Banks', 'Cross', 'Fox', 'Grant', 'King', 'Knight', 'Lane', 'Price', 'Reed', 'Rivers', 'Stone', 'Wells'];
const attributes = ['Speed', 'Shooting', 'Finishing', 'Defense', 'Passing'];
const controls = new Map();
const pads = new Map();
const keys = new Set();
const keyboard = {side: 0, enabled: true};
const empty = {x: 0, y: 0, down: [], press: [], release: []};
const players = Array.from({length: 6}, (_, i) => ({side: Math.floor(i / 3), slot: i % 3}));
const score = [0, 0];
const particles = [];
const replayFrames = [];
const highlights = [];
const fouls = [0, 0];
const referee = {x: 480, y: 435};
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
let sequence, draft, periodResult, replaySample = 0;
let mode = 'lobby', quarter = 1, time = periodTime, shotClock = possessionTime, side = 0;
let difficulty = 1, possessionAge = 0, inbound = 0, callTime = 0;
let owner, flight, loose, assist, previousKeys = [], audio;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rim = team => ({x: basket[team], y: center});
const team = which => players.filter(p => p.side === which);
function isThree(p) {
  const depth = (basket[p.side] - p.x) * (p.side ? -1 : 1);
  const width = Math.abs(p.y - center);
  return width >= 188 || depth >= Math.sqrt(three * three - width * width);
}
const humans = () => [...(keyboard.enabled ? [keyboard] : []), ...pads.values()];
const nearest = (point, candidates) => candidates.reduce((best, p) =>
  !best || distance(p, point) < distance(best, point) ? p : best, null);

function tone(notes) {
  if (!audio || audio.state !== 'running') return;
  notes.forEach((frequency, i) => {
    const start = audio.currentTime + i * .067;
    const wave = audio.createOscillator();
    const gain = audio.createGain();
    wave.type = 'triangle';
    wave.frequency.value = frequency;
    gain.gain.setValueAtTime(.095, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + .12);
    wave.connect(gain).connect(audio.destination);
    wave.start(start);
    wave.stop(start + .12);
  });
}

function call(message, duration = 1.1) {
  $('call').textContent = message;
  $('call').hidden = false;
  $('status').textContent = message;
  callTime = duration;
}

function layout(which, tip = false) {
  replayFrames.length = 0;
  replaySample = 0;
  players.forEach(p => {
    const attack = p.side ? -1 : 1;
    const offense = p.side === which;
    p.x = 480 + attack * (offense ? (p.slot ? 22 : -65) : (p.slot ? -72 : -8));
    p.y = p.slot ? center + (p.slot === 1 ? -112 : 112) : center + (offense ? 0 : 36);
    Object.assign(p, {vx: 0, vy: 0, charge: 0, jump: 0, swipe: 0, ready: 0, request: 0, energy: 1});
  });
  side = which;
  owner = team(which).find(p => p.human) || team(which)[0];
  if (owner.slot) {
    const guard = team(which)[0];
    [guard.x, owner.x] = [owner.x, guard.x];
    [guard.y, owner.y] = [owner.y, guard.y];
  }
  flight = loose = assist = null;
  shotClock = possessionTime;
  possessionAge = 0;
  inbound = tip ? .9 : .63;
}

function assignPlayers() {
  players.forEach(p => { p.human = p.phoneSeat = null; });
  humans().forEach((human, index) => {
    human.number = index + 1;
    const slot = team(human.side).find(p => !p.human);
    if (slot) {
      slot.human = human;
      if (human.phone) slot.phoneSeat = human;
    }
  });
  $('roster').textContent = humans().map(p => `P${p.number} · ${names[p.side]}${p.phone ? p.online ? ' · PHONE' : ' · PHONE OFFLINE' : ''}`).join('  /  ') || 'CPU exhibition';
  $('team').textContent = names[keyboard.side] + ' ↔';
  $('team').disabled = !keyboard.enabled;
}

function switchSide(human) {
  if (humans().filter(p => p.side !== human.side).length < 3) human.side = 1 - human.side;
  assignPlayers();
  layout(0);
}

function menuAction() {
  if (!['lobby', 'end', 'pause'].includes(mode)) return;
  if (!audio && window.AudioContext) audio = new AudioContext();
  audio?.resume().catch(() => {});
  if (mode === 'pause') {
    resumePlay();
    return;
  }
  for (const [index, profile] of pads) {
    if (profile.phone && !profile.online) pads.delete(index);
  }
  assignPlayers();
  for (const p of players) p.cpu = null;
  draft = {pool: createProspects(), side: 0, index: 0, direction: 0};
  const captain = humans()[0];
  nextDraftPick(captain?.side ?? 0);
}

function createProspects() {
  const first = [...firstNames], last = [...lastNames];
  const take = list => list.splice(Math.floor(Math.random() * list.length), 1)[0];
  return cpuArchetypes.map(([role, ...ratings]) => {
    const surname = take(last);
    const values = ratings.map(rating => rating + Math.floor(Math.random() * 9) - 4);
    const [speed, shooting, finishing, defense, passing] = values;
    return {name: `${take(first)} ${surname}`, surname, role, values, speed, shooting, finishing, defense, passing};
  });
}

function draftCaptain(which) {
  return team(which).find(p => p.human)?.human;
}

function openDraftSlot(which) {
  return team(which).find(p => !p.human && !p.phoneSeat && !p.cpu);
}

function nextDraftPick(preferred) {
  const picking = [preferred, 1 - preferred].find(which => openDraftSlot(which) && draftCaptain(which));
  if (picking !== undefined) {
    draft.side = picking;
    draft.index = 0;
    draft.direction = 0;
    mode = 'draft';
    overlay('CPU DRAFT', `P${draftCaptain(picking).number} picks for ${names[picking]}`, '');
    renderDraft();
    $('title').focus({preventScroll: true});
    return;
  }
  for (const p of players) {
    if (!p.human && !p.cpu) {
      const index = Math.floor(Math.random() * draft.pool.length);
      p.cpu = draft.pool.splice(index, 1)[0];
    }
  }
  draft = null;
  beginMatch();
}

function pickCPU(index) {
  if (mode !== 'draft' || !draft.pool[index]) return;
  const slot = openDraftSlot(draft.side);
  if (!slot) return;
  slot.cpu = draft.pool.splice(index, 1)[0];
  tone([392, 587]);
  nextDraftPick(1 - draft.side);
}

function browseDraft(direction) {
  const length = draft.pool.length;
  draft.index = (draft.index + direction + length) % length;
  updateDraftSelection();
}

function updateDraftSelection() {
  const cards = [...$('draft-pool').children];
  cards.forEach((card, i) => { card.dataset.selected = i === draft.index; });
  cards[draft.index]?.scrollIntoView({block: 'nearest'});
}

function renderDraft() {
  $('draft-rosters').textContent = [0, 1].map(which => {
    const roster = team(which).map(p => p.human ? `P${p.human.number}` : p.cpu?.name || 'Open');
    return `${names[which]} · ${roster.join(' / ')}`;
  }).join('  |  ');
  const cards = draft.pool.map((prospect, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    const title = document.createElement('strong');
    title.textContent = prospect.name;
    const role = document.createElement('small');
    role.textContent = prospect.role;
    const ratings = document.createElement('small');
    ratings.className = 'rating-line';
    ratings.textContent = attributes.map((name, j) => `${name} ${prospect.values[j]}`).join(' · ');
    const traits = document.createElement('small');
    traits.textContent = `Best: ${attributes[prospect.values.indexOf(Math.max(...prospect.values))]} · Weakest: ${attributes[prospect.values.indexOf(Math.min(...prospect.values))]}`;
    card.append(title, role, ratings, traits);
    card.addEventListener('click', () => pickCPU(i));
    card.addEventListener('focus', () => {
      draft.index = i;
      updateDraftSelection();
    });
    return card;
  });
  $('draft-pool').replaceChildren(...cards);
  updateDraftSelection();
}

function cancelDraft() {
  if (mode !== 'draft') return;
  draft = null;
  mode = 'lobby';
  assignPlayers();
  overlay('TIP-OFF', '3-on-3 · Four 28-second quarters', 'TIP OFF');
}

function beginMatch() {
  score.fill(0);
  fouls.fill(0);
  benchCheer.fill(0);
  replayFrames.length = highlights.length = 0;
  sequence = null;
  quarter = 1;
  periodResult = null;
  time = periodTime;
  particles.length = 0;
  for (const p of players) {
    Object.assign(p, {fatigue: 0, injury: 0, injuryCooldown: 0});
    const human = p.human || p.phoneSeat;
    p.statsLabel = human ? `P${human.number}` : p.cpu.name;
    p.stats = {points: 0, fieldGoals: 0, shots: 0, threes: 0, threeAttempts: 0,
      freeThrows: 0, freeThrowAttempts: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, fouls: 0};
  }
  layout(0, true);
  call('TIP-OFF!');
  tone([392, 587, 784]);
  resumePlay();
}

function resumePlay() {
  mode = 'live';
  $('overlay').hidden = true;
  canvas.focus({preventScroll: true});
  $('pause').disabled = false;
  $('skip-show').hidden = sequence?.kind !== 'halftime';
}

function overlay(title, intro, button) {
  $('title').textContent = title;
  $('intro').textContent = intro;
  $('start').textContent = button;
  $('overlay').hidden = false;
  $('lobby').hidden = mode === 'pause' || mode === 'draft';
  $('draft').hidden = mode !== 'draft';
  $('start').hidden = mode === 'draft';
  $('box-score').hidden = mode !== 'end';
  $('overlay').scrollTop = 0;
  $('pause').disabled = true;
}

function togglePause() {
  if (mode === 'pause') menuAction();
  else if (mode === 'live') {
    mode = 'pause';
    $('skip-show').hidden = true;
    overlay('TIMEOUT', 'Game paused', 'RESUME');
  }
}

function readInputs() {
  controls.clear();
  const down = ['KeyJ', 'KeyK', 'KeyL', 'KeyI'].map(code => keys.has(code));
  if (keyboard.enabled) {
    controls.set(keyboard, input(
      +(keys.has('KeyD') || keys.has('ArrowRight')) - +(keys.has('KeyA') || keys.has('ArrowLeft')),
      +(keys.has('KeyS') || keys.has('ArrowDown')) - +(keys.has('KeyW') || keys.has('ArrowUp')),
      down, previousKeys
    ));
  }
  previousKeys = down;
  let gamepads = [];
  try {
    gamepads = Array.from(navigator.getGamepads?.() || []);
  } catch {
    if (!window.couchJoinstick) return;
  }
  gamepads.push(...(window.couchJoinstick?.sample() || []));
  const seen = new Set();
  const now = performance.now();
  for (const pad of gamepads) {
    if (!pad?.connected || pad.mapping !== 'standard') continue;
    seen.add(pad.index);
    let profile = pads.get(pad.index);
    const buttons = [0, 1, 2, 3, 5, 9].map(i => !!pad.buttons[i]?.pressed);
    const pressed = i => !!pad.buttons[i]?.pressed;
    if (profile?.phone && !profile.online) {
      profile.online = true;
      profile.last = buttons;
      if (mode === 'lobby' || mode === 'end') assignPlayers();
      else {
        const player = players.find(p => p.phoneSeat === profile);
        if (player) {
          player.human = profile;
          player.charge = 0;
          player.cpu = null;
        }
        if (mode === 'draft') nextDraftPick(draft.side);
      }
    }
    if (!profile && buttons[0] && (mode === 'lobby' || mode === 'end')) {
      const red = humans().filter(p => !p.side).length;
      const blue = humans().length - red;
      if (red + blue < 6) {
        profile = {side: red <= blue ? 0 : 1, last: buttons, phone: pad.source === 'joinstick', online: true};
        pads.set(pad.index, profile);
        assignPlayers();
      }
    }
    if (!profile) continue;
    if (pad.resetInputs) {
      const player = players.find(p => p.human === profile);
      if (player) {
        player.charge = player.request = 0;
        player.vx = player.vy = 0;
      }
      profile.last = buttons;
      continue;
    }
    const state = input(
      (pressed(15) ? 1 : pressed(14) ? -1 : pad.axes[0]) || 0,
      (pressed(13) ? 1 : pressed(12) ? -1 : pad.axes[1]) || 0,
      buttons, profile.last
    );
    profile.last = buttons;
    controls.set(profile, state);
    if (mode === 'lobby' || mode === 'end') {
      if (state.press[4]) switchSide(profile);
      if (state.press[5]) menuAction();
      if (state.press[2] && mode !== 'live') {
        pads.delete(pad.index);
        assignPlayers();
      }
    } else if (mode === 'draft') {
      if (profile !== draftCaptain(draft.side)) continue;
      const axis = Math.abs(state.x) > Math.abs(state.y) ? state.x : state.y;
      const direction = Math.abs(axis) > .55 ? Math.sign(axis) : 0;
      if (direction && direction !== draft.direction) browseDraft(direction);
      draft.direction = direction;
      if (state.press[0]) pickCPU(draft.index);
    } else if (state.press[5]) {
      if (mode === 'live' && sequence?.kind === 'halftime') skipHalftime();
      else togglePause();
    }
  }
  for (const [index, profile] of pads) {
    if (seen.has(index)) continue;
    const activeMatch = mode !== 'lobby' && mode !== 'end';
    const reserved = profile.phone && window.couchJoinstick?.reserved?.(index) !== false;
    const retain = reserved && (activeMatch || profile.online || now - profile.lostAt < 60_000);
    if (retain && !profile.online) continue;
    if (retain) {
      profile.online = false;
      profile.lostAt = now;
      profile.last = [];
    } else pads.delete(index);
    if (mode === 'live' || mode === 'pause' || mode === 'draft') {
      const player = players.find(p => p.human === profile || p.phoneSeat === profile);
      if (player) {
        player.human = null;
        if (!retain) player.phoneSeat = null;
        player.charge = player.request = 0;
        player.vx = player.vy = 0;
        if (mode === 'draft') nextDraftPick(draft.side);
      }
    } else assignPlayers();
  }
}

function describePhoneControls() {
  const inLobby = mode === 'lobby' || mode === 'end';
  const labels = {_default: {mode: inLobby ? humans().length < 6 ? 'join' : 'full' : 'wait'}};
  for (const [index, profile] of pads) {
    if (!profile.phone) continue;
    const player = players.find(p => p.human === profile);
    let phase = 'stoppage';
    if (inLobby) phase = 'lobby';
    else if (mode === 'draft') phase = profile === draftCaptain(draft.side) ? 'draft' : 'draftWait';
    else if (mode === 'pause') phase = 'paused';
    else if (sequence?.kind === 'halftime') phase = 'halftime';
    else if (sequence?.kind === 'free-throw') {
      phase = sequence.shooter === player && sequence.result === null ? 'freeThrow' : 'freeThrowWait';
    } else if (!sequence && !inbound) {
      if (owner === player && player) phase = 'ball';
      else if (!owner && flight?.type !== 'pass') phase = 'loose';
      else phase = player?.side === side ? 'offense' : 'defense';
    }
    labels[index] = {player: `P${profile.number}`, team: names[profile.side], mode: phase};
  }
  return labels;
}

function input(x, y, down, previous) {
  const magnitude = Math.hypot(x, y);
  const scale = magnitude > .2 ? 1 / Math.max(1, magnitude) : 0;
  return {
    x: x * scale, y: y * scale, down,
    press: down.map((value, i) => value && !previous[i]),
    release: previous.map((value, i) => value && !down[i])
  };
}

function gainBall(p) {
  if (p.side !== side) {
    shotClock = possessionTime;
    possessionAge = 0;
  }
  side = p.side;
  owner = p;
  flight = loose = assist = null;
  p.charge = 0;
  p.ready = Math.max(p.ready, .22);
}

function pass(p, state) {
  const mates = team(p.side).filter(q => q !== p);
  const aimed = Math.hypot(state.x, state.y) > .25;
  const value = q => {
    const d = distance(p, q);
    const dot = ((q.x - p.x) * state.x + (q.y - p.y) * state.y) / Math.max(1, d);
    return (aimed ? dot * 240 : 0) + q.request * 120 - d * .25
      + Math.min(75, distance(q, nearest(q, team(1 - p.side))));
  };
  const [a, b] = mates;
  const target = value(a) >= value(b) ? a : b;
  const duration = clamp(distance(p, target) / (760 + ((p.cpu?.passing ?? 72) - 72) * 6), .12, .45);
  flight = {type: 'pass', p, target, x: p.x, y: p.y, age: 0, duration};
  owner = null;
  p.charge = 0;
  tone([330]);
}

function shotTier(range) {
  return shotTiers.find(tier => range <= tier.maxRange);
}

function releaseGrade(charge, tier) {
  const error = Math.abs(charge - tier.center);
  if (error <= tier.green) return 0;
  return error <= tier.amber ? 1 : 2;
}

function cpuReleaseGrade(shooter) {
  const rating = ((shooter.cpu?.shooting ?? 72) - 72) / 145;
  const roll = Math.random();
  if (roll < clamp([.14, .28, .46][difficulty] + rating, .03, .82)) return 0;
  return roll < clamp([.62, .8, .92][difficulty] + rating * .65, .3, .98) ? 1 : 2;
}

function dunkOdds(shooter, goal) {
  const defenders = team(1 - shooter.side);
  const crowd = defenders.filter(p => distance(p, goal) < 40 || distance(p, shooter) < 28);
  if (!crowd.length) return .99;
  const rimProtector = crowd.some(p => distance(p, goal) < 34 && !isBehind(p, shooter));
  const defense = Math.max(...crowd.map(p => p.cpu?.defense ?? 72));
  const finishing = shooter.cpu?.finishing ?? 72;
  return clamp((rimProtector ? .54 : .73) - (crowd.length - 1) * .11 + (finishing - defense) * .004, .22, .85);
}

function shot(p, cpu = false) {
  const target = rim(p.side);
  const range = distance(p, target);
  const points = isThree(p) ? 3 : 2;
  const dunk = range <= dunkRange;
  const defender = nearest(p, team(1 - p.side));
  const pressure = distance(p, defender);
  const contact = team(1 - p.side).find(q =>
    distance(p, q) < 25 && (q.swipe > 0 || (q.jump > 0 && isBehind(q, p))));
  if (contact) {
    whistle('SHOOTING FOUL', contact, p, points);
    return;
  }
  const tier = shotTier(range);
  const grade = dunk ? 0 : cpu ? cpuReleaseGrade(p) : releaseGrade(p.charge, tier);
  const chance = dunk ? dunkOdds(p, target) : tier.odds[grade] * (pressure < 35 ? .72 : 1);
  const made = Math.random() < chance;
  const end = made ? target : {x: target.x + (p.side ? 1 : -1) * (28 + Math.random() * 42),
    y: clamp(center + (Math.random() - .5) * 190, 65, 435)};
  p.stats.shots++;
  if (points === 3) p.stats.threeAttempts++;
  const passer = assist?.receiver === p && possessionAge <= assist.expiresAfter
    ? assist.passer : null;
  assist = null;
  flight = {type: 'shot', p, passer, x: p.x, y: p.y, end, points, dunk, made, age: 0,
    duration: dunk ? made ? .32 : .52 : clamp(.42 + range / 660, .49, 1.12)};
  owner = null;
  p.charge = 0;
  if (dunk) p.jump = .36;
  if (!cpu && !dunk) call(`${tier.name} · ${releaseNames[grade]} RELEASE`, .62);
  tone(dunk ? [175, 112] : [470]);
}

function action(p, state, dt) {
  if (owner === p) {
    if (state.press[3]) pass(p, state);
    else if (state.down[0] && (p.charge || p.ready <= 0)) p.charge = Math.min(p.charge + dt, maxCharge);
    else if (state.release[0] && p.charge) shot(p);
  } else if (owner?.side === p.side) {
    if (state.press[3]) p.request = 1.5;
  } else {
    if (state.press[0] && p.ready <= 0) jump(p);
    if (state.press[2] && p.ready <= 0) swipe(p);
  }
}

function jump(p) {
  p.jump = .35;
  p.ready = .67;
}

function isBehind(defender, attacker) {
  return (attacker.x - defender.x) * (attacker.side ? -1 : 1) > 8;
}

function swipe(p) {
  p.swipe = .24;
  p.ready = .82;
  if (!owner || owner.side === p.side || distance(owner, p) >= 27) return;
  if (owner.charge >= .26) {
    whistle('SHOOTING FOUL', p, owner, isThree(owner) ? 3 : 2);
  } else if (isBehind(p, owner) && distance(p, owner) < 23) {
    whistle('REACH-IN FOUL', p, owner);
  } else if (owner.ready <= 0) {
    owner.charge = 0;
    gainBall(p);
    p.stats.steals++;
    p.ready = .4;
    call('PICKPOCKET!');
    tone([200, 420]);
  }
}

function simulateCPU(p, dt) {
  const goal = rim(p.side);
  const attack = p.side ? -1 : 1;
  const pace = [118, 143, 166][difficulty] + ((p.cpu?.speed ?? 75) - 75) * 1.12;
  const defense = (p.cpu?.defense ?? 70) / 70;
  let target;
  if (owner === p) {
    const range = distance(p, goal);
    const request = team(p.side).find(q => q !== p && q.request > 0 && distance(p, q) < 350);
    const defender = nearest(p, team(1 - p.side));
    if (p.ready <= 0 && request && !p.charge) {
      const d = Math.max(1, distance(p, request));
      pass(p, {x: (request.x - p.x) / d, y: (request.y - p.y) / d});
      return;
    }
    if (p.ready <= 0 && (p.charge || range < 75 || (range < 250 && shotClock < 8 && distance(p, defender) > 39) || shotClock < 1.3)) {
      p.charge += dt;
      if (p.charge >= .61) shot(p, true);
    }
    target = {x: goal.x - attack * 32, y: center + Math.sin(possessionAge * 1.9) * 75};
  } else if (loose) {
    target = loose;
  } else if (flight?.type === 'shot') {
    target = {x: flight.end.x - attack * (12 + p.slot * 16), y: flight.end.y + (p.slot - 1) * 28};
  } else if (p.side === side) {
    const ball = owner || flight?.target;
    const lane = (p.slot === 0 || (p.slot === 1 && ball?.slot === 0)) ? -1 : 1;
    target = {x: clamp((ball?.x ?? 480) + attack * 110, 150, 810),
      y: center + lane * (127 + Math.sin(possessionAge * 2 + p.slot) * 30)};
  } else {
    const opponent = team(side)[p.slot];
    const ball = owner || flight?.target;
    const chase = ball && p === nearest(ball, team(p.side).filter(q => !q.human));
    const mark = chase ? ball : opponent;
    target = {x: mark.x + attack * (chase ? -21 : -39), y: mark.y + (chase ? 0 : 8)};
    if (owner && chase && p.ready <= 0 && distance(p, owner) < 26 && possessionAge > 1) {
      if (owner.charge > .44) {
        if (Math.random() < dt * [1.4, 2.6, 4.1][difficulty] * defense) jump(p);
      } else if (Math.random() < dt * [.16, .33, .62][difficulty] * defense) swipe(p);
    }
  }
  const d = Math.max(10, distance(p, target));
  const speed = (p.charge ? pace * .36 : owner === p ? pace + 22 : pace) * mobility(p);
  p.vx = (target.x - p.x) / d * speed;
  p.vy = (target.y - p.y) / d * speed;
}

function ballPosition(f) {
  const t = clamp(f.age / f.duration, 0, 1);
  const end = f.end || f.target;
  if (f.dunk && !f.made && t > .62) {
    const goal = rim(f.p.side);
    const bounce = (t - .62) / .38;
    return {x: goal.x + (end.x - goal.x) * bounce, y: goal.y + (end.y - goal.y) * bounce,
      z: 13 * Math.sin(bounce * Math.PI)};
  }
  const landing = f.dunk && !f.made ? rim(f.p.side) : end;
  const travel = f.dunk && !f.made ? t / .62 : t;
  return {x: f.x + (landing.x - f.x) * travel, y: f.y + (landing.y - f.y) * travel,
    z: Math.sin(Math.PI * travel) * (f.type === 'pass' ? 18 : f.dunk ? 40 : 87)};
}

function advanceBall(dt) {
  if (loose) {
    if (time <= 0) return;
    loose.age += dt;
    const p = nearest(loose, players);
    if (distance(p, loose) < 19 || loose.age > 2) {
      const changed = side !== p.side;
      gainBall(p);
      p.stats.rebounds++;
      if (!changed) shotClock = Math.max(shotClock, 6);
      call(changed ? 'DEFENSIVE BOARD' : 'OFFENSIVE BOARD', .63);
    }
    return;
  }
  if (!flight) return;
  const f = flight;
  f.age += dt;
  const point = ballPosition(f);
  if (f.type === 'pass') {
    const defender = nearest(point, team(1 - f.p.side));
    if (f.age > .08 && distance(point, defender) < (defender.swipe ? 24 : 12)) {
      gainBall(defender);
      defender.stats.steals++;
      call('INTERCEPTED!');
    } else if (f.age >= f.duration) {
      gainBall(f.target);
      assist = {passer: f.p, receiver: f.target, expiresAfter: possessionAge + 2.5};
    }
    return;
  }

  const blocker = team(1 - f.p.side).find(p =>
    p.jump > 0 && f.age < .19
    && distance(p, f) < 43 + ((p.cpu?.defense ?? 72) - 72) * .35 && distance(p, point) < 46);
  if (blocker) {
    if (time === 0) periodResult = 'SHOT BLOCKED';
    blocker.stats.blocks++;
    benchCheer[blocker.side] = 1.35;
    loose = {x: clamp(point.x + (f.p.side ? 26 : -26), 75, 885), y: point.y, age: 0};
    flight = null;
    saveHighlight('REJECTED!', point, 1, sceneSnapshot(point));
    call('REJECTED!');
    tone([164, 120]);
    return;
  }
  if (f.age < f.duration) return;
  flight = null;
  if (!f.made) {
    if (time === 0) periodResult = 'OFF THE RIM';
    loose = {...f.end, age: 0};
    call(f.dunk ? 'DUNK RIMMED OUT' : 'OFF THE RIM', .66);
    tone([175]);
    return;
  }
  score[f.p.side] += f.points;
  f.p.stats.points += f.points;
  benchCheer[f.p.side] = f.dunk ? 2.3 : f.points === 3 ? 1.9 : 1.25;
  f.p.stats.fieldGoals++;
  if (f.points === 3) f.p.stats.threes++;
  if (f.passer) f.passer.stats.assists++;
  const goal = rim(f.p.side);
  const atHorn = time === 0;
  const title = atHorn ? 'BUZZER BEATER!' : f.dunk ? 'SLAM DUNK!' : f.points === 3 ? 'FROM DOWNTOWN!' : 'BUCKET!';
  burst(goal, colors[f.p.side]);
  call(title);
  tone(f.dunk ? [210, 380, 690] : [440, 554, 740]);
  const feature = atHorn || f.dunk || f.points === 3;
  const clip = saveHighlight(title, goal, feature ? 3 : 2, sceneSnapshot(point));
  if (feature) sequence = {kind: 'replay', age: 0, duration: atHorn ? 2.3 : 1.65, clip, scoringSide: f.p.side, atHorn};
  else afterBasket(f.p.side);
}

function afterBasket(scoringSide) {
  if (time > 0) {
    layout(1 - scoringSide);
    if (callTime <= 0) $('status').textContent = names[side] + ' POSSESSION';
  }
}

function finish() {
  mode = 'end';
  const winner = score[0] > score[1] ? 0 : 1;
  showBoxScore();
  overlay('FINAL', `${names[winner]} WIN · ${score[0]}–${score[1]}`, 'REMATCH');
  $('status').textContent = names[winner] + ' WIN';
}

function showBoxScore() {
  const rows = $('box-score').querySelectorAll('tbody tr:not(:first-child)');
  players.forEach((p, i) => {
    const stat = p.stats;
    const values = [p.statsLabel, stat.points, `${stat.fieldGoals}–${stat.shots}`,
      `${stat.threes}–${stat.threeAttempts}`, `${stat.freeThrows}–${stat.freeThrowAttempts}`,
      stat.rebounds, stat.assists, stat.steals, stat.blocks, stat.fouls];
    const cells = values.map((value, column) => {
      const cell = document.createElement(column === 0 ? 'th' : 'td');
      if (column === 0) cell.scope = 'row';
      cell.textContent = value;
      return cell;
    });
    rows[i].replaceChildren(...cells);
  });
}

function nextPeriod() {
  if (quarter === 2) {
    const clips = [...highlights].sort((a, b) => b.priority - a.priority).slice(0, 3).reverse();
    sequence = {kind: 'halftime', age: 0, clips, duration: 3.4 + clips.length * 2};
    $('skip-show').hidden = false;
    call('HALFTIME', 1);
    tone([262, 330, 392, 523, 659]);
    return;
  }
  startNextQuarter();
}

function startNextQuarter() {
  if (quarter >= 4 && score[0] !== score[1]) {
    finish();
    tone([296, 392, 587]);
    return;
  }
  quarter++;
  periodResult = null;
  time = periodTime;
  layout((quarter - 1) % 2, true);
  call(quarter >= 5 ? `OVERTIME ${quarter - 4}` : quarter === 3 ? 'SECOND HALF' : `QUARTER ${quarter}`);
  tone([370, 555]);
}

function mobility(p) {
  return (1 - (p.fatigue || 0) * .24) * (p.injury > 0 ? .72 : 1);
}

function updateCondition(p, dt, sprinting) {
  const exertion = Math.min(1, Math.hypot(p.vx, p.vy) / 165);
  p.fatigue = clamp(p.fatigue + dt * (.0034 + .008 * exertion + (sprinting ? .018 : 0)), 0, 1);
  p.injury = Math.max(0, p.injury - dt);
  p.injuryCooldown = Math.max(0, p.injuryCooldown - dt);
}

function checkContact(a, b, approach) {
  if (a.side === b.side || approach < 215) return;
  const eligible = p => p.fatigue >= .34 && p.injuryCooldown <= 0;
  const player = eligible(a) && (!eligible(b) || a.fatigue > b.fatigue) ? a : eligible(b) ? b : null;
  if (!player) return;
  player.injury = 5;
  player.injuryCooldown = 15;
  const clip = refereeClip('INJURY TIMEOUT', player, side, player);
  sequence = {kind: 'injury', age: 0, duration: injuryReplayTime + 1.25, clip, player};
  if (owner) owner.charge = 0;
  call(`INJURY TIMEOUT · ${player.statsLabel}`, 1.2);
  tone([1150, 940]);
}

function update(dt) {
  if (callTime > 0 && (callTime -= dt) <= 0) {
    $('call').hidden = true;
    if (mode === 'live' && !sequence) $('status').textContent = names[side] + ' POSSESSION';
  }
  for (const bit of particles) {
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    bit.vy += 140 * dt;
    bit.life -= dt;
  }
  while (particles[0]?.life <= 0) particles.shift();
  if (mode !== 'live') return;
  for (const teamIndex of [0, 1]) benchCheer[teamIndex] = Math.max(0, benchCheer[teamIndex] - dt);
  if (sequence) {
    advanceSequence(dt);
    return;
  }
  if (inbound > 0) {
    inbound = Math.max(0, inbound - dt);
    return;
  }

  const wasLive = time > 0;
  time = Math.max(0, time - dt);
  if (wasLive && time === 0) {
    tone([196, 196, 147]);
    if (flight?.type === 'shot') call('SHOT AT THE HORN', 1.2);
  }
  possessionAge += dt;
  if (time > 0 && flight?.type !== 'shot' && !loose) {
    const previousSeconds = Math.ceil(shotClock);
    shotClock = Math.max(0, shotClock - dt);
    if (shotClock === 0) {
      const receivingSide = 1 - side;
      const point = currentBall(0) || referee;
      const clip = refereeClip('SHOT CLOCK VIOLATION', point, receivingSide);
      layout(receivingSide);
      sequence = {kind: 'violation', age: 0, duration: 1.2, clip};
      call('SHOT CLOCK VIOLATION', sequence.duration);
      tone([940, 166, 126]);
      return;
    }
    const seconds = Math.ceil(shotClock);
    if (seconds <= 3 && seconds < previousSeconds) tone([520]);
  }
  if (time > 0) {
    for (const p of players) {
      for (const timer of ['ready', 'jump', 'swipe', 'request']) p[timer] = Math.max(0, p[timer] - dt);
      let sprinting = false;
      if (p.human) {
        const state = controls.get(p.human) || empty;
        action(p, state, dt);
        sprinting = state.down[1] && p.energy > .06 && Math.hypot(state.x, state.y) > .2 && !p.charge && !p.injury;
        const recharge = .33 - .16 * p.fatigue;
        p.energy = clamp(p.energy + (sprinting ? -.52 : recharge) * dt, 0, 1);
        const speed = (sprinting ? 233 : 170) * (p.charge ? .45 : 1) * (p.swipe ? .68 : 1) * mobility(p);
        p.vx = state.x * speed;
        p.vy = state.y * speed;
      } else simulateCPU(p, dt);
      if (sequence) return;
      updateCondition(p, dt, sprinting);
    }
    for (const p of players) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const [i, a] of players.entries()) {
      for (const b of players.slice(i + 1)) {
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d >= 23) continue;
        const approach = -((a.vx - b.vx) * dx + (a.vy - b.vy) * dy) / d;
        checkContact(a, b, approach);
        const push = (23 - d) * .32 / d;
        a.x += dx * push; a.y += dy * push;
        b.x -= dx * push; b.y -= dy * push;
        if (sequence) return;
      }
    }
    for (const p of players) {
      p.x = clamp(p.x, 77, 883);
      p.y = clamp(p.y, 54, 446);
    }
  }
  if (time === 0 && flight?.type !== 'shot') {
    sequence = {kind: 'period-break', age: 0, duration: 1.35, scene: sceneSnapshot()};
    call(periodResult || 'END OF PERIOD', 1.35);
    return;
  }
  const ball = currentBall(0);
  const tracked = ball || referee;
  const targetX = clamp(tracked.x, 105, 855);
  referee.x += clamp(targetX - referee.x, -145 * dt, 145 * dt);
  const targetY = 449;
  referee.y += clamp(targetY - referee.y, -85 * dt, 85 * dt);
  replaySample += dt;
  if (replaySample >= 1 / 24) {
    replaySample %= 1 / 24;
    replayFrames.push(sceneSnapshot(ball));
    if (replayFrames.length > 32) replayFrames.shift();
  }
  advanceBall(dt);
}

function sceneSnapshot(ball = currentBall(0)) {
  return {
    players: players.map(p => ({...p, hasBall: p === owner})),
    ref: {...referee},
    bench: [...benchCheer],
    ball
  };
}

function saveHighlight(title, focus, priority, last) {
  const clip = {title, focus: {x: focus.x, y: focus.y}, priority, frames: [...replayFrames, last]};
  if (quarter <= 2) {
    highlights.push(clip);
    if (highlights.length > 8) {
      const lowest = Math.min(...highlights.map(item => item.priority));
      highlights.splice(highlights.findIndex(item => item.priority === lowest), 1);
    }
  }
  return clip;
}

function whistle(title, defender, shooter, throws = 0) {
  fouls[defender.side]++;
  defender.stats.fouls++;
  assist = null;
  shooter.charge = 0;
  const clip = refereeClip(title, shooter, shooter.side);
  sequence = {kind: 'foul', age: 0, duration: 1.65, clip, shooter, throws, clock: shotClock};
  const ruling = throws ? `${throws} FREE THROWS` : `${names[shooter.side]} KEEP THE BALL`;
  call(`${title} · ${ruling}`, 1.65);
  tone([1150, 940]);
}

function refereeClip(title, point, receivingSide, focus = referee) {
  referee.x = clamp(point.x + (receivingSide ? 36 : -36), 90, 870);
  referee.y = clamp(point.y + (point.y > center ? -46 : 46), 70, 423);
  const scene = sceneSnapshot();
  scene.ref.receivingSide = receivingSide;
  return saveHighlight(title, focus, 2, scene);
}

function skipHalftime() {
  if (mode !== 'live' || sequence?.kind !== 'halftime') return;
  sequence = null;
  $('skip-show').hidden = true;
  for (const p of players) {
    p.fatigue = Math.max(0, p.fatigue - .32);
    p.injury = 0;
  }
  startNextQuarter();
}

function advanceSequence(dt) {
  const active = sequence;
  const previousAge = active.age;
  active.age += dt;
  if (active.kind === 'injury' && previousAge < injuryReplayTime && active.age >= injuryReplayTime) {
    call(`REFEREE · ${names[side]} KEEP THE BALL`, active.duration - active.age);
  }
  if (active.kind === 'halftime') {
    if (active.age >= active.duration) skipHalftime();
    return;
  }
  if (active.kind === 'free-throw') {
    advanceFreeThrow(active);
    return;
  }
  if (active.age < active.duration) return;
  sequence = null;
  if (active.kind === 'period-break' || (active.kind === 'replay' && active.atHorn)) {
    nextPeriod();
  } else if (active.kind === 'injury') {
    call('PLAY ON', .65);
    tone([555, 740]);
  } else if (active.kind === 'violation') {
    $('status').textContent = names[side] + ' POSSESSION';
  } else if (active.kind === 'replay') {
    afterBasket(active.scoringSide);
  } else if (active.throws) {
    sequence = {kind: 'free-throw', age: 0, shooter: active.shooter, remaining: active.throws,
      total: active.throws, result: null};
    announceFreeThrow(sequence);
  } else if (time > 0) {
    layout(active.shooter.side);
    shotClock = Math.max(7, active.clock);
    $('status').textContent = names[side] + ' POSSESSION';
  }
}

function announceFreeThrow(active) {
  const number = active.total - active.remaining + 1;
  call(`FREE THROW ${number} OF ${active.total}`, .85);
}

function freeThrowNeedle(age) {
  if (age < freeThrowStart) return 0;
  const cycle = ((age - freeThrowStart) * freeThrowSpeed) % 2;
  return 1 - Math.abs(1 - cycle);
}

function advanceFreeThrow(active) {
  const {shooter} = active;
  if (active.result === null) {
    const pressed = controls.get(shooter.human)?.press[0];
    const timed = shooter.human && pressed && active.age >= freeThrowStart;
    const automatic = active.age >= (shooter.human ? 2.75 : 1.02);
    if (!timed && !automatic) return;
    const needle = freeThrowNeedle(active.age);
    active.result = timed ? Math.abs(needle - .5) <= freeThrowWindow
      : !shooter.human && Math.random() < clamp([.56, .64, .72][difficulty] + ((shooter.cpu?.shooting ?? 72) - 72) / 190, .28, .9);
    active.age = 0;
    tone([470]);
    return;
  }
  if (active.age >= .57 && !active.counted) {
    active.counted = true;
    shooter.stats.freeThrowAttempts++;
    if (active.result) {
      score[shooter.side]++;
      shooter.stats.freeThrows++;
      shooter.stats.points++;
    }
    call(active.result ? 'FREE THROW GOOD · +1' : 'FREE THROW MISSED', .7);
    tone(active.result ? [440, 554, 740] : [175]);
  }
  if (active.age < 1.24) return;
  if (--active.remaining > 0) {
    Object.assign(active, {age: 0, result: null, counted: false});
    announceFreeThrow(active);
  } else {
    sequence = null;
    if (time > 0) {
      layout(1 - shooter.side);
      $('status').textContent = names[side] + ' POSSESSION';
    }
  }
}

function rect(c, color, x, y, w, h) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function circle(c, x, y, radius, fill, stroke) {
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}

function lettering(c, words, x, y, size, color) {
  c.fillStyle = color;
  c.font = `bold ${size}px Menlo, monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(words, x, y);
}

const court = document.createElement('canvas');
court.width = 960;
court.height = 500;

function paintCourt() {
  const c = court.getContext('2d');
  rect(c, '#1d1726', 0, 0, 960, 500);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 93; col++) {
      const shade = (row * 37 + col * 17 + row * col * 7) % 13;
      if (shade > 3) {
        const color = ['#574053', '#876372', '#382e47', '#a47766'][shade % 4];
        rect(c, color, col * 10 + 15 + row * 3, 5 + row * 9, 5, 4);
        rect(c, color, col * 10 + 15 + row * 3, 470 + row * 9, 5, 4);
      }
    }
  }
  rect(c, '#6c4245', 51, 36, 858, 434);
  for (let row = 0; row < 27; row++) {
    const y = 40 + row * 15.6;
    for (let x = 62; x < 898;) {
      const w = Math.min(898 - x, Math.max(35, 148 - (row * 43 + x * 17) % 100));
      const light = (x * 9 + row * 19) % 8;
      rect(c, `hsl(29 55% ${52 + light * 2}%)`, x, y, w, 15.6);
      rect(c, '#6f38252b', x, y, w, 1);
      rect(c, '#6f382528', x, y, 1, 15.6);
      rect(c, '#fdd19735', x + 5, y + 6, Math.max(0, w - 18), 1);
      x += w;
    }
  }
  const line = '#fff0cae0';
  c.lineWidth = 2.5;
  c.strokeStyle = line;
  c.strokeRect(62, 41, 836, 418);
  rect(c, line, 479, 41, 2, 418);
  circle(c, 480, center, 52, '#843749', line);
  lettering(c, 'ϟ', 480, center + 1, 58, '#ffd58d');

  for (const [i, x] of basket.entries()) {
    const sign = i ? 1 : -1;
    const base = i ? 62 : 898;
    const key = base + sign * 155;
    rect(c, i ? '#963f49' : '#257d80', Math.min(base, key), center - 60, 155, 120);
    c.strokeStyle = line;
    c.strokeRect(Math.min(base, key), center - 60, 155, 120);
    circle(c, key, center, 59, null, line);
    const theta = Math.asin(188 / three);
    const corner = x + sign * Math.sqrt(three * three - 188 * 188);
    c.beginPath();
    c.moveTo(base, center - 188);
    c.lineTo(corner, center - 188);
    if (i) c.arc(x, center, three, -theta, theta);
    else c.arc(x, center, three, Math.PI + theta, Math.PI - theta, true);
    c.lineTo(base, center + 188);
    c.stroke();
    c.save();
    c.translate(base - sign * 29, center);
    c.rotate(sign * Math.PI / 2);
    lettering(c, names[1 - i], 0, 0, 16, '#ffebc6');
    c.restore();
  }
  lettering(c, 'HOT DOGS  →', 245, 28, 12, colors[0]);
  lettering(c, '←  TURBO TOADS', 714, 28, 12, colors[1]);
  lettering(c, 'BLITZ HOOPS', 480, 477, 12, '#ffc267');
}

function drawRim(x, i) {
  rect(ctx, '#352336', x + (i ? -19 : 11), center - 31, 8, 62);
  rect(ctx, '#fbf0e3', x + (i ? -15 : 12), center - 28, 3, 56);
  circle(ctx, x, center, 10, '#482d3a77', '#fff3d3');
  circle(ctx, x, center, 8, null, '#f4733d');
}

function burst(point, color) {
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 150;
    particles.push({x: point.x, y: point.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: .7, color: i % 3 ? color : '#ffe083'});
  }
}

function drawPlayer(p, now, hasBall = p === owner) {
  const {x, y} = p;
  const raised = Math.sin((p.jump / .36) * Math.PI) * 13;
  const pace = Math.hypot(p.vx, p.vy);
  const stride = pace > 20 ? Math.sin(now * .026 + p.slot) * 4 : 0;
  const top = y - raised;
  circle(ctx, x, y + 5, 13, '#25142660');
  if (p.human || hasBall) {
    ctx.lineWidth = 2;
    circle(ctx, x, y + 2, 16, null, hasBall ? '#fff3bc' : colors[p.side]);
  }
  if (p.swipe) {
    ctx.strokeStyle = '#fff0aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 22, -.5, 2.5);
    ctx.stroke();
  }
  rect(ctx, '#312436', x - 11, top - 8, 22, 18);
  rect(ctx, '#ffeee2', x - 8, top + 6 + stride, 5, 6);
  rect(ctx, '#ffeee2', x + 3, top + 6 - stride, 5, 6);
  rect(ctx, colors[p.side], x - 10, top - 7, 20, 13);
  rect(ctx, '#fff8d1', x - 9, top + 3, 18, 2);
  const skin = ['#c77c55', '#9c563f', '#e9ad7a'][p.slot];
  circle(ctx, x, top - 9, 6, skin, '#392435');
  rect(ctx, '#352539', x - 5, top - 15, 10, 3);
  if (p.human) {
    rect(ctx, '#2b1c30', x - 14, top - 37, 28, 15);
    lettering(ctx, `P${p.human.number}`, x, top - 29, 12, colors[p.side]);
    rect(ctx, '#443045', x - 13, top - 21, 26, 2);
    rect(ctx, colors[p.side], x - 13, top - 21, 26 * p.energy, 2);
  }
  if (!p.human && p.cpu && (mode === 'live' || mode === 'pause')) {
    lettering(ctx, p.cpu.surname.toUpperCase(), x, top - 23, 9, '#ffefd8');
  }
  if (p.human || p.fatigue > .6 || p.injury > 0) {
    const restY = y + 16;
    rect(ctx, '#382638', x - 13, restY, 26, 4);
    rect(ctx, p.fatigue > .66 ? '#ff876b' : '#ffda87', x - 12, restY + 1, 24 * (1 - (p.fatigue || 0)), 2);
  }
  if (p.injury > 0) {
    rect(ctx, '#49243a', x + 10, top - 20, 13, 13);
    rect(ctx, '#ffd5ca', x + 15, top - 18, 3, 9);
    rect(ctx, '#ffd5ca', x + 12, top - 15, 9, 3);
  }
  if (p.request) lettering(ctx, 'PASS!', x, top - 46, 12, '#fff0aa');
  if (p.charge && p.human) {
    const range = distance(p, rim(p.side));
    if (range <= dunkRange) {
      rect(ctx, '#27182e', x - 21, top - 52, 42, 13);
      lettering(ctx, 'DUNK', x, top - 45, 11, '#ffc267');
    } else {
      const tier = shotTier(range);
      const width = 88;
      const left = x - width / 2;
      const meterY = top < 65 ? top + 34 : top - 47;
      rect(ctx, '#27182e', left - 2, meterY - 17, width + 4, 26);
      lettering(ctx, tier.name, x, meterY - 9, 10, '#fff1d6');
      rect(ctx, '#a45351', left, meterY, width, 6);
      rect(ctx, '#ffc267', left + width * (tier.center - tier.amber) / maxCharge, meterY, width * 2 * tier.amber / maxCharge, 6);
      rect(ctx, '#9cfa8a', left + width * (tier.center - tier.green) / maxCharge, meterY, width * 2 * tier.green / maxCharge, 6);
      const needle = left + width * p.charge / maxCharge;
      rect(ctx, '#fff6de', needle - 1, meterY - 3, 2, 3);
      rect(ctx, '#fff6de', needle - 1, meterY + 6, 2, 3);
    }
  }
}

function currentBall(now) {
  let point = loose;
  if (flight) point = ballPosition(flight);
  if (owner) {
    const attack = owner.side ? -1 : 1;
    point = {x: owner.x + attack * 13, y: owner.y + 4,
      z: owner.charge ? 17 : 3 + Math.abs(Math.sin(now * .019)) * 9};
  }
  return point;
}

function drawBall(point) {
  if (!point) return;
  const z = point.z || 0;
  circle(ctx, point.x, point.y, 6, '#42203d6e');
  circle(ctx, point.x, point.y - z, 6.7, '#ff9844', '#5c2d34');
  rect(ctx, '#773b36', point.x - 5, point.y - z - 1, 10, 1.4);
  rect(ctx, '#773b36', point.x - 1, point.y - z - 5, 1.4, 10);
}

function drawBench(now, cheering) {
  for (const side of [0, 1]) {
    const start = side ? 622 : 190;
    rect(ctx, '#3c293e', start - 15, 477, 164, 17);
    rect(ctx, colors[side], start - 15, 492, 164, 2);
    const loud = cheering[side] > 0;
    for (let seat = 0; seat < 5; seat++) {
      const x = start + seat * 33;
      const hop = loud ? reducedMotion?.matches ? 4 : 3 + Math.abs(Math.sin(now * .018 - seat * .63)) * 8 : 0;
      const y = 483 - hop;
      rect(ctx, '#211827', x - 9, y - 6, 18, 14);
      rect(ctx, colors[side], x - 8, y - 6, 16, 10);
      const skin = ['#c77c55', '#9c563f', '#e9ad7a'][seat % 3];
      circle(ctx, x, y - 9, 5, skin, '#392435');
      if (loud) {
        rect(ctx, skin, x - 13, y - 14, 4, 12);
        rect(ctx, skin, x + 9, y - 14, 4, 12);
      }
    }
  }
}

function drawRef({x, y}) {
  circle(ctx, x, y + 4, 11, '#25142670');
  rect(ctx, '#242134', x - 9, y - 6, 18, 18);
  for (let i = -6; i <= 6; i += 4) rect(ctx, '#fff4df', x + i, y - 6, 2, 11);
  circle(ctx, x, y - 9, 5, '#c78760', '#392435');
}

function drawScene(now, scene) {
  ctx.drawImage(court, 0, 0);
  basket.forEach(drawRim);
  drawBench(now, scene?.bench || benchCheer);
  drawRef(scene?.ref || referee);
  for (const p of [...(scene?.players || players)].sort((a, b) => a.y - b.y)) {
    drawPlayer(p, now, scene ? p.hasBall : p === owner);
  }
  drawBall(scene ? scene.ball : currentBall(now));
}

function caption(title, subtitle) {
  rect(ctx, '#23172eee', 0, 388, 960, 112);
  rect(ctx, '#ffc267', 0, 388, 960, 3);
  lettering(ctx, title, 480, 424, 30, '#fff1d6');
  lettering(ctx, subtitle, 480, 463, 17, '#ffc267');
}

function showClip(clip, age, duration, label) {
  const progress = clamp(age / duration, 0, 1);
  const index = reducedMotion?.matches ? clip.frames.length - 1 : Math.floor(progress * (clip.frames.length - 1));
  const scene = clip.frames[index];
  ctx.save();
  if (!reducedMotion?.matches) {
    const zoom = 1 + .55 * Math.sin(Math.min(1, age / .36) * Math.PI / 2);
    const x = clamp(clip.focus.x, 480 / zoom, 960 - 480 / zoom);
    const y = clamp(clip.focus.y, 250 / zoom, 500 - 250 / zoom);
    ctx.translate(480 - x * zoom, 250 - y * zoom);
    ctx.scale(zoom, zoom);
  }
  drawScene(age * 700, scene);
  ctx.restore();
  caption(clip.title, label);
}

function showReferee(clip, age, ruling, gesture) {
  const scene = clip.frames.at(-1);
  const {x, y, receivingSide} = scene.ref;
  const direction = receivingSide === 1 ? -1 : 1;
  const motion = !reducedMotion?.matches;
  const arrival = motion ? Math.min(1, age / .3) : 1;
  const zoom = 1 + 5.3 * (1 - (1 - arrival) ** 3);
  const pose = motion ? clamp((age - .22) / .28, 0, 1) : 1;
  rect(ctx, '#25182e', 0, 0, 960, 500);
  ctx.save();
  ctx.translate(480, 192);
  ctx.scale(zoom, zoom);
  ctx.translate(-x, -y);
  ctx.drawImage(court, 0, 0);
  rect(ctx, '#24163386', x - 500, y - 300, 1000, 600);
  circle(ctx, x, y, 23, '#ffdc9a36', '#ffe1a4');
  rect(ctx, '#21182a', x - 6, y + 5, 4, 12);
  rect(ctx, '#21182a', x + 2, y + 5, 4, 12);
  drawRef(scene.ref);
  rect(ctx, '#3b2931', x - 2, y - 8, 4, 2);
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d3986c';
  ctx.beginPath();
  ctx.moveTo(x - direction * 8, y - 3);
  ctx.lineTo(x - direction * (8 + 5 * (1 - pose)), y + 5 - 7 * (1 - pose));
  ctx.lineTo(x - direction * (8 + 4 * (1 - pose)), y + 9 - 17 * (1 - pose));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + direction * 8, y - 3);
  if (gesture === 'shooting') {
    ctx.lineTo(x + direction * (13 + 2 * pose), y + 5 - 24 * pose);
  } else if (gesture === 'injury') {
    ctx.lineTo(x + direction * (9 - 8 * pose), y + 6 - 17 * pose);
  } else {
    ctx.lineTo(x + direction * (10 + 12 * pose), y + 8 - 12 * pose);
  }
  ctx.stroke();
  if (pose > .8 && gesture === 'possession') {
    lettering(ctx, direction === 1 ? '→' : '←', x + direction * 28, y - 5, 11, colors[receivingSide]);
  }
  ctx.restore();
  caption(clip.title, ruling);
}

function drawHalftime(active) {
  const {age, clips, duration} = active;
  const highlight = Math.floor((age - 1.7) / 2);
  if (highlight >= 0 && highlight < clips.length) {
    showClip(clips[highlight], (age - 1.7) % 2, 2, `FIRST-HALF HIGHLIGHTS  ·  ${highlight + 1} / ${clips.length}`);
    return;
  }
  ctx.drawImage(court, 0, 0);
  rect(ctx, '#1c1125eb', 0, 0, 960, 500);
  for (let i = 0; i < 12; i++) {
    const sway = reducedMotion?.matches ? 0 : Math.sin(age * 2 + i * .45) * 15;
    rect(ctx, i % 2 ? '#ff826f27' : '#72e6de25', i * 87 - 22 + sway, 48, 38, 404);
  }
  lettering(ctx, 'BLITZ HOOPS', 480, 95, 22, '#ffc267');
  lettering(ctx, 'HALFTIME SHOW', 480, 150, 59, '#fff1d6');
  lettering(ctx, names[0], 255, 236, 24, colors[0]);
  lettering(ctx, names[1], 705, 236, 24, colors[1]);
  lettering(ctx, score[0], 255, 305, 63, colors[0]);
  lettering(ctx, score[1], 705, 305, 63, colors[1]);
  lettering(ctx, `${fouls[0]} FOULS`, 255, 372, 19, '#fff1d6');
  lettering(ctx, `${fouls[1]} FOULS`, 705, 372, 19, '#fff1d6');
  lettering(ctx, age < 1.7 && clips.length ? 'FIRST-HALF HIGHLIGHTS' : `SECOND HALF IN ${Math.ceil(duration - age)}`,
    480, 442, 17, '#ffc267');
}

function drawFreeThrow(active, now) {
  const {shooter, age, result, total, remaining} = active;
  const goal = rim(shooter.side);
  const direction = shooter.side ? -1 : 1;
  const shooterX = shooter.side ? 217 : 743;
  const progress = result === null ? 0 : clamp(age / .57, 0, 1);
  const ball = {
    x: shooterX + (goal.x - shooterX) * progress,
    y: center + (result === false ? progress * 19 : 0),
    z: Math.sin(progress * Math.PI) * 68 + (1 - progress) * 10
  };
  const lineup = players.filter(p => p !== shooter).map((p, i) => ({
    ...p, x: shooterX + direction * (24 + (i % 3) * 29), y: center + (i < 3 ? -75 : 75),
    vx: 0, vy: 0, jump: 0, swipe: 0, charge: 0, request: 0
  }));
  lineup.push({...shooter, x: shooterX, y: center, vx: 0, vy: 0, jump: 0, swipe: 0, charge: 0, request: 0});
  drawScene(now, {players: lineup, ref: {x: goal.x - direction * 31, y: 360}, ball});
  const hint = result === null
    ? shooter.human ? 'PRESS SHOOT IN THE GREEN · J / A / CROSS' : 'CPU AT THE LINE'
    : age < .57 ? names[shooter.side] : result ? 'GOOD · +1 POINT' : 'MISSED';
  caption(`FREE THROW ${total - remaining + 1} / ${total}`, hint);
  if (result === null) {
    const width = 210, left = shooterX - width / 2;
    const needle = freeThrowNeedle(age);
    rect(ctx, '#23172e', left - 4, 160, width + 8, 23);
    rect(ctx, '#a45351', left, 164, width, 15);
    rect(ctx, '#9cfa8a', left + width * (.5 - freeThrowWindow), 164, width * 2 * freeThrowWindow, 15);
    rect(ctx, '#fff6de', left + width * needle - 2, 162, 4, 19);
  }
}

function draw(now) {
  const active = sequence;
  if (active?.kind === 'halftime') drawHalftime(active);
  else if (active?.kind === 'replay') showClip(active.clip, active.age, active.duration, 'INSTANT REPLAY');
  else if (active?.kind === 'period-break') {
    drawScene(now, active.scene);
    caption(periodResult || 'END OF PERIOD', `${names[0]} ${score[0]}  ·  ${score[1]} ${names[1]}`);
  } else if (active?.kind === 'injury') {
    if (active.age < injuryReplayTime) {
      showClip(active.clip, active.age, injuryReplayTime, 'INSTANT REPLAY');
    } else {
      showReferee(active.clip, active.age - injuryReplayTime,
        `${active.player.statsLabel} STAYS IN · ${names[side]} BALL`, 'injury');
    }
  } else if (active?.kind === 'foul' || active?.kind === 'violation') {
    const ruling = active.kind === 'violation' ? `${names[side]} BALL`
      : active.throws ? `${active.throws} FREE THROWS AWARDED` : 'SIDE OUT · OFFENSE KEEPS THE BALL';
    showReferee(active.clip, active.age, ruling, active.throws ? 'shooting' : 'possession');
  } else if (active?.kind === 'free-throw') drawFreeThrow(active, now);
  else {
    drawScene(now);
    for (const bit of particles) rect(ctx, bit.color, bit.x, bit.y, 4, 4);
    if (inbound > 0 && mode === 'live') lettering(ctx, 'INBOUND', 480, 433, 14, '#fff2c7');
  }
  if (time === 0 && mode === 'live' && active?.kind !== 'halftime') {
    rect(ctx, '#ff786d', 0, 0, 960, 4);
    rect(ctx, '#ff786d', 0, 496, 960, 4);
  }
  for (let i = 0; i < score.length; i++) {
    $('score' + i).textContent = String(score[i]).padStart(2, '0');
    $('fouls' + i).textContent = `${fouls[i]} ${fouls[i] === 1 ? 'FOUL' : 'FOULS'}`;
  }
  $('period').textContent = active?.kind === 'halftime' ? 'HALF' : quarter >= 5 ? `OT${quarter - 4}` : 'Q' + quarter;
  $('clock').textContent = time > 0 && time < 5 ? (Math.ceil(time * 10) / 10).toFixed(1)
    : '0:' + String(Math.ceil(time)).padStart(2, '0');
  const clockRunning = mode === 'live' && !active && !inbound && time > 0 && flight?.type !== 'shot' && !loose;
  const expired = active?.kind === 'violation';
  $('shot-timer').dataset.state = expired || (clockRunning && shotClock <= 5) ? 'urgent' : clockRunning ? 'running' : 'stopped';
  $('shot-clock').textContent = expired ? '0.0'
    : shotClock <= 5 ? (Math.ceil(shotClock * 10) / 10).toFixed(1) : Math.ceil(shotClock);
}

$('start').addEventListener('click', menuAction);
$('draft-back').addEventListener('click', cancelDraft);
$('pause').addEventListener('click', togglePause);
$('skip-show').addEventListener('click', skipHalftime);
$('team').addEventListener('click', () => switchSide(keyboard));
$('difficulty').addEventListener('click', () => {
  difficulty = (difficulty + 1) % 3;
  $('difficulty').textContent = 'CPU · ' + ['ROOKIE', 'NORMAL', 'HARD'][difficulty];
});
$('keyboard').addEventListener('click', () => {
  if (!keyboard.enabled && pads.size >= 6) return;
  if (!keyboard.enabled && [...pads.values()].filter(p => p.side === keyboard.side).length >= 3) keyboard.side = 1 - keyboard.side;
  keyboard.enabled = !keyboard.enabled;
  $('keyboard').setAttribute('aria-pressed', keyboard.enabled);
  $('keyboard').textContent = keyboard.enabled ? 'KEYBOARD' : 'KEYBOARD OFF';
  assignPlayers();
  layout(0);
});

const gameKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK', 'KeyL', 'KeyI',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener('keydown', event => {
  if (mode === 'draft') {
    if (event.code === 'Escape') cancelDraft();
    if (event.code === 'Enter' && event.target?.closest?.('button')) return;
    if (draft && draftCaptain(draft.side) === keyboard) {
      const direction = {ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1}[event.code];
      if (direction || event.code === 'Enter') {
        event.preventDefault();
        if (direction) browseDraft(direction);
        else if (!event.repeat) pickCPU(draft.index);
      }
    }
    return;
  }
  if (event.code === 'Enter' && mode === 'live' && sequence?.kind === 'halftime') {
    event.preventDefault();
    skipHalftime();
  }
  if (event.code === 'Escape' && !event.repeat) togglePause();
  if (!gameKeys.has(event.code) || mode !== 'live' || !keyboard.enabled) return;
  event.preventDefault();
  keys.add(event.code);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => {
  keys.clear();
  previousKeys = [];
  if (mode === 'live') togglePause();
});

window.couchJoinstick?.describe(describePhoneControls);
paintCourt();
assignPlayers();
layout(0);
let previous = performance.now();
function frame(now) {
  const dt = clamp((now - previous) / 1000, 0, .035);
  previous = now;
  if (document.hasFocus()) readInputs();
  update(dt);
  draw(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
