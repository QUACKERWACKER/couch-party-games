import {createRingoutController} from './ringout-controller.js';
import './profiles.js';
import {localPeer, localDescription} from './direct-link.js';

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
    title: 'Blitz Track', move: 'Pace / select', actions: [
      [0, 'Join'], [1, 'Turbo'], [2, 'Dirty trick'], [3, 'Event action'], [5, 'Switch team'], [9, 'Start'],
    ], hint: 'Tap Join to take a seat in the lobby.',
  },
  bedrock: {
    title: 'Bedrock Rivals', move: 'Move · up jets', aim: true, actions: [
      [5, 'Pick minion'], [7, 'Pick upgrade'], [2, 'Summon'], [3, 'Upgrade'], [0, 'Join'], [1, 'Leave'],
    ], hint: 'Tap Join to claim a player. Tap a picker to choose equipment.',
  },
  ringout: {
    title: 'Ringout', move: 'Move', aim: true, actions: [
      [2, 'Push'], [0, 'Join'], [1, 'Dodge'], [3, 'Emote'], [5, 'Trick'], [9, 'Ready'],
    ], hint: 'Hold and release Push. Use the right stick to aim it.',
  },
};
const blitzModes = {
  perks: [null,null,null,null,'Tap a perk to lock it for this drive. Both teams see the results.'],
  lobby: ['Boots', 'Leave', 'Helmet', null, 'Tap Team / CPU to switch sides. P1 can hold it and move the stick up or down to adjust CPUs.'],
  ready: ['Snap', null, null, 'Kick', 'Pick a play, then tap Snap.'],
  offense: ['Pass', 'Sprint', 'Dash', 'Handoff', 'Hold Pass, aim with the stick, and release to throw.'],
  receiver: ['Call for pass', 'Sprint', 'Dash', null, 'Run your route and call for the ball.'],
  runner: [null, 'Sprint', 'Juke', null, 'Use the stick to run. Dash away from defenders.'],
  defense: ['Intercept', 'Grapple', 'Dash', null, 'Tap Intercept as the pass comes down. Hold Grapple facing the runner.'],
  defenseReady: [null, null, null, null, 'Choose a defensive lineup.'],
  kickMeter: [null, null, null, 'Kick', 'Tap Kick when the meter reaches the target.'],
  try: ['Go for 2', null, null, 'Kick for 1', 'Choose a kick or a two-point play.'],
  paused: [null, null, null, null, 'Waiting for P1 to resume.'],
  final: [null, null, null, null, 'Check the shared screen for postgame stats.'],
  waiting: [null, null, null, null, 'Watch the shared screen.'],
};
const hoopsModes = {
  join: {labels: {0: 'Join'}, hint: 'Tap Join to claim a player.'},
  lobby: {labels: {2: 'Leave team', 5: 'Switch team', 9: 'Start'}, hint: 'Choose a team, then start the draft or tip off.'},
  warmup: {labels: {0: 'Practice shot', 1: 'Turbo', 2: 'Leave team', 5: 'Switch team', 9: 'Start'},
    hint: 'Everyone has a ball. Hold Practice shot and release in green. Tap Start when ready.'},
  full: {labels: {}, hint: 'All six spots are taken.'},
  wait: {labels: {}, hint: 'You can join at the next lobby.'},
  draft: {labels: {0: 'Draft', 1: 'Back', 2: 'Previous', 3: 'Next'}, hint: 'Browse on your phone. A drafts the displayed teammate.'},
  draftWait: {labels: {}, hint: 'Your captain is choosing a teammate. Watch the shared screen.'},
  ball: {labels: {0: 'Shoot', 1: 'Turbo', 3: 'Pass', 9: 'Pause'}, hint: 'Hold Shoot, then release in green. Aim with the stick to pass.'},
  offense: {labels: {1: 'Turbo', 3: 'Call for pass', 9: 'Pause'}, hint: 'Get open and call for the ball.'},
  defense: {labels: {0: 'Block', 1: 'Turbo', 2: 'Steal', 9: 'Pause'}, hint: 'Jump to block or get close to steal.'},
  loose: {labels: {0: 'Block', 1: 'Turbo', 2: 'Steal', 9: 'Pause'}, hint: 'Follow the ball on the shared screen.'},
  freeThrow: {labels: {0: 'Free throw', 9: 'Pause'}, hint: 'Watch the shared meter. Tap Free throw in green.'},
  freeThrowWait: {labels: {9: 'Pause'}, hint: 'Free throws in progress.'},
  recoveryBrief: {labels: {0: 'Ready', 9: 'Pause'}, hint: 'Read the recovery instructions, then tap Ready.'},
  recoveryPreview: {labels: {9: 'Pause'}, hint: 'Memorize the recovery order on the shared screen.'},
  recovery: {labels: {0: 'Ice', 1: 'Tape', 3: 'Stretch', 9: 'Pause'}, hint: 'Repeat the shared-screen order. Each correct tap shortens your injury.'},
  recoveryWait: {labels: {9: 'Pause'}, hint: 'Injury recovery in progress. Watch the shared screen.'},
  halftime: {labels: {9: 'Skip halftime'}, hint: 'Watch the highlights on the shared screen.'},
  paused: {labels: {9: 'Resume'}, hint: 'The game is paused.'},
  stoppage: {labels: {9: 'Pause'}, hint: 'Watch the call or replay on the shared screen.'},
};
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const code = params.get('r')?.trim().toUpperCase();
const validCode = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/.test(code);
const gameKey = params.get('g') || (validCode ? 'lobby' : null);
const managed = gameKey === 'lobby' || params.get('p') === '1';
const lobby = gameKey === 'lobby';
const game = Object.hasOwn(games, gameKey) ? games[gameKey] : null;
const actions = new Map();
const sticks = {};
const portrait = matchMedia('(orientation: portrait)');
let profile;
let menuSelection = 'blitz';
let pad, direct, relayTimer;
let lastRelayMotion = -Infinity;
let nextDirectAttempt = 0;
let relayInterval = 1000 / 60;
let lastAim = [0, 0];
let blitzBook, blitzMenu, blitzChoices, blitzPreview;
let bedrockState, bedrockPicker, bedrockController, heartbeatTimer;
const heartbeats = {
  blitz: {interval: 400, message: {blitzActive: true}},
  track: {interval: 400, message: {trackPulse: true}},
  bedrock: {interval: 400, message: {bedrock: {live: true}}},
  hoops: {interval: 450, message: {hoopsPulse: true}},
  ringout: {interval: 500, message: {ringoutActive: true}},
};
const cancellations = {
  blitz: {blitzActive: false}, hoops: {hoopsCancel: true}, ringout: {cancel: true}, track: {trackCancel: true},
};
const departures = {blitz: {blitzLeave: true}, ringout: {leave: true}, bedrock: {bedrock: {leave: true}}};

function send(message) {
  if (message && pad?.status === 'connected') pad.send(message);
}

function heartbeat() {
  if (!document.hidden) send(heartbeats[gameKey]?.message);
}

function publish(force = false, motion = false) {
  if (!pad || (!force && pad.status !== 'connected')) return;
  const x = sticks.move?.x ?? 0;
  const y = sticks.move?.y ?? 0;
  const aimX = sticks.aim?.x ?? 0;
  const aimY = sticks.aim?.y ?? 0;
  let mask = 0;
  if (gameKey==='bedrock' && bedrockController && Math.hypot(aimX,aimY)>.22 && (sticks.aim.pointer!==null || sticks.aim.keys.size) && !actions.get(0)?.held) mask |= 1<<1;
  for (const [number, action] of actions) if (action.held) mask |= 1 << number;
  const now = performance.now();
  const channel = direct?.channel;
  if (!direct?.active && channel?.readyState === 'open' && !mask && !x && !y && !aimX && !aimY) {
    pad.setInput({x: 0, y: 0, buttons: {}});
    direct.active = true;
  }
  const useDirect = direct?.active && channel?.readyState === 'open';
  const wait = motion && (x || y || aimX || aimY) && (useDirect
    ? channel.bufferedAmount > 128 ? 12 : 0
    : lastRelayMotion + relayInterval - now);
  if (wait > 0) {
    relayTimer ??= setTimeout(() => {
      relayTimer = undefined;
      publish(false, true);
    }, wait);
    return;
  }
  clearTimeout(relayTimer);
  relayTimer = undefined;
  if (useDirect) {
    try {
      channel.send(JSON.stringify([x, y, mask, aimX, aimY]));
      return;
    } catch {
      direct.active = false;
      direct.close();
      lastAim = [NaN, NaN];
    }
  }
  lastRelayMotion = now;
  if (pad.status === 'connected' && sticks.aim && (lastAim[0] !== aimX || lastAim[1] !== aimY)) {
    lastAim = [aimX, aimY];
    pad.send(gameKey==='bedrock' ? {bedrock:{aim:lastAim}} : {aim: lastAim});
  }
  const buttons = {};
  for (const [number] of actions) if (mask & (1 << number)) buttons['b' + number] = true;
  pad.setInput({x, y, buttons});
}

function setStick(stick, x, y) {
  const scale = Math.max(1, Math.hypot(x, y));
  const nextX = Math.round(x / scale * 100) / 100;
  const nextY = Math.round(y / scale * 100) / 100;
  if (nextX === stick.x && nextY === stick.y) return false;
  stick.x = nextX;
  stick.y = nextY;
  const travel = stick.element.clientWidth * .28;
  stick.element.style.setProperty('--x', stick.x * travel + 'px');
  stick.element.style.setProperty('--y', stick.y * travel + 'px');
  stick.element.classList.toggle('active', Boolean(stick.x || stick.y));
  return true;
}

function installStick(element) {
  const stick = {element, x: 0, y: 0, pointer: null, keys: new Set()};
  sticks[element.dataset.stick] = stick;
  const move = (event, motion = false) => {
    const {left, top, width, height} = element.getBoundingClientRect();
    const screenX = (event.clientX - left - width / 2) / (width * .35);
    const screenY = (event.clientY - top - height / 2) / (height * .35);
    // Undo the portrait viewport's clockwise quarter-turn before sending game axes.
    const rotated=portrait.matches && !(gameKey==='bedrock' && bedrockController);
    if (setStick(stick, rotated ? screenY : screenX, rotated ? -screenX : screenY)) {
      publish(false, motion);
    }
  };
  element.addEventListener('pointerdown', event => {
    if (event.button !== 0 || stick.pointer !== null) return;
    event.preventDefault();
    stick.pointer = event.pointerId;
    element.setPointerCapture(event.pointerId);
    move(event);
  });
  element.addEventListener('pointermove', event => {
    if (event.pointerId === stick.pointer) move(event, true);
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

function setActionLabel(action, label) {
  if (label && action.caption.textContent !== label) action.caption.textContent = label;
  action.element.dataset.inactive = String(!label);
  action.element.hidden = !label && !action.held;
  action.element.setAttribute('aria-disabled', String(!label));
}

function installAction(number, label) {
  const element = document.createElement('button');
  element.type = 'button';
  element.dataset.action = number;
  element.className = number === 0 ? 'action primary' : 'action';
  const face = ['A', 'B', 'X', 'Y'][number];
  if (face) {
    const marker = document.createElement('span');
    marker.className = 'face-letter';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = face;
    element.append(marker);
  }
  const caption = document.createElement('span');
  caption.className = 'action-label';
  caption.textContent = label;
  element.append(caption);
  $(number === 9 ? 'system-buttons' : face ? 'face-buttons' : 'utility-buttons').append(element);
  const action = {element, caption, pointer: null, held: false, keyboard: false, clickTimer: 0};
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
      if(typeof action.local==='function') action.local();
      else openBedrockPicker(action.local);
      return;
    }
    if (event.detail !== 0 || action.held || element.getAttribute('aria-disabled') === 'true') return;
    setAction(action, true);
    action.clickTimer = setTimeout(() => setAction(action, false), 65);
  });
}

function neutral() {
  if (gameKey === 'track' && direct?.active && direct.channel?.readyState === 'open') {
    try { direct.channel.send('track-cancel'); } catch {}
  }
  send(cancellations[gameKey]);
  if(gameKey==='bedrock') send({bedrock:{aim:[0,0]}});
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
  publish(true);
  lastAim = [0, 0];
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
  if(bedrockController && info?.version===2) {bedrockController.update(info);return;}
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
  const mainAction = actions.get(0);
  const group = $(info?.host && inLobby ? 'system-buttons' : 'face-buttons');
  if (mainAction.element.parentElement !== group) {
    if (mainAction.held) neutral();
    group.prepend(mainAction.element);
  }
  const labels = playing
    ? {0:'Dig', 1:'Fire', 2:'Summon', 3:'Upgrade', 5:'Pick minion', 7:'Pick upgrade'}
    : {0: info?.host && inLobby ? (info.phase === 'result' ? 'Rematch' : 'Start') : hasSeat || waitingForRound ? null : 'Join',
       1: hasSeat ? 'Leave seat' : null, 2: info?.host && inLobby ? 'Match size' : null};
  for (const [number, action] of actions) {
    const label = labels[number];
    setActionLabel(action, label);
    action.local = playing && number === 5 ? 'minion' : playing && number === 7 ? 'upgrade' : null;
  }
  emphasizeAction();
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
  if (lobby) {
    const connected = status === 'connected';
    $('leave').hidden = $('profile-open').hidden = $('controls').hidden = $('hint').hidden = !connected;
    document.querySelector('.join-recovery').hidden = status !== 'closed';
    $('status').textContent = connected ? 'Paired. Choose a game on the shared screen.'
      : status === 'closed' ? 'Disconnected' : 'Reconnecting…';
    if (connected) {
      updateLobbySelection();
      pad.send({ready: true, couchGame: null, ...(profile && {couchProfile: profile})});
    } else {
      neutral();
    }
    return;
  }
  const connected = status === 'connected';
  $('controls').hidden = $('hint').hidden = $('player').hidden = !connected;
  $('leave').hidden = status === 'closed';
  document.querySelector('.join-recovery').hidden = status !== 'closed';
  $('status').textContent = connected ? 'Connected' : status === 'closed' ? 'Disconnected' : 'Reconnecting…';
  if (!connected && blitzMenu) {blitzMenu.hidden = true; }
  clearInterval(heartbeatTimer);
  if (connected) {
    $('player').textContent = 'Phone ' + pad.slot;
    if (gameKey === 'ringout') updateRingout();
    if (gameKey === 'track') updateTrack();
    if (gameKey === 'bedrock') neutral();
    pad.send({ready: true, couchGame: gameKey});
    heartbeat();
    heartbeatTimer = setInterval(heartbeat, heartbeats[gameKey].interval);
  } else {
    neutral();
    closeBedrockPicker();
  }
}

function emphasizeAction(preferred = 0) {
  const available = number => actions.get(number)?.element.dataset.inactive === 'false';
  const primary = available(preferred) ? preferred : [0, 3, 2, 1, 9, 5, 7].find(available);
  for (const [number, action] of actions) {
    action.element.classList.toggle('primary', number === primary);
  }
}

let lastTrackCue;
let lastTrackContext;
let trackPlan;

function updateTrack(info) {
  if (info?.context && info.context !== lastTrackContext) {
    lastTrackContext = info.context;
    neutral();
  }
  if (!trackPlan) {
    trackPlan = document.createElement('section');
    trackPlan.id = 'track-plan';
    trackPlan.setAttribute('aria-live', 'polite');
    trackPlan.append(document.createElement('h2'), document.createElement('strong'), document.createElement('p'));
    $('controls').append(trackPlan);
  }
  trackPlan.hidden = !info?.plan;
  if (info?.plan) {
    const [title, selected, detail] = trackPlan.children;
    title.textContent = info.plan.title;
    selected.textContent = info.plan.waiting ? 'Ready · ' + info.plan.selected : info.plan.selected;
    detail.textContent = info.plan.detail;
  }
  $('move-label').textContent = info?.stick ?? game.move;
  document.body.dataset.trackPhase = info?.phase ?? 'joining';
  const cue = info?.cue;
  if (cue?.id && cue.id !== lastTrackCue) {
    lastTrackCue = cue.id;
    if (!document.hidden) navigator.vibrate?.(cue.kind === 'flag' ? [40, 35, 50] : 23);
  }
  const labels = info?.buttons ?? {0: 'Join'};
  updateActionLabels(labels);
  emphasizeAction(info?.primary);
  $('player').textContent = info?.player ?? 'Phone ' + pad.slot;
  $('status').textContent = info?.team ?? 'Connected';
  $('hint').textContent = info?.hint ?? game.hint;
}

function updateActionLabels(labels) {
  for (const [number, action] of actions) setActionLabel(action, labels[number]);
}

function installBlitzMenu() {
  blitzMenu = document.createElement('section');
  blitzMenu.id = 'blitz-playbook';
  blitzMenu.hidden = true;
  blitzMenu.setAttribute('aria-labelledby', 'blitz-call-title');
  const heading = document.createElement('h2');
  heading.id = 'blitz-call-title';
  const preview = document.createElement('div');
  preview.className = 'blitz-preview';
  blitzPreview = document.createElement('canvas');
  blitzPreview.width = 480;
  blitzPreview.height = 154;
  blitzPreview.setAttribute('role', 'img');
  const detail = document.createElement('p');
  detail.className = 'blitz-call-detail';
  preview.append(blitzPreview, detail);
  blitzChoices = document.createElement('div');
  blitzChoices.className = 'blitz-choices';
  const quick = document.createElement('div');
  quick.className = 'blitz-call-actions';
  for (const [number,label] of [[0,'Snap'],[3,'Kick']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.callAction = number;
    button.textContent = label;
    button.addEventListener('click', () => {
      const action = actions.get(number);
      if (!blitzBook || blitzBook.kind !== 'offense' || pad?.status !== 'connected' || action.held) return;
      setAction(action, true);
      action.clickTimer = setTimeout(() => setAction(action, false), 90);
    });
    quick.append(button);
  }
  blitzMenu.append(heading, preview, blitzChoices, quick);
  $('controls').after(blitzMenu);
}

function drawBlitzPreview(option, defense) {
  const canvas = blitzPreview, ctx = canvas.getContext('2d');
  const routes = option.routes || [];
  const all = option.players.concat(routes.flatMap(([, points]) => points));
  const minX = Math.min(-70, ...all.map(([x]) => x)) - 14;
  const maxX = Math.max(150, ...all.map(([x]) => x)) + 19;
  const plot = ([x,y]) => [(x - minX) / (maxX - minX) * 448 + 16, 77 + y * .44];
  ctx.fillStyle = '#183b31';
  ctx.fillRect(0, 0, 480, 154);
  function line(points, color, dashed = false, arrow = false) {
    const coords = points.map(plot);
    const [x, y] = coords.at(-1), previous = coords.at(-2);
    ctx.strokeStyle = color;
    ctx.lineWidth = arrow ? 2.5 : 1;
    ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.beginPath();
    coords.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.stroke();
    if (!arrow || Math.hypot(x - previous[0], y - previous[1]) < 4) return;
    const angle = Math.atan2(y - previous[1], x - previous[0]);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x - 8 * Math.cos(angle - .52), y - 8 * Math.sin(angle - .52));
    ctx.lineTo(x, y);
    ctx.lineTo(x - 8 * Math.cos(angle + .52), y - 8 * Math.sin(angle + .52));
    ctx.stroke();
  }
  for (let x = -40; x < maxX; x += 40) {
    line([[x,-151],[x,151]], x === 0 ? '#b1d2bf' : '#54816b', x === 0);
  }
  for (const [type,points] of routes) {
    line(points, ['kick','run','exchange'].includes(type) ? '#ffcf74' : '#a9e9cf', type==='block' || type==='exchange', true);
  }
  option.players.forEach((point,index) => {
    if (defense && index < option.rushers) line([point,[point[0]-25,point[1]]], '#ffcf74', false, true);
    const [x,y] = plot(point);
    ctx.fillStyle = (defense ? index < option.rushers : index === 0) ? '#ffcf74' : '#a9e9cf';
    ctx.beginPath();
    ctx.arc(x,y,index===0 ? 6 : 4.5,0,Math.PI*2);
    ctx.fill();
  });
  canvas.setAttribute('aria-label', option.name + (defense ? ' with '+option.rushers+' rushers' : ' route preview'));
}

function renderBlitzBook(book) {
  if (!book) {
    blitzBook = null;
    blitzMenu.hidden = true;
    return;
  }
  const defense = book.kind === 'defense', perk = book.kind === 'perk';
  if (blitzBook?.id !== book.id || blitzBook?.kind !== book.kind || blitzBook?.options.length !== book.options.length) {
    blitzChoices.replaceChildren(...book.options.map((option,index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.name+(book.kind==='perk' ? ' · '+option.detail : '');
      button.addEventListener('click', () => {
        if (pad?.status !== 'connected' || !blitzBook) return;
        pad.send({blitzPlay: {id:blitzBook.id, kind:blitzBook.kind, index}});
      });
      return button;
    }));
  }
  blitzBook = book;
  const selected = book.options[book.selected];
  blitzMenu.hidden = false;
  blitzMenu.dataset.kind = book.kind;
  $('blitz-call-title').textContent = defense ? 'Defensive lineup' : perk ? (book.confirmed ? 'Perk locked' : 'Pick a drive perk') : 'QB play call';
  blitzMenu.querySelector('.blitz-preview').hidden = perk;
  blitzMenu.querySelector('.blitz-call-detail').textContent = defense ?
    selected.rushers+' rush · '+(7-selected.rushers)+' in coverage' : '';
  blitzMenu.querySelector('.blitz-call-actions').hidden = defense || perk;
  blitzMenu.querySelector('[data-call-action="0"]').textContent = book.snapWait ? 'Ready in '+book.snapWait+'s' : selected.name === 'PUNT' ? 'Punt' : 'Snap';
  for (const button of blitzMenu.querySelectorAll('[data-call-action]')) button.disabled = Boolean(book.snapWait);
  [...blitzChoices.children].forEach((button,index) => {
    button.setAttribute('aria-pressed', String(book.selected===index));
    button.disabled = perk && book.confirmed;
  });
  if (!perk) drawBlitzPreview(selected, defense);
}

function updateBlitz(info) {
  const mode = info?.mode;
  const labels = Object.hasOwn(blitzModes, mode) ? blitzModes[mode] : null;
  if (!info?.player || !labels) {
    updateActionLabels({0: 'Join'});
    emphasizeAction();
    $('player').textContent = 'Phone ' + pad.slot;
    $('status').textContent = 'Connected';
    $('hint').textContent = game.hint;
    renderBlitzBook(null);
    return;
  }
  const [a, b, x, y, hint] = labels;
  const book = (mode === 'ready' || mode === 'defenseReady' || mode === 'perks') && info.playbook?.kind ? info.playbook : null;
  const selected = book?.options[book.selected]?.name;
  updateActionLabels({
    0: selected === 'PUNT' ? 'Punt' : a, 1: b, 2: x, 3: y,
    5: mode === 'lobby' ? (info.host ? 'Team / CPU' : 'Switch team') : null,
    9: info.host ? ({lobby: 'Start', paused: 'Resume', final: 'Back to lobby'}[mode] || 'Pause') : null,
  });
  emphasizeAction(mode === 'runner' ? 1 : 0);
  renderBlitzBook(book);
  $('player').textContent = info.player + (info.host ? ' ★' : '');
  $('status').textContent = info.team || 'Connected';
  $('hint').textContent = book ? '' : mode === 'lobby' && !info.host ? 'Switch teams or customize your boots and helmet.' : hint;
}

let ringoutController;
function updateRingout(info) {
  ringoutController ||= createRingoutController({send,neutral});
  ringoutController.update(info);
  const phase=info?.phase;
  if (phase && phase!==updateRingout.phase) { neutral(); updateRingout.phase=phase; }

  if(/^#[0-9a-f]{6}$/i.test(info?.accent || '')) document.body.style.setProperty('--accent',info.accent);
  const buttons = info?.buttons ?? {};
  const aim = sticks.aim;
  $('aim').hidden = !(info?.active || buttons[2] === 'Push' || buttons[2] === 'Last Word');
  if ($('aim').hidden && (aim.x || aim.y || aim.pointer !== null)) {
    aim.pointer = null;
    aim.keys.clear();
    setStick(aim, 0, 0);
    publish();
  }
  updateActionLabels(buttons);
  emphasizeAction(info?.primary);
  $('player').textContent = (info?.player || 'Phone ' + pad.slot)+(info?.team?' · '+info.team:'');
  $('hint').textContent = info?.hint ?? 'Connecting to the arena…';
}

let hoopsPanel, hoopsPowerStatus;

function installHoopsPanels() {
  if (hoopsPanel) return;
  hoopsPanel = document.createElement('aside');
  hoopsPanel.id = 'hoops-break-panel';
  hoopsPanel.setAttribute('aria-label', 'Your basketball instructions');
  hoopsPanel.hidden = true;
  $('controls').append(hoopsPanel);
  hoopsPowerStatus = document.createElement('span');
  hoopsPowerStatus.id = 'hoops-power-status';
  hoopsPowerStatus.hidden = true;
  $('utility-buttons').append(hoopsPowerStatus);
  $('hint').setAttribute('role', 'status');
}

function renderHoopsPanel(info, view) {
  const prospect = info?.prospect;
  const phase = info?.mode;
  let title, detail;
  if (info?.result) {
    title = `${info.player} · final stats`;
    detail = `${info.result.points} points · ${info.result.rebounds} rebounds · ${info.result.assists} assists. Full stats are on the shared screen.`;
  } else if (prospect) {
    title = `${prospect.name} · ${prospect.position}/${prospect.total}`;
    detail = `${prospect.role}. ${prospect.ability.name}: ${prospect.ability.text}`;
  } else if (phase === 'recoveryBrief') {
    title = 'Quick recovery';
    detail = 'Memorize three treatments on the shared screen. Repeat them here to shorten your injury. Tap Ready when you understand.';
  } else if (phase === 'recoveryPreview') {
    title = 'Look at the shared screen';
    detail = 'Memorize the treatment order. Your phone buttons appear when it is time to repeat it.';
  } else if (phase === 'recovery') {
    title = `Recovery · ${info.progress}/3`;
    detail = `${info.seconds}s left. A = Ice. B = Tape. Y = Stretch. A wrong tap costs time.`;
  } else if (phase === 'recoveryWait') {
    title = 'Injury timeout';
    detail = 'Your teammate is recovering. Play resumes automatically.';
  } else if (phase === 'draftWait') {
    title = 'Your captain is choosing';
    detail = info?.ability ? `Your power is ${info.ability.name}. ${info.ability.text}` : view.hint;
  } else if (phase === 'freeThrow') {
    title = info.getReady ? `Get ready · ${info.getReady}` : 'Watch the shared meter';
    detail = 'Tap Free throw when the shared-screen marker reaches green. The game judges your timing.';
  } else if (phase === 'freeThrowWait') {
    title = 'At the free-throw line';
    detail = 'Watch the shared screen for the result.';
  } else if (phase === 'paused' && info?.ability) {
    title = info.ability.name;
    detail = `${info.ability.text} Use its button below the center controls. Tap Resume when ready.`;
  }
  hoopsPanel.hidden = !title;
  if (!title) return false;
  const key = JSON.stringify([title, detail, prospect?.ratings]);
  if (hoopsPanel.dataset.content !== key) {
    const heading = document.createElement('h2');
    heading.textContent = title;
    const text = document.createElement('p');
    text.textContent = detail;
    const nodes = [heading, text];
    if (prospect) {
      const ratings = document.createElement('dl');
      ['Speed', 'Shooting', 'Finishing', 'Defense', 'Passing'].forEach((label, i) => {
        const term = document.createElement('dt');
        term.textContent = label;
        const value = document.createElement('dd');
        value.textContent = prospect.ratings[i];
        ratings.append(term, value);
      });
      nodes.push(ratings);
    }
    hoopsPanel.replaceChildren(...nodes);
    hoopsPanel.dataset.content = key;
  }
  return true;
}

function updateHoops(info) {
  installHoopsPanels();
  const view = hoopsModes[info?.mode] || hoopsModes.join;
  const labels = {...view.labels};
  if (info?.ruleset) {
    labels[9] = info.final ? 'Rematch' : info.ruleset === 'chaos' ? 'Draft & start' : 'Tip off';
    if (info.final) labels[3] = 'Choose mode';
    else if (info.canSelectMode) labels[3] = info.ruleset === 'basic' ? 'Choose Chaos' : 'Choose Basic';
  }
  const powerAvailable = info?.ability?.ready && ['ball', 'offense', 'defense', 'loose'].includes(info.mode);
  if (powerAvailable && !info.ability.seconds) labels[5] = info.ability.name;
  hoopsPowerStatus.hidden = !powerAvailable || !info.ability.seconds;
  if (!hoopsPowerStatus.hidden) hoopsPowerStatus.textContent = `${info.ability.name} · ${info.ability.seconds}s`;
  updateActionLabels(labels);
  $('controls').classList.remove('hoops-recovery');
  $('movement').hidden = renderHoopsPanel(info, view);
  if (info?.mode?.startsWith('recovery')) {
    for (const action of actions.values()) action.element.classList.remove('primary');
  } else emphasizeAction(view === hoopsModes.lobby ? 9 : 0);
  $('move-label').textContent = view.move || game.move;
  $('player').textContent = info?.player || 'Phone ' + pad.slot;
  $('status').textContent = info?.team || 'Connected';
  $('status').style.color = info?.team === 'HOT DOGS' ? '#ff826f' : info?.team === 'TURBO TOADS' ? '#72e6de' : '';
  if (/^#[0-9a-f]{6}$/i.test(info?.accent)) document.body.style.setProperty('--accent', info.accent);
  $('hint').textContent = info?.notice || view.hint;
}

async function openDirectLink() {
  if (!managed || direct || document.hidden || pad?.status !== 'connected' ||
      performance.now() < nextDirectAttempt) return;
  nextDirectAttempt = performance.now() + 30_000;
  const peer = localPeer();
  if (!peer) return;
  const channel = peer.createDataChannel('couch-input');
  const link = {peer, channel, id: Array.from(crypto.getRandomValues(new Uint32Array(2))).join('-')};
  direct = link;
  const timer = setTimeout(() => { if (channel.readyState !== 'open') close(); }, 4500);
  function close() {
    if (direct !== link) return;
    direct = undefined;
    clearTimeout(timer);
    clearInterval(link.pulseTimer);
    peer.close();
    if (link.active) {
      lastAim = [NaN, NaN];
      publish();
    }
  }
  channel.onopen = () => {
    clearTimeout(timer);
    let lastPong = performance.now();
    let sentAt, ping;
    channel.onmessage = ({data}) => {
      if (data !== 'pong' || sentAt === undefined) return;
      lastPong = performance.now();
      ping = lastPong - sentAt;
      sentAt = undefined;
    };
    link.pulseTimer = setInterval(() => {
      if (performance.now() - lastPong > 1200 || channel.readyState !== 'open') return close();
      if (sentAt !== undefined) return;
      sentAt = performance.now();
      try {
        channel.send(ping === undefined ? 'ping' : 'ping:' + ping.toFixed(1));
      } catch { close(); }
    }, 400);
    publish();
  };
  channel.onclose = close;
  peer.onconnectionstatechange = () => {
    if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) close();
  };
  link.answer = async sdp => {
    try {
      if (peer.signalingState === 'have-local-offer') await peer.setRemoteDescription({type: 'answer', sdp});
    } catch { close(); }
  };
  link.close = close;
  try {
    const sdp = await localDescription(peer, await peer.createOffer());
    if (direct === link && sdp?.length < 5500) send({directOffer: {id: link.id, sdp}});
  } catch { close(); }
}

async function connect() {
  try {
    const {join} = await import(relay + '/joinstick/client.js');
    const slot = Number(params.get('s')) || undefined;
    pad = await join({room: code, slot, server: relay});
    params.set('g', gameKey);
    params.set('r', code);
    params.set('s', pad.slot);
    history.replaceState(null, '', '?' + params);
    pad.on('status', status => {
      if (status !== 'connected') direct?.close();
      roomStatus(status);
      if(status!=='connected') bedrockController?.reset();
      if(status!=='connected') ringoutController?.reset();
      if (status === 'connected') openDirectLink();
    });
    pad.on('message', data => {
      if(gameKey==='ringout' && !document.hidden && Number.isFinite(data?.ringoutFeedback)) navigator.vibrate?.(Math.max(0,Math.min(80,data.ringoutFeedback)));
      const answer = data?.directAnswer;
      if (direct && answer?.id === direct.id && typeof answer.sdp === 'string') direct.answer(answer.sdp);
      if (typeof data?.inputPong === 'number') {
        const latency = performance.now() - data.inputPong;
        relayInterval = latency > 350 ? 50 : latency > 170 ? 33 : 1000 / 60;
        send({relayPing: latency});
      }
    });
    pad.on('error', error => {
      $('status').textContent = error.code === 'kicked' ? 'The host disconnected this phone.' : 'Connection lost.';
    });
    if (managed) pad.on('message', data => {
      if (!data || !Object.hasOwn(data, 'couchGame')) return;
      const next = data.couchGame ?? 'lobby';
      if (next === gameKey || (next !== 'lobby' && !Object.hasOwn(games, next))) return;
      neutral();
      params.set('p', '1');
      params.set('g', next);
      location.replace('?' + params);
    });
    if (lobby) pad.on('message', data => {
      if (!Object.hasOwn(window.couchProfiles.games, data?.couchSelection)) return;
      menuSelection = data.couchSelection;
      updateLobbySelection();
    });
    const update = {blitz: updateBlitz, bedrock: updateBedrock, hoops: updateHoops,
      track: updateTrack, ringout: updateRingout}[gameKey];
    if (update) pad.on('message', data => {
      if (data && Object.hasOwn(data, gameKey)) update(data[gameKey]);
    });
    if (gameKey === 'hoops') updateHoops();
    roomStatus('connected');
    openDirectLink();
    const probe = () => {
      send({inputPing: performance.now()});
      openDirectLink();
    };
    probe();
    setInterval(probe, 6000);
    addEventListener('pagehide', () => direct?.close());
  } catch (error) {
    roomStatus('closed');
    $('status').textContent = error.code === 'room-not-found' ? 'Room not found. Check the code or ask the host for a new one.'
      : error.code === 'slot-taken' ? 'This room or player slot is full.' : 'Could not connect to the game.';
  }
}

function updateLobbySelection() {
  $('hint').textContent = 'Selected: ' + window.couchProfiles.games[menuSelection][0];
}

function installProfileEditor() {
  const {games, icons, accents, colors, normalize, avatar} = window.couchProfiles;
  const dialog = $('profile-dialog');
  const form = dialog.querySelector('form');
  const name = form.elements.nickname;
  const color = form.elements.color;
  const previews = $('profile-avatars');
  const art = new Map();
  const gameArt = new Map();
  const key = 'couch-party-player';
  try {
    const saved = localStorage.getItem(key);
    if (saved) profile = normalize(JSON.parse(saved));
  } catch {}
  for (const [id, [label]] of Object.entries(colors)) color.add(new Option(label, id));
  for (const [id, [title]] of Object.entries(icons)) {
    const choice = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'avatar';
    radio.value = id;
    const figure = document.createElement('span');
    figure.className = 'avatar-art';
    choice.append(radio, figure, title);
    previews.append(choice);
    art.set(id, figure);
  }
  for (const [id, [title]] of Object.entries(games)) {
    const card = document.createElement('div');
    const figure = document.createElement('span');
    const name = document.createElement('strong');
    const detail = document.createElement('small');
    name.textContent = title;
    detail.textContent = accents[id];
    card.append(figure, name, detail);
    $('profile-game-previews').append(card);
    gameArt.set(id, figure);
  }
  function refresh() {
    for (const [id, figure] of [...art, ...gameArt]) figure.replaceChildren(avatar(id, color.value));
    $('profile-icon-preview').replaceChildren(avatar(form.elements.avatar.value, color.value));
    $('profile-name-preview').textContent = name.value || 'Phone ' + (pad?.slot ?? '');
  }
  previews.addEventListener('change', refresh);
  color.addEventListener('input', refresh);
  name.addEventListener('input', () => {
    const normalized = normalize({name: name.value}).name;
    if (name.value !== normalized) name.value = normalized;
    refresh();
  });
  $('profile-open').onclick = () => {
    const draft = profile ?? window.couchProfiles.defaults;
    name.value = draft.name;
    color.value = draft.color;
    form.elements.avatar.value = draft.avatar;
    dialog.returnValue = 'cancel';
    neutral();
    refresh();
    dialog.showModal();
  };
  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'save') return;
    profile = normalize({name: name.value, color: color.value, avatar: form.elements.avatar.value});
    try { localStorage.setItem(key, JSON.stringify(profile)); } catch {}
    if (pad?.status === 'connected') pad.send({couchProfile: profile});
  });
}

if (validCode && (lobby || game)) {
  document.querySelector('main').addEventListener('touchend', event => {
    const control = event.target.closest?.('[data-action], [data-stick]');
    if (!control || !event.cancelable || actions.get(Number(control.dataset.action))?.local) return;
    // These controls already consume pointer events. Suppress Safari's follow-up native tap.
    event.preventDefault();
  }, {passive: false});
}

if (lobby && validCode) {
  document.body.dataset.game = 'lobby';
  document.querySelector('h1').textContent = 'Couch Party Games';
  $('move-label').textContent = 'Choose a game';
  installStick(document.querySelector('[data-stick="move"]'));
  installAction(0, 'Play');
  installProfileEditor();
} else if (game && validCode) {
  document.body.dataset.game = gameKey;
  document.querySelector('h1').textContent = game.title;
  document.title = game.title + ' · Phone controller';
  $('movement').hidden = !game.move;
  if (game.move) {
    $('move-label').textContent = game.move;
    installStick(document.querySelector('[data-stick="move"]'));
  }
  $('hint').textContent = game.hint;
  $('aim').hidden = true;
  if (game.aim) installStick(document.querySelector('[data-stick="aim"]'));
  for (const [number, label] of [...game.actions].sort(([a], [b]) => a - b)) {
    installAction(number, label);
  }
  if (gameKey === 'blitz') {
    installBlitzMenu();
    updateActionLabels({0: 'Join'});
  }
  const surface = document.querySelector('main');
  for (const name of ['contextmenu', 'dragstart', 'selectstart']) {
    surface.addEventListener(name, event => {
      if (!event.target.closest('input, textarea, select, [contenteditable]')) event.preventDefault();
    });
  }
}
if (validCode && (lobby || game)) {
  $('retry').onclick = () => location.reload();
  $('leave').onclick = () => {
    if (!lobby) neutral();
    send(departures[gameKey]);
    pad.leave();
  };
  addEventListener('blur', neutral);
  portrait.addEventListener('change', neutral);
  function suspendControls() {
    neutral();
    closeBedrockPicker();
    if (gameKey === 'bedrock') send({bedrock: {live: false}});
  }
  addEventListener('pagehide', suspendControls);
  addEventListener('pageshow', heartbeat);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspendControls();
    else heartbeat();
  });
  if(gameKey==='bedrock') {
    import('../Bedrock/phone-controller.js').then(({installBedrockPhone})=>{
      bedrockController=installBedrockPhone({actions,sticks,send,neutral,installStick,setActionLabel,setStick,publish});
      connect();
    }).catch(error=>{
      $('status').textContent='Controller update unavailable. Refresh to retry.';
      console.error(error);
    });
  } else connect();
} else {
  $('status').textContent = code ? 'Check the four-letter code shown on the shared screen.'
    : 'Enter the code on the shared screen, or scan its QR code with your camera.';
  $('join-room').hidden = false;
  if (code) $('room-code').value = code.slice(0, 4);
}
