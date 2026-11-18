'use strict';

// Gates mark the fraction of the race at which the obstacle is reached.
const race = (id, name, group, seconds, briefing, trick, options = {}) => ({
  id, name, group, seconds, briefing, trick, ...options,
});

const field = (id, name, briefing, trick, stages, options = {}) => ({
  id, name, group: 'Field', briefing, trick, stages, ...options,
});

const events = [
  race('60', '60 m', 'Sprints', 7, 'React to GO. Your first stride matters most.', 'Confetti starter', {launch: 1.9}),
  race('100', '100 m', 'Sprints', 9, 'Launch on GO, then save K for a photo-finish lean.', 'Cartoon spike scuff', {surges: [[.84, 1, 'LEAN AT THE TAPE']], prank: 'spike'}),
  race('200', '200 m', 'Sprints', 11, 'Ease off the bend, then hit turbo on the straight.', 'Banana on the bend', {bend: .52}),
  race('400', '400 m', 'Sprints', 13, 'You get one long tank of turbo. Spend it on the home straight.', 'Borrowed roller skates', {drain: .66, regen: .015, surges: [[.73, 1, 'HOME STRAIGHT']]}),
  race('800', '800 m', 'Distance', 14, 'Draft near your rival to refill turbo, then slingshot past.', 'Slipstream sneeze', {draft: true, surges: [[.7, .84, 'SLINGSHOT']]}),
  race('1000', '1000 m', 'Distance', 15, 'Hold your line through two bends. Turbo works best on the little straight between them.', 'Shortcut through lane zero', {bend: .38, secondBend: [.55, .79], surges: [[.39, .54, 'BACK STRAIGHT'], [.86, 1, 'KICK']]}),
  race('1500', '1500 m', 'Distance', 15, 'Time turbo to the two pack surges for extra speed.', 'Fake last-lap bell', {surges: [[.31, .42, 'PACK SURGE'], [.77, .94, 'BELL LAP']]}),
  race('mile', 'Mile', 'Distance', 16, 'Build a kick with clean strides. Press K on the bell lap to cash it in.', 'Shortcut through the snack tent', {kick: true, surges: [[.72, 1, 'BELL LAP']]}),
  race('3000', '3000 m', 'Distance', 17, 'Find a steady stride rhythm. The blue cadence straights reward running without turbo.', 'Pocket leaf blower', {rhythm: true, terrain: [[.27, .43, .11, 'CADENCE STRAIGHT'], [.62, .76, .11, 'CADENCE STRAIGHT']]}),
  race('2mile', 'Two Miles', 'Distance', 18, 'Time steady strides and bank them for one turbo kick on the bell lap.', 'Borrowed lap from the mile', {rhythm: true, kick: true, surges: [[.72, 1, 'BELL LAP']]}),
  race('5000', '5000 m', 'Distance', 18, 'Tap I at the cups to refill your tank.', 'Soda fountain swap', {gates: [.22, .47, .73], gate: 'cup'}),
  race('10000', '10,000 m', 'Distance', 20, 'Grab cups and manage three long pushes. Let turbo go on the blue recovery straights.', 'Lap counter flip', {gates: [.19, .43, .67, .84], gate: 'cup', drain: .62, terrain: [[.10, .23, .10, 'RECOVERY'], [.60, .84, .08, 'RECOVERY']], surges: [[.25, .34, 'PUSH'], [.49, .58, 'PUSH'], [.88, 1, 'FINAL KICK']]}),
  race('60h', '60 m Hurdles', 'Hurdles & chase', 9, 'Five quick hops. Tap I when JUMP lights up.', 'Spring-loaded socks', {gates: [.18, .33, .48, .63, .78], gate: 'jump', window: .023}),
  race('100h', '100 m Hurdles', 'Hurdles & chase', 11, 'Clear five evenly spaced hurdles, then sprint for the line.', 'Noodle hurdles', {gates: [.16, .29, .42, .55, .68], gate: 'jump', window: .032}),
  race('110h', '110 m Hurdles', 'Hurdles & chase', 12, 'The tall hurdles need a late takeoff. Watch for the narrower green zone.', 'Inflatable hurdle legs', {gates: [.22, .35, .48, .61, .74, .87], gate: 'jump', window: .019}),
  race('400h', '400 m Hurdles', 'Hurdles & chase', 15, 'The hurdles get closer together on the home straight. Keep turbo for the gaps.', 'Unofficial hurdles detour', {gates: [.19, .39, .59, .72, .83, .93], gate: 'jump', window: .026, bend: .54}),
  race('steeple2', '2000 m Steeplechase', 'Hurdles & chase', 15, 'An early puddle and three late barriers. Hold I through blue and tap I at the hurdles.', 'Puddle full of jelly', {gates: [.26, .39, .71, .83, .93], gate: 'steeple', splashes: [0, 1], window: .031}),
  race('steeple', '3000 m Steeplechase', 'Hurdles & chase', 17, 'Tap I over the barriers. For blue pits, hold I through the splash.', 'Rubber duck flotilla', {gates: [.19, .35, .52, .68, .85], gate: 'steeple'}),
  race('4x100', '4 × 100 m Relay', 'Relays', 13, 'Tap I in three tight exchange zones. A clean pass gives the next runner a boost.', 'Foam baton bonk', {gates: [.25, .5, .75], gate: 'pass', window: .023}),
  race('mixed100', 'Mixed 4 × 100 m Relay', 'Relays', 14, 'A quick first exchange and a late final exchange. Watch the marks.', 'Baton squeaker', {gates: [.21, .5, .79], gate: 'pass', window: .025, launch: 1.5}),
  race('4x200', '4 × 200 m Relay', 'Relays', 15, 'Keep turbo off around the bend and pass at all three marks.', 'Telescoping foam baton', {gates: [.25, .5, .75], gate: 'pass', bend: .4}),
  race('4x400', '4 × 400 m Relay', 'Relays', 16, 'Every handoff refills turbo, even a fumble. Empty the tank on each leg.', 'Baton bonk deluxe', {gates: [.25, .5, .75], gate: 'pass', refill: true, drain: .49}),
  race('mixed400', 'Mixed 4 × 400 m Relay', 'Relays', 17, 'Boost on the last two legs. Exchanges are generous until the anchor.', 'Baton full of marbles', {gates: [.25, .5, .75], gate: 'pass', windows: [.044, .035, .02], surges: [[.56, .67, 'THIRD LEG PUSH'], [.86, 1, 'ANCHOR KICK']]}),
  race('4x800', '4 × 800 m Relay', 'Relays', 18, 'Draft between exchanges, then pass in the green to slingshot the next runner.', 'Baton boomerang', {gates: [.25, .5, .75], gate: 'pass', draft: true}),
  race('smr', 'Sprint Medley Relay', 'Relays', 15, 'Two short legs, then a 400 and an 800. Sprint through the first two quick exchanges.', 'Four batons in a trench coat', {gates: [.0625, .125, .375], gate: 'pass', windows: [.018, .019, .037], surges: [[.4, .57, '800 M LEG']]}),
  race('medley', 'Distance Medley Relay', 'Relays', 19, 'Four uneven legs. The short 400 m leg has a fast second handoff.', 'Fake exchange marshal', {gates: [.3, .4, .6], gate: 'pass', surges: [[.31, .38, 'SHORT LEG'], [.87, 1, 'MILE KICK']]}),
  race('walk3', '3000 m Race Walk', 'Race walks', 12, 'Stride on the green beat. Turbo is a very conspicuous jog.', 'Suspiciously slippery loafers', {walk: .72}),
  race('walk5', '5000 m Race Walk', 'Race walks', 14, 'The beat speeds up halfway. Tap J only while it is green.', 'Wheeled loafers', {walk: .81, shift: .64}),
  race('walk10', '10,000 m Race Walk', 'Race walks', 17, 'A long walk with aid cups. Tap I for a cup without breaking stride.', 'Motorized loafers', {walk: .78, gates: [.25, .51, .77], gate: 'cup'}),
  race('walk20', '20,000 m Race Walk', 'Race walks', 19, 'Alternate between slow and fast beats at the aid stations.', 'Entirely legal office chair', {walk: .89, shift: .66, gates: [.25, .5, .75], gate: 'cup'}),

  field('long', 'Long Jump', 'Build speed, release at the board, then time the landing.', 'Trampoline in the sand', ['Runway', 'Takeoff', 'Landing']),
  field('triple', 'Triple Jump', 'Plant, alternate your steps, then launch. Each station adds to your mark.', 'Three springs in one shoe', ['Hop', 'Step', 'Jump'], {period: .8, chain: true}),
  field('high', 'High Jump', 'Alternate your approach steps, then clear two increasingly narrow bar windows.', 'Foam replacement bar', ['Approach', 'Low bar', 'High bar'], {widths: [.18, .13, .085]}),
  field('pole', 'Pole Vault', 'Plant the pole, balance your swing, then release over the bar.', 'Inflatable pole extender', ['Plant', 'Swing', 'Clear the bar'], {widths: [.12, .17, .1]}),
  field('shot', 'Shot Put', 'Charge the glide and snap the put in a short punch window.', 'Suspiciously hollow shot', ['Glide', 'Put'], {widths: [.16, .085]}),
  field('discus', 'Discus', 'Alternate feet to build spin, then lock the release angle as the marker comes back around.', 'Bureaucratic frisbee', ['Spin', 'Release'], {period: .82}),
  field('hammer', 'Hammer Throw', 'Balance the opening turn, alternate your steps on the fast turn, then release the hammer.', 'Helium hammer', ['First turn', 'Fast turn', 'Release'], {period: .72, chain: true}),
  field('javelin', 'Javelin', 'Sprint down the runway, plant, then hit the release angle.', 'Pool-noodle javelin', ['Run-up', 'Plant', 'Release angle'], {widths: [.15, .11, .09]}),
  field('pent', 'Pentathlon', 'Five quick marks from hurdles to the 800 m kick.', 'Borrowed score stamp', ['60 m hurdles', 'High jump', 'Shot put', 'Long jump', '800 m kick'], {group: 'Combined'}),
  field('hep', 'Heptathlon', 'Seven marks in competition order. The last kick counts as much as the first.', 'Pencil with two erasers', ['100 m hurdles', 'High jump', 'Shot put', '200 m', 'Long jump', 'Javelin', '800 m'], {group: 'Combined'}),
  field('hepIndoor', 'Indoor Heptathlon', 'Seven stations, including pole vault and a 1000 m finish.', 'Scorecard printed upside down', ['60 m', 'Long jump', 'Shot put', 'High jump', '60 m hurdles', 'Pole vault', '1000 m'], {group: 'Combined', period: .98}),
  field('dec', 'Decathlon', 'Ten marks in competition order. Keep your timing across the whole gauntlet.', 'Pocket-sized scoring committee', ['100 m', 'Long jump', 'Shot put', 'High jump', '400 m', '110 m hurdles', 'Discus', 'Pole vault', 'Javelin', '1500 m'], {group: 'Combined'}),
];

const groups = [...new Set(events.map(event => event.group))];
const quickMeet = ['100', '110h', 'long', 'steeple', '4x100'];

// Each field station describes the input and the scoring rule used by the host.
const fieldSkills = {
  power: {mode: 'mash', key: 'j', label: 'Build power', help: 'Tap A / J rapidly to fill your power bar.'},
  meter: {mode: 'tap', key: 'j', label: 'Time it', help: 'Tap A / J as the marker enters green.'},
  launch: {mode: 'release', key: 'j', label: 'Hold / release', help: 'Hold A / J for power, then release in green.'},
  plant: {mode: 'tap', key: 'i', label: 'Plant', help: 'Tap Y / I in green to plant.'},
  landing: {mode: 'tap', key: 'i', label: 'Land', help: 'Tap Y / I in green to stick the landing.'},
  angle: {mode: 'tap', key: 'i', label: 'Lock angle', help: 'Tap Y / I in green to lock your angle.'},
  throw: {mode: 'release', key: 'k', label: 'Load / throw', help: 'Hold B / K to load the throw, then release in green.'},
  sequence: {mode: 'sequence', label: 'Alternate steps', help: 'Alternate A / J and Y / I. The lit button shows what comes next.'},
  balance: {mode: 'balance', key: 'k', label: 'Balance', help: 'Hold B / K to lift the marker. Let go to lower it. Stay in green.'},
};

const fieldPrograms = {
  long: ['power', 'launch', 'landing'],
  triple: ['plant', 'sequence', 'launch'],
  high: ['sequence', 'meter', 'landing'],
  pole: ['plant', 'balance', 'launch'],
  shot: ['launch', 'meter'],
  discus: ['sequence', 'angle'],
  hammer: ['balance', 'sequence', 'throw'],
  javelin: ['power', 'plant', 'throw'],
  pent: ['sequence', 'landing', 'throw', 'launch', 'power'],
  hep: ['sequence', 'landing', 'throw', 'power', 'launch', 'angle', 'balance'],
  hepIndoor: ['power', 'launch', 'throw', 'landing', 'sequence', 'plant', 'balance'],
  dec: ['power', 'launch', 'throw', 'landing', 'balance', 'sequence', 'angle', 'plant', 'throw', 'power'],
};

const cups = [
  {name: 'Quick 5', ids: quickMeet},
  {name: 'Speed Cup', ids: ['60', '200', '800', '400h', 'mixed400']},
  {name: 'Infield Cup', ids: ['long', 'pole', 'shot', 'hammer', 'javelin']},
  {name: 'Chaos Cup', ids: ['100', 'steeple2', '4x100', 'walk5', 'triple', 'pent']},
  {name: 'Championship', ids: ['100', '1500', '110h', 'steeple', '4x400', 'long', 'high', 'discus', 'javelin', 'dec']},
  {name: 'All 42 events', ids: events.map(event => event.id)},
  {name: 'Empty', ids: []},
];
