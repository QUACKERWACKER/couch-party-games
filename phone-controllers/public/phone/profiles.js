(() => {
  const games = {
    blitz: ['Blitz 7', '<path fill="currentColor" d="M8 28v-7a15 15 0 0 1 30 0v6H25v11h-9z"/><path d="M25 27h17v7H25m10-7v7" fill="none" stroke="#fff" stroke-width="2.5"/>'],
    hoops: ['Blitz Hoops', '<path fill="#716685" d="M15 7l-8 6-3 13 10 3v12h20V29l10-3-3-13-8-6c-2 8-16 8-18 0z"/><path d="M14 34h20" stroke="currentColor" stroke-width="5"/><path d="M20 25h8m-4-4v8" stroke="#fff" stroke-width="3"/>'],
    track: ['Blitz Track', '<path fill="currentColor" d="M5 28h20l4-17h7l3 14c1 5 6 6 6 11H5z"/><path d="M5 36h40M26 23h10m-13 5h15" stroke="#fff" stroke-width="2.5"/>'],
    bedrock: ['Bedrock Rivals', '<path fill="currentColor" d="M7 29a17 17 0 0 1 34 0l4 3v6H3v-6z"/><path d="M24 13v16" stroke="#fff" stroke-width="3"/><circle cx="24" cy="26" r="5" fill="#fff"/>'],
    ringout: ['Ringout', '<circle cx="24" cy="24" r="17" fill="#c0c8e6" stroke="currentColor" stroke-width="4"/><path d="M17 21h3m8 0h3m-12 8q5 4 10 0" stroke="#18232b" stroke-linecap="round" stroke-width="3" fill="none"/>'],
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
      avatar: typeof value?.avatar === 'string' && Object.hasOwn(games, value.avatar) ? value.avatar : defaults.avatar,
      color: typeof value?.color === 'string' && Object.hasOwn(colors, value.color) ? value.color : defaults.color,
    };
  }
  function avatar(game, color) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    element.setAttribute('viewBox', '0 0 48 48');
    element.setAttribute('aria-hidden', 'true');
    element.style.color = colors[color][1];
    element.innerHTML = games[game][1];
    return element;
  }
  window.couchProfiles = {games, colors, defaults, normalize, avatar};
})();
