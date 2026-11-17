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
        if (!anchor || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
            event.shiftKey || event.altKey || new URL(anchor.href).href !== home.href) return;
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
