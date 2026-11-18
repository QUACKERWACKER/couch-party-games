(() => {
  const games = {
    blitz: ['Blitz 7', '<path fill="currentColor" d="M8 28v-7a15 15 0 0 1 30 0v6H25v11h-9z"/><path d="M25 27h17v7H25m10-7v7" fill="none" stroke="#fff" stroke-width="2.5"/>'],
    hoops: ['Blitz Hoops', '<path fill="#716685" d="M15 7l-8 6-3 13 10 3v12h20V29l10-3-3-13-8-6c-2 8-16 8-18 0z"/><path d="M14 34h20" stroke="currentColor" stroke-width="5"/><path d="M20 25h8m-4-4v8" stroke="#fff" stroke-width="3"/>'],
    track: ['Blitz Track', '<path fill="currentColor" d="M5 28h20l4-17h7l3 14c1 5 6 6 6 11H5z"/><path d="M5 36h40M26 23h10m-13 5h15" stroke="#fff" stroke-width="2.5"/>'],
    bedrock: ['Bedrock Rivals', '<path fill="currentColor" d="M7 29a17 17 0 0 1 34 0l4 3v6H3v-6z"/><path d="M24 13v16" stroke="#fff" stroke-width="3"/><circle cx="24" cy="26" r="5" fill="#fff"/>'],
    ringout: ['Ringout', '<circle cx="24" cy="24" r="17" fill="#c0c8e6" stroke="currentColor" stroke-width="4"/><path d="M17 21h3m8 0h3m-12 8q5 4 10 0" stroke="#18232b" stroke-linecap="round" stroke-width="3" fill="none"/>'],
  };
  const icons = {
    ...Object.fromEntries(Object.entries(games).map(([id, [title, art]]) =>
      [id, [({blitz:'Helmet', hoops:'Jersey', track:'Running shoe', bedrock:'Mining helmet', ringout:'Fighter'})[id], art]])),
    football: ['Football', '<ellipse cx="24" cy="24" rx="20" ry="12" transform="rotate(-35 24 24)" fill="currentColor"/><path d="M16 30l16-12m-12 3l5 7m0-11l5 7" stroke="#19212d" stroke-width="2.5"/>'],
    soccer: ['Soccer ball', '<circle cx="24" cy="24" r="19" fill="currentColor"/><path fill="#19212d" d="M24 15l9 7-4 10H19l-4-10zM8 13l8-6 2 7-7 6zm24-6l8 6-3 7-7-6zM5 30l9 1 5 10-9-4zm29 1l9-1-5 7-9 4z"/><path d="M18 14l6 1 6-1M11 20l4 2m22-2l-4 2M19 32l-1 7m11-7l1 7" stroke="#19212d" stroke-width="2"/>'],
    basketball: ['Basketball', '<circle cx="24" cy="24" r="19" fill="currentColor"/><g stroke="#19212d" stroke-width="2.5" fill="none"><path d="M5 24h38M24 5v38M12 9q22 15 0 30M36 9Q14 24 36 39"/></g>'],
    pickaxe: ['Pickaxe', '<path d="M12 40l19-25" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M9 14Q28-1 43 24L29 16 9 19z" fill="currentColor"/><path d="M11 15l17-4 11 9" fill="none" stroke="#fff" stroke-width="2"/>'],
    crystal: ['Crystal', '<path d="M24 3L40 16 34 36 24 45 13 36 8 16z" fill="currentColor"/><path d="M24 3l-6 15 6 27 6-27zM8 16l10 2h12l10-2" stroke="#19212d" stroke-width="2" fill="none"/>'],
    trophy: ['Trophy', '<path d="M15 7h18v12q0 10-9 12-9-2-9-12zM21 30h6v9h8v5H13v-5h8z" fill="currentColor"/><path d="M15 11H6v7q0 8 12 9m15-16h9v7q0 8-12 9" fill="none" stroke="currentColor" stroke-width="4"/>'],
    lightning: ['Lightning', '<path d="M27 2L8 28h13l-3 18 23-29H27z" fill="currentColor"/>'],
  };
  const accents = {
    blitz: 'Helmet color', hoops: 'Jersey stripe', track: 'Running shoes',
    bedrock: 'Mining helmet', ringout: 'Player outline',
  };
  const colors = {
    teal: ['Teal', '#65e7cb'], blue: ['Blue', '#7abaff'], violet: ['Violet', '#be99ff'],
    pink: ['Pink', '#ff90bd'], orange: ['Orange', '#ffab73'], gold: ['Gold', '#ffda74'],
    lime: ['Lime', '#b4ee78'], white: ['Pearl', '#f5f0e3'],
  };
  const defaults = {name: '', avatar: 'blitz', color: 'teal'};
  function normalize(value) {
    return {
      name: typeof value?.name === 'string' ? value.name.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase() : '',
      avatar: typeof value?.avatar === 'string' && Object.hasOwn(icons, value.avatar) ? value.avatar : defaults.avatar,
      color: typeof value?.color === 'string' && Object.hasOwn(colors, value.color) ? value.color : defaults.color,
    };
  }
  function avatar(game, color) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    element.setAttribute('viewBox', '0 0 48 48');
    element.setAttribute('aria-hidden', 'true');
    element.style.color = colors[color][1];
    element.innerHTML = (icons[game] ?? icons[defaults.avatar])[1];
    return element;
  }
  window.couchProfiles = {games, icons, accents, colors, defaults, normalize, avatar};
})();
