'use strict';

const palette = ['#61dbff', '#ffa16b', '#e8ef76', '#f69dbf', '#8ef0a2', '#a994ff',
  '#ff7979', '#f1f3ff', '#59e2ce', '#ffc759'];
const shapes = ['Square', 'Triangle', 'Circle', 'Diamond', 'Hexagon', 'Star',
  'Rounded', 'Chevron', 'Octagon', 'Rook', 'Crescent', 'Shield'];
const accessories = ['None', 'Mustache', 'Top hat', 'Crown', 'Cap', 'Visor',
  'Cat ears', 'Antenna', 'Halo', 'Witch hat', 'Scarf', 'Mask', 'Headphones', 'Viking horns', 'Bow', 'Monocle'];
const emotes = [
  ['Victory Flip', '↻'],
  ['The Bow', '⌄'],
  ['Disco Step', '✦'],
  ['Confetti Pop', '✺'],
];
const emoteDuration = 1.25;
const reducedEmoteMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

function drawEmote(context, look, size, time) {
  const t = Math.max(0,Math.min(1,time));
  const type = look.emote || 0;
  const beat = Math.sin(Math.PI*t);
  const hop = Math.sin(Math.PI*Math.min(1,t/.82));
  context.save();
  if (!reducedEmoteMotion?.matches) {
    if (type === 0) {
      context.translate(0,-size*.34*hop);
      context.rotate(2*Math.PI*(t*t*(3-2*t)));
    } else if (type === 1) {
      context.translate(size*.06*beat,size*.10*beat);
      context.rotate(.42*beat);
      context.scale(1+.17*beat,1-.30*beat);
    } else if (type === 2) {
      context.translate(size*.15*Math.sin(t*Math.PI*6)*beat,-size*.10*Math.abs(Math.sin(t*Math.PI*6))*beat);
      context.rotate(.35*Math.sin(t*Math.PI*6)*beat);
    } else {
      const pop = Math.sin(t*Math.PI);
      context.translate(0,-size*.21*pop);
      context.scale(1+.15*pop,1-.08*pop);
    }
  }
  drawCharacter(context,look,-size/2,-size/2,size);
  context.restore();
  if (type < 2) return;
  context.save();
  const motion = reducedEmoteMotion?.matches ? .46 : t;
  const burst = type === 3 ? Math.max(0,(motion-.2)/.8) : motion;
  context.globalAlpha *= type === 3 ? Math.sin(Math.PI*burst) : beat;
  for (let i=0;i<8;i++) {
    const angle = i*Math.PI/4 + (type === 2 ? motion*4 : 0);
    const distance = size*(type === 3 ? .18+burst*.52 : .38);
    const x = Math.cos(angle)*distance;
    const y = Math.sin(angle)*distance-size*.16;
    context.fillStyle = palette[(look.color+i*2)%palette.length];
    context.save();
    context.translate(x,y);
    context.rotate(angle+motion*Math.PI);
    const spark = size*.047;
    context.fillRect(-spark/2,-spark/2,spark,type === 3 ? spark*1.6 : spark);
    context.restore();
  }
  context.restore();
}

const spriteColumns = 16;
const spriteRows = 11;
const sprites = new Image();
sprites.src = 'sprites.svg';

function drawCharacter(context, look, x, y, size, accessory = true) {
  if (!sprites.complete || !sprites.naturalWidth) return;
  context.drawImage(sprites, look.shape * 64, look.color * 64, 64, 64, x, y, size, size);
  if (accessory && look.accessory) {
    context.drawImage(sprites, look.accessory * 64, 640, 64, 64, x, y, size, size);
  }
}

function lookCookie(slot) {
  return 'ringout_look_v1_' + slot;
}

function loadLook(slot) {
  try {
    const prefix = lookCookie(slot) + '=';
    const entry = document.cookie.split(';').map(cookie => cookie.trim())
      .find(cookie => cookie.startsWith(prefix));
    if (!entry) return undefined;
    const match = /^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/.exec(entry.slice(prefix.length));
    if (!match) return undefined;
    const [color, shape, accessory, emote] = match.slice(1).map(value => Number(value || 0));
    if (color >= palette.length || shape >= shapes.length || accessory >= accessories.length) return undefined;
    return {color, shape, accessory, emote:emote % emotes.length};
  } catch {
    return undefined;
  }
}

function saveLook(slot, {color, shape, accessory, emote = 0}) {
  try {
    // Cookies are shared by localhost ports, including the launcher's random port.
    document.cookie = lookCookie(slot) + '=' + [color, shape, accessory, emote].join('.') +
      '; Max-Age=31536000; Path=/; SameSite=Strict';
  } catch {
    // Customization still works for the current session if cookies are blocked.
  }
}
