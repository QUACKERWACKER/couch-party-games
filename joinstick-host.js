'use strict';

(() => {
  if (typeof couchJoinstickServer === 'undefined') return;
  const hostedPhone = typeof couchJoinstickHostedPhone !== 'undefined'
    ? new URL('./phone/', document.currentScript.src) : null;
  const game = document.currentScript.dataset.game;
  const layouts = {
    blitz: {slots: 8, labels: {0: 'A', 1: 'B', 2: 'X', 3: 'Y', 5: 'Team/RB', 9: 'Start'}},
    hoops: {slots: 6, labels: {0: 'Shoot/A', 1: 'Turbo/B', 2: 'Swipe/X', 3: 'Pass/Y', 5: 'Team/RB', 9: 'Start'}},
    track: {slots: 8, labels: {0: 'Stride/A', 1: 'Turbo/B', 2: 'Trick/X', 3: 'Event/Y', 5: 'Team/RB', 9: 'Start'}},
    bedrock: {slots: 8, labels: {0: 'Dig/A', 1: 'Fire/B', 2: 'Summon/X', 3: 'Buy/Y', 4: 'Jet/LB', 5: 'Minion', 7: 'Upgrade'}},
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
  let nextId = 1_000_000;
  let room;
  let drawQr;
  let describe;

  window.couchJoinstick = {
    describe(callback) { describe = callback; },
    sample() {
      if (room?.status !== 'connected') return [];
      const pads = [];
      const labels = drawQr && describe?.();
      for (const [slot, index] of playerIds) {
        if (!room.connected(slot)) continue;
        if (labels) {
          const blitz = labels[index] ?? null;
          const info = JSON.stringify(blitz);
          if (info !== sentInfo.get(slot)) {
            room.send(slot, {blitz});
            sentInfo.set(slot, info);
          }
        }
        const input = room.input(slot);
        const buttons = Array.from({length: 17}, () => ({pressed: false, value: 0}));
        for (const [number] of buttonMap) {
          const id = 'b' + number;
          // Keep a tap that began and ended between two game frames.
          const pressed = Boolean(input.buttons[id] || input.pressed[id]);
          buttons[number] = {pressed, value: Number(pressed)};
        }
        pads.push({index, mapping: 'standard', connected: true, timestamp: performance.now(),
          axes: [input.x, input.y, ...(aimInputs.get(slot) ?? [0, 0])], buttons});
      }
      return pads;
    },
    kick(index) {
      for (const [slot, id] of playerIds) {
        if (id !== index) continue;
        room.kick(slot);
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
  open.addEventListener('keydown', event => event.stopPropagation());
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
        aimInputs.delete(slot);
        sentInfo.delete(slot);
        update();
      });
      current.on('leave', ({slot}) => {
        aimInputs.delete(slot);
        sentInfo.delete(slot);
        update();
      });
      current.on('message', ({slot, data}) => {
        if (data?.ready === true) sentInfo.delete(slot);
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
