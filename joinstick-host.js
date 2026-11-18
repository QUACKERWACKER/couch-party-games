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

  const buttonMap = [0, 1, 2, 3, 5, game === 'bedrock' ? 7 : 9];
  const buttonStates = [false, true].map(pressed => Object.freeze({pressed, value: Number(pressed)}));
  const buttonLayouts = Array.from({length: 1 << buttonMap.length}, (_, mask) =>
    Object.freeze(Array.from({length: 17}, (_, number) => {
      const bit = buttonMap.indexOf(number);
      return buttonStates[bit < 0 ? 0 : (mask >> bit) & 1];
    })));
  const heartbeatTimeout = {blitz: 1400, track: 1400, ringout: 1500, hoops: 1600, bedrock: 1250}[game];
  const players = new Map();
  let nextId = 1_000_000;
  let describe, onBlitzCommand, bedrockMessage;

  function addPlayer(slot) {
    const player = {slot, index: nextId++};
    players.set(slot, player);
    return player;
  }

  function playerAt(index) {
    for (const player of players.values()) {
      if (player.index === index) return player;
    }
  }

  function samplePlayer(player, input, now) {
    const expired = player.heartbeat !== undefined && now - player.heartbeat > heartbeatTimeout;
    const down = buttonMap.some(number => input.buttons['b' + number]);
    const neutral = !input.x && !input.y && !down;
    let inputCanceled = Boolean(player.canceled);
    let suppressAxes = false;
    let resetInputs = false;
    switch (game) {
      case 'blitz':
        if (!down) player.canceled = false;
        break;
      case 'track':
        if (expired) {
          player.canceled = true;
          return;
        }
        if (!down) player.canceled = false;
        break;
      case 'bedrock':
        if (expired) player.canceled = true;
        if (player.canceled) {
          if (!expired && neutral) player.canceled = false;
          return;
        }
        break;
      case 'ringout':
        if (expired) {
          player.reset = true;
          player.aim = undefined;
          return;
        }
        suppressAxes = inputCanceled = Boolean(player.reset || player.neutralizing);
        player.neutralizing = suppressAxes && !neutral;
        player.reset = false;
        break;
      case 'hoops':
        resetInputs = Boolean(player.reset || (expired && !player.expired));
        player.expired = expired;
        player.neutralizing = Boolean(player.neutralizing || resetInputs) && !neutral;
        suppressAxes = inputCanceled = expired || resetInputs || player.neutralizing;
        player.reset = false;
        break;
    }

    // Keep taps that began and ended between frames without rebuilding gamepad buttons.
    const mask = inputCanceled ? 0 : buttonMap.reduce((mask, number, bit) => {
      const id = 'b' + number;
      return input.buttons[id] || input.pressed[id] ? mask | (1 << bit) : mask;
    }, 0);
    return {
      index: player.index, mapping: 'standard', connected: true, timestamp: now, buttons: buttonLayouts[mask],
      axes: suppressAxes ? [0, 0, 0, 0] : [input.x, input.y, ...(player.aim ?? [0, 0])],
      ...(game === 'track' ? {inputCanceled} : {}),
      ...(game === 'blitz' ? {joinstick: true, inputCanceled} : {}),
      ...(game === 'ringout' ? {phone: true, inputReset: suppressAxes} : {}),
      ...(game === 'hoops' ? {source: 'joinstick', resetInputs} : {}),
    };
  }

  window.couchJoinstick = {
    describe(callback) { describe = callback; },
    onBlitzCommand(callback) { onBlitzCommand = callback; },
    onBedrockMessage(callback) { bedrockMessage = callback; },
    sample() {
      if (room.status !== 'connected') return [];
      let labels;
      const now = performance.now();
      const pads = [];
      for (const player of players.values()) {
        if (!room.connected(player.slot)) continue;
        const input = room.input(player.slot);
        if (game === 'blitz' && (player.active === false || now - player.heartbeat > heartbeatTimeout)) continue;
        labels ??= describe?.() ?? false;
        if (labels) {
          const description = labels[player.index] ?? labels._default ?? null;
          const info = JSON.stringify(description);
          if (info !== player.sentInfo) {
            room.send(player.slot, {[game]: description});
            player.sentInfo = info;
          }
        }
        const pad = samplePlayer(player, input, now);
        if (pad) pads.push(pad);
      }
      return pads;
    },
    reserved(index) { return Boolean(playerAt(index)); },
    kick(index) {
      const player = playerAt(index);
      if (!player) return false;
      room.kick(player.slot);
      if (game === 'ringout' || game === 'blitz') players.delete(player.slot);
      return true;
    },
    profile(index) {
      const player = playerAt(index);
      if (player) return room.profile(player.slot);
    },
    label(index) {
      const player = playerAt(index);
      if (player) return room.profile(player.slot)?.name || 'Phone ' + player.slot;
    },
  };

  for (let slot = 1; slot <= room.slots; slot++) {
    if (room.connected(slot)) addPlayer(slot);
  }
  room.on('join', ({slot, rejoin}) => {
    const previous = rejoin && players.get(slot);
    const player = previous || addPlayer(slot);
    if (rejoin && (game === 'hoops' || (game === 'ringout' && previous))) player.reset = true;
    if (rejoin && (game === 'track' || (game === 'blitz' && player.active !== undefined))) player.canceled = true;
    player.aim = player.sentInfo = undefined;
  });
  room.on('leave', ({slot, reason}) => {
    if ((game === 'ringout' || game === 'hoops') && reason === 'kicked') {
      players.delete(slot);
      return;
    }
    const player = players.get(slot);
    if (!player) return;
    player.aim = player.sentInfo = undefined;
    if (game !== 'blitz') player.heartbeat = player.canceled = undefined;
    player.expired = player.neutralizing = false;
  });
  room.on('message', ({slot, data}) => {
    const player = players.get(slot);
    if (!player || !data) return;
    if (data.ready === true) player.sentInfo = undefined;
    const now = performance.now();
    switch (game) {
      case 'ringout':
        if (data.ringoutActive === true) player.heartbeat = now;
        if (data.cancel === true) {
          player.reset = true;
          player.aim = undefined;
        }
        if (data.leave === true) players.delete(slot);
        if (Array.isArray(data.aim) && data.aim.length === 2 && data.aim.every(Number.isFinite)) {
          player.aim = data.aim.map(axis => Math.max(-1, Math.min(1, axis)));
        }
        break;
      case 'hoops':
        if (data.hoopsPulse === true) player.heartbeat = now;
        if (data.hoopsCancel === true) player.reset = true;
        break;
      case 'track':
        if (data.trackPulse === true) player.heartbeat = now;
        if (data.trackCancel === true) player.canceled = true;
        break;
      case 'bedrock':
        if (!data.bedrock || !room.connected(slot)) break;
        if (Array.isArray(data.bedrock.aim) && data.bedrock.aim.length===2 && data.bedrock.aim.every(Number.isFinite)) {
          player.aim=data.bedrock.aim.map(v=>Math.max(-1,Math.min(1,v)));
        }
        if (data.bedrock.live === false) {
          player.aim=undefined;
          player.heartbeat = -Infinity;
          player.canceled = true;
        }
        if (data.bedrock.live === true) {
          if (now - player.heartbeat > heartbeatTimeout) player.canceled = true;
          player.heartbeat = now;
        }
        bedrockMessage?.(player.index, data.bedrock);
        break;
      case 'blitz':
        if (typeof data.blitzActive === 'boolean') {
          if (!data.blitzActive || player.active === false || now - player.heartbeat > heartbeatTimeout) {
            player.canceled = true;
          }
          player.active = data.blitzActive;
          player.heartbeat = now;
        }
        if (data.blitzCancel === true) player.canceled = true;
        if (data.blitzLeave === true) players.delete(slot);
        else if (data.blitzPlay && room.connected(slot) && player.active) {
          onBlitzCommand?.(player.index, data.blitzPlay);
          player.sentInfo = undefined;
        }
        break;
    }
  });
})();

function ordinaryClick(event) {
  return !event.defaultPrevented && event.button === 0 &&
    !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

function setupLauncher(hostedPhone) {
  const home = new URL('./', document.currentScript.src);
  const main = document.querySelector('main');
  const panel = document.querySelector('#phone-room');
  const status = panel.querySelector('[role="status"]');
  const invite = panel.querySelector('.invite');
  const qr = invite.querySelector('img');
  const link = invite.querySelector('.phone-invite');
  const codeUrl = invite.querySelector('.code-url');
  const roomCode = invite.querySelector('.room-code');
  const copy = document.querySelector('#copy-phone-invite');
  const start = panel.querySelector('#start-phone-room');
  const stop = panel.querySelector('#stop-phone-room');
  const links = [...main.querySelectorAll('.game')];
  const gameKeys = links.map(link => link.dataset.game);
  const ready = new Set();
  const players = new Map();
  const directLinks = new Map();
  const relayPings = new Map();
  const pingLabels = new Map();
  const roster = document.querySelector('#players-list');
  const playersCount = document.querySelector('#players-count');
  const manualJoin = document.querySelector('#enter-phone-code');
  const {avatar, colors, defaults, normalize} = window.couchProfiles;
  let menuSelection = gameKeys[0];

  function updatePing(slot) {
    const label = pingLabels.get(slot);
    if (!label) return;
    const link = directLinks.get(slot);
    const ping = link?.input ? link.ping : relayPings.get(slot);
    const text = ping === undefined ? 'Ping —' : ping < 1 ? '<1 ms' : Math.round(ping) + ' ms';
    if (label.textContent !== text) label.textContent = text;
  }

  function validPing(ms) {
    return Number.isFinite(ms) && ms >= 0 && ms < 10000;
  }

  function updateRoster() {
    const entries = [...players].filter(([slot]) => room?.connected(slot)).sort(([a], [b]) => a - b);
    pingLabels.clear();
    roster.replaceChildren(...entries.map(([slot, profile]) => {
      const item = document.createElement('li');
      const text = document.createElement('div');
      const name = document.createElement('strong');
      const phone = document.createElement('small');
      name.textContent = profile?.name || 'Phone ' + slot;
      phone.textContent = directLinks.get(slot)?.input ? 'Direct connection' : profile?.name ? 'Phone ' + slot : 'Connected';
      const ping = document.createElement('small');
      ping.title = 'Round-trip ping between this phone and the host';
      pingLabels.set(slot, ping);
      updatePing(slot);
      text.append(name, phone, ping);
      item.append(avatar(profile?.avatar ?? defaults.avatar, profile?.color ?? defaults.color), text);
      return item;
    }));
    document.querySelector('#players-empty').hidden = entries.length > 0;
    const count = entries.length + ' connected';
    if (playersCount.textContent !== count) playersCount.textContent = count;
  }

  let room, frame, game, selected, listeners;

  panel.hidden = false;
  manualJoin.hidden = !hostedPhone;
  if (hostedPhone) manualJoin.href = hostedPhone.href;
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(link.href);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Copy unavailable';
    }
  };

  function closeDirect(slot) {
    const link = directLinks.get(slot);
    if (!link) return;
    directLinks.delete(slot);
    clearTimeout(link.timer);
    link.peer?.close();
    if (link.input) updateRoster();
  }

  function sampleInput(slot) {
    const link = directLinks.get(slot);
    if (!link?.input) return room.input(slot);
    const input = {...link.input, pressed: link.pressed};
    link.pressed = {};
    return input;
  }

  async function answerDirect(slot, offer) {
    if (directLinks.has(slot) || typeof offer?.id !== 'string' ||
        !/^\d{1,10}-\d{1,10}$/.test(offer.id) || typeof offer.sdp !== 'string' || offer.sdp.length > 5500) return;
    const current = room;
    const link = {pressed: {}};
    directLinks.set(slot, link);
    const isCurrent = () => current === room && directLinks.get(slot) === link;
    const close = () => { if (isCurrent()) closeDirect(slot); };
    link.timer = setTimeout(close, 6000);
    try {
      const {localPeer, localDescription} = await import(new URL('direct-link.js', home));
      if (!isCurrent()) return;
      const peer = link.peer = localPeer();
      if (!peer) return close();
      peer.onconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) close();
      };
      peer.ondatachannel = ({channel}) => {
        if (!isCurrent() || channel.label !== 'couch-input') return channel.close();
        channel.onopen = () => clearTimeout(link.timer);
        channel.onclose = close;
        channel.onmessage = ({data}) => {
          if (!isCurrent() || !ready.has(slot) || typeof data !== 'string' || data.length > 80) return;
          if (data === 'ping' || data.startsWith('ping:')) {
            const ms = Number(data.slice(5));
            if (data.length > 5 && validPing(ms)) {
              link.ping = ms;
              updatePing(slot);
            }
            if (channel.readyState === 'open') {
              try { channel.send('pong'); } catch { close(); }
            }
            return;
          }
          let packet;
          try { packet = JSON.parse(data); } catch { return; }
          if (!Array.isArray(packet) || packet.length !== 5) return;
          const [x,y,mask,aimX,aimY] = packet;
          if (!Number.isInteger(mask) || mask < 0 || mask > 1023 ||
              ![x,y,aimX,aimY].every(v => Number.isFinite(v) && Math.abs(v) <= 1)) return;
          const buttons = {};
          for (const number of [0,1,2,3,5,7,9]) {
            if (!(mask & (1 << number))) continue;
            const key = 'b' + number;
            buttons[key] = true;
            if (!link.input?.buttons[key]) link.pressed[key] = true;
          }
          const first = !link.input;
          link.input = {x,y,buttons};
          if (first) {
            current.input(slot);
            updateRoster();
          }
          if (game === 'ringout') listeners?.message?.({slot,data:{aim:[aimX,aimY]}});
          if (game === 'bedrock') listeners?.message?.({slot,data:{bedrock:{aim:[aimX,aimY]}}});
        };
      };
      await peer.setRemoteDescription({type: 'offer', sdp: offer.sdp});
      const sdp = await localDescription(peer, await peer.createAnswer());
      if (isCurrent() && sdp?.length < 5500) current.send(slot, {directAnswer: {id: offer.id, sdp}});
      else close();
    } catch { close(); }
  }

  function showGame(next, gameLink) {
    frame?.remove();
    frame = undefined;
    listeners = undefined;
    game = next;
    ready.clear();
    for (const slot of directLinks.keys()) closeDirect(slot);
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
        const {x, y, buttons, pressed} = sampleInput(slot);
        return {index: slot, x, y, confirm: Boolean(buttons.b0 || pressed.b0)};
      });
    },
    attach(child, key) {
      if (!frame || child !== frame.contentWindow || key !== game || !room) return;
      const current = room;
      const callbacks = listeners = {};
      child.document.addEventListener('click', event => {
        const anchor = event.target.closest?.('a[href]');
        if (!anchor || !ordinaryClick(event) || anchor.href !== home.href) return;
        event.preventDefault();
        history.back();
      });
      return {
        get slots() { return current.slots; },
        get status() { return current.status; },
        connected: slot => ready.has(slot) && current.connected(slot),
        input: sampleInput,
        profile: slot => players.get(slot),
        send: (slot, data) => current.send(slot, data),
        kick: slot => current.kick(slot),
        on: (event, callback) => { callbacks[event] = callback; },
      };
    },
  };

  links.forEach((gameLink, index) => gameLink.addEventListener('click', event => {
    if (!room || !ordinaryClick(event)) return;
    event.preventDefault();
    history.pushState({couchGame: gameKeys[index]}, '', location.href);
    showGame(gameKeys[index], gameLink);
  }));
  addEventListener('popstate', event => {
    const index = gameKeys.indexOf(event.state?.couchGame);
    if (room && index !== -1) showGame(gameKeys[index], links[index]);
    else if (frame) showGame(null);
  });

  function updateStatus() {
    if (!room) return;
    const message = room.status === 'connected' ? 'Room open' : 'Reconnecting to the phone relay…';
    if (status.textContent !== message) status.textContent = message;
  }

  function closeRoom(message) {
    const current = room;
    room = undefined;
    current?.close();
    ready.clear();
    for (const slot of directLinks.keys()) closeDirect(slot);
    players.clear();
    relayPings.clear();
    updateRoster();
    if (frame) history.back();
    invite.hidden = stop.hidden = copy.hidden = true;
    manualJoin.hidden = !hostedPhone;
    qr.removeAttribute('src');
    link.removeAttribute('href');
    codeUrl.removeAttribute('href');
    codeUrl.textContent = roomCode.textContent = '';
    copy.textContent = 'Copy invite';
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
        closeDirect(slot);
        relayPings.delete(slot);
        if (!rejoin || !players.has(slot)) players.set(slot, null);
        updateRoster();
        current.send(slot, {couchGame: game ?? null});
        listeners?.join?.({slot, rejoin});
        updateStatus();
      });
      current.on('leave', event => {
        ready.delete(event.slot);
        closeDirect(event.slot);
        relayPings.delete(event.slot);
        if (event.reason === 'kicked') players.delete(event.slot);
        updateRoster();
        listeners?.leave?.(event);
        updateStatus();
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
        if (data?.directOffer) return answerDirect(slot, data.directOffer);
        if (validPing(data?.relayPing)) {
          relayPings.set(slot, data.relayPing);
          updatePing(slot);
          return;
        }
        if (typeof data?.inputPing === 'number') {
          current.send(slot, {inputPong: data.inputPing});
          return;
        }
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
        else updateStatus();
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
      copy.hidden = !navigator.clipboard?.writeText;
      manualJoin.hidden = start.hidden = true;
      link.focus();
      updateStatus();
    } catch (error) {
      console.warn('Phone room could not start:', error);
      closeRoom('Could not start a phone room. Check that the Couch Party phone relay is running and try again.');
    }
  };
}
