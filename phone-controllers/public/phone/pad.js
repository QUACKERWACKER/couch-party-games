import {join} from '/joinstick/client.js';

const games = {
  blitz: {
    title: 'Blitz 7', move: 'Move / aim', actions: [
      [0, 'Join'], [1, 'Leave'], [2, 'Helmet'], [3, 'Start'], [5, 'Team / CPU'], [9, 'Pause'],
    ], hint: 'Press Join to claim a player.',
  },
  hoops: {
    title: 'Blitz Hoops', move: 'Move / aim', actions: [
      [0, 'Shoot / join'], [1, 'Turbo'], [2, 'Swipe / leave'], [3, 'Pass / call'], [5, 'Switch team'], [9, 'Start'],
    ], hint: 'Hold Shoot to charge and release to shoot. Aim with the stick to pass.',
  },
  track: {
    title: 'Blitz Track', move: 'Direction pad', actions: [
      [0, 'Stride / join'], [1, 'Turbo'], [2, 'Dirty trick'], [3, 'Event action'], [5, 'Switch team'], [9, 'Start'],
    ], hint: 'Follow the stadium prompts. Captains can use Event action to pick an athlete.',
  },
  bedrock: {
    title: 'Bedrock Rivals', move: 'Move / aim', actions: [
      [0, 'Dig / join'], [1, 'Fire / leave'], [2, 'Summon'], [3, 'Buy upgrade'], [4, 'Jet'], [5, 'Minion type'], [7, 'Upgrade type'],
    ], hint: 'Hold Minion type or Upgrade type and aim to choose. Release to confirm.',
  },
  ringout: {
    title: 'Ringout', move: 'Move', aim: true, actions: [
      [0, 'Dash / join'], [1, 'Dodge'], [2, 'Push'], [3, 'Emote'], [5, 'Trick'], [9, 'Ready'],
    ], hint: 'Hold and release Push. Use the right stick to aim it.',
  },
};
const blitzModes = {
  lobby: ['Boots', 'Leave', 'Helmet', 'Start', 'Tap Team / CPU to switch sides. P1 can hold it and move the stick up or down to adjust CPU difficulty.'],
  ready: ['Snap', 'Sprint', 'Dash', 'Kick', 'Move the stick up or down to choose a play.'],
  offense: ['Pass', 'Sprint', 'Dash', 'Handoff', 'Hold Pass to charge, aim with the stick, and release to throw.'],
  defense: ['Pick', 'Grapple', 'Dash', 'Handoff', 'Time Pick to intercept. Hold Grapple when facing the runner.'],
  kickMeter: ['Pass', 'Sprint', 'Dash', 'Kick', 'Tap Kick when the marker reaches the target.'],
  kickFlight: ['Pass', 'Sprint', 'Dash', 'Kick', 'Use the stick to move.'],
  try: ['Go for 2', 'Sprint', 'Dash', 'Kick for 1', 'Choose a kick or a two-point play.'],
  paused: ['Pass', 'Sprint', 'Dash', 'Resume', 'P1 can resume.'],
};
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const gameKey = params.get('g');
const code = params.get('r')?.toUpperCase();
const game = Object.hasOwn(games, gameKey) ? games[gameKey] : null;
const actions = new Map();
const sticks = {};
let pad;
let movementFrame = 0;
let lastAim = [0, 0];

function publish() {
  cancelAnimationFrame(movementFrame);
  movementFrame = 0;
  if (!pad || pad.status !== 'connected') return;
  if (sticks.aim && (lastAim[0] !== sticks.aim.x || lastAim[1] !== sticks.aim.y)) {
    lastAim = [sticks.aim.x, sticks.aim.y];
    pad.send({aim: lastAim});
  }
  pad.setInput({
    x: sticks.move.x,
    y: sticks.move.y,
    buttons: Object.fromEntries([...actions].map(([number, action]) => ['b' + number, action.held])),
  });
}

function setStick(stick, x, y) {
  const scale = Math.max(1, Math.hypot(x, y));
  stick.x = Math.round(x / scale * 100) / 100;
  stick.y = Math.round(y / scale * 100) / 100;
  const travel = stick.element.clientWidth * .28;
  stick.element.style.setProperty('--x', stick.x * travel + 'px');
  stick.element.style.setProperty('--y', stick.y * travel + 'px');
  stick.element.classList.toggle('active', Boolean(stick.x || stick.y));
}

function installStick(element) {
  const stick = {element, x: 0, y: 0, pointer: null, keys: new Set()};
  sticks[element.dataset.stick] = stick;
  const move = event => {
    const {left, top, width, height} = stick.bounds;
    setStick(stick, (event.clientX - left - width / 2) / (width * .35),
      (event.clientY - top - height / 2) / (height * .35));
    if (!movementFrame) movementFrame = requestAnimationFrame(publish);
  };
  element.addEventListener('pointerdown', event => {
    if (event.button !== 0 || stick.pointer !== null) return;
    event.preventDefault();
    stick.pointer = event.pointerId;
    stick.bounds = element.getBoundingClientRect();
    element.setPointerCapture(event.pointerId);
    move(event);
  });
  element.addEventListener('pointermove', event => {
    if (event.pointerId === stick.pointer) move(event);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(eventName, event => {
      if (event.pointerId !== stick.pointer) return;
      stick.pointer = null;
      setStick(stick, 0, 0);
      publish();
    });
  }
  for (const eventName of ['keydown', 'keyup']) {
    element.addEventListener(eventName, event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      if (event.type === 'keydown') stick.keys.add(event.key);
      else stick.keys.delete(event.key);
      const has = key => Number(stick.keys.has(key));
      setStick(stick, has('ArrowRight') - has('ArrowLeft'), has('ArrowDown') - has('ArrowUp'));
      publish();
    });
  }
  element.addEventListener('blur', () => {
    if (!stick.keys.size) return;
    stick.keys.clear();
    setStick(stick, 0, 0);
    publish();
  });
}

function setAction(action, held) {
  if (action.held === held) return;
  action.held = held;
  action.element.classList.toggle('held', held);
  publish();
}

function installAction(number, label) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = number === 0 ? 'action primary' : 'action';
  element.textContent = label;
  $('actions').append(element);
  const action = {element, pointer: null, held: false, keyboard: false, clickTimer: 0};
  actions.set(number, action);
  element.addEventListener('pointerdown', event => {
    if (event.button !== 0 || action.pointer !== null) return;
    clearTimeout(action.clickTimer);
    action.pointer = event.pointerId;
    element.setPointerCapture(event.pointerId);
    setAction(action, true);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(eventName, event => {
      if (event.pointerId !== action.pointer) return;
      action.pointer = null;
      setAction(action, action.keyboard);
    });
  }
  for (const eventName of ['keydown', 'keyup']) {
    element.addEventListener(eventName, event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      clearTimeout(action.clickTimer);
      action.keyboard = event.type === 'keydown';
      setAction(action, action.keyboard || action.pointer !== null);
    });
  }
  element.addEventListener('blur', () => {
    action.keyboard = false;
    setAction(action, action.pointer !== null);
  });
  element.addEventListener('click', event => {
    if (event.detail !== 0 || action.held) return;
    setAction(action, true);
    action.clickTimer = setTimeout(() => setAction(action, false), 65);
  });
}

function neutral() {
  for (const stick of Object.values(sticks)) {
    stick.pointer = null;
    stick.keys.clear();
    setStick(stick, 0, 0);
  }
  for (const action of actions.values()) {
    clearTimeout(action.clickTimer);
    action.pointer = null;
    action.keyboard = false;
    action.held = false;
    action.element.classList.remove('held');
  }
  publish();
  lastAim = [0, 0];
}

function roomStatus(status) {
  const connected = status === 'connected';
  $('controls').hidden = $('hint').hidden = $('player').hidden = !connected;
  $('leave').hidden = status === 'closed';
  $('retry').hidden = status !== 'closed';
  $('status').textContent = connected ? 'Connected' : status === 'closed' ? 'Disconnected' : 'Reconnecting…';
  if (connected) {
    $('player').textContent = 'Phone ' + pad.slot;
    pad.send({ready: true});
  } else neutral();
}

function updateBlitz(info) {
  if (!info?.player || !Object.hasOwn(blitzModes, info.mode)) {
    for (const [number, label] of game.actions) actions.get(number).element.textContent = label;
    $('player').textContent = 'Phone ' + pad.slot;
    $('status').textContent = 'Connected';
    $('hint').textContent = game.hint;
    return;
  }
  const [a, b, x, y, hint] = blitzModes[info.mode];
  [a, b, x, y].forEach((label, index) => { actions.get(index).element.textContent = label; });
  $('player').textContent = info.player + (info.host ? ' ★' : '');
  $('status').textContent = info.team || 'Connected';
  $('hint').textContent = hint;
}

async function connect() {
  try {
    const slot = Number(params.get('s')) || undefined;
    pad = await join({room: code, slot});
    params.set('s', pad.slot);
    history.replaceState(null, '', '?' + params);
    pad.on('status', roomStatus);
    pad.on('error', error => {
      $('status').textContent = error.code === 'kicked' ? 'The host disconnected this phone.' : 'Connection lost.';
    });
    if (gameKey === 'blitz') pad.on('message', ({blitz} = {}) => updateBlitz(blitz));
    roomStatus('connected');
  } catch (error) {
    roomStatus('closed');
    $('status').textContent = error.code === 'room-not-found' ? 'Room expired. Ask for a new invite.'
      : error.code === 'slot-taken' ? 'This room or player slot is full.' : 'Could not connect to the game.';
  }
}

if (game && /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/.test(code)) {
  document.body.dataset.game = gameKey;
  document.querySelector('h1').textContent = game.title;
  document.title = game.title + ' · Phone controller';
  $('move-label').textContent = game.move;
  $('hint').textContent = game.hint;
  $('aim').hidden = !game.aim;
  installStick(document.querySelector('[data-stick="move"]'));
  if (game.aim) installStick(document.querySelector('[data-stick="aim"]'));
  for (const [number, label] of game.actions) installAction(number, label);
  $('retry').onclick = () => location.reload();
  $('leave').onclick = () => { neutral(); pad.leave(); };
  addEventListener('blur', neutral);
  addEventListener('pagehide', neutral);
  document.addEventListener('visibilitychange', () => { if (document.hidden) neutral(); });
  connect();
} else {
  $('status').textContent = 'Open a controller invite from the game screen.';
}
