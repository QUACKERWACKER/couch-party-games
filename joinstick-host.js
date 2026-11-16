'use strict';

(() => {
  if (typeof couchJoinstickServer === 'undefined') return;
  const hostedPhone = typeof couchJoinstickHostedPhone !== 'undefined'
    ? new URL('./phone/', document.currentScript.src) : null;
  const game = document.currentScript.dataset.game;
  if (!game) {
    setupLauncher(hostedPhone);
    return;
  }

  let launcher;
  try {
    if (window.parent !== window) launcher = window.parent.couchPartyLauncher;
  } catch {
    // Games can also be opened directly or embedded on another origin.
  }
  const room = launcher?.attach(window, game);
  if (!room) return;

  const buttonsByGame = {
    blitz: [0, 1, 2, 3, 5, 9],
    hoops: [0, 1, 2, 3, 5, 9],
    track: [0, 1, 2, 3, 5, 9],
    bedrock: [0, 1, 2, 3, 5, 7],
    ringout: [0, 1, 2, 3, 5, 9],
  };
  const buttonMap = buttonsByGame[game];
  const playerIds = new Map();
  const aimInputs = new Map();
  const sentInfo = new Map();
  const trackCancellations = new Set();
  const trackPulses = new Map();
  const hoopsPulses = new Map();
  const hoopsResets = new Set();
  const hoopsExpired = new Set();
  const hoopsNeutralizing = new Set();
  const inputResets = new Set();
  const ringoutHeartbeats = new Map();
  const ringoutNeutralizing = new Set();
  const canceledInputs = new Set();
  const blitzActivity = new Map();
  let nextId = 1_000_000;
  let describe;
  let onBlitzCommand;
  let bedrockMessage;
  const bedrockHeartbeats = new Map();

  window.couchJoinstick = {
    describe(callback) { describe = callback; },
    onBlitzCommand(callback) { onBlitzCommand = callback; },
    onBedrockMessage(callback) { bedrockMessage = callback; },
    sample() {
      if (room?.status !== 'connected') return [];
      const pads = [];
      const labels = describe?.();
      for (const [slot, index] of playerIds) {
        if (!room.connected(slot)) continue;
        const activity = blitzActivity.get(slot);
        if (activity && (!activity.active || performance.now() - activity.at > 1400)) {
          room.input(slot);
          continue;
        }
        if (labels) {
          const description = labels[index] ?? labels._default ?? null;
          const info = JSON.stringify(description);
          if (info !== sentInfo.get(slot)) {
            room.send(slot, {[game]: description});
            sentInfo.set(slot, info);
          }
        }
        const input = room.input(slot);
        const trackPulse = trackPulses.get(slot);
        if (trackPulse !== undefined && performance.now() - trackPulse > 1400) {
          trackCancellations.add(slot);
          continue;
        }
        const trackCanceled = trackCancellations.has(slot);
        if (trackCanceled && !Object.values(input.buttons).some(Boolean)) trackCancellations.delete(slot);
        const lastBeat = ringoutHeartbeats.get(slot);
        if (lastBeat !== undefined && performance.now() - lastBeat > 1500) {
          inputResets.add(slot);
          aimInputs.delete(slot);
          continue;
        }
        const reset = inputResets.delete(slot);
        if (game === 'ringout' && reset) ringoutNeutralizing.add(slot);
        const suppressRingout = ringoutNeutralizing.has(slot);
        if (suppressRingout && !input.x && !input.y && !Object.values(input.buttons).some(Boolean)) {
          ringoutNeutralizing.delete(slot);
        }
        const pulse = hoopsPulses.get(slot);
        const expired = game === 'hoops' && pulse !== undefined && performance.now() - pulse > 1600;
        const resetInputs = game === 'hoops' && (hoopsResets.delete(slot) || (expired && !hoopsExpired.has(slot)));
        if (expired) hoopsExpired.add(slot);
        else hoopsExpired.delete(slot);
        if (resetInputs) hoopsNeutralizing.add(slot);
        if (!input.x && !input.y && !Object.values(input.buttons).some(Boolean)) hoopsNeutralizing.delete(slot);
        const suppressHoops = expired || resetInputs || hoopsNeutralizing.has(slot);
        if (bedrockHeartbeats.has(slot) && performance.now()-bedrockHeartbeats.get(slot)>1250) {
          canceledInputs.add(slot);
          continue;
        }
        if (game === 'bedrock' && canceledInputs.has(slot)) {
          if (input.x || input.y || Object.values(input.buttons).some(Boolean)) continue;
          canceledInputs.delete(slot);
          continue;
        }
        const inputCanceled = canceledInputs.has(slot);
        if (inputCanceled && !buttonMap.some(number => input.buttons['b' + number])) {
          canceledInputs.delete(slot);
        }
        const buttons = Array.from({length: 17}, () => ({pressed: false, value: 0}));
        for (const number of buttonMap) {
          const id = 'b' + number;
          // Keep a tap that began and ended between two game frames.
          const pressed = !trackCanceled && !inputCanceled && !suppressRingout && !suppressHoops && Boolean(input.buttons[id] || input.pressed[id]);
          buttons[number] = {pressed, value: Number(pressed)};
        }
        pads.push({index, mapping: 'standard', connected: true, timestamp: performance.now(),
          ...(game === 'track' ? {inputCanceled: trackCanceled} : {}),
          ...(game === 'blitz' ? {joinstick: true, inputCanceled} : {}),
          axes: suppressRingout || suppressHoops ? [0, 0, 0, 0] : [input.x, input.y, ...(aimInputs.get(slot) ?? [0, 0])], buttons,
          ...(game === 'ringout' ? {phone: true, inputReset: suppressRingout} : {}),
          ...(game === 'hoops' ? {source: 'joinstick', resetInputs} : {})});
      }
      return pads;
    },
    reserved(index) { return Boolean(room && [...playerIds.values()].includes(index)); },
    kick(index) {
      for (const [slot, id] of playerIds) {
        if (id !== index) continue;
        room.kick(slot);
        if (game === 'ringout' || game === 'blitz') playerIds.delete(slot);
        return true;
      }
      return false;
    },
    profile(index) {
      for (const [slot, id] of playerIds) {
        if (id === index) return room.profile(slot);
      }
    },
    label(index) {
      for (const [slot, id] of playerIds) {
        if (id === index) return room.profile(slot)?.name || 'Phone ' + slot;
      }
    },
  };

  for (let slot = 1; slot <= room.slots; slot++) {
    if (room.connected(slot)) playerIds.set(slot, nextId++);
  }
  room.on('join', ({slot, rejoin}) => {
    if (!rejoin || !playerIds.has(slot)) playerIds.set(slot, nextId++);
    else if (game === 'ringout') inputResets.add(slot);
    if (game === 'hoops' && rejoin) hoopsResets.add(slot);
    if (game === 'track' && rejoin) trackCancellations.add(slot);
    if (game === 'blitz') {
      if (rejoin && blitzActivity.has(slot)) canceledInputs.add(slot);
      else if (!rejoin) blitzActivity.delete(slot);
    }
    aimInputs.delete(slot);
    sentInfo.delete(slot);
    if (game === 'bedrock') canceledInputs.delete(slot);
    bedrockHeartbeats.delete(slot);
  });
  room.on('leave', ({slot, reason}) => {
    if ((game === 'ringout' || game === 'hoops') && reason === 'kicked') playerIds.delete(slot);
    ringoutHeartbeats.delete(slot);
    ringoutNeutralizing.delete(slot);
    hoopsPulses.delete(slot);
    hoopsExpired.delete(slot);
    hoopsNeutralizing.delete(slot);
    trackCancellations.delete(slot);
    trackPulses.delete(slot);
    aimInputs.delete(slot);
    sentInfo.delete(slot);
    if (game === 'bedrock') canceledInputs.delete(slot);
    bedrockHeartbeats.delete(slot);
  });
  room.on('message', ({slot, data}) => {
    if (game === 'ringout' && data?.ringoutActive === true) ringoutHeartbeats.set(slot, performance.now());
    if (game === 'ringout' && data?.cancel === true) {
      inputResets.add(slot);
      aimInputs.delete(slot);
    }
    if (game === 'ringout' && data?.leave === true) playerIds.delete(slot);
    if (data?.ready === true) sentInfo.delete(slot);
    if (game === 'hoops') {
      if (data?.hoopsPulse === true) hoopsPulses.set(slot, performance.now());
      if (data?.hoopsCancel === true) hoopsResets.add(slot);
    }
    if (game === 'bedrock' && data?.bedrock && room.connected(slot)) {
      if (data.bedrock.live === false) {
        bedrockHeartbeats.set(slot, -Infinity);
        canceledInputs.add(slot);
      }
      if (data.bedrock.live === true) {
        if (bedrockHeartbeats.has(slot) && performance.now()-bedrockHeartbeats.get(slot)>1250) canceledInputs.add(slot);
        bedrockHeartbeats.set(slot, performance.now());
      }
      const index = playerIds.get(slot);
      if (index !== undefined) bedrockMessage?.(index, data.bedrock);
    }
    if (game === 'track') {
      if (data?.trackCancel === true) trackCancellations.add(slot);
      if (data?.trackPulse === true) trackPulses.set(slot, performance.now());
    }
    if (game === 'blitz') {
      if (typeof data?.blitzActive === 'boolean') {
        const previous = blitzActivity.get(slot);
        if (!data.blitzActive || (previous && (!previous.active || performance.now() - previous.at > 1400))) {
          canceledInputs.add(slot);
        }
        blitzActivity.set(slot, {active: data.blitzActive, at: performance.now()});
      }
      if (data?.blitzCancel === true) canceledInputs.add(slot);
      if (data?.blitzLeave === true) playerIds.delete(slot);
      if (data?.blitzPlay && room.connected(slot) && blitzActivity.get(slot)?.active) {
        onBlitzCommand?.(playerIds.get(slot), data.blitzPlay);
        sentInfo.delete(slot);
      }
    }
    const aim = data?.aim;
    if (game === 'ringout' && Array.isArray(aim) && aim.length === 2 && aim.every(Number.isFinite)) {
      aimInputs.set(slot, aim.map(axis => Math.max(-1, Math.min(1, axis))));
    }
  });
})();

function setupLauncher(hostedPhone) {
  const home = new URL('./', document.currentScript.src);
  const main = document.querySelector('main');
  const open = document.querySelector('#phone-pairing');
  const dialog = document.querySelector('#phone-room');
  const status = dialog.querySelector('[role="status"]');
  const invite = dialog.querySelector('.invite');
  const qr = invite.querySelector('img');
  const link = invite.querySelector('.phone-invite');
  const codeUrl = invite.querySelector('.code-url');
  const roomCode = invite.querySelector('.room-code');
  const copy = document.querySelector('#copy-phone-invite');
  const start = dialog.querySelector('#start-phone-room');
  const stop = dialog.querySelector('#stop-phone-room');
  const links = [...main.querySelectorAll('.game')];
  const gameKeys = links.map(link => link.dataset.game);
  const ready = new Set();
  const players = new Map();
  const roster = document.querySelector('#players-list');
  const playersOpen = document.querySelector('#players-open');
  const {avatar, colors, defaults, normalize} = window.couchProfiles;
  let menuSelection = gameKeys[0];

  function updateRoster() {
    const entries = [...players].filter(([slot]) => room?.connected(slot)).sort(([a], [b]) => a - b);
    roster.replaceChildren(...entries.map(([slot, profile]) => {
      const item = document.createElement('li');
      const text = document.createElement('div');
      const name = document.createElement('strong');
      const phone = document.createElement('small');
      name.textContent = profile?.name || 'Phone ' + slot;
      phone.textContent = profile?.name ? 'Phone ' + slot : 'Connected';
      text.append(name, phone);
      item.append(avatar(profile?.avatar ?? defaults.avatar, profile?.color ?? defaults.color), text);
      return item;
    }));
    document.querySelector('#players-empty').hidden = entries.length > 0;
    playersOpen.textContent = entries.length ? `Players (${entries.length})` : 'Players';
  }

  playersOpen.hidden = false;
  playersOpen.onclick = () => document.querySelector('#players-room').showModal();

  let room, frame, game, selected, listeners;

  open.hidden = false;
  open.onclick = () => dialog.showModal();
  copy.hidden = !navigator.clipboard?.writeText;
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(link.href);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Copy unavailable';
    }
  };

  function showGame(next, gameLink) {
    frame?.remove();
    frame = undefined;
    listeners = undefined;
    game = next;
    ready.clear();
    main.hidden = Boolean(next);
    if (next) {
      selected = gameLink;
      frame = document.createElement('iframe');
      frame.className = 'game-frame';
      frame.title = gameLink.querySelector('.title').textContent;
      frame.allow = 'gamepad; fullscreen';
      frame.src = gameLink.href;
      document.body.append(frame);
      frame.focus();
    } else {
      selected?.focus();
    }
    room?.broadcast({couchGame: game});
  }

  window.couchPartyLauncher = {
    selectMenu(key) {
      if (key === menuSelection) return;
      menuSelection = key;
      if (room && !game) room.broadcast({couchSelection: key});
    },
    menuPads() {
      if (game || room?.status !== 'connected') return [];
      return [...ready].filter(slot => room.connected(slot)).map(slot => {
        const {x, y, buttons, pressed} = room.input(slot);
        return {index: 1_000_000 + slot, connected: true, mapping: 'standard', phone: true,
          axes: [x, y], buttons: [{pressed: Boolean(buttons.b0 || pressed.b0)}]};
      });
    },
    attach(child, key) {
      if (!frame || child !== frame.contentWindow || key !== game || !room) return;
      const current = room;
      const callbacks = listeners = {};
      child.document.addEventListener('click', event => {
        const anchor = event.target.closest?.('a[href]');
        if (!anchor || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
            event.shiftKey || event.altKey || new URL(anchor.href).href !== home.href) return;
        event.preventDefault();
        history.back();
      });
      return {
        get slots() { return current.slots; },
        get status() { return current.status; },
        connected: slot => ready.has(slot) && current.connected(slot),
        input: slot => current.input(slot),
        profile: slot => players.get(slot),
        send: (slot, data) => current.send(slot, data),
        kick: slot => current.kick(slot),
        on: (event, callback) => { callbacks[event] = callback; },
      };
    },
  };

  links.forEach((gameLink, index) => gameLink.addEventListener('click', event => {
    if (!room || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
        event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState({couchGame: gameKeys[index]}, '', location.href);
    showGame(gameKeys[index], gameLink);
  }));
  addEventListener('popstate', event => {
    const index = gameKeys.indexOf(event.state?.couchGame);
    if (room && index !== -1) showGame(gameKeys[index], links[index]);
    else if (frame) showGame(null);
  });

  function updateCount() {
    if (!room) return;
    const count = Array.from({length: room.slots}, (_, i) => i + 1)
      .filter(slot => room.connected(slot)).length;
    status.textContent = room.status === 'connected'
      ? `${count} of ${room.slots} phones connected. Scan the QR code or enter the room code on your phone.`
      : 'Reconnecting to the phone relay…';
    open.textContent = count ? `Phone controllers (${count})` : 'Phone controllers';
  }

  function closeRoom(message) {
    const current = room;
    room = undefined;
    current?.close();
    ready.clear();
    players.clear();
    updateRoster();
    if (frame) history.back();
    invite.hidden = stop.hidden = true;
    qr.removeAttribute('src');
    link.removeAttribute('href');
    codeUrl.removeAttribute('href');
    codeUrl.textContent = roomCode.textContent = '';
    copy.textContent = 'Copy invite';
    open.textContent = 'Phone controllers';
    start.hidden = start.disabled = false;
    status.textContent = message;
  }

  stop.onclick = () => {
    for (let slot = 1; slot <= room.slots; slot++) {
      if (room.connected(slot)) room.kick(slot);
    }
    closeRoom('Room disconnected. Start a new room to pair phones.');
    start.focus();
  };

  start.onclick = async () => {
    start.disabled = true;
    status.textContent = hostedPhone ? 'Starting the phone relay. This can take about a minute…'
      : 'Connecting to the phone relay…';
    try {
      const server = couchJoinstickServer;
      if (hostedPhone) {
        const deadline = Date.now() + 90_000;
        while (Date.now() < deadline) {
          try {
            const response = await fetch(server + '/phone/qr.js', {
              cache: 'no-store', signal: AbortSignal.timeout(Math.min(10_000, deadline - Date.now())),
            });
            await response.body?.cancel();
            if (response.ok && response.headers.get('content-type')?.includes('javascript')) break;
          } catch {
            // The relay may answer without CORS headers while waking up.
          }
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
        if (Date.now() >= deadline) throw new Error('The phone relay did not start in time.');
      }
      const [{host}, {renderSVG, maxPhoneConnections}] = await Promise.all([
        import(server + '/joinstick/host.js'),
        import(server + '/phone/qr.js'),
      ]);
      const layout = {
        arrangement: 'arc',
        stick: 'dpad',
        buttons: [0, 1, 2, 3, 5, 7, 9].map(number => ({id: 'b' + number, label: String(number), system: number === 9})),
      };
      const current = await host({server, slots: maxPhoneConnections, layout});
      room = current;
      current.on('join', ({slot, rejoin}) => {
        ready.delete(slot);
        if (!rejoin || !players.has(slot)) players.set(slot, null);
        updateRoster();
        current.send(slot, {couchGame: game ?? null});
        listeners?.join?.({slot, rejoin});
        updateCount();
      });
      current.on('leave', event => {
        ready.delete(event.slot);
        if (event.reason === 'kicked') players.delete(event.slot);
        updateRoster();
        listeners?.leave?.(event);
        updateCount();
      });
      current.on('message', event => {
        const {slot, data} = event;
        if (data?.ready) {
          if (data.couchGame !== (game ?? null)) {
            current.send(slot, {couchGame: game ?? null});
            return;
          }
          current.input(slot); // Clear presses queued before the new layout was ready.
          ready.add(slot);
          if (!game) current.send(slot, {couchSelection: menuSelection});
        }
        if (!ready.has(slot)) return;
        if (!game && data?.couchProfile && typeof data.couchProfile === 'object') {
          const profile = normalize(data.couchProfile);
          profile.accent = colors[profile.color][1];
          const previous = players.get(slot);
          if (previous?.name !== profile.name || previous?.avatar !== profile.avatar || previous?.color !== profile.color) {
            players.set(slot, profile);
            updateRoster();
          }
        }
        if (game) listeners?.message?.(event);
      });
      current.on('status', value => {
        if (room !== current) return;
        if (value === 'closed') closeRoom('The relay closed this room. Start a new room to pair phones.');
        else updateCount();
      });
      const relay = new URL(couchJoinstickPublicUrl ?? server);
      const inviteUrl = new URL(hostedPhone ?? '/phone/', relay.protocol === 'https:' ? relay : current.joinUrl());
      codeUrl.href = inviteUrl.href;
      codeUrl.textContent = inviteUrl.host + inviteUrl.pathname;
      roomCode.textContent = current.code;
      inviteUrl.searchParams.set('g', 'lobby');
      inviteUrl.searchParams.set('r', current.code);
      link.href = inviteUrl.href;
      qr.src = 'data:image/svg+xml,' + encodeURIComponent(renderSVG(link.href, {border: 4}));
      invite.hidden = stop.hidden = false;
      start.hidden = true;
      if (dialog.open) stop.focus();
      updateCount();
    } catch (error) {
      console.warn('Phone room could not start:', error);
      closeRoom('Could not start a phone room. Check that the Couch Party phone relay is running and try again.');
    }
  };
}
