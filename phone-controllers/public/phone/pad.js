const relay = typeof couchPhoneRelay === 'undefined' ? location.origin : couchPhoneRelay;
const games = {
  blitz: {
    title: 'Blitz 7', move: 'Move / aim', actions: [
      [0, 'Join'], [1, 'Leave'], [2, 'Helmet'], [3, 'Start'], [5, 'Team / CPU'], [9, 'Pause'],
    ], hint: 'Press Join to claim a player.',
  },
  hoops: {
    title: 'Blitz Hoops', move: 'Move / aim', actions: [
      [0, 'Join'], [3, 'Pass'], [1, 'Turbo'], [2, 'Steal'], [5, 'Switch team'], [9, 'Start'],
    ], hint: 'Tap Join to claim a player.',
  },
  track: {
    title: 'Blitz Track', actions: [
      [0, 'Join'], [1, 'Turbo'], [2, 'Dirty trick'], [3, 'Event action'], [5, 'Switch team'], [9, 'Start'],
    ], hint: 'Tap Join to take a seat in the lobby.',
  },
  bedrock: {
    title: 'Bedrock Rivals', move: 'Move / aim', actions: [
      [5, 'Pick minion'], [7, 'Pick upgrade'], [2, 'Summon'], [3, 'Upgrade'], [0, 'Join'], [1, 'Leave'],
    ], hint: 'Tap Join to claim a player. Hold a picker and point the stick to choose.',
  },
  ringout: {
    title: 'Ringout', move: 'Move', aim: true, actions: [
      [2, 'Push'], [0, 'Join'], [1, 'Dodge'], [3, 'Emote'], [5, 'Trick'], [9, 'Ready'],
    ], hint: 'Hold and release Push. Use the right stick to aim it.',
  },
};
const blitzModes = {
  lobby: ['Boots', 'Leave', 'Helmet', null, 'Tap Team / CPU to switch sides. P1 can hold it and move the stick up or down to adjust CPUs.'],
  ready: ['Snap', null, null, 'Kick', 'Pick a play, then tap Snap. You can also use the stick to cycle plays.'],
  offense: ['Pass', 'Sprint', 'Dash', 'Handoff', 'Hold Pass, aim with the stick, and release to throw.'],
  receiver: ['Call for pass', 'Sprint', 'Dash', null, 'Run your route and call for the ball.'],
  runner: [null, 'Sprint', 'Juke', null, 'Use the stick to run. Dash away from defenders.'],
  defense: ['Intercept', 'Grapple', 'Dash', null, 'Tap Intercept as the pass comes down. Hold Grapple facing the runner.'],
  defenseReady: [null, null, null, null, 'Move the stick up or down to cycle defensive formations.'],
  kickMeter: [null, null, null, 'Kick', 'Tap Kick when the meter reaches the target.'],
  try: ['Go for 2', null, null, 'Kick for 1', 'Choose a kick or a two-point play.'],
  paused: [null, null, null, null, 'Waiting for P1 to resume.'],
  final: [null, null, null, null, 'Check the shared screen for postgame stats.'],
  waiting: [null, null, null, null, 'Watch the shared screen.'],
};
const hoopsModes = {
  join: {labels: {0: 'Join'}, hint: 'Tap Join to claim a player.'},
  lobby: {labels: {0: 'Joined', 2: 'Leave team', 5: 'Switch team', 9: 'Start'}, hint: 'Choose a team, then start the draft or tip off.'},
  full: {labels: {}, hint: 'All six spots are taken.'},
  wait: {labels: {}, hint: 'You can join at the next lobby.'},
  draft: {labels: {0: 'Draft player'}, move: 'Browse players', hint: 'Move the stick to browse. Check ratings on the shared screen.'},
  draftWait: {labels: {}, hint: 'Your captain is drafting on the shared screen.'},
  ball: {labels: {0: 'Shoot', 1: 'Turbo', 3: 'Pass', 9: 'Pause'}, hint: 'Hold Shoot, then release in green. Aim with the stick to pass.'},
  offense: {labels: {1: 'Turbo', 3: 'Call for pass', 9: 'Pause'}, hint: 'Get open and call for the ball.'},
  defense: {labels: {0: 'Block', 1: 'Turbo', 2: 'Steal', 9: 'Pause'}, hint: 'Jump to block or get close to steal.'},
  loose: {labels: {0: 'Block', 1: 'Turbo', 2: 'Steal', 9: 'Pause'}, hint: 'Follow the ball on the shared screen.'},
  freeThrow: {labels: {0: 'Free throw', 9: 'Pause'}, hint: 'Watch the shared meter. Tap Free throw in green.'},
  freeThrowWait: {labels: {9: 'Pause'}, hint: 'Free throws in progress.'},
  halftime: {labels: {9: 'Skip halftime'}, hint: 'Watch the highlights on the shared screen.'},
  paused: {labels: {9: 'Resume'}, hint: 'The game is paused.'},
  stoppage: {labels: {9: 'Pause'}, hint: 'Watch the call or replay on the shared screen.'},
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
let blitzBook, blitzMenu, blitzSelect;
let bedrockState, bedrockPicker, bedrockHeartbeat;
let hoopsPulseTimer = 0;
let trackPulseTimer = 0;

function publish(force = false) {
  cancelAnimationFrame(movementFrame);
  movementFrame = 0;
  if (!pad || (!force && pad.status !== 'connected')) return;
  if (pad.status === 'connected' && sticks.aim && (lastAim[0] !== sticks.aim.x || lastAim[1] !== sticks.aim.y)) {
    lastAim = [sticks.aim.x, sticks.aim.y];
    pad.send({aim: lastAim});
  }
  pad.setInput({
    x: sticks.move?.x ?? 0,
    y: sticks.move?.y ?? 0,
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
  if (!held && action.element.dataset.inactive === 'true') action.element.hidden = true;
  publish();
}

function installAction(number, label) {
  const element = document.createElement('button');
  element.type = 'button';
  element.dataset.action = number;
  element.className = number === 0 ? 'action primary' : 'action';
  element.textContent = label;
  $('actions').append(element);
  const action = {element, pointer: null, held: false, keyboard: false, clickTimer: 0};
  actions.set(number, action);
  element.addEventListener('pointerdown', event => {
    if (action.local || event.button !== 0 || action.pointer !== null || element.getAttribute('aria-disabled') === 'true') return;
    clearTimeout(action.clickTimer);
    action.pointer = event.pointerId;
    element.setPointerCapture(event.pointerId);
    setAction(action, true);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(eventName, event => {
      if (event.pointerId !== action.pointer) return;
      if (gameKey === 'blitz' && eventName !== 'pointerup' && pad?.status === 'connected') {
        pad.send({blitzCancel: true});
      }
      if ((gameKey === 'track' || gameKey === 'hoops' || gameKey === 'ringout') && eventName !== 'pointerup') {
        neutral();
        return;
      }
      action.pointer = null;
      setAction(action, action.keyboard);
    });
  }
  for (const eventName of ['keydown', 'keyup']) {
    element.addEventListener(eventName, event => {
      if (action.local || (event.key !== ' ' && event.key !== 'Enter')) return;
      if (event.type === 'keydown' && element.getAttribute('aria-disabled') === 'true') return;
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
    if (action.local) {
      openBedrockPicker(action.local);
      return;
    }
    if (event.detail !== 0 || action.held || element.getAttribute('aria-disabled') === 'true') return;
    setAction(action, true);
    action.clickTimer = setTimeout(() => setAction(action, false), 65);
  });
}

function blitzActivity(active) {
  if (gameKey === 'blitz' && pad?.status === 'connected') pad.send({blitzActive: active});
}

function neutral() {
  blitzActivity(false);
  if (gameKey === 'hoops' && pad?.status === 'connected') pad.send({hoopsCancel: true});
  if (gameKey === 'ringout' && pad?.status === 'connected') pad.send({cancel:true});
  if (gameKey === 'track' && pad?.status === 'connected') pad.send({trackCancel: true});
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
    if (action.element.dataset.inactive === 'true') action.element.hidden = true;
  }
  // Update the SDK’s queued state even if the socket has already dropped.
  publish(gameKey === 'blitz' || gameKey === 'hoops');
  lastAim = [0, 0];
}

function bedrockLive(live) {
  if (gameKey === 'bedrock' && pad?.status === 'connected') pad.send({bedrock: {live}});
}

function closeBedrockPicker() {
  if (!bedrockPicker) return;
  bedrockPicker.hidden = true;
  $('actions').inert = false;
}

function openBedrockPicker(kind) {
  if (bedrockState?.phase !== 'play') return;
  if (!bedrockPicker) {
    bedrockPicker = document.createElement('section');
    bedrockPicker.className = 'bedrock-picker';
    bedrockPicker.setAttribute('aria-label', 'Choose equipment');
    $('controls').append(bedrockPicker);
  }
  bedrockPicker.replaceChildren();
  const heading = document.createElement('b');
  heading.textContent = kind === 'minion' ? 'Choose minion' : 'Choose upgrade';
  bedrockPicker.append(heading);
  const current = bedrockState[kind];
  const options = kind === 'minion' ? bedrockState.minions : bedrockState.upgrades;
  options.forEach(({name, cost}, choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name + ' · ' + (typeof cost === 'number' ? cost + ' ore' : cost);
    button.setAttribute('aria-pressed', String(choice === current));
    button.onclick = () => {
      if (pad.status !== 'connected' || bedrockState?.phase !== 'play') return closeBedrockPicker();
      pad.send({bedrock: {kind, choice}});
      closeBedrockPicker();
      actions.get(kind === 'minion' ? 5 : 7).element.focus();
    };
    bedrockPicker.append(button);
  });
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = 'Back';
  back.onclick = () => {
    closeBedrockPicker();
    actions.get(kind === 'minion' ? 5 : 7).element.focus();
  };
  bedrockPicker.append(back);
  bedrockPicker.hidden = false;
  $('actions').inert = true;
}

function updateBedrock(info) {
  const before = bedrockState;
  bedrockState = info;
  if (before?.phase !== info?.phase || before?.player !== info?.player) {
    neutral();
    closeBedrockPicker();
  }
  const hasSeat = Boolean(info?.player);
  const waitingForRound = info?.phase === 'play' && !hasSeat;
  const playing = info?.phase === 'play' && hasSeat;
  const inLobby = info?.phase === 'lobby' || info?.phase === 'result';
  const labels = playing
    ? {0:'Dig', 1:'Fire', 2:'Summon', 3:'Upgrade', 5:'Pick minion', 7:'Pick upgrade'}
    : {0: info?.host ? (info.phase === 'result' ? 'Rematch' : 'Start') : hasSeat || waitingForRound ? null : 'Join',
       1: hasSeat ? 'Leave seat' : null, 2: info?.host && inLobby ? 'Match size' : null};
  for (const [number, action] of actions) {
    const label = labels[number];
    action.element.hidden = !label;
    if (label) action.element.textContent = label;
    action.local = playing && number === 5 ? 'minion' : playing && number === 7 ? 'upgrade' : null;
  }
  $('movement').hidden = !playing;
  $('controls').dataset.phase = playing ? 'play' : 'lobby';
  $('player').textContent = hasSeat ? info.player + (info.host ? ' · Host' : '') : 'Phone ' + pad.slot;
  $('status').textContent = info?.team ?? 'Connected';
  $('hint').textContent = playing
    ? 'Push up to jet. Hold Dig or Fire while aiming. ' +
      'Summon ' + info.minions[info.minion].name + ' · Upgrade ' + info.upgrades[info.upgrade].name + '.'
    : waitingForRound ? 'Round in progress. You can join the next one.'
      : !hasSeat ? 'Tap Join to claim a player.'
      : info.host ? info.size + 'v' + info.size + ' · CPUs fill empty seats.' : 'Waiting for the host.';
}

function roomStatus(status) {
  const connected = status === 'connected';
  $('controls').hidden = $('hint').hidden = $('player').hidden = !connected;
  $('leave').hidden = status === 'closed';
  $('retry').hidden = status !== 'closed';
  $('status').textContent = connected ? 'Connected' : status === 'closed' ? 'Disconnected' : 'Reconnecting…';
  if (!connected && blitzMenu) {blitzMenu.hidden = true; blitzMenu.open = false;}
  clearInterval(bedrockHeartbeat);
  clearInterval(trackPulseTimer);
  if (connected) {
    $('player').textContent = 'Phone ' + pad.slot;
    if (gameKey === 'track') {
      updateTrack();
      const pulse = () => {
        if (!document.hidden && pad.status === 'connected') pad.send({trackPulse: true});
      };
      pulse();
      trackPulseTimer = setInterval(pulse, 400);
    }
    if (gameKey === 'bedrock') {
      neutral();
      bedrockLive(!document.hidden);
      bedrockHeartbeat = setInterval(() => {
        if (!document.hidden) bedrockLive(true);
      }, 400);
    }
    pad.send({ready: true});
    blitzActivity(!document.hidden);
    if (gameKey === 'ringout') publishRingoutHeartbeat();
    if (gameKey === 'hoops') {
      pad.send({hoopsPulse: true});
      clearInterval(hoopsPulseTimer);
      hoopsPulseTimer = setInterval(() => {
        if (!document.hidden && pad.status === 'connected') pad.send({hoopsPulse: true});
      }, 450);
    }
  } else {
    clearInterval(hoopsPulseTimer);
    neutral();
    closeBedrockPicker();
  }
}

function updateTrack(info) {
  const labels = info?.buttons ?? {0: 'Join'};
  for (const [number, action] of actions) {
    const label = labels[number];
    // Keep a captured button visible until its finger lifts, even when the stage changes.
    if (label) action.element.textContent = label;
    action.element.hidden = !label && !action.held;
    action.element.dataset.inactive = !label;
  }
  $('player').textContent = info?.player ?? 'Phone ' + pad.slot;
  $('status').textContent = info?.team ?? 'Connected';
  $('hint').textContent = info?.hint ?? game.hint;
}

function blitzAction(number, label) {
  const action = actions.get(number);
  action.inactive = !label;
  action.element.textContent = label || '—';
  action.element.setAttribute('aria-disabled', String(action.inactive));
}

function installBlitzMenu() {
  blitzMenu = document.createElement('details');
  blitzMenu.id = 'blitz-playbook';
  blitzMenu.hidden = true;
  const title = document.createElement('summary');
  title.textContent = 'Choose a play';
  blitzSelect = document.createElement('select');
  blitzSelect.setAttribute('aria-label', 'Offensive play');
  blitzSelect.addEventListener('change', () => {
    if (!blitzBook || pad?.status !== 'connected') return;
    pad.send({blitzPlay: {id: blitzBook.id, index: Number(blitzSelect.value)}});
    blitzMenu.open = false;
  });
  blitzMenu.append(title, blitzSelect);
  $('controls').after(blitzMenu);
}

function updateBlitz(info) {
  const mode = info?.mode;
  const labels = Object.hasOwn(blitzModes, mode) ? blitzModes[mode] : null;
  if (!info?.player || !labels) {
    for (const [number] of game.actions) blitzAction(number, number === 0 ? 'Join' : null);
    $('player').textContent = 'Phone ' + pad.slot;
    $('status').textContent = 'Connected';
    $('hint').textContent = game.hint;
    blitzBook = null;
    blitzMenu.open = false;
    blitzMenu.hidden = true;
    return;
  }
  const [a, b, x, y, hint] = labels;
  const book = mode === 'ready' ? info.playbook : null;
  const selected = book?.options[book.selected];
  [selected === 'PUNT' ? 'Punt' : a, b, x, y].forEach((label, index) => blitzAction(index, label));
  blitzAction(5, mode === 'lobby' ? (info.host ? 'Team / CPU' : 'Switch team') : null);
  blitzAction(9, info.host ? ({lobby: 'Start', paused: 'Resume', final: 'Back to lobby'}[mode] || 'Pause') : null);
  if (!book || blitzBook?.id !== book.id) {
    blitzMenu.open = false;
    blitzSelect.replaceChildren(...(book?.options || []).map((name, index) => new Option(name, index)));
  }
  blitzBook = book;
  blitzMenu.hidden = !book;
  if (book) {
    blitzSelect.value = book.selected;
    blitzMenu.querySelector('summary').textContent = 'Play · ' + selected;
  }
  $('player').textContent = info.player + (info.host ? ' ★' : '');
  $('status').textContent = info.team || 'Connected';
  $('hint').textContent = mode === 'lobby' && !info.host ? 'Switch teams or customize your boots and helmet.' : hint;
}

function publishRingoutHeartbeat() {
  if (!document.hidden && pad?.status === 'connected') pad.send({ringoutActive:true});
}

function updateRingout(info) {
  if (!info) return;
  for (const [number, action] of actions) {
    const label = info.buttons[number];
    action.element.hidden = !label;
    if (label) action.element.textContent = label;
    action.element.classList.toggle('primary', number === info.primary);
  }
  $('player').textContent = info.player || 'Phone ' + pad.slot;
  $('hint').textContent = info.hint;
}

function updateHoops(info) {
  const view = hoopsModes[info?.mode] || hoopsModes.join;
  for (const [number, action] of actions) {
    const label = view.labels[number];
    action.element.textContent = label || '—';
    action.element.setAttribute('aria-disabled', String(!label || label === 'Joined'));
  }
  $('move-label').textContent = view.move || game.move;
  $('player').textContent = info?.player || 'Phone ' + pad.slot;
  $('status').textContent = info?.team || 'Connected';
  $('hint').textContent = view.hint;
}

async function connect() {
  try {
    const {join} = await import(relay + '/joinstick/client.js');
    const slot = Number(params.get('s')) || undefined;
    pad = await join({room: code, slot, server: relay});
    params.set('s', pad.slot);
    history.replaceState(null, '', '?' + params);
    pad.on('status', roomStatus);
    pad.on('error', error => {
      $('status').textContent = error.code === 'kicked' ? 'The host disconnected this phone.' : 'Connection lost.';
    });
    if (gameKey === 'blitz') pad.on('message', ({blitz} = {}) => updateBlitz(blitz));
    if (gameKey === 'bedrock') pad.on('message', data => {
      if (data && Object.hasOwn(data, 'bedrock')) updateBedrock(data.bedrock);
    });
    if (gameKey === 'hoops') {
      pad.on('message', ({hoops} = {}) => updateHoops(hoops));
      updateHoops(null);
    }
    if (gameKey === 'track') pad.on('message', ({track} = {}) => updateTrack(track));
    if (gameKey === 'ringout') pad.on('message', ({ringout} = {}) => updateRingout(ringout));
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
  $('movement').hidden = !game.move;
  if (game.move) {
    $('move-label').textContent = game.move;
    installStick(document.querySelector('[data-stick="move"]'));
  }
  $('hint').textContent = game.hint;
  $('aim').hidden = !game.aim;
  if (game.aim) installStick(document.querySelector('[data-stick="aim"]'));
  for (const [number, label] of game.actions) installAction(number, label);
  if (gameKey === 'blitz') {
    installBlitzMenu();
    $('controls').addEventListener('contextmenu', event => event.preventDefault());
    for (const [number] of game.actions) blitzAction(number, number === 0 ? 'Join' : null);
    setInterval(() => { if (!document.hidden) blitzActivity(true); }, 400);
  }
  $('retry').onclick = () => location.reload();
  $('leave').onclick = () => { neutral(); if (gameKey === 'ringout') pad.send({leave:true}); if (gameKey === 'bedrock') pad.send({bedrock: {leave: true}}); if (gameKey === 'blitz') pad.send({blitzLeave: true}); pad.leave(); };
  addEventListener('blur', neutral);
  function suspendControls() {
    neutral();
    closeBedrockPicker();
    bedrockLive(false);
  }
  addEventListener('pagehide', suspendControls);
  addEventListener('pageshow', () => blitzActivity(!document.hidden));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspendControls();
    else {
      blitzActivity(true);
      bedrockLive(true);
    }
  });
  if (gameKey === 'ringout') {
    setInterval(publishRingoutHeartbeat, 500);
    document.addEventListener('visibilitychange', publishRingoutHeartbeat);
  }
  connect();
} else {
  $('status').textContent = 'Open a controller invite from the game screen.';
}
