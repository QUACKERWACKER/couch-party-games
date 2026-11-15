'use strict';

const deck = [
  ['Shock Ring', 'Epic', 'At 75% charge, release a 360° push at full force. +15% push range.', {range:.15,ring:1}],
  ['Second Chance', 'Epic', 'Recover from one ringout per round or wave. −12% incoming knockback.', {guard:.12,save:1}],
  ['Recoil Drive', 'Epic', 'At 80% charge, recoil backward on release. +30% push force.', {force:.30,recoil:1}],





  ['Tailwind', 'Common', 'After dashing, move 24% faster for 3s.', {tailwind:1}],
  ['Breathing Room', 'Common', 'Spot dodging shortens your remaining dash cooldown by 0.3s.', {breather:1}],
  ['Quick Set', 'Rare', 'After dashing, charge pushes 65% faster for 1.6s.', {quickSet:1}],
  ['Parting Shot', 'Rare', 'Dash hits prime your next push within 3s for 35% extra force.', {partingShot:1}],
  ['Spring Stance', 'Epic', 'A parry banks a full dash recharge and extends your next dash by 50%.', {springStance:1}],
  ['Combo Engine', 'Legendary', 'Dash hits prime a 55% stronger push for 3s. Landing that push instantly recharges dash.', {comboEngine:1}],

  ['Guard Breaker', 'Epic', 'Parry to bank a larger, stronger burst at the end of your next dash.', {guardBurst:1}],
  ['Chain Reaction', 'Epic', 'Fully charged pushes that hit send a short shockwave from the first target.', {chain:1}],
  ['Pocket Shield', 'Epic', 'Fully charge a push to briefly shield yourself from one incoming push.', {chargeShield:1}],


  ['Needlepoint', 'Rare', 'A narrow push cone hits 45% harder.', {focusCone:1}],
  ['Wide Sweep', 'Common', 'Cover a much wider arc with 25% less force.', {sweepCone:1}],
  ['Trident', 'Epic', 'Fire three narrow push lanes. Each hits for 92% force.', {trident:1}],

  ['Slip Charge', 'Common', 'Spot dodge to bank a 25% head start on your next push charge.', {slipCharge:1}],
  ['Second Stride', 'Rare', 'Dodging a push gives you 35% more movement speed for 1.8s.', {secondStride:1}],
  ['Turntable', 'Epic', 'Parries bank a full-circle next push within 3s, even on a tap.', {turntable:1}],
  ['Safety Valve', 'Epic', 'Dodging a push instantly reloads dash and banks a brief speed boost.', {safetyValve:1}],
  ['Pop Circuit', 'Legendary', 'Once every 3s, a landed full-charge push emits a second pulse at the target and refills both dash and dodge.', {popCircuit:1}],

];

// Event recipes share the same combat triggers and pending-bonus limits.
deck.push(
  ["Pinball Shoes", "Common", "A fully charged hit primes your next dash to bounce once off a wall.", {pinball:1}],
  ["Snapback", "Common", "Regain steering after a shove to move 22% faster for 2 seconds.", {snapback:1}],
  ["Clean Shoes", "Common", "Overcharge during a slip to shake it off and kick a peel behind you. Creates a short-lived peel without arena bananas.", {cleanShoes:1}],
  ["Grin and Bear It", "Common", "Once per bow, turn part of an incoming shove into a steerable slide.", {grin:1}],
  ["Backstage Pass", "Rare", "Overcharge leaves a slow patch. Your own dash gets a kick the first time it crosses.", {backstage:1}],
  ["Brake Lights", "Rare", "Leave a bumper at the end of a dash. Opponents who hit it slow down.", {brakeLights:1}],
  ["Corner Store", "Rare", "Breaking a wall leaves a neutral bumper in its place.", {cornerStore:1}],
  ["Fast Delivery", "Rare", "Carry a timed pickup for 2 seconds. Tap push to throw it to any fighter. If time runs out, use it yourself.", {delivery:1}],
  ["Stepping Stone", "Rare", "Dodge a shove near the rim to create a foothold only you can use once.", {stepping:1}],
  ["Catch and Throw", "Rare", "Parry to store part of the force for your next push.", {catchThrow:1}],
  ["Aftershock", "Epic", "Release at 85% charge or higher to mark a delayed, reflectable blast.", {echo:1}],
  ["Blink Step", "Epic", "Tap dash to blink up to 110 units. Walls and ledges stop it.", {blink:1}],
  ["Emergency Brake", "Epic", "Your first dash after a shove redirects some of your remaining knockback along your aim.", {anchor:1}],
  ["Smoke Screen", "Epic", "Dodging leaves a cloud that bursts when anyone pushes through it.", {smoke:1}],
  ["Thunder Tread", "Epic", "End every dash with a 360\u00b0 shove that scales with your push upgrades.", {dashBurst:1}],
  ["Pulse Train", "Legendary", "Dash-end shoves hit twice. The second pulse comes 0.45 seconds later. Works with or without Thunder Tread.", {pulseTrain:1}],
  ["Power Slide", "Epic", "End a Super Dash with a wide shove in your travel direction.", {powerSlide:1}],
  ["Gale Anchor", "Epic", "Brace against wind while charging. Your next push releases a short gust downwind.", {windGuard:1}],
  ["Ice Treads", "Epic", "Carve on ice and lay brief slicks as you move, even on dry floors.", {treads:1}],
  ["Rubber Soles", "Epic", "Dash into a banana peel to kick it across the floor.", {soles:1}],
  ["Icebreaker", "Epic", "Dash hits trade knockback for a short, steerable low-friction slide.", {freeze:1}],
  ["Mine Cart", "Legendary", "Tap push to nudge mines and light a short fuse. Dash ends drop a basic mine if you lack Backbeat Mine.", {mineCart:1}],
  ["Catapult Club", "Legendary", "Overcharge to plant a spring pad aimed in your chosen direction. Any fighter can launch from it.", {catapult:1}],
  ["Center Stage", "Epic", "Your last push aims a spotlight. Emote to detonate it after a beat. The blast can hit you.", {centerStage:1}],
  ["House Lights", "Legendary", "Emote to detonate two spotlights after a beat, one at your last push target and one under you. Both can hit you.", {houseLights:1}],
  ["Gravity Well", "Legendary", "Near-full pushes visibly pull fighters toward you.", {gravity:1}],
  ["Backbeat", "Epic", "A parry leaves a visible echo. It repeats the parry from that spot 1.5 seconds later.", {backbeat:1}],
  ["Signal Jammer", "Legendary", "Parries create a field where everyone\u2019s dashes become short shove-hops.", {jammer:1}],
  ["Bank Shot", "Common", "Tap push into a wall to bank a traveling shove off its face.", {bankShot:1}],
  ["Carom", "Rare", "Shove a fighter into a wall to turn their rebound into a bumper that can hit anyone, including you.", {carom:1}],
  ["Borrowed Momentum", "Common", "Dodge a shove to leave a moving arrow. Anyone can bat it once with a tap push.", {borrowed:1}],
  ["Return to Sender", "Epic", "Parry a traveling shove or Aftershock to return a weaker traveling copy along your aim.", {sender:1}],
  ["Stand-In", "Common", "Your first emote after each dash leaves a cardboard copy. Anyone can shove it. It breaks on impact.", {standIn:1}],
  ["Stunt Double", "Epic", "A charged push fires a weaker copy from your next eligible decoy or Afterimage marker, consuming it. Emote creates a fallback decoy.", {stunt:1}],
  ["Wrong Floor", "Epic", "A charged push into bare floor marks a launch zone. Anyone launched gets one longer airborne dash.", {wrongFloor:1}],
  ["Pocket Ledge", "Rare", "Once per round, dash past the rim to unfold a small platform. It folds one second after anyone lands.", {pocketLedge:1}],
  ["Extension Cord", "Epic", "Emote to tether to a nearby breakable wall. Dash to swing. A hard shove snaps the cord.", {cord:1}],
  ["The Floor Is Yours", "Legendary", "Once per round, overcharge near the rim to detach a tile. Ride it as it drifts out, then get off before it tips.", {floorYours:1}],
  ["Group Hug", "Epic", "Your first full hit tethers you to the target for 3 seconds. A dash pulls both fighters. Dodge the tug to break free.", {groupHug:1}],
  ["Last Word", "Legendary", "Once per round, a shove ringout leaves your ghost at the rim. Aim and tap push once after the windup.", {lastWord:1}],
);

const comboCards = [
 [
  "Rolling Thunder",
  "Common",
  "After a dash, bank 20% extra reach on your next push.",
  "dash",
  "reach",
  0.2
 ],
 [
  "Foot Brake",
  "Common",
  "A push hit shortens dodge recovery by 0.25s.",
  "push",
  "dodge",
  0.25
 ],
 [
  "Hot Start",
  "Common",
  "A dash hit banks 22% charge for your next push.",
  "dashHit",
  "charge",
  0.22
 ],
 [
  "Hands Free",
  "Common",
  "Collect a timed pickup to bank 30% charge for your next push.",
  "pickup",
  "charge",
  0.3
 ],
 [
  "Push Off",
  "Rare",
  "A push hit banks a faster dash and trims its cooldown.",
  "push",
  "dashSpeed",
  0.3,
  "dash",
  0.3
 ],
 [
  "Ricochet Boots",
  "Epic",
  "Overcharge releases a burst around you and immediately reloads dash.",
  "overcharge",
  "burst",
  470,
  "dash",
  3
 ],
];
const expansionCards = [
  ["Pocket Sand", "Common", "Dodging leaves a patch that slows opponents who cross it.", "dodge", "slowPatch", 0.34],
  ["Kickstand", "Common", "The end of a dash brakes your slide without stopping your steering.", "dashEnd", "brake", 0.55],
  ["Rattle Can", "Common", "Damaging a wall banks a 28% push charge head start.", "wall", "charge", 0.28],
  ["Lantern Step", "Common", "Finishing a dash leaves a small pulse behind.", "dashEnd", "burst", 210],
  ["Pep Talk", "Common", "Emoting banks 20% charge for your next push.", "emote", "charge", 0.2],
  ["Counter Grip", "Common", "Parrying banks 25% extra reach for your next push.", "parry", "reach", 0.25],
  ["Second Verse", "Rare", "Land a tap to bank a wider-reaching full-circle next push.", "tap", "circle", 1, "reach", 0.22],
  ["Clean Sweep", "Rare", "Parrying clears your knockback and shortens dash recovery.", "parry", "brake", 1, "dash", 0.65],
  ["Hot Mic", "Rare", "Emoting releases a small pulse and banks push charge.", "emote", "burst", 265, "charge", 0.25],
  ["Mirrored Step", "Rare", "Taking a push previews a safe sidestep. Emote to commit.", "takeHit", "sidestep", 1],
  ["Field Kit", "Rare", "A timed pickup cleanses movement penalties and banks a full-circle push.", "pickup", "clean", 1, "circle", 1],
  ["Split Second", "Rare", "A fully charged hit briefly braces you and cuts dodge recovery.", "full", "brace", 0.28, "dodge", 0.65],
  ["Backbeat Mine", "Epic", "Leave an armed mine where your dash ends. An enemy approaching triggers it.", "dashEnd", "mine", 475],
  ["Parting Gift", "Epic", "Leave a timed bomb at the point you overcharge, and reload part of your dash.", "overcharge", "bomb", 525, "dash", 0.55],
  ["Hollow Double", "Epic", "A dodge leaves a visible decoy that bursts if an opponent approaches.", "dodge", "decoy", 470],
  ["Riverbend", "Epic", "A parry places a short-lived pull field where you stood.", "parry", "well", 390],
  ["Fracture Line", "Epic", "Damaging a wall sends a pulse from it and banks a 30% charge head start.", "wall", "burst", 415, "charge", 0.3],
  ["Trade Places", "Epic", "On a dash hit, swap places with your opponent if both landing spots are clear. Recharges in 4s.", "dashHit", "swap", 1],
  ["Afterimage", "Epic", "Your first emote after a dash rewinds you to its starting point if it is still safe. Recharges in 4s.", "dashEnd", "afterimage", 1],
  ["Driftwood", "Epic", "Overcharge puts a spring pad behind you that launches you along your retreat.", "overcharge", "spring", 520],
  ["Domino Link", "Epic", "A full push hit links that target to a nearby opponent for 3s. Your pushes on either send 45% of their force to the other.", "full", "link", 1],
  ["Rally Flag", "Epic", "Timed pickups grant a speed boost to you and nearby allies, and bank push reach.", "pickup", "rally", 0.36, "reach", 0.4],
  ["Fault Beacon", "Epic", "A tap hit leaves a beacon that pulses twice from the impact point.", "tap", "double", 285],
  ["Orbit Step", "Epic", "A dash hit carries you around to the far side of the opponent if there is room. Recharges in 3s.", "dashHit", "orbit", 1],
  ["Recall Ticket", "Legendary", "Every 5 seconds, finishing a dash marks a safe return point. Your next emote returns you to it.", "dashEnd", "recall", 1],
];
const comboRecipes = new Map();
const radicalEffects = new Set(['mine','bomb','center','centerDouble','decoy','well','spring','jam','recall','double','swap','afterimage','link','orbit','sidestep']);
const radicalCards = new Set(['centerStage','houseLights','mineCart','catapult','jammer','wrongFloor','cord','floorYours','groupHug','lastWord']);
const isRadicalCard = card => Object.keys(card[3]).some(key=>radicalCards.has(key) || comboRecipes.get(key)?.radical);
for (const [name,rarity,text,event,...effects] of [...comboCards,...expansionCards]) {
  const key = name.toLowerCase().replaceAll(' ','-');
  comboRecipes.set(key,{event,effects,radical:effects.some((effect,i)=>i%2===0&&radicalEffects.has(effect))});
  deck.push([name,rarity,text,{[key]:1}]);
}

// The offer streak carries across matches in this tab and resets when a Legendary is offered.
let draftsWithoutLegendary = 0;

function legendaryChance(streak) {
  return Math.min(.36, .06 + .019 * streak);
}

const pushShapeKeys = ['focusCone','sweepCone','trident'];
const hasPushShape = card => pushShapeKeys.some(key=>card[3][key]);
const canDraftCard = (card, owned) => !owned.includes(card) &&
  !(hasPushShape(card) && owned.some(hasPushShape));

const cardLinks = {
  bankShot:{makes:['traveling'],uses:[]}, borrowed:{makes:['traveling'],uses:[]},
  sender:{makes:[],uses:['traveling']}, echo:{makes:['traveling'],uses:[]},
  standIn:{makes:['decoy'],uses:[]}, 'hollow-double':{makes:['decoy'],uses:[]},
  afterimage:{makes:['decoy'],uses:[]}, stunt:{makes:[],uses:['decoy']},
  'backbeat-mine':{makes:['mine'],uses:[]}, mineCart:{makes:[],uses:['mine']},
  centerStage:{makes:['spotlight'],uses:[]}, houseLights:{makes:[],uses:['spotlight']},
  dashBurst:{makes:['dash burst'],uses:['push reach','push force']},
  pulseTrain:{makes:[],uses:['dash burst','push reach','push force']},
  guardBurst:{makes:['dash burst'],uses:['push force']},
  'rolling-thunder':{makes:['push reach'],uses:[]}, 'counter-grip':{makes:['push reach'],uses:[]},
  'rally-flag':{makes:['push reach','movement'],uses:[]}, recoil:{makes:['push force'],uses:['charge']},
  ring:{makes:['circle'],uses:['charge']}, 'second-verse':{makes:['circle','push reach'],uses:[]},
  turntable:{makes:['circle'],uses:[]}, focusCone:{makes:[],uses:['circle']},
  'hot-start':{makes:['charge'],uses:[]}, 'hands-free':{makes:['charge'],uses:[]},
  'rattle-can':{makes:['charge'],uses:[]}, 'pep-talk':{makes:['charge'],uses:[]},
  quickSet:{makes:['charge'],uses:[]}, slipCharge:{makes:['charge'],uses:[]},
  wrongFloor:{makes:[],uses:['charge']}, pinball:{makes:[],uses:['charge']},
  popCircuit:{makes:[],uses:['charge']}, chain:{makes:[],uses:['charge']},
  chargeShield:{makes:[],uses:['charge']}, gravity:{makes:[],uses:['charge']},
  groupHug:{makes:[],uses:['charge']},
};
const cardTriggers = {
  'dash end':['dashBurst','pulseTrain','brakeLights','lantern-step','kickstand','backbeat-mine','afterimage','recall-ticket'],
  'fully charged hit':['pinball','groupHug','chain','popCircuit','split-second','domino-link'],
  'dash hit':['hot-start','freeze','partingShot','comboEngine','trade-places','orbit-step'],
  'overcharge':['cleanShoes','backstage','catapult','floorYours','driftwood','parting-gift','ricochet-boots'],
  'parry':['catchThrow','sender','jammer','turntable','springStance','guardBurst','backbeat','clean-sweep','counter-grip','riverbend'],
  'spot dodge':['smoke','pocket-sand','slipCharge','hollow-double','breather'],
  'emote':['pep-talk','hot-mic','cord','standIn','centerStage','houseLights'],
  'wall damage':['rattle-can','fracture-line'],
};
const synergyNotes = {
  traveling:'Return to Sender can parry and return the traveling shove.',
  decoy:'Stunt Double fires from the decoy or marker and consumes it.',
  mine:'Mine Cart can move the Backbeat Mine and start its fuse.',
  spotlight:'House Lights adds a second blast beneath you to the spotlight act.',
  'dash burst':'Pulse Train adds a second beat to Thunder Tread.',
  'push reach':'Banked reach also increases the radius of your dash-end shove.',
  'push force':'Push-force upgrades also strengthen the dash-end shove.',
  charge:'The charge bonus helps you reach the charged effect sooner.',
  circle:'Your regular push stays narrow. The banked circle takes over for one shot.',
};
function synergyNote(card, owned) {
  const key = Object.keys(card[3])[0];
  const candidate = cardLinks[key];
  for (const other of owned) {
    const otherKey = Object.keys(other[3])[0];
    const link = cardLinks[otherKey];
    if (candidate && link) {
      const shared = candidate.makes.find(effect=>link.uses.includes(effect)) ||
        candidate.uses.find(effect=>link.makes.includes(effect));
      if (shared) return other[0]+'. '+synergyNotes[shared];
    }
    const trigger = Object.keys(cardTriggers).find(event=>cardTriggers[event].includes(key) && cardTriggers[event].includes(otherKey));
    if (trigger) return other[0]+'. The same '+trigger+' can trigger both effects.';
  }
  return '';
}

function cardEligible(card, settings = {}, map, owned = []) {
  const stats = card[3];
  const keys = Object.keys(stats);
  const needsDodge = ['borrowed','sender','stepping','catchThrow','jammer','smoke','backbeat','turntable',
    'springStance','guardBurst','secondStride','safetyValve','slipCharge','breather'];
  if (!canDraftCard(card,owned) || (settings.radicalCards === false && isRadicalCard(card))) return false;
  if (settings.dodge === false && keys.some(key=>needsDodge.includes(key) ||
      ['dodge','parry'].includes(comboRecipes.get(key)?.event))) return false;
  if (settings.walls === false && (stats.bankShot || stats.carom || stats.pinball || stats.cornerStore || stats.cord ||
      keys.some(key=>comboRecipes.get(key)?.event==='wall'))) return false;
  if (settings.bananas === false && (stats.soles || stats.delivery ||
      keys.some(key=>comboRecipes.get(key)?.event==='pickup'))) return false;
  if (settings.superDash === false && (stats.powerSlide || stats.superRate || stats.superDuration)) return false;
  if (stats.windGuard && (settings.hazards === false || !map?.winds?.length)) return false;
  if (stats.floorYours && (!map?.detachableRims?.length || settings.objective)) return false;
  if (stats.lastWord && (settings.coop || settings.objective)) return false;
  if (stats.gravity && settings.coop) return false;
  if (stats.pulseTrain && settings.roundsPreset && !owned.some(pick=>pick[3].dashBurst)) return false;
  if (stats['rally-flag'] && !settings.teams && !settings.coop) return false;
  return true;
}

function dealCards(owned, coop = false, random = Math.random, settings = {}, map, starters = false) {
  const pool = deck.filter(card=>cardEligible(card,{...settings,coop},map,owned) &&
    (!starters || card[1] === 'Common'));
  const offer = [];
  const take = (candidates) => {
    const weight = card=>({Common:10,Rare:3,Epic:1,Legendary:1})[card[1]];
    let roll = random()*candidates.reduce((sum,card)=>sum+weight(card),0);
    const card = candidates.find(card=>(roll-=weight(card))<0) || candidates.at(-1);
    if (!card) return;
    offer.push(card);
    pool.splice(pool.indexOf(card),1);
  };
  if (!starters) {
    const legends = pool.filter(card=>card[1]==='Legendary');
    const unlockLegend = legends.length && random()<legendaryChance(draftsWithoutLegendary);
    if (!unlockLegend) {
      for (const card of legends) pool.splice(pool.indexOf(card),1);
      draftsWithoutLegendary++;
    }
    if (owned.length) {
      const candidates = pool.filter(card=>synergyNote(card,owned));
      const upgrade = candidates.filter(card=>card[3].pulseTrain || card[3].houseLights);
      take(upgrade.length ? upgrade : candidates);
    }
    if (unlockLegend && !offer.some(card=>card[1]==='Legendary')) take(legends);
    if (unlockLegend) draftsWithoutLegendary=0;
  }
  while (offer.length<3 && pool.length) take(pool);
  for (let i=offer.length-1;i>0;i--) {
    const j=Math.floor(random()*(i+1));
    [offer[i],offer[j]]=[offer[j],offer[i]];
  }
  return offer;
}

const previewKinds = {
  bankShot:'push repeat',carom:'push repeat',borrowed:'guard push',sender:'guard push repeat',
  standIn:'move repeat',stunt:'charge push repeat',wrongFloor:'charge recover',
  pocketLedge:'dash recover',cord:'dash repeat',floorYours:'charge recover',groupHug:'charge dash',
  lastWord:'recover push',pinball:'dash repeat',snapback:'push move',cleanShoes:'banana recoil',
  grin:'guard move',backstage:'charge dash',brakeLights:'dash guard',cornerStore:'push guard',
  delivery:'move push',stepping:'guard recover',catchThrow:'guard charge',smoke:'guard ring',
  mineCart:'dash push',catapult:'recoil recover',centerStage:'push ring',houseLights:'push ring repeat',
  jammer:'guard dash',
  slipCharge:'guard charge',
  heelTurn:'dash reload',
  zipFuse:'push dash',
  hitchKick:'dash reload',
  quickCover:'push guard',
  secondStride:'guard move',
  springline:'guard dash',
  faultTap:'push reach',
  dashCurrent:'dash charge',
  breakerShield:'push guard',
  turntable:'guard ring',
  safetyValve:'guard dash',
  popCircuit:'push ring repeat',
  starCatcher:'guard ring',

  focusCone:'push reach', sweepCone:'push ring', trident:'push ring repeat',
  dashBurst:'dash ring', pulseTrain:'dash ring repeat', guardBurst:'guard dash ring',
  finishReload:'dash reload', runningStart:'push dash', flashCharge:'dash charge',
  chain:'push ring repeat', chargeShield:'charge guard',
  tailwind:'dash move', quickSet:'dash charge', partingShot:'dash push', comboEngine:'dash push reload',
  powerSlide:'dash push', breather:'guard reload', cleanRelease:'push reload', secondWind:'guard move',
  backbeat:'guard repeat', comeback:'push move', springStance:'guard dash', reloadRelay:'push reload',
  ring:'charge ring', save:'recover', recoil:'charge recoil', blink:'blink', parry:'guard push',
  echo:'charge push repeat', freeze:'dash freeze', treads:'move ice', anchor:'dash guard',
  gravity:'charge pull', encore:'dash reload repeat', riposte:'guard push', phoenix:'recover reload',
  counterReload:'guard reload', windGuard:'wind guard', soles:'banana guard',
  parryWindow:'guard', dodgeRate:'guard reload', superRate:'dash reload', superDuration:'dash',
  speed:'move', charge:'charge', range:'push reach', force:'push', guard:'guard', dashRate:'dash reload',
  pushRate:'push reload', duration:'dash', dashForce:'dash push',
};

function makeCardPreview(stats) {
  const keys = Object.keys(stats);
  const effect = keys.find(key => stats[key] === 1) || keys[0];
  const preview = document.createElement('div');
  preview.className = 'card-preview';
  const event = comboRecipes.get(effect)?.event;
  preview.dataset.effect = previewKinds[effect] || ({dash:'dash push',dashHit:'dash charge',
    dodge:'guard reload',parry:'guard push',full:'charge ring',pickup:'move',overcharge:'charge recoil',emote:'move ring',wall:'push ring',dashEnd:'dash ring',takeHit:'guard',tap:'push'})[event] || 'push';
  preview.setAttribute('aria-hidden','true');
  const actor = document.createElement('i');
  actor.className = 'demo-actor';
  const target = document.createElement('i');
  target.className = 'demo-target';
  const wave = document.createElement('i');
  wave.className = 'demo-wave';
  const meter = document.createElement('i');
  meter.className = 'demo-meter';
  const cue = document.createElement('span');
  cue.className = 'demo-cue';
  cue.textContent = ({ice:'❄',wind:'≈',banana:'🍌',reload:'↻',recover:'↥',freeze:'❄'})[
    preview.dataset.effect.split(' ').find(kind => ['ice','wind','banana','reload','recover','freeze'].includes(kind))] || '';
  preview.append(actor,target,wave,meter,cue);
  return preview;
}


function makeSharedPool(size, owned, random = Math.random, settings = {}, map) {
  const eligible = deck.filter(card => cardEligible(card,settings,map));
  const fresh = eligible.filter(card => !owned.includes(card));
  const pool = [];
  let candidates = fresh.length >= size ? fresh : [...eligible];
  while (pool.length < size) {
    if (!candidates.length) candidates = [...eligible];
    const weights = {Common:10,Rare:3,Epic:1.5,Legendary:.65};
    let roll = random() * candidates.reduce((sum,card)=>sum+weights[card[1]],0);
    const index = candidates.findIndex(card => (roll-=weights[card[1]]) < 0);
    pool.push(candidates.splice(index,1)[0]);
  }
  return pool;
}
