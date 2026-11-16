'use strict';

(() => {
  if (typeof couchJoinstickServer === 'undefined') return;
  const hostedPhone = typeof couchJoinstickHostedPhone !== 'undefined'
    ? new URL('./phone/', document.currentScript.src) : null;
  const game = document.currentScript.dataset.game;
  const layouts = {
    blitz: {slots: 8, labels: {0: 'Join', 1: 'Sprint', 2: 'Dash', 3: 'Kick', 5: 'Team/CPU', 9: 'Start'}},
    hoops: {slots: 6, labels: {0: 'Shoot/A', 1: 'Turbo/B', 2: 'Swipe/X', 3: 'Pass/Y', 5: 'Team/RB', 9: 'Start'}},
    track: {slots: 8, labels: {0: 'Join / A', 1: 'Turbo', 2: 'Trick', 3: 'Event', 5: 'Team', 9: 'Start'}},
    bedrock: {slots: 8, labels: {0: 'Dig', 1: 'Fire', 2: 'Summon', 3: 'Upgrade', 5: 'Minion', 7: 'Pick kit'}},
    ringout: {slots: 8, labels: {0: 'Dash/A', 1: 'Dodge/B', 2: 'Push/X', 3: 'Emote/Y', 5: 'Trick/RB', 9: 'Start'}},
  };
  const {slots: stockSlots, labels} = layouts[game];
  const buttonMap = Object.entries(labels).map(([index, label]) => [Number(index), label]);
  const layout = {
    arrangement: 'arc',
    stick: 'dpad',
    buttons: buttonMap.map(([index, label]) => ({id: 'b' + index, label, system: index === 9})),
  };
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
  let room;
  let drawQr;
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
      const labels = drawQr && describe?.();
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
        if (inputCanceled && !buttonMap.some(([number]) => input.buttons['b' + number])) {
          canceledInputs.delete(slot);
        }
        const buttons = Array.from({length: 17}, () => ({pressed: false, value: 0}));
        for (const [number] of buttonMap) {
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
    label(index) {
      for (const [slot, id] of playerIds) {
        if (id === index) return 'Phone ' + slot;
      }
    },
  };

  const open = document.createElement('button');
  open.type = 'button';
  open.textContent = 'Phone controllers';
  open.setAttribute('aria-haspopup', 'dialog');
  const header = document.querySelector('header');
  (header.querySelector('.header-tools') || header).append(open);

  const dialog = document.createElement('dialog');
  dialog.id = 'couch-joinstick-dialog';
  dialog.setAttribute('aria-labelledby', 'couch-joinstick-title');
  dialog.innerHTML = `
    <style>
      #couch-joinstick-dialog { width: min(24rem, 90vw); color: #fff; background: #19212d;
        border: 1px solid #59677b; border-radius: 12px; padding: 20px; text-align: center; }
      #couch-joinstick-dialog:modal { overscroll-behavior: contain; }
      #couch-joinstick-dialog::backdrop { overflow: hidden; overscroll-behavior: contain; background: #0009; }
      #couch-joinstick-dialog h2 { margin: 0; font: 700 1.25rem system-ui; }
      #couch-joinstick-dialog a { display: inline-block; color: #c8e4ff; }
      #couch-joinstick-dialog img { display: block; margin-inline: auto; background: #fff; }
      #couch-joinstick-dialog [hidden] { display: none; }
      #couch-joinstick-dialog button { margin: 4px; }
    </style>
    <h2 id="couch-joinstick-title">Phone controllers</h2>
    <p role="status">Start a room, then scan the QR code with your phone’s camera.</p>
    <p id="couch-joinstick-invite" hidden>
      <img alt="Scan to open the Joinstick controller" width="192" height="192">
      <a target="_blank" rel="noopener noreferrer">Open phone invite</a>
      <button type="button" id="couch-joinstick-copy" hidden>Copy invite</button>
    </p>
    <form method="dialog">
      <button type="button" id="couch-joinstick-start" autofocus>Start room</button>
      <button type="button" id="couch-joinstick-stop" hidden>Disconnect room</button>
      <button>Close</button>
    </form>`;
  document.body.append(dialog);
  const status = dialog.querySelector('[role="status"]');
  const invite = dialog.querySelector('#couch-joinstick-invite');
  const qr = invite.querySelector('img');
  const link = invite.querySelector('a');
  const copy = invite.querySelector('#couch-joinstick-copy');
  const start = dialog.querySelector('#couch-joinstick-start');
  const stop = dialog.querySelector('#couch-joinstick-stop');

  function update() {
    const connected = room?.status === 'connected';
    invite.hidden = !connected;
    if (connected) {
      const relay = new URL(couchJoinstickPublicUrl ?? couchJoinstickServer);
      const joinUrl = new URL(room.joinUrl());
      // A reverse proxy may terminate TLS before Joinstick sees the request.
      const inviteUrl = drawQr
        ? new URL(hostedPhone ?? '/phone/', relay.protocol === 'https:' ? relay : joinUrl)
        : joinUrl;
      if (drawQr) {
        inviteUrl.searchParams.set('g', game);
        inviteUrl.searchParams.set('r', room.code);
      }
      link.href = inviteUrl.href;
      if (qr.dataset.invite !== link.href) {
        qr.dataset.invite = link.href;
        qr.hidden = false;
        qr.src = drawQr ? 'data:image/svg+xml,' + encodeURIComponent(drawQr(link.href, {border: 4})) : room.qr();
      }
      const count = [...playerIds.keys()].filter(slot => room.connected(slot)).length;
      const access = inviteUrl.protocol === 'https:' ? 'Internet invite' : 'Local Wi-Fi invite';
      status.textContent = `${access} · ${count} of ${room.slots} phones connected. Scan the code, then press ${drawQr ? 'Join' : 'A'} on the controller.`;
    } else if (room) {
      status.textContent = 'Reconnecting to Joinstick…';
    }
  }

  function disconnect(message) {
    const current = room;
    room = undefined;
    current?.close();
    playerIds.clear();
    aimInputs.clear();
    sentInfo.clear();
    trackCancellations.clear();
    trackPulses.clear();
    hoopsPulses.clear();
    hoopsResets.clear();
    hoopsExpired.clear();
    hoopsNeutralizing.clear();
    inputResets.clear();
    ringoutHeartbeats.clear();
    ringoutNeutralizing.clear();
    bedrockHeartbeats.clear();
    canceledInputs.clear();
    blitzActivity.clear();
    drawQr = undefined;
    invite.hidden = stop.hidden = true;
    qr.removeAttribute('src');
    delete qr.dataset.invite;
    link.removeAttribute('href');
    copy.textContent = 'Copy invite';
    start.hidden = start.disabled = false;
    status.textContent = message;
  }

  qr.addEventListener('error', () => { qr.hidden = true; });
  copy.hidden = !navigator.clipboard?.writeText;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link.href);
      if (room) copy.textContent = 'Copied';
    } catch {
      if (room) copy.textContent = 'Copy unavailable';
    }
  });
  open.addEventListener('click', () => dialog.showModal());
  open.addEventListener('keydown', event => {
    if (game !== 'ringout' || ['Enter','Space'].includes(event.code)) event.stopPropagation();
  });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  stop.addEventListener('click', () => {
    for (const slot of playerIds.keys()) if (room.connected(slot)) room.kick(slot);
    disconnect('Room disconnected.');
    start.focus();
  });
  start.addEventListener('click', async () => {
    start.disabled = true;
    status.textContent = 'Connecting to Joinstick…';
    try {
      const server = couchJoinstickServer;
      if (hostedPhone) {
        status.textContent = 'Starting the phone relay. This can take about a minute…';
        const deadline = Date.now() + 90_000;
        while (true) {
          if (Date.now() >= deadline) throw new Error('The phone relay did not start in time.');
          try {
            const response = await fetch(server + '/phone/qr.js', {
              cache: 'no-store', signal: AbortSignal.timeout(Math.min(10_000, deadline - Date.now())),
            });
            await response.body?.cancel();
            if (response.ok && response.headers.get('content-type')?.includes('javascript')) break;
          } catch {
            // A sleeping relay may respond without CORS headers while it wakes up.
          }
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
      }
      const [{host}, qrModule] = await Promise.all([
        import(server + '/joinstick/host.js'),
        import(server + '/phone/qr.js').catch(() => null),
      ]);
      drawQr = qrModule?.renderSVG;
      const slots = qrModule?.maxPhoneConnections ?? stockSlots;
      const current = await host({server, slots, layout});
      room = current;
      for (let slot = 1; slot <= slots; slot++) {
        if (current.connected(slot)) playerIds.set(slot, nextId++);
      }
      current.on('join', ({slot, rejoin}) => {
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
        update();
      });
      current.on('leave', ({slot, reason}) => {
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
        update();
      });
      current.on('message', ({slot, data}) => {
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
        if (game === 'bedrock' && data?.bedrock && current.connected(slot)) {
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
      current.on('status', value => {
        if (room !== current) return;
        if (value === 'closed') disconnect('Joinstick closed the connection. Start a new room to play.');
        else update();
      });
      start.hidden = true;
      stop.hidden = false;
      if (dialog.open) stop.focus();
      update();
    } catch (error) {
      console.warn('Joinstick could not start:', error);
      disconnect(hostedPhone ? 'Could not start a room. Wait a moment, then try again.'
        : 'Could not start a room. Check that your Joinstick server is running and try again.');
    }
  });
  window.addEventListener('pagehide', event => {
    if (event.persisted && room) disconnect('Start a room to show a phone invite.');
  });
})();
