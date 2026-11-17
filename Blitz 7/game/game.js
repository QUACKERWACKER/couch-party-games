'use strict';

const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const LEFT = 80, RIGHT = 880, TOP = 48, BOTTOM = 384, MID = 216, YARD = 8;
const names = ['HOT DOGS', 'TURBO TOADS'];
const colors = ['#ff856f', '#75e5ed'];
const dark = ['#a7433e', '#27778c'];
const keys = new Set();
const controllers = new Map();
const joinHeld = new Set();
const pendingJoins = new Map();
const missingPads = new Map();
const PAD_GRACE_MS = 750, PHONE_RESUME_MS = 12000;
let playbookId=0;
const helmetColors=['#f8edcf','#ffe06a','#ff926b','#f68db7','#bd9bff','#7aafff','#70e4eb','#9be990','#f4f5ff'];
const bootColors=['#eee9d6','#ffdb62','#ff775e','#ff8ed1','#b49cff','#6ac4ff','#65e4c3','#b5eb69','#30343f'];
const keyboardProfile={helmet:0,boot:0,position:null,seat:null,order:0,team:0,fieldSlot:0};
let nextJoinOrder=0;
let cpuDifficulty=3;
const cpuSkill=()=> (cpuDifficulty-1)/9;
const inputs = new Map();
const empty = {x:0, y:0, buttons:[], edge:[]};
const players = Array.from({length:14}, (_, i) => ({team:Math.floor(i/7), slot:i%7}));
let keyboard = false, previousKeys = [], state = 'menu', phase, score, team, down, spot, line, goal, quarter, time;
let carrier, flight, passed, elapsed, between, noticeUntil = 0, crate, walls, rally, liveStatus = '';
let lastFrame = 0, simTime = 0, audio;
let tryMode = '', kickFlight = null, kickMeter = null, kickoffNext = null, playCall, hazard, particles = [], impact = 0;
let crowdUntil = 0, returning = '', returnTouchback = false;
const qbSlots = [0,0], possessions = [0,0];
let lastPossession = null, playIndex = 0, defenseIndex = 0;
const menuAxes = [false,false];
const plays = [
  {name:'QUICK SLANTS',kind:'quick',depth:[0,32,50,66,52,106,103],cut:[0,0,-44,44,-31,54,-54]},
  {name:'FOUR VERTICALS',kind:'deep',depth:[0,43,80,125,145,190,190],cut:[0,8,-10,10,0,-12,12]},
  {name:'CROSSING ROUTES',kind:'cross',depth:[0,35,73,85,107,126,150],cut:[0,-15,108,-108,33,62,-62]},
  {name:'SWEEP LEFT',kind:'sweep',side:-1,depth:[0,27,47,61,42,108,95],cut:[0,-24,-14,-28,-16,0,-40]},
  {name:'SWEEP RIGHT',kind:'sweep',side:1,depth:[0,27,47,61,42,95,108],cut:[0,24,28,14,16,40,0]},
  {name:'QB KEEPER',kind:'keeper',depth:[0,34,32,32,29,69,69],cut:[0,18,-18,18,0,0,0]},
  {name:'RB HANDOFF',kind:'handoff',side:1,depth:[0,52,28,42,29,81,81],cut:[0,0,11,-14,0,12,-12]}
];
const formations = [
  {name:'BALANCED',rushers:2,x:[23,23,28,55,56,67,67],y:[0,-31,30,-65,65,-114,114]},
  {name:'ALL-OUT BLITZ',rushers:4,x:[17,17,19,19,56,64,64],y:[-13,13,-43,43,0,-114,114]},
  {name:'DEEP COVERAGE',rushers:1,x:[31,61,61,93,93,134,134],y:[0,-38,38,-94,94,-56,56]},
  {name:'GOAL-LINE WALL',rushers:3,x:[17,17,17,25,25,37,37],y:[0,-28,28,-61,61,-93,93]}
];
const KICKOFF_SWEET_SPOT = .04;
const GRAPPLE_TIME=1.05, GRAPPLE_COOLDOWN=1.45, CONTACT_TIME=.11;
const QUARTER_SECONDS=34.5;
const HALF_INTRO=1.25, HALF_CLIP=1.8;
let firstHalfHighlights=[], halftime=null;
const REPLAY_TIME=1.65, REF_SEQUENCE=3.6, TOUCHDOWN_REPLAY=1.95, TOUCHDOWN_SHOW=2.35;
let replayFrames=[], lastReplayFrame=-1, touchdownScene=null;
let flag=null, flagScene=null;
const official={x:475,y:BOTTOM-38};
const PASS_CHARGE_TIME = .95;
const DASH_TIME=.34, DEFENSE_DASH_TIME=.30, POCKET_REACH=29, SACK_TIME=.24;
let pocketPressure=0;
const CLAIM_TIME=.48, WHEEL_SPIN=2.15, WHEEL_REVEAL=.95;
let wheel=null, prize=null;
const rewards=[
  {key:'rocket', name:'Rocket Cleats', wedge:'ROCKET', detail:'Your ball carrier runs 45% faster.', seconds:5, color:'#fbd16a'},
  {key:'sneaky', name:'Sneaky Defense', wedge:'SNEAKY', detail:'Your defenders can tackle and pick off passes from farther away.', seconds:7, color:'#ad98ee'},
  {key:'bubble', name:'Bubble Wrap', wedge:'BUBBLE', detail:'Your next ball carrier can shrug off one tackle.', seconds:7, color:'#72d5db'},
  {key:'sludge', name:'Swamp Legs', wedge:'SWAMP', detail:'The other team moves 28% slower.', seconds:4, color:'#a3d77a'},
  {key:'gloves', name:'Magnet Gloves', wedge:'MAGNET', detail:'Your team has a much bigger catch radius.', seconds:7, color:'#f393b9'},
  {key:'jukes', name:'Juke Juice', wedge:'JUICE', detail:'Your ball carrier can juke more often and dodge longer.', seconds:6, color:'#f69d63'},
  {key:'freeze', name:'Freeze Tag', wedge:'FREEZE', detail:'The other team freezes in place.', seconds:1.6, color:'#9bd1ff'},
  {key:'turbo', name:'Free Samples', wedge:'SAMPLES', detail:'Every teammate moves 22% faster.', seconds:5, color:'#e6dc8b'},
  {key:'pinball', name:'Human Pinball', wedge:'PINBALL', detail:'Your ball carrier gets a speed boost and a one-tackle shield.', seconds:4, color:'#f4a391'},
  {key:'gremlins', name:'Turf Gremlins', wedge:'GREMLINS', detail:'The other team slides when trying to turn.', seconds:4, color:'#acdbaa'}
];

const clamp = (n, min, max) => Math.max(min, Math.min(max,n));
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const direction = () => team === 0 ? 1 : -1;
const endzone = () => team === 0 ? RIGHT : LEFT;
const own25 = () => team === 0 ? LEFT+25*YARD : RIGHT-25*YARD;
const role = p => (p.slot-qbSlots[p.team]+7)%7;
const lineup = side => Array.from({length:7},(_,i)=>players[side*7+(qbSlots[side]+i)%7]);
const offense = () => lineup(team);
const defense = () => lineup(1-team);
const qb = () => players[team*7+qbSlots[team]];
const defenseCaptain = () => defense().find(p=>p.owner!==null) || defense()[0];
const puntSelected = () => down===4 && playIndex===plays.length;
const control = p => inputs.get(p.owner) || empty;
function joinedPlayers() {
  const joined=Array.from(controllers,([owner,entry])=>({owner,entry}));
  if (keyboard) joined.push({owner:'keyboard',entry:keyboardProfile});
  return joined.sort((a,b)=>a.entry.order-b.entry.order);
}

const host = () => joinedPlayers().find(({entry})=>!entry.suspended)?.owner;
const canStartFrom = owner => owner===host();
const ordinals = ['1ST','2ND','3RD','4TH'];
const keyboardCodes = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyJ','KeyK','KeyL','KeyI','Enter','Escape','KeyQ','KeyE','KeyR'];

window.addEventListener('keydown', e => {
  if (!keyboardCodes.includes(e.code) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof HTMLButtonElement && e.code === 'Enter') return;
  if (e.target instanceof HTMLElement && e.target.tagName === 'SUMMARY' && e.code === 'Enter') return;
  if (!keyboard && e.code!=='Escape') return;
  e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code==='KeyQ' || e.code==='KeyE') switchTeam('keyboard',Number(e.code==='KeyE'));
  if (e.code==='Enter' && canStartFrom('keyboard')) menuAction('keyboard');
  if (e.code==='Escape') pause('keyboard');
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

window.addEventListener('gamepadconnected', ({gamepad}) => {
  if (gamepad.buttons.length>=4 && gamepad.buttons[0]?.pressed && !joinHeld.has(gamepad.index) && !controllers.has(gamepad.index)) {
    pendingJoins.set(gamepad.index,gamepad);
    joinHeld.add(gamepad.index);
  }
});

window.addEventListener('gamepaddisconnected', ({gamepad}) => {
  const {index}=gamepad;
  joinHeld.delete(index);
  pendingJoins.delete(index);
  missingPads.delete(index);
  if (controllers.delete(index)) assignSeats();
});

function sound(frequency, duration = .13, type = 'square', delay = 0) {
  playGameTone(audio, frequency, duration, type, .035, delay);
}

function readInputs() {
  const pressed = ['KeyJ','KeyK','KeyL','KeyI'].map(code => keys.has(code));
  const keyAxis = (positive,negative) => Number(positive.some(k=>keys.has(k))) - Number(negative.some(k=>keys.has(k)));
  inputs.clear();
  if (keyboard) inputs.set('keyboard', {
    x:keyAxis(['KeyD','ArrowRight'],['KeyA','ArrowLeft']),
    y:keyAxis(['KeyS','ArrowDown'],['KeyW','ArrowUp']),
    buttons:pressed, edge:pressed.map((value,i)=>value&&!previousKeys[i])
  });
  previousKeys = pressed;
  if (document.hidden) return;
  const physical = physicalGamepads();
  const pads = physical ?? [];
  pads.push(...(window.blitzPhones?.sample() || []));
  pads.push(...(window.couchJoinstick?.sample() || []));
  const connected=new Set(pads.map(pad=>pad.index));
  const now=performance.now();
  let changed=false;
  // Safari can temporarily omit a pad while the window gains focus.
  for (const index of new Set([...controllers.keys(),...joinHeld])) {
    if (!physical && index<1000) continue;
    const entry=controllers.get(index);
    if (connected.has(index)) {
      missingPads.delete(index);
      if (entry?.suspended) {
        entry.suspended=false;
        changed=true;
      }
      continue;
    }
    if (entry?.joinstick) {
      const player=players.find(p=>p.owner===index);
      if (player) player.aim=null;
      if (!entry.suspended) {
        entry.suspended=true;
        entry.buttons=[];
        entry.start=entry.rightBumper=false;
        changed=true;
      }
    }
    if (!missingPads.has(index)) missingPads.set(index,now);
    const grace=entry?.joinstick && window.couchJoinstick?.reserved(index) ? PHONE_RESUME_MS : PAD_GRACE_MS;
    if (now-missingPads.get(index)<grace) continue;
    joinHeld.delete(index);
    pendingJoins.delete(index);
    missingPads.delete(index);
    if (controllers.delete(index)) changed=true;
  }

  const samples=[];
  const requests=Array.from(pendingJoins.values(),pad=>({
    pad,buttons:pad.buttons.slice(0,4).map(button=>button.pressed),start:!!pad.buttons[9]?.pressed
  }));
  const pollRequests=[];
  pendingJoins.clear();
  for (const pad of pads) {
    if (pad.buttons.length<4) continue;
    const buttons=pad.buttons.slice(0,4).map(button=>button.pressed);
    if (buttons[0] && !joinHeld.has(pad.index) && !controllers.has(pad.index)) {
      pollRequests.push({pad,buttons,start:!!pad.buttons[9]?.pressed});
    }
    if (buttons[0]) joinHeld.add(pad.index);
    else joinHeld.delete(pad.index);

    const joined=controllers.get(pad.index);
    const start=!!pad.buttons[9]?.pressed;
    samples.push({pad,buttons,start});
    if (state==='menu' && joined && buttons[1] && !joined.buttons[1]) {
      controllers.delete(pad.index);
      kickPhone(pad.index);
      changed=true;
    }
  }
  // Prefer join events already delivered by Safari, then compare polled button times.
  if (pollRequests.every(({pad})=>pad.timestamp>0)) {
    pollRequests.sort((a,b)=>a.pad.timestamp-b.pad.timestamp);
  }
  for (const {pad,buttons,start} of [...requests,...pollRequests]) {
    if (controllers.size+Number(keyboard)>=14) break;
    const used=new Set(joinedPlayers().map(({entry})=>entry.seat));
    let seat=0;
    while (used.has(seat)) seat++;
    const team=defaultTeam();
    const fieldSlot=freeTeamSlot(team);
    const rightBumper=!!pad.buttons[5]?.pressed;
    controllers.set(pad.index,{seat,buttons,start,rightBumper,bumperSince:now,adjusted:rightBumper,order:nextJoinOrder++,team,fieldSlot,joinstick:pad.joinstick,
      profile:{helmet:0,boot:0,position:null}});
    changed=true;
    sound(720);
  }
  if (changed) assignSeats();

  const priorState=state;
  let activateMenu=false, togglePause=false;
  const hostOwner=host();
  for (const {pad,buttons,start} of samples) {
    const joined=controllers.get(pad.index);
    if (!joined) continue;
    if (pad.inputCanceled && joined.joinstick) {
      const player=players.find(p=>p.owner===pad.index);
      if (player) player.aim=null;
      joined.adjusted=true;
      inputs.set(pad.index,empty);
      joined.buttons=buttons;
      joined.start=start;
      joined.rightBumper=!!pad.buttons[5]?.pressed;
      continue;
    }
    const x=pad.axes[0] || 0, y=pad.axes[1] || 0;
    const useStick=Math.hypot(x,y)>.23;
    const edge=buttons.map((value,i)=>value&&!joined.buttons[i]);
    const startEdge=start && !joined.start;
    if ((edge[3] || startEdge) && priorState!=='playing' && pad.index===hostOwner) {
      edge[3]=false;
      activateMenu=true;
    }
    if (startEdge && priorState==='playing' && pad.index===hostOwner) togglePause=true;
    inputs.set(pad.index,{
      x:useStick ? x : Number(!!pad.buttons[15]?.pressed)-Number(!!pad.buttons[14]?.pressed),
      y:useStick ? y : Number(!!pad.buttons[13]?.pressed)-Number(!!pad.buttons[12]?.pressed),
      buttons,edge
    });
    const rightBumper=!!pad.buttons[5]?.pressed;
    if (priorState==='menu') {
      if (pad.index===hostOwner) {
        const input=inputs.get(pad.index);
        if (rightBumper) {
          if (!joined.rightBumper) {
            joined.bumperSince=now;
            joined.adjusted=false;
          }
          if (adjustCpuDifficulty(joined,input.y,now)) joined.adjusted=true;
          input.x=0;
          input.y=0;
        } else {
          adjustCpuDifficulty(joined,0,now);
          if (joined.rightBumper && !joined.adjusted && now-joined.bumperSince<350) {
            switchTeam(pad.index,1-joined.team);
          }
        }
      } else if (rightBumper && !joined.rightBumper) switchTeam(pad.index,1-joined.team);
    }
    joined.buttons=buttons;
    joined.start=start;
    joined.rightBumper=rightBumper;
  }
  if (activateMenu) menuAction(hostOwner);
  else if (togglePause) pause(hostOwner);
}

function kickPhone(index) {
  if (window.couchJoinstick?.kick(index)) return;
  if (index>=1000) window.blitzPhones?.kick(index);
}

function removeController(index) {
  if (state!=='menu' || !controllers.delete(index)) return;
  kickPhone(index);
  assignSeats();
}

function drawRoster() {
  const roster=$('lobby-roster');
  roster.replaceChildren();
  const sorted=[...controllers.entries()].sort((a,b)=>a[1].seat-b[1].seat);
  for (const [index,{seat,profile,team}] of sorted) {
    const button=document.createElement('button');
    const identity=window.couchJoinstick?.profile?.(index);
    const label=identity?.name || 'P'+(seat+1);
    button.className='secondary roster-player';
    button.dataset.controller=index;
    button.style.setProperty('--helmet',(!profile.customHelmet && identity?.accent) || helmetColors[profile.helmet]);
    button.style.setProperty('--boots',bootColors[profile.boot]);
    button.style.borderColor=colors[team];
    button.textContent=label+' ×';
    button.setAttribute('aria-label','Remove '+label);
    button.onclick=()=>removeController(index);
    roster.append(button);
  }
  roster.hidden=state!=='menu' || !sorted.length;
}

function adjustCpuDifficulty(gesture,y,now) {
  if (Math.abs(y)<.38) gesture.difficultyDirection=0;
  if (Math.abs(y)<.62) return false;
  const step=y<0 ? 1 : -1;
  const initial=step!==gesture.difficultyDirection;
  if (initial || now>=gesture.difficultyRepeat) {
    gesture.difficultyDirection=step;
    gesture.difficultyRepeat=now+(initial ? 340 : 145);
    const value=clamp(cpuDifficulty+step,1,10);
    if (value!==cpuDifficulty) {
      cpuDifficulty=value;
      sound(350+cpuDifficulty*45,.08);
    }
  }
  return true;
}

function defaultTeam() {
  const count=[0,0];
  for (const {entry} of joinedPlayers()) count[entry.team]++;
  return count[0]<=count[1] ? 0 : 1;
}

function freeTeamSlot(side) {
  const used=new Set(joinedPlayers().filter(({entry})=>entry.team===side).map(({entry})=>entry.fieldSlot));
  return Array.from({length:7},(_,i)=>i).find(slot=>!used.has(slot));
}

function switchTeam(owner,side) {
  if (state!=='menu') return;
  const player=joinedPlayers().find(p=>p.owner===owner);
  if (!player || player.entry.team===side) return;
  if (freeTeamSlot(side)===undefined) {
    say(names[side]+' ARE FULL');
    return;
  }
  player.entry.team=side;
  const profile=owner==='keyboard' ? keyboardProfile : player.entry.profile;
  profile.position=null;
  assignSeats();
  sound(side===0 ? 490 : 630);
}

function assignSeats() {
  const joined=joinedPlayers();
  if (state==='menu') {
    const nextSlot=[0,0];
    joined.forEach(({entry},seat)=>{
      entry.seat=seat;
      entry.fieldSlot=nextSlot[entry.team]++;
    });
  }
  for (const p of players) {p.owner=null;p.label='';p.profile=null;}
  for (const {owner,entry} of joined) {
    if (entry.suspended) continue;
    const {seat}=entry;
    const player=players[entry.team*7+entry.fieldSlot];
    const profile=owner==='keyboard' ? keyboardProfile : entry.profile;
    const identity=window.couchJoinstick?.profile?.(owner);
    Object.assign(player,{owner,label:identity?.name || 'P'+(seat+1),profile});
  }
  $('keyboard').disabled=controllers.size===14;
  $('keyboard').textContent=keyboard ? 'KEYBOARD · P'+(keyboardProfile.seat+1) : 'KEYBOARD · OFF';
  $('keyboard').setAttribute('aria-pressed',String(keyboard));
  if (state==='playing' || state==='paused') for (const p of players) statsFor(p);
  drawRoster();
  refreshPauseControls();
  for (const [i,id] of ['red','blue'].entries()) {
    const humans = players.filter(p=>p.team===i && p.owner!==null).length;
    $(id).textContent = humans ? `${humans} HUMAN · ${7-humans} CPU` : '7 CPU';
  }
}

function claimPossession(side) {
  if (side===lastPossession) return;
  const roster = players.slice(side*7,side*7+7);
  const humans = roster.filter(p=>p.owner!==null);
  const eligible = humans.length ? humans : roster;
  const previous = qbSlots[side];
  qbSlots[side] = (possessions[side] ? eligible.find(p=>p.slot>previous) || eligible[0] : eligible[0]).slot;
  possessions[side]++;
  lastPossession=side;
}

function freshDrive(newTeam, at, temporary=false) {
  if (!temporary) claimPossession(newTeam);
  team = newTeam;
  spot = at ?? own25();
  down = 1;
  goal = spot + direction()*Math.min(10*YARD,Math.abs(endzone()-spot));
}

function setFormation() {
  playbookId++;
  passStats=null;
  phase = 'ready';
  pocketPressure=0;
  flag=null;
  flagScene=null;
  touchdownScene=null;
  replayFrames=[];
  lastReplayFrame=-1;
  official.x=clamp(spot ?? 475,135,825);
  official.y=BOTTOM-39;
  returning = '';
  returnTouchback = false;
  line = spot;
  carrier = qb();
  flight = null;
  elapsed = 0;
  passed = false;
  crate = null;
  walls = [];
  rally = null;
  hazard = null;
  playIndex = qb().owner===null ? Math.floor(Math.random()*plays.length) : 0;
  defenseIndex = defenseCaptain().owner===null ? Math.floor(Math.random()*formations.length) : 0;
  menuAxes[0] = Math.abs(control(qb()).y)>.35;
  menuAxes[1] = Math.abs(control(defenseCaptain()).y)>.35;
  positionFormation();
  for (const p of players) {
    Object.assign(p,{stun:0,dive:0,dodge:0,cool:0,call:-100,step:0,shield:false,boost:0,vx:0,vy:0,slip:0,catchWindow:0,grappleCooldown:0,grapple:0,grip:null,gripTime:0,contact:0,grabbed:0,aim:null});
  }
  updateScore();
}

function offensivePositions(index) {
  const x=[-31,-26,-7,-7,-7,0,0], y=[0,40,-26,26,0,-122,122];
  const call=plays[index];
  if (call && runningPlay(call)) {
    y[1]=call.kind==='sweep' ? call.side*40 : 17;
    if (call.kind==='handoff') x[1]=-48;
  }
  if (!call) x[0]=-65;
  return x.map((offset,i)=>({x:clamp(line+direction()*offset,15,945),y:MID+y[i]}));
}

function positionFormation() {
  const formation=formations[defenseIndex];
  const d=direction(), starts=offensivePositions(playIndex);
  for (const p of players) {
    const onOffense = p.team===team, i=role(p);
    p.x=onOffense ? starts[i].x : clamp(line+d*formation.x[i],15,945);
    p.y=onOffense ? starts[i].y : MID+formation.y[i];
    p.fx=onOffense ? d : -d;
    p.fy=0;
  }
}

function selectCalls() {
  const captains=[qb(),defenseCaptain()];
  for (const [i,captain] of captains.entries()) {
    const y=control(captain).y;
    if (Math.abs(y)<.35) menuAxes[i]=false;
    if (Math.abs(y)<.58 || menuAxes[i]) continue;
    menuAxes[i]=true;
    const step=Math.sign(y);
    if (i===0) {
      const count=plays.length+Number(down===4);
      playIndex=(playIndex+step+count)%count;
    } else defenseIndex=(defenseIndex+step+formations.length)%formations.length;
    positionFormation();
    sound(i===0 ? 590 : 440,.06);
  }
}

function updateScore() {
  $('s0').textContent = String(score[0]).padStart(2,'0');
  $('s1').textContent = String(score[1]).padStart(2,'0');
  $('quarter').textContent = 'Q'+quarter;
  $('clock').textContent = '0:'+String(Math.ceil(time)).padStart(2,'0');
  const yards = Math.max(1,Math.ceil(Math.abs(goal-spot)/YARD));
  $('down').textContent = returning && phase==='live' ? (returning==='kickoff' ? 'KICK RETURN' : 'PICK RETURN') : tryMode === 'two' ? '2 PT TRY' : tryMode ? 'PAT / 2 PT' : ordinals[down-1]+' & '+(goal === endzone() ? 'GOAL' : yards);
}

function say(message, duration = 1.85) {
  $('call').textContent = message;
  $('call').hidden = false;
  noticeUntil = simTime+duration;
}

function menuAction(owner) {
  if (state==='paused') {pause(owner);return;}
  if (state==='over') {
    reset();
    state='menu';
    $('menu').hidden=true;
    $('lobby').hidden=false;
    $('cpu-setting').hidden=false;
    assignSeats();
    $('lobby-start').focus();
    return;
  }
  start();
}

function start() {
  if (state!=='menu' && state!=='over') return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (Audio) {
    audio ||= new Audio();
    audio.resume().catch(()=>{});
  }
  reset();
  state = 'playing';
  canvas.focus({preventScroll:true});
  $('lobby').hidden=true;
  $('cpu-setting').hidden=true;
  $('lobby-roster').hidden=true;
  $('menu').hidden = true;
  refreshPauseControls();
  openKickoff(0);
  sound(550);
}

const matchStats=new Map();
const cpuStatKeys=[{},{}];
let passStats=null;

function statsFor(p) {
  const key=p.profile || cpuStatKeys[p.team];
  if (!matchStats.has(key)) {
    matchStats.set(key,{side:p.team,label:p.label || 'CPUs',cpu:!p.profile,
      rush:0,attempts:0,completions:0,passing:0,catches:0,receiving:0,
      touchdowns:0,points:0,tackles:0,sacks:0,picks:0});
  }
  return matchStats.get(key);
}

function logPlayStats(reason,at,scored,tackler) {
  if (tryMode==='two') {
    if (scored && carrier) statsFor(carrier).points+=2;
    return;
  }
  if (tackler) {
    const defenseStats=statsFor(tackler);
    defenseStats.tackles++;
    if (reason==='sack') defenseStats.sacks++;
  }
  if (passStats && !returning) {
    passStats.passer.attempts++;
    if (passStats.receiver) {
      const gain=Math.round(direction()*(at-line)/YARD);
      passStats.passer.completions++;
      passStats.passer.passing+=gain;
      passStats.receiver.catches++;
      passStats.receiver.receiving+=gain;
    }
  } else if (carrier && !returning && reason!=='incomplete' && reason!=='sack') {
    statsFor(carrier).rush+=Math.round(direction()*(at-line)/YARD);
  }
  if (scored && carrier) {
    const row=statsFor(carrier);
    row.touchdowns++;
    row.points+=6;
  }
}

function showPostgame() {
  $('final-result').textContent=score[0]===score[1] ? 'Draw' : names[Number(score[1]>score[0])]+' win';
  $('final-score').textContent=names[0]+' '+score[0]+'  –  '+score[1]+' '+names[1];
  const rows=[...matchStats.values()].sort((a,b)=>a.side-b.side || Number(a.cpu)-Number(b.cpu) ||
    a.label.localeCompare(b.label,undefined,{numeric:true}));
  $('stats-body').replaceChildren(...rows.map(row=>{
    const tr=document.createElement('tr');
    tr.append(...gameTableCells([row.label+' · '+names[row.side],row.rush,
      row.completions+'/'+row.attempts,row.passing,row.catches+' / '+row.receiving,
      row.touchdowns,row.points,row.tackles,row.sacks,row.picks],row.side===0 ? 'coral' : 'blue'));
    return tr;
  }));
  canvas.hidden=true;
  $('postgame').hidden=false;
  $('stats-lobby').focus({preventScroll:true});
}

function reset() {
  score = [0,0];
  matchStats.clear();
  for (const p of players) statsFor(p);
  $('postgame').hidden=true;
  canvas.hidden=false;
  wheel=null;
  prize=null;
  lastPossession=null;
  qbSlots.fill(0);
  possessions.fill(0);
  between = 0;
  tryMode = '';
  kickFlight = null;
  kickMeter = null;
  kickoffNext = null;
  particles = [];
  impact = 0;
  crowdUntil = 0;
  quarter = 1;
  time=QUARTER_SECONDS;
  firstHalfHighlights=[];
  halftime=null;
  freshDrive(0,undefined,true);
  setFormation();
}

function refreshPauseControls() {
  const active=state==='playing' || state==='paused';
  const keyboardHost=canStartFrom('keyboard');
  $('pause').disabled=!active || !keyboardHost;
  $('pause').textContent=active && !keyboardHost ? 'P1 · START' : state==='paused' ? 'RESUME' : 'PAUSE';
  $('start').disabled=state==='paused' && !keyboardHost;
  if (state==='paused') {
    $('intro').textContent=keyboardHost ? 'P1 can press Escape to resume.' : 'P1 can press Start or the top face button to resume.';
  }
}

function pause(owner) {
  if (owner==null || !canStartFrom(owner)) return;
  if (state==='playing') {
    state='paused';
    $('title').textContent='PAUSED';
    $('start').textContent='RESUME';
    $('menu').hidden=false;
  } else if (state==='paused') {
    state='playing';
    $('menu').hidden=true;
  }
  refreshPauseControls();
}

function finalWhistle() {
  state = 'over';
  refreshPauseControls();
  $('menu').hidden=true;
  $('call').hidden=true;
  showPostgame();
  sound(660,.25);
}

$('start').onclick=()=>menuAction('keyboard');
$('stats-lobby').onclick=()=>menuAction('keyboard');
$('lobby-start').onclick = start;
$('pause').onclick=()=>pause('keyboard');
$('keyboard').onclick = () => {
  if (state!=='menu' || controllers.size===14) return;
  if (!keyboard) {
    keyboardProfile.order=nextJoinOrder++;
    keyboardProfile.team=defaultTeam();
    keyboardProfile.position=null;
  }
  keyboard=!keyboard;
  keys.clear();
  previousKeys=[];
  assignSeats();
};

function snap() {
  phase = 'live';
  pocketPressure=0;
  elapsed = 0;
  between = 0;
  playCall = {
    ...plays[playIndex],
    side:plays[playIndex].side || (Math.random()<.5 ? -1 : 1),
    rushers:formations[defenseIndex].rushers
  };
  crate = !tryMode && !prize && Math.random()<.63 ? makePrizeCrate() : null;
  const chaos = tryMode ? 1 : Math.random();
  if (chaos<.15) {
    const x = clamp(line+direction()*110,LEFT+28,RIGHT-28);
    walls = [{x,y:MID-64},{x,y:MID+64}];
    say('INFLATABLES ON THE FIELD');
  } else if (chaos<.36) {
    const duck = chaos<.24;
    hazard = {
      duck, triggered:false, x:clamp(line+direction()*(48+Math.random()*100),LEFT+25,RIGHT-25),
      y:duck ? MID-110 : MID+(Math.random()-.5)*155
    };
    say(duck ? 'THE DUCKS ARE LOOSE!' : 'SODA SPILL!');
  }
  sound(320,.08);
}

function dead(message) {
  phase = 'dead';
  between = 0;
  say(message,1.65);
  sound(390,.16,'triangle');
}

function openTry(at) {
  const side = team;
  freshDrive(side,at ?? endzone()-2*YARD*direction());
  setFormation();
  tryMode = 'choice';
  phase = 'try';
  between = 0;
  say('I / TOP: KICK +1   ·   J / BOTTOM: GO FOR 2', 20);
  updateScore();
}

function finishTry(points, message) {
  score[team] += points;
  tryMode = '';
  kickFlight = null;
  if (points) celebrate(endzone());
  kickoffNext = 1-team;
  dead(message);
  updateScore();
}

function openKickoff(receiver) {
  kickoffNext = null;
  claimPossession(receiver);
  const kicking = 1-receiver;
  freshDrive(kicking,endzoneFor(kicking,35),true);
  setFormation();
  carrier = null;
  const d = direction();
  for (const p of offense()) {
    p.x = line-d*(role(p)===0 ? 10 : 3);
    p.y = MID+[0,-128,-86,-43,43,86,128][role(p)];
  }
  for (const p of defense()) {
    p.x = endzone()-d*(role(p)===0 ? 55 : 198);
    p.y = MID+[0,-128,-86,-43,43,86,128][role(p)];
  }
  beginKick('kickoff');
  updateScore();
}

function kickTitle(kind) {
  return {pat:'EXTRA POINT', fg:'FIELD GOAL', kickoff:'KICKOFF'}[kind];
}

function beginKick(kind, distance=0) {
  phase = 'kickMeter';
  between = 0;
  const half = kind==='fg' ? clamp(.23-distance*.0034,.065,.17) : kind==='pat' ? .09 : .15;
  kickMeter = {kind,distance,half};
  say(kickTitle(kind)+(kind==='kickoff' ? ' · AIM FOR THE CENTER' : ' · PRESS I / TOP IN THE GOLD ZONE'),20);
}

function meterPosition() {
  return 1-Math.abs((between*1.42)%2-1);
}

function launchKick(value) {
  const {kind,half,distance}=kickMeter;
  const error = value-.5;
  const good = Math.abs(error)<=half;
  const d = direction();
  const x = kind==='kickoff' ? line : line-d*46;
  const sweetSpot = Math.abs(error)<=KICKOFF_SWEET_SPOT;
  const kickoffDepth = 10+370*Math.pow(Math.abs(error)*2,.85);
  const target = kind==='kickoff' ? endzone()-d*kickoffDepth : team===0 ? 935 : 25;
  const y = kind==='kickoff' ? MID+error*215 : good ? MID+error*80 : MID+Math.sign(error)*(46+Math.abs(error)*103);
  const coverage = kind==='kickoff' ? players.map(p=>({
    player:p, fromX:p.x, fromY:p.y,
    x:p.team===team ? target-d*(145+Math.abs(role(p)-3)*17)
      : role(p)===0 ? target : target-d*(56+Math.abs(role(p)-3)*13),
    y:p.team!==team && role(p)===0 ? y : p.y
  })) : null;
  kickFlight = {kind,distance,good,x,target,y,coverage,duration:kind==='kickoff' ? 1.42 : 1.05};
  kickMeter = null;
  phase = 'kickFlight';
  between = 0;
  carrier = null;
  burst(x,MID,'#ffe193',13,.5,75);
  say(kind==='kickoff' ? (sweetSpot ? 'SWEET SPOT · DEEP KICK!' : 'KICKOFF IN THE AIR') : kickTitle(kind)+' ATTEMPT');
  sound(208,.2,'triangle');
}

function resolveKick() {
  const {kind,good,target,y,distance} = kickFlight;
  kickFlight=null;
  if (kind==='pat') {
    if (good) statsFor(qb()).points++;
    finishTry(good ? 1 : 0,good ? 'EXTRA POINT GOOD!  +1' : 'EXTRA POINT MISSED!');
    return;
  }
  if (kind==='fg') {
    time=Math.max(0,time-4);
    if (good) {
      score[team]+=3;
      statsFor(qb()).points+=3;
      kickoffNext=1-team;
      celebrate(endzone());
      dead(distance+' YD FIELD GOAL!  +3');
    } else {
      freshDrive(1-team,clamp(line-direction()*56,LEFT+1,RIGHT-1));
      dead(y<MID ? 'FIELD GOAL · WIDE LEFT' : 'FIELD GOAL · WIDE RIGHT');
    }
    updateScore();
    return;
  }
  freshDrive(1-team,target);
  carrier=qb();
  carrier.x=target;
  carrier.y=y;
  playCall={...plays[5],side:1,rushers:2};
  elapsed=0;
  passed=true;
  returning='kickoff';
  phase='live';
  say('KICKOFF RETURN · BALL LIVE');
  updateScore();
}

function celebrate(x) {
  crowdUntil = simTime+2.1;
  for (let i=0;i<4;i++) burst(x,MID+(i-1.5)*61,colors[team],25,1.6,150);
  impact = .30;
}

function replaySnapshot() {
  const avatars=players.map(p=>({
    x:p.x,y:p.y,team:p.team,label:p.label,fx:p.fx,step:p.step,dive:p.dive,
    profile:p.profile && {helmet:p.profile.helmet,boot:p.profile.boot,customHelmet:p.profile.customHelmet},
    accent:window.couchJoinstick?.profile?.(p.owner)?.accent,
    replayCarrier:p===carrier,
    grip:p.grip && {x:p.grip.x,y:p.grip.y}
  }));
  const fraction=flight ? clamp(flight.t/flight.duration,0,1) : 0;
  const ball=flight ? {x:flight.x,y:flight.y-passHeight(flight,fraction)} : null;
  return {avatars,ball,at:elapsed};
}

function addHighlight(kind,title,focus,replay) {
  if (quarter>2) return;
  const matching=firstHalfHighlights.filter(clip=>clip.kind===kind);
  if (matching.length===4) firstHalfHighlights.splice(firstHalfHighlights.indexOf(matching[0]),1);
  firstHalfHighlights.push({kind,title,replay:replay ?? [...replayFrames,replaySnapshot()],side:focus?.team ?? team,
    x:focus?.x ?? line,y:focus?.y ?? MID,index:players.indexOf(focus)});
}

function openHalftime() {
  const clips=[];
  const recent=[...firstHalfHighlights].reverse();
  for (const kind of ['touchdown','flag','pick']) {
    const clip=recent.find(item=>item.kind===kind);
    if (clip) clips.push(clip);
  }
  for (const clip of recent) {
    if (clips.length===4) break;
    if (!clips.includes(clip)) clips.push(clip);
  }
  clips.sort((a,b)=>firstHalfHighlights.indexOf(a)-firstHalfHighlights.indexOf(b));
  halftime={clips,length:HALF_INTRO+Math.max(1,clips.length)*HALF_CLIP};
  phase='halftime';
  between=0;
  $('quarter').textContent='HALF';
  $('down').textContent='HIGHLIGHTS';
  $('call').hidden=true;
  [392,523,659].forEach((note,i)=>sound(note,.13,'triangle',i*.11));
}

function recordReplay() {
  if (elapsed-lastReplayFrame<1/24) return;
  const frame=replaySnapshot();
  lastReplayFrame=elapsed;
  replayFrames.push(frame);
  if (replayFrames.length>29) replayFrames.shift();
  if (flag && elapsed<=flag.when+.24) flag.replay.push(frame);
}

function flagDefense(name,at,y=MID) {
  if (flag || returning) return;
  flag={name,at,y,when:elapsed,replay:[...replayFrames,replaySnapshot()]};
  say('FLAG ON THE PLAY');
  const player=carrier || qb();
  burst(player.x,player.y,'#ffe479',12,.45,82);
  sound(785,.12,'triangle');
}

function showFlag(message) {
  flagScene={title:flag.name,message,x:flag.at,y:flag.y,replay:flag.replay};
  addHighlight('flag',flag.name,{x:flag.at,y:flag.y,team:1-team},flag.replay);
  official.x=clamp(flag.at,205,755);
  official.y=237;
  flag=null;
  $('call').hidden=true;
  sound(1050,.18,'triangle');
}

function enforceFlag(result) {
  if (!flag) return false;
  const d=direction();
  const halfDistance=Math.abs(endzone()-line)/2;
  const yards=Math.min(5*YARD,halfDistance);
  if (tryMode==='two') {
    spot=line+d*yards;
    tryMode='retry';
    dead('REPLAY TWO-POINT TRY');
    showFlag('HALF THE DISTANCE · REPLAY THE TRY');
  } else {
    const foulGain=flag.name==='PASS INTERFERENCE' ? Math.max(0,d*(flag.at-line)) : 0;
    const enforced=Math.max(yards,foulGain,d*(result-line));
    const next=clamp(line+d*enforced,LEFT+1,RIGHT-1);
    const gain=Math.max(1,Math.round(d*(next-line)/YARD));
    freshDrive(team,next);
    dead('AUTOMATIC FIRST DOWN');
    showFlag('+'+gain+' YDS · AUTOMATIC FIRST DOWN');
  }
  updateScore();
  return true;
}

function finishPlay(reason, at, tackler=null) {
  const d = direction();
  if (reason === 'incomplete') at = line;
  const crossed = reason !== 'incomplete' && d*(at-endzone())>=0;
  if (!crossed && enforceFlag(at)) return;
  logPlayStats(reason,crossed ? endzone() : at,crossed,tackler);
  if (tryMode === 'two') {
    finishTry(crossed ? 2 : 0,crossed ? 'TWO-POINT CONVERSION!  +2' : 'TWO-POINT TRY FAILED');
    if (flag) showFlag('DECLINED · CONVERSION COUNTS');
    return;
  }
  if (crossed) {
    score[team] += 6;
    tryMode = 'pending';
    celebrate(endzone());
    touchdownScene={team,x:endzone(),scorer:carrier?.label || names[team],
      scorerIndex:players.indexOf(carrier),replay:[...replayFrames,replaySnapshot()]};
    addHighlight('touchdown',names[team]+' TOUCHDOWN',carrier,touchdownScene.replay);
    dead('TOUCHDOWN!  +6');
    $('call').hidden=true;
    if (flag) showFlag('DECLINED · TOUCHDOWN COUNTS');
    [440,554,659,880].forEach((note,i)=>sound(note,.18,'square',i*.1));
  } else if (returning && returnTouchback) {
    freshDrive(team,endzoneFor(team,20));
    dead('INTERCEPTION · TOUCHBACK');
  } else if (reason !== 'incomplete' && (team===0 ? at<=LEFT : at>=RIGHT)) {
    score[1-team] += 2;
    kickoffNext = 1-team;
    dead('SAFETY!  +2');
  } else if (returning) {
    freshDrive(team,clamp(LEFT+Math.round((at-LEFT)/YARD)*YARD,LEFT+1,RIGHT-1));
    dead(returning==='kickoff' ? 'KICK RETURN · FIRST DOWN' : 'PICK RETURN · FIRST DOWN');
  } else {
    spot = clamp(LEFT+Math.round((at-LEFT)/YARD)*YARD,LEFT+1,RIGHT-1);
    const gain = Math.round(d*(spot-line)/YARD);
    if (reason==='sack') addHighlight('sack','POCKET COLLAPSE · SACK',carrier);
    else if (gain>=16) addHighlight('gain','BIG PLAY · '+gain+' YARDS',carrier);
    const caption = reason === 'incomplete' ? 'INCOMPLETE' : reason === 'out' ? 'OUT OF BOUNDS' : reason === 'timer' ? 'PLAY TIME LIMIT' : reason==='sack' ? 'POCKET COLLAPSE · SACK' : 'DOWN';
    if (d*(spot-goal)>=0) {
      freshDrive(team,spot);
      dead('FIRST DOWN!  +'+gain+' YDS');
    } else if (down === 4) {
      freshDrive(1-team,spot);
      dead(reason==='sack' ? 'SACK · TURNOVER ON DOWNS' : 'TURNOVER ON DOWNS');
    } else {
      down++;
      dead(caption+(reason==='incomplete' ? '' : `  ${gain>0?'+':''}${gain} YDS`));
    }
  }
  updateScore();
}

function kick(forcePunt=false) {
  const d = direction(), distance = Math.abs(endzone()-line)/YARD+17;
  if (!forcePunt && distance<=48) {
    beginKick('fg',Math.round(distance));
    return;
  }
  if (down!==4) {
    say('OUT OF FIELD-GOAL RANGE · PUNT ON 4TH');
    return;
  }
  const landing = line+d*YARD*(32+Math.random()*14);
  const touchback = d*(landing-endzone())>=0;
  freshDrive(1-team,touchback ? endzoneFor(1-team,20) : landing);
  dead(touchback ? 'PUNT · TOUCHBACK' : 'PUNT · POSSESSION FLIPS');
  time = Math.max(0,time-4);
  updateScore();
}

function endzoneFor(side, yards) {
  return side===0 ? LEFT+yards*YARD : RIGHT-yards*YARD;
}

function canPass(p) {
  return p===qb() && !passed && !returning && direction()*(p.x-line)<=0;
}

function inPocket() {
  return !!carrier && canPass(carrier);
}

function pocketClosed(p) {
  if (p!==carrier || !inPocket()) return false;
  let nearby=0;
  for (const defender of defense()) {
    if (!defender.stun && prizeSpeed(defender)>0 && dist(defender,p)<POCKET_REACH && ++nearby===2) return true;
  }
  return false;
}

function updatePocketPressure(dt) {
  if (!carrier || !pocketClosed(carrier)) {
    pocketPressure=0;
    return false;
  }
  if (!pocketPressure) say('POCKET COLLAPSING',.65);
  pocketPressure+=dt;
  carrier.aim=null;
  carrier.dive=0;
  carrier.dodge=0;
  if (pocketPressure<SACK_TIME) return false;
  burst(carrier.x,carrier.y,'#fff0c7',20,.5,85);
  impact=.2;
  finishPlay('sack',carrier.x,defense().filter(p=>!p.stun && prizeSpeed(p)>0)
    .sort((a,b)=>dist(a,carrier)-dist(b,carrier))[0]);
  return true;
}

function protectingPocket(p) {
  const slot=role(p);
  return p.team===team && p.owner===null && inPocket() &&
    ((slot===4 && elapsed<1.45) || (slot===2 && elapsed<1.1));
}

function chooseReceiver(p) {
  const options = offense().filter(target=>target!==p && dist(target,p)<345);
  const rating = target => {
    const range = dist(target,p);
    const open = Math.min(...defense().map(other=>dist(other,target)));
    const called = simTime-target.call<1.3 ? 70 : 0;
    return open*.8+called+direction()*(target.x-p.x)*.16-range*.15;
  };
  return options.sort((a,b)=>rating(b)-rating(a))[0];
}

function throwBall(p,toX,toY,receiver=null) {
  passStats={passer:statsFor(p),receiver:null};
  const duration=clamp(Math.hypot(toX-p.x,toY-p.y)/410,.21,.95);
  flight={x:p.x,y:p.y,fromX:p.x,fromY:p.y,toX,toY,duration,t:0,receiver,manual:receiver===null};
  for (const defender of defense()) defender.catchWindow=0;
  passed=true;
  carrier=null;
  sound(250,.16,'triangle');
}

function pass(p) {
  if (!canPass(p) || pocketClosed(p)) return;
  const receiver=chooseReceiver(p);
  if (!receiver) return;
  const leadTime=clamp(dist(p,receiver)/395,.20,.75);
  const lead=receiver.owner===null ? direction()*61 : (receiver.vx || 0)*.68;
  const verticalLead=(receiver.vy || 0)*(receiver.owner===null ? .6 : .68);
  const error=(1-cpuSkill())*49;
  throwBall(p,receiver.x+lead*leadTime+(Math.random()-.5)*error,
    receiver.y+verticalLead*leadTime+(Math.random()-.5)*error,receiver);
}

function passTarget(p) {
  const power=clamp(p.aim.held/PASS_CHARGE_TIME,0,1);
  const range=36+power*300;
  const target={x:p.x+p.aim.x*range,y:p.y+p.aim.y*range,power,assisted:false};
  if (target.y<=TOP || target.y>=BOTTOM || target.x<14 || target.x>946) return target;
  const predictionTime=clamp(range/410,.21,.95)*.83;
  let closest=null;
  let bestDistance=31;
  for (const receiver of offense()) {
    if (receiver===p || receiver.stun || prizeSpeed(receiver)===0) continue;
    const predicted={x:receiver.x+receiver.vx*predictionTime,y:receiver.y+receiver.vy*predictionTime};
    if (predicted.y<=TOP || predicted.y>=BOTTOM || predicted.x<14 || predicted.x>946) continue;
    const error=dist(target,predicted);
    if (error<bestDistance) {closest=predicted;bestDistance=error;}
  }
  if (closest) {
    const blend=Math.min(.67,19/Math.max(bestDistance,1));
    target.x+=(closest.x-target.x)*blend;
    target.y+=(closest.y-target.y)*blend;
    target.assisted=true;
  }
  return target;
}

function updateAim(p,input,dt) {
  if (!canPass(p) || pocketClosed(p)) {
    p.aim=null;
    return;
  }
  if (input.edge[0]) p.aim={held:0,x:direction(),y:0};
  if (!p.aim) return;
  if (!input.buttons[0]) {
    const target=passTarget(p);
    p.aim=null;
    throwBall(p,target.x,target.y);
    return;
  }
  const magnitude=Math.hypot(input.x,input.y);
  if (magnitude>.23) {
    p.aim.x=input.x/magnitude;
    p.aim.y=input.y/magnitude;
  }
  p.aim.held=Math.min(PASS_CHARGE_TIME,p.aim.held+dt);
}

function runningPlay(call) {
  return call.kind==='sweep' || call.kind==='handoff';
}

function handoff(p) {
  if (p!==carrier || !canPass(p) || pocketClosed(p) || p.stun || prizeSpeed(p)===0) return;
  const back=offense()[1];
  if (back.stun || prizeSpeed(back)===0 || dist(p,back)>=55 || direction()*(back.x-p.x)>14) return;
  p.aim=null;
  carrier=back;
  back.dodge=.28;
  passed=true;
  sound(430,.1);
  if (runningPlay(playCall)) say('HANDOFF · '+(back.label || 'CPU')+' RB');
}

function routeTarget(call,slot,age) {
  const lanes=[0,51,-43,46,3,-119,117];
  const cut=clamp((age-.37)*1.6,0,1);
  return {
    x:clamp(line+direction()*(call.depth[slot]+Math.max(0,age-1.15)*54),20,940),
    y:clamp(MID+lanes[slot]+call.cut[slot]*cut,TOP+13,BOTTOM-13)
  };
}

function runTarget(call) {
  const sweep=call.kind==='sweep';
  return {x:clamp(line+direction()*(sweep ? 85 : 65),24,936),y:MID+(sweep ? call.side*105 : 17)};
}

function intercept(player) {
  if (enforceFlag(line)) return;
  burst(player.x,player.y,colors[player.team],18);
  if (tryMode === 'two') {
    finishTry(0,'INTERCEPTED · TRY FAILED');
    return;
  }
  if (passStats) passStats.passer.attempts++;
  statsFor(player).picks++;
  passStats=null;
  claimPossession(player.team);
  team = player.team;
  carrier = player;
  addHighlight('pick',names[team]+' INTERCEPTION',player);
  returning = 'pick';
  returnTouchback = direction()*(player.x-(team===0 ? LEFT : RIGHT))<=0;
  elapsed = 0;
  updateScore();
  say('INTERCEPTION!  RETURN IT!');
  sound(196,.18,'triangle');
  sound(588,.15,'square',.14);
}

function passHeight(ball,progress) {
  const distance=Math.hypot(ball.toX-ball.fromX,ball.toY-ball.fromY);
  const peak=clamp(22+distance*.18,27,82);
  return Math.sin(progress*Math.PI)*peak;
}

function canPickPass(progress,height) {
  return progress>.5 && height<=13;
}

function updateFlight(dt) {
  flight.t += dt;
  const f = Math.min(1,flight.t/flight.duration);
  flight.x = flight.fromX+(flight.toX-flight.fromX)*f;
  flight.y = flight.fromY+(flight.toY-flight.fromY)*f;
  const height=passHeight(flight,f);
  if (canPickPass(f,height) && flight.y>TOP && flight.y<BOTTOM && flight.x>=14 && flight.x<=946) {
    const defenders=defense().filter(p=>!p.stun && prizeSpeed(p)>0);
    const receiverDistance = Math.min(...offense().map(p=>dist(p,flight)));
    const pickers=defenders.filter(p=>{
      const timed = p.catchWindow>0;
      const bonus=hasPrize(p,'sneaky') ? 7 : 0;
      const range=dist(p,flight);
      if (timed && range<=23+bonus) return true;
      if (p.owner===null) {
        const reach=18+cpuSkill()*7+bonus;
        return range<=reach && (range<=9+cpuSkill()*4 || range<receiverDistance);
      }
      return f===1 && range<=12+bonus && range+4<receiverDistance;
    }).sort((a,b)=>dist(a,flight)-dist(b,flight));
    if (pickers.length) {
      flight = null;
      intercept(pickers[0]);
      return;
    }
  }
  if (f<1) return;
  const target = flight;
  flight = null;
  const catchRadius=target.manual ? 18 : 26;
  const near = offense().filter(p=>!p.stun && prizeSpeed(p)>0 && dist(p,target)<catchRadius+(hasPrize(p,'gloves') ? 17 : 0))
    .sort((a,b)=>dist(a,target)-dist(b,target))[0];
  if (!near || target.y<=TOP || target.y>=BOTTOM || target.x<14 || target.x>946) {
    finishPlay('incomplete',line);
    return;
  }
  if (passStats) passStats.receiver=statsFor(near);
  carrier = near;
  near.dodge = .15;
  burst(near.x,near.y,'#ffe29b',9);
  sound(760,.12);
}

function makePrizeCrate() {
  const d=direction();
  const offset=(12+Math.random()*12)*YARD;
  const forward=line+d*offset;
  const x=forward>LEFT+22 && forward<RIGHT-22 ? forward : line-d*offset;
  const y=Math.random()<.5 ? TOP+23 : BOTTOM-23;
  return {x:clamp(x,LEFT+22,RIGHT-22),y,at:1.15,expires:11,progress:0,claimer:null};
}

function updateCrate(dt) {
  if (!crate || elapsed<crate.at) return;
  if (elapsed>=crate.expires) {crate=null;return;}
  const nearby=players.filter(p=>!p.stun && dist(p,crate)<17).sort((a,b)=>dist(a,crate)-dist(b,crate));
  const claimant=nearby[0];
  const contested=claimant && nearby.some(p=>p.team!==claimant.team);
  if (!claimant || contested) {
    crate.progress=0;
    crate.claimer=null;
    return;
  }
  if (claimant!==crate.claimer) {
    crate.claimer=claimant;
    crate.progress=0;
  }
  crate.progress+=dt;
  if (crate.progress<CLAIM_TIME) return;
  const index=Math.floor(Math.random()*rewards.length);
  wheel={index,team:claimant.team,player:claimant,time:0,lastTick:-1,
    target:Math.PI*8-(index+.5)*Math.PI*2/rewards.length};
  crate=null;
  $('call').hidden=true;
  sound(523,.15);
}

function updateWheel(dt) {
  wheel.time+=dt;
  const fraction=clamp(wheel.time/WHEEL_SPIN,0,1);
  const tickIndex=Math.floor(wheelAngle(wheel)/(Math.PI*2/rewards.length));
  if (fraction<1 && tickIndex!==wheel.lastTick) {
    wheel.lastTick=tickIndex;
    sound(260,.045,'triangle');
  }
  if (wheel.time>=WHEEL_SPIN && !wheel.revealed) {
    wheel.revealed=true;
    [494,659,880].forEach((note,i)=>sound(note,.16,'triangle',i*.085));
  }
  if (wheel.time<WHEEL_SPIN+WHEEL_REVEAL) return;
  const reward=rewards[wheel.index];
  prize={reward,team:wheel.team,left:reward.seconds,shield:reward.key==='bubble' || reward.key==='pinball'};
  // Give the claimant a moment to react when play resumes.
  wheel.player.dodge=Math.max(wheel.player.dodge,.45);
  burst(wheel.player.x,wheel.player.y,reward.color,23,.75,96);
  say(reward.name.toUpperCase()+' · '+names[prize.team]);
  wheel=null;
}

function wheelAngle(spin) {
  const progress=clamp(spin.time/WHEEL_SPIN,0,1);
  return spin.target*(1-Math.pow(1-progress,3));
}

function hasPrize(p,key) {
  return prize?.team===p.team && prize.reward.key===key;
}

function prizeSpeed(p) {
  if (!prize) return 1;
  if (prize.team!==p.team) {
    if (prize.reward.key==='freeze') return 0;
    return prize.reward.key==='sludge' ? .72 : 1;
  }
  if (prize.reward.key==='turbo') return 1.22;
  if (p===carrier && prize.reward.key==='rocket') return 1.45;
  if (p===carrier && prize.reward.key==='pinball') return 1.28;
  return 1;
}

function cpuInterceptionPoint(ball) {
  const lowStart=1-Math.asin(13/passHeight(ball,.5))/Math.PI;
  const progress=clamp(ball.t/ball.duration+.035,(1+lowStart)/2,1);
  return {x:ball.fromX+(ball.toX-ball.fromX)*progress,
    y:clamp(ball.fromY+(ball.toY-ball.fromY)*progress,TOP+6,BOTTOM-6)};
}

function cpuMove(p) {
  const d = direction(), onOffense = p.team === team;
  let x, y;
  const point = flight && (onOffense ? {x:flight.toX,y:flight.toY} : cpuInterceptionPoint(flight));
  const rushers = playCall.rushers, slot=role(p);
  if (p===carrier && slot===1 && runningPlay(playCall) && elapsed<1.05) {
    ({x,y}=runTarget(playCall));
  } else if (p === carrier && (p !== qb() || passed || elapsed > 1.55 || playCall.kind==='keeper')) {
    const candidates = [-75,-38,0,38,75].map(offset=>({
      x:p.x+d*58, y:clamp(p.y+offset,TOP+14,BOTTOM-14), offset
    }));
    const danger = defense().filter(rival=>!rival.stun && dist(p,rival)<142);
    const safety = lane => {
      const clearance = Math.min(105,...danger.map(rival=>Math.min(dist(rival,lane),
        Math.hypot(rival.x-(lane.x+p.x)/2,rival.y-(lane.y+p.y)/2)+8)));
      return clearance-Math.abs(lane.offset)*.23;
    };
    const lane=candidates.sort((a,b)=>safety(b)-safety(a))[0];
    ({x,y}=lane);

  } else if (p === carrier) {
    x = clamp(line-d*(playCall.kind==='quick' ? 42 : 55),LEFT+8,RIGHT-8);
    y = MID+playCall.side*Math.min(49,elapsed*37);
  } else if (onOffense && point && (flight.manual ? dist(p,point)<34 : p===flight.receiver && dist(p,point)<100)) {
    ({x,y}=point);
  } else if (onOffense && carrier && (returning || carrier!==qb() || d*(carrier.x-line)>0)) {
    const threats = defense().filter(r=>r.stun<=0).sort((a,b)=>dist(a,carrier)-dist(b,carrier));
    const threat = threats[slot%Math.min(threats.length,4)] || carrier;
    x = threat.x;
    y = threat.y;
  } else if (protectingPocket(p)) {
    const rush=defense().slice(0,rushers).filter(rival=>!rival.stun)
      .sort((a,b)=>dist(a,p)-dist(b,p))[0];
    x=rush ? rush.x-d*7 : carrier.x+d*22;
    y=rush ? rush.y : carrier.y+(slot===2 ? -21 : 21);
  } else if (onOffense) {
    if (slot===1 && carrier===qb() && runningPlay(playCall) && elapsed<.72) {
      x=qb().x-d*12;
      y=qb().y+playCall.side*22;
    } else ({x,y}=routeTarget(playCall,slot,elapsed));
  } else if (point && defense().filter(r=>r.owner===null && !r.stun)
    .sort((a,b)=>dist(a,point)-dist(b,point)).slice(0,2).includes(p)) {
    x=point.x;
    y=point.y;
  } else if (carrier && (returning || carrier!==qb() || passed || d*(carrier.x-line)>0 || slot<rushers)) {
    const range = dist(p,carrier);
    const lead=clamp(range/240,.06,.48)*(.30+.70*cpuSkill());
    const chasing = d*(carrier.x-p.x)>0;
    const angle=!chasing && range>65 && slot>=2 ? (slot%2 ? -1 : 1)*24 : 0;
    x = carrier.x+carrier.vx*lead;
    y = clamp(carrier.y+carrier.vy*lead+angle,TOP+6,BOTTOM-6);
  } else {
    const mark=offense()[slot];
    x = clamp(mark.x+mark.vx*.2+d*(slot>=5 ? 32 : 17),20,940);
    y = mark.y+mark.vy*.15;
  }
  if (crate && elapsed>=crate.at && !flight && dist(p,crate)<62 &&
    (p===carrier || slot>=5) && !defense().some(rival=>p.team===team && dist(p,rival)<23)) {
    ({x,y}=crate);
  }
  const range = Math.hypot(x-p.x,y-p.y);
  if (range<=4) return empty;
  const closing=carrier && (p===carrier
    ? cpuDifficulty>=4 && defense().some(r=>!r.stun && dist(p,r)<31)
    : !onOffense && !carrier.dodge && dist(p,carrier)<(16+13*cpuSkill()) && (slot<rushers || !inPocket() || elapsed>1.65));
  const chaseDash=!onOffense && cpuDifficulty>=8 && carrier && !inPocket() &&
    d*(carrier.x-p.x)>30 && dist(p,carrier)<62;
  return {x:(x-p.x)/range,y:(y-p.y)/range,edge:[false,!onOffense && closing,onOffense ? closing : chaseDash]};
}

function updateGrapple(p,input,x,y,dt) {
  p.grappleCooldown=Math.max(0,p.grappleCooldown-dt);
  p.grapple=Math.max(0,p.grapple-dt);
  if (p.team===team || p.stun || prizeSpeed(p)===0) {
    p.grip=null;
    p.gripTime=0;
    return;
  }
  if (input.edge?.[1] && !p.grappleCooldown) {
    p.grapple=GRAPPLE_TIME;
    p.grappleCooldown=GRAPPLE_COOLDOWN;
  }
  if (!p.grapple || (p.owner!==null && !input.buttons?.[1])) {
    p.grip=null;
    p.gripTime=0;
    return;
  }
  const magnitude=Math.hypot(x,y);
  const fx=magnitude>.15 ? x/magnitude : p.fx;
  const fy=magnitude>.15 ? y/magnitude : p.fy;
  const reach=hasPrize(p,'sneaky') ? 49 : 42;
  if (!p.grip || p.grip.dodge || dist(p,p.grip)>reach+13) {
    p.grip=offense().filter(target=>{
      if (target.dodge || (p.owner===null && target!==carrier)) return false;
      const range=dist(p,target);
      return range<reach && (range<6 || (fx*(target.x-p.x)+fy*(target.y-p.y))/range>.44);
    }).sort((a,b)=>dist(p,a)-dist(p,b))[0] || null;
    p.gripTime=0;
  }
  if (!p.grip) return;
  const target=p.grip;
  target.grabbed=.17;
  const range=dist(p,target);
  if (range>13) {
    const pull=Math.min(range-13,dt*(target===carrier ? 34 : 19));
    target.x+=(p.x-target.x)*pull/range;
    target.y+=(p.y-target.y)*pull/range;
  }
  if (p.gripTime===0) {
    burst(target.x,target.y,'#ffe093',8,.38,60);
    sound(190,.09,'triangle');
  }
  p.gripTime+=dt;
  if (target===carrier) return;
  if (flight && direction()*(target.x-line)>0 &&
    dist(target,{x:flight.toX,y:flight.toY})<60 && p.gripTime>=.08) {
    flagDefense('PASS INTERFERENCE',target.x,target.y);
  } else if (p.gripTime>=.31) flagDefense('DEFENSIVE HOLDING',target.x,target.y);
}

function move(p,dt) {
  p.stun = Math.max(0,p.stun-dt);
  p.dive = Math.max(0,p.dive-dt);
  p.grabbed=Math.max(0,p.grabbed-dt);
  p.dodge = Math.max(0,p.dodge-dt);
  p.cool = Math.max(0,p.cool-dt);
  p.boost = Math.max(0,p.boost-dt);
  p.slip = Math.max(0,p.slip-dt);
  p.catchWindow = Math.max(0,p.catchWindow-dt);
  const input = p.owner===null ? cpuMove(p) : control(p);
  let {x,y} = input;
  const size = Math.max(1,Math.hypot(x,y));
  x /= size;
  y /= size;
  const rewardSpeed=prizeSpeed(p);
  updateGrapple(p,input,x,y,dt);
  if (p.stun || rewardSpeed===0) {p.aim=null;p.vx=0;p.vy=0;return;}
  const trapped=pocketClosed(p);
  if (trapped) {p.aim=null;p.dive=0;p.dodge=0;}
  const defending=p.team!==team;
  if (input.edge?.[2] && !trapped && !p.aim && p.cool===0 &&
    (defending || p!==qb() || returning || elapsed>=2)) {
    p.dive=defending ? DEFENSE_DASH_TIME : DASH_TIME;
    p.cool=defending ? 1.55 : p===carrier ? (hasPrize(p,'jukes') ? .65 : 1.45) : 1.05;
    if (p===carrier) p.dodge=hasPrize(p,'jukes') ? .60 : .41;
    burst(p.x,p.y,p.dodge ? colors[p.team] : '#dee8bf',7,.35,56);
    if (p.dodge) sound(175,.09);
  }
  if (flight && p.team!==team && input.edge?.[0]) p.catchWindow=.31;
  if (p===carrier) {
    if (p.owner!==null) updateAim(p,input,dt);
    if (input.edge?.[3] && p===carrier) handoff(p);
  } else if (p.team===team && input.edge?.[0]) {
    p.call=simTime;
  }
  if (p.aim) {x=0;y=0;}
  else if (p.dive && Math.hypot(x,y)<.1) {x=p.fx;y=p.fy;}
  const pursuing = carrier && p.team!==team;
  const openField = pursuing && (returning || passed || carrier!==qb() || direction()*(carrier.x-line)>0);
  const normalSpeed=p.owner===null ? 106 : 128;
  const pocketRush=pursuing && inPocket() && direction()*(p.x-line)<27;
  const rushSpeed=normalSpeed*(.56+.44*clamp((elapsed-1.05)/.72,0,1));
  const base=p===carrier ? 105 : openField ? 135 : pocketRush ? rushSpeed : normalSpeed;
  const sprint = p.team===team && input.buttons?.[1] ? (p===carrier ? 1.19 : 1.23) : 1;
  const moveScale=trapped ? .62 : p.dive ? (defending ? 1.67 : p===carrier ? 1.79 : 1.84) : p.grabbed && !p.dodge ? .36 : p.grip ? .92 : 1;
  const cpuPace=p.owner===null ? .69+.31*cpuSkill() : 1;
  const speed = base*sprint*(p.boost ? 1.65 : 1)*moveScale*rewardSpeed*cpuPace;
  const slippery=p.slip || (prize?.reward.key==='gremlins' && p.team!==prize.team);
  const steering = slippery && !p.aim ? Math.min(1,dt*1.6) : 1;
  p.vx+=(x*speed-p.vx)*steering;
  p.vy+=(y*speed-p.vy)*steering;
  p.x=clamp(p.x+p.vx*dt,15,945);
  p.y=clamp(p.y+p.vy*dt,p===carrier ? TOP-3 : TOP+6,p===carrier ? BOTTOM+3 : BOTTOM-6);
  if (Math.hypot(x,y)>.09) {
    const previous=Math.floor(p.step);
    p.fx=x;p.fy=y;p.step+=dt*(p.dive ? 24 : 14);
    if (Math.floor(p.step)!==previous && (p.dive || p.boost || rewardSpeed>1 || input.buttons?.[1])) {
      burst(p.x-9*x,p.y-9*y,p.boost || rewardSpeed>1 ? '#ffbf62' : '#afc59c',2,.25,35);
    }
  }
  if (hazard && !hazard.duck && dist(p,hazard)<34) {
    if (!p.slip) burst(p.x,p.y,'#d4926d',6,.46,63);
    p.slip=.65;
  }
  for (const wall of walls) {
    const range=dist(p,wall);
    if (range<25 && range>0) {
      p.x=wall.x+(p.x-wall.x)*25/range;
      p.y=wall.y+(p.y-wall.y)*25/range;
    }
  }
}

function tick(dt) {
  if (state!=='playing') return;
  if (wheel) {updateWheel(dt);return;}
  between += dt;
  if (phase==='halftime') {
    if (between>=halftime.length) {
      halftime=null;
      firstHalfHighlights=[];
      quarter=3;
      time=QUARTER_SECONDS;
      prize=null;
      openKickoff(1);
    }
    return;
  }
  if (phase==='try') {
    const captain = qb(), input = control(captain);
    const auto = captain.owner===null && between>2.25;
    const gap = score[1-team]-score[team];
    const goForTwo = auto && (gap===2 || gap===5 || Math.random()<.25);
    if (input.edge[0] || (auto && goForTwo)) {
      tryMode = 'two';
      snap();
      updateScore();
      say('TWO-POINT TRY · BALL LIVE');
    } else if (input.edge[3] || auto) beginKick('pat');
    return;
  }
  if (phase==='kickMeter') {
    const captain=qb();
    if (control(captain).edge[3] && between>.12) launchKick(meterPosition());
    else if (captain.owner===null && between>.82) {
      const span=kickMeter.kind==='fg' ? .39 : kickMeter.kind==='pat' ? .22 : .31;
      launchKick(.5+(Math.random()-.5)*span*(1.55-.55*cpuSkill()));
    }
    return;
  }
  if (phase==='kickFlight') {
    const {coverage,duration}=kickFlight;
    if (coverage) {
      const fraction=Math.min(1,between/duration);
      for (const lane of coverage) {
        const p=lane.player;
        p.x=lane.fromX+(lane.x-lane.fromX)*fraction;
        p.y=lane.fromY+(lane.y-lane.fromY)*fraction;
        p.fx=Math.sign(lane.x-lane.fromX)||p.fx;
        p.step+=dt*14;
      }
    }
    if (between>=duration) resolveKick();
    return;
  }
  if (phase==='dead') {
    const stopTime=(flagScene ? REF_SEQUENCE : 0)+(touchdownScene ? TOUCHDOWN_REPLAY+TOUCHDOWN_SHOW : 0);
    if (between<(stopTime || 1.65)) return;
    flagScene=null;
    touchdownScene=null;
    if (tryMode==='retry') {openTry(spot);return;}
    if (tryMode==='pending') {openTry();return;}
    if (time<=0) {
      if (quarter===4) {finalWhistle();return;}
      if (quarter===2) {openHalftime();return;}
      quarter++;
      time=QUARTER_SECONDS;
      say('START OF Q'+quarter);
    }
    if (kickoffNext!==null) {openKickoff(kickoffNext);return;}
    setFormation();
    between=0;
    return;
  }
  if (phase==='ready') {
    const captain = qb();
    const input = control(captain);
    const auto = captain.owner===null && between>1.55;
    const inRange = Math.abs(endzone()-line)/YARD+17<=48;
    const needsTouchdown = quarter===4 && time<30 && score[1-team]-score[team]>3;
    const shouldKick = down===4 && (inRange ? !needsTouchdown && Math.abs(goal-spot)>12
      : !needsTouchdown && Math.abs(goal-spot)>32);
    selectCalls();
    if ((input.edge[0] || input.edge[3]) && puntSelected()) kick(true);
    else if (input.edge[3] || (auto && shouldKick)) kick();
    else if (input.edge[0] || auto) snap();
    return;
  }
  elapsed+=dt;
  const ball=carrier || flight;
  if (ball) {
    const cue=clamp(ball.x-direction()*18,120,840);
    official.x+=clamp(cue-official.x,-dt*80,dt*80);
  }
  if (prize) {
    prize.left-=dt;
    if (prize.left<=0) prize=null;
  }
  if (!tryMode) time=Math.max(0,time-dt);
  if (hazard?.duck) {
    hazard.y+=dt*126;
    const bumped=players.find(p=>dist(p,hazard)<18);
    if (bumped && !hazard.triggered) {
      hazard.triggered=true;
      bumped.stun=.32;
      burst(bumped.x,bumped.y,'#fff1b5',13,.55,75);
      say('QUACK!  DUCK INTERFERENCE');
      sound(143,.14,'triangle');
    }
  }
  // Give each defense the same view of the runner's current movement.
  for (const p of offense()) move(p,dt);
  for (const p of defense()) move(p,dt);
  recordReplay();
  updateCrate(dt);
  if (wheel) {
    $('clock').textContent='0:'+String(Math.ceil(time)).padStart(2,'0');
    return;
  }
  if (updatePocketPressure(dt)) {
    $('clock').textContent='0:'+String(Math.ceil(time)).padStart(2,'0');
    return;
  }
  if (carrier===qb() && runningPlay(playCall) && elapsed>=.22 && elapsed<.72 && !carrier.aim) handoff(carrier);
  if (carrier===qb() && carrier.owner===null && prizeSpeed(carrier)>0 && canPass(carrier) &&
    (!runningPlay(playCall) || elapsed>=.72)) {
    const requested=offense().some(p=>simTime-p.call<.8 && p!==carrier);
    const pressure=defense().some(p=>!p.stun && dist(p,carrier)<52);
    if (elapsed>.38 && requested) pass(carrier);
    else if (!rally && playCall.kind!=='keeper' && (pressure || elapsed>({quick:.64,cross:.92,deep:1.16}[playCall.kind] || 1.16))) {
      pass(carrier);
      rally=passed;
    }
  }
  for (const p of offense()) {
    if (p===carrier || p.stun || p===qb() || prizeSpeed(p)===0) continue;
    const protecting=protectingPocket(p);
    const block=defense().find(other=>other.stun<=0 && other.cool<=0 &&
      dist(p,other)<(protecting ? 22 : 17) && (protecting || !carrier || dist(carrier,other)>22 || (p.owner!==null && p.dive)));
    if (block) {block.stun=protecting ? .50 : .37;block.cool=.9;}
  }
  if (flight) {
    for (const p of defense()) p.contact=0;
    updateFlight(dt);
  }
  if (phase==='live' && carrier) {
    if (returnTouchback && direction()*(carrier.x-(team===0 ? LEFT : RIGHT))>0) returnTouchback=false;
    if (direction()*(carrier.x-endzone())>=0) finishPlay('score',carrier.x);
    else if (carrier.y<=TOP || carrier.y>=BOTTOM) finishPlay('out',carrier.x);
    else if (elapsed>.18) {
      let tackler=null;
      for (const p of defense()) {
        const reach=(p.grip===carrier ? 20 : p.dive ? 17 : 15)+(hasPrize(p,'sneaky') ? 5 : 0);
        const contact=!p.stun && !carrier.dodge && prizeSpeed(p)>0 && dist(p,carrier)<reach;
        p.contact=contact ? p.contact+dt : 0;
        const required=CONTACT_TIME+(p.owner===null ? .15*(1-cpuSkill()) : 0);
        if (p.contact>=required && !tackler) tackler=p;
      }
      if (tackler && !carrier.dodge) {
        const teamShield=prize?.team===carrier.team && prize.shield;
        if (carrier.shield || teamShield) {
          carrier.shield=false;
          if (teamShield) prize.shield=false;
          carrier.dodge=.52;
          tackler.contact=0;
          tackler.stun=.65;
          say('POP! BUBBLE WRAP SAVES THE DAY');
          sound(110,.2);
        } else {
          burst(carrier.x,carrier.y,'#f8efc4',16,.52,112);
          impact=.18;
          finishPlay('tackle',carrier.x,tackler);
        }
      }
    }
  }
  if (phase==='live' && elapsed>=17) finishPlay(carrier?'timer':'incomplete',carrier?.x ?? line);
  $('clock').textContent = '0:'+String(Math.ceil(time)).padStart(2,'0');
}

function rect(x,y,w,h,color) {
  ctx.fillStyle=color;
  ctx.fillRect(Math.round(x),Math.round(y),w,h);
}

function label(value,x,y,size,color,align='center') {
  ctx.font='bold '+size+'px Menlo, monospace';
  ctx.fillStyle=color;
  ctx.textAlign=align;
  ctx.fillText(value,Math.round(x),Math.round(y));
}

const field=document.createElement('canvas');
field.width=960;field.height=432;
function drawField() {
  rect(0,0,960,432,'#102724');
  for (let i=0;i<1200;i++) {
    const x=(i*73+i*i*13)%960, y=(i*173+i*i*7)%432;
    rect(x,y,2,2,i%2?'#243e34':'#091b1b');
  }
  rect(14,TOP,932,BOTTOM-TOP,'#207259');
  rect(14,TOP,66,BOTTOM-TOP,'#93463e');
  rect(RIGHT,TOP,66,BOTTOM-TOP,'#287687');
  for (let i=0;i<10;i++) {
    const x=LEFT+i*80;
    rect(x,TOP,80,BOTTOM-TOP,i%2?'#206b54':'#25735a');
    rect(x,TOP,2,BOTTOM-TOP,'#a8cab38a');
    if (i>0 && i!==5) {
      const n=String(Math.min(i,10-i)*10);
      label(n,x,TOP+39,19,'#9fcaac');
      label(n,x,BOTTOM-24,19,'#9fcaac');
    }
  }
  for (let i=1;i<100;i++) {
    const x=LEFT+i*8;
    rect(x,MID-63,1,6,'#a1bda88f');
    rect(x,MID+57,1,6,'#a1bda88f');
  }
  ctx.save();
  for (const [i,x] of [48,914].entries()) {
    ctx.translate(x,MID);
    ctx.rotate(i===0?-Math.PI/2:Math.PI/2);
    label(names[i],0,8,21,'#fff4df');
    ctx.resetTransform();
  }
  ctx.restore();
  rect(14,TOP,932,2,'#e1e7c7');
  rect(14,BOTTOM,932,2,'#e1e7c7');
  rect(LEFT,TOP,3,BOTTOM-TOP,'#e1e7c7');
  rect(RIGHT,TOP,3,BOTTOM-TOP,'#e1e7c7');
  label('ϟ',480,239,73,'#acd9b858');
  label('HOT DOGS  ▶',16,26,12,colors[0],'left');
  label('◀  TURBO TOADS',945,26,12,colors[1],'right');
  label('BLITZ 7 FIELD',480,411,12,'#9cbbaf');
  for (const x of [13,944]) for (const y of [TOP,BOTTOM]) rect(x,y-2,5,5,'#faab57');
  field.getContext('2d').drawImage(canvas,0,0);
}

function burst(x,y,color,count,life=.55,speed=80) {
  for (let i=0;i<count;i++) {
    const angle=Math.random()*Math.PI*2, velocity=speed*(.35+Math.random()*.65);
    particles.push({x,y,vx:Math.cos(angle)*velocity,vy:Math.sin(angle)*velocity,
      color:i%6===0 ? '#fff3c9' : i%5===0 ? '#ffd16b' : color,
      life:life*(.6+Math.random()*.4),size:2+Math.floor(Math.random()*4)});
  }
}

function updateEffects(dt) {
  impact=Math.max(0,impact-dt);
  for (const p of particles) {
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    p.vy+=34*dt;
    p.life-=dt;
  }
  particles=particles.filter(p=>p.life>0);
}

function drawHazard() {
  if (!hazard) return;
  const {duck,x,y}=hazard;
  if (y>BOTTOM+9) return;
  if (duck) {
    const flap=Math.sin(simTime*25)>0?2:0;
    rect(x-9,y+3,19,7,'#102a2477');
    rect(x-10,y-4,17,11,'#e9a93d');
    rect(x-8,y-6,17,10,'#ffda63');
    rect(x+3,y-12,9,10,'#ffe98b');
    rect(x+11,y-7,5,3,'#fa884a');
    rect(x+8,y-11,2,2,'#23312c');
    rect(x-8,y-3+flap,10,3,'#ecb74e');
  } else {
    rect(x-26,y-12,52,24,'#583c58aa');
    rect(x-20,y-16,41,32,'#9c656a');
    rect(x-12,y-10,30,16,'#c2837b');
    rect(x-15,y-10,9,3,'#e7ad97');
    rect(x+17,y+9,10,5,'#d69c86');
    label('SODA',x,y+5,9,'#faf0ba');
  }
}

function drawKickMeter() {
  const width=240, x=360, y=318;
  const {half,kind,distance}=kickMeter;
  rect(x-15,y-31,width+30,66,'#172124f4');
  label(kind==='fg' ? distance+' YD FIELD GOAL' : kickTitle(kind),480,y-11,13,'#fff3ce');
  rect(x,y,width,13,'#506369');
  rect(x+width*(.5-half),y,width*half*2,13,'#fdce65');
  if (kind==='kickoff') rect(x+width*(.5-KICKOFF_SWEET_SPOT),y,width*KICKOFF_SWEET_SPOT*2,13,'#fff0a0');
  rect(x+width*meterPosition()-2,y-3,4,19,'#fff');
  label(qb().owner===null ? 'CPU KICKING' : 'I / TOP TO STRIKE',480,y+28,11,'#ffe093');
}

function drawKickFlight() {
  const {kind,x,target,y,duration}=kickFlight;
  const f=Math.min(1,between/duration);
  if (kind!=='kickoff') {
    const arm=target>480 ? -15 : 0;
    rect(target-2,MID-33,4,66,'#fbe093');
    rect(target+arm,MID-33,15,3,'#fbe093');
    rect(target+arm,MID+30,15,3,'#fbe093');
  }
  const ball = progress => ({
    x:x+(target-x)*progress,
    y:MID+(y-MID)*progress-Math.sin(progress*Math.PI)*(kind==='kickoff' ? 118 : 88)
  });
  const current=ball(f);
  for (let i=3;i>0;i--) {
    const past=ball(Math.max(0,f-i*.034));
    rect(past.x,past.y,3,3,'#ffdf876f');
  }
  rect(current.x-6,current.y-4,13,8,'#663b30');
  rect(current.x-4,current.y-3,8,5,'#ecab60');
  rect(current.x-2,current.y-1,4,2,'#fff6d3');
}

function drawRoute(points,color,dash=[]) {
  const tip=points.at(-1), start=points.at(-2);
  const length=dist(tip,start);
  if (length<3) return;
  const dx=(tip.x-start.x)/length, dy=(tip.y-start.y)/length;
  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=2.5;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(points[0].x,points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x,point.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(tip.x-dx*10-dy*5,tip.y-dy*10+dx*5);
  ctx.lineTo(tip.x,tip.y);
  ctx.lineTo(tip.x-dx*10+dy*5,tip.y-dy*10-dx*5);
  ctx.stroke();
  ctx.restore();
}

function playRoutes(index,starts) {
  const d=direction(), [passer,back]=starts;
  const call=plays[index];
  if (!call) return [{points:[passer,{x:clamp(line+d*310,21,939),y:MID}],type:'kick'}];
  const routes=[], run=runningPlay(call), roster=offense();
  for (let slot=1;slot<roster.length;slot++) {
    if (run && slot===1) continue;
    const start=starts[slot];
    if (roster[slot].owner===null && (slot===2 || slot===4) && !run && call.kind!=='keeper') {
      routes.push({points:[start,{x:clamp(line+d*18,20,940),y:start.y}],type:'block'});
    } else routes.push({points:[start,routeTarget(call,slot,.37),routeTarget(call,slot,1.16)],type:'route'});
  }
  if (run) {
    const exchange={x:passer.x-d*12,y:passer.y+call.side*22};
    routes.push({points:[passer,exchange],type:'exchange'},{points:[back,exchange,runTarget(call)],type:'run'});
  } else if (call.kind==='keeper') {
    routes.push({points:[passer,{x:clamp(line+d*95,20,940),y:MID}],type:'run'});
  }
  return routes;
}

function drawPlayRoutes() {
  const colorsByType={kick:'#ffd673',block:'#c4d3b699',route:colors[team]+'ca',exchange:'#fff0b0',run:'#ffda6f'};
  const dashByType={kick:[7,5],block:[3,4],exchange:[3,3]};
  for (const {points,type} of playRoutes(playIndex,offense())) {
    drawRoute(points,colorsByType[type],dashByType[type]);
  }
}

function drawPassAim(p) {
  const target=passTarget(p);
  const {x,y}=p.aim;
  const tip={x:target.x,y:target.y};
  const color=target.assisted ? '#bafdaf' : target.power>=1 ? '#ffae58' : '#ffe177';
  const dart=12;
  ctx.beginPath();
  ctx.moveTo(p.x+x*16,p.y+y*16);
  ctx.lineTo(tip.x,tip.y);
  ctx.lineTo(tip.x-x*dart-y*6,tip.y-y*dart+x*6);
  ctx.moveTo(tip.x,tip.y);
  ctx.lineTo(tip.x-x*dart+y*6,tip.y-y*dart-x*6);
  ctx.strokeStyle=color;
  ctx.lineWidth=2;
  ctx.stroke();
  if (target.assisted) {
    ctx.beginPath();
    ctx.arc(tip.x,tip.y,8,0,Math.PI*2);
    ctx.stroke();
  }
  rect(p.x-19,p.y+21,38,5,'#15262b');
  rect(p.x-18,p.y+22,36*target.power,3,color);
}

function sprite(p) {
  const x=p.x, y=p.y-(p.rise || 0)-(p.dive ? Math.sin(p.dive/DASH_TIME*Math.PI)*8 : Math.abs(Math.sin(p.step*1.5))*1.7);
  const color=colors[p.team], shade=dark[p.team], stride=Math.sin(p.step*1.5)>0?3:-2;
  rect(x-11,y+6,22,5,'#102a24a0');
  if (p.label) {
    rect(x-12,y+12,24,2,color);
    rect(x-6,y+14,12,2,color);
  }
  if (p.boost) {rect(x-15*p.fx-3,y-2,7,4,'#ffdc64');rect(x-23*p.fx-3,y+2,5,2,'#ff8d59');}
  if (p.shield || (p===carrier && prize?.team===p.team && prize.shield)) {
    ctx.strokeStyle='#f8e39c';
    ctx.lineWidth=2;
    ctx.strokeRect(x-14,y-14,28,27);
  }
  rect(x-9,y-7,18,14,'#192126');
  rect(x-12,y-4,24,8,shade);
  rect(x-9,y-5,18,10,color);
  const boots=bootColors[p.profile?.boot ?? 0];
  rect(x-6,y+4,4,3+stride,'#ede9d2');
  rect(x+3,y+4,4,3-stride,'#ede9d2');
  rect(x-7,y+6+stride,6,4,boots);
  rect(x+2,y+6-stride,6,4,boots);
  rect(x-7,y-13,14,9,'#1b2428');
  const accent=p.accent || window.couchJoinstick?.profile?.(p.owner)?.accent;
  rect(x-6,y-14,12,8,(!p.profile?.customHelmet && accent) || helmetColors[p.profile?.helmet ?? 0]);
  rect(x-2,y-14,4,8,color);
  rect(x+(p.fx<0?-7:3),y-10,5,4,'#26323a');
  if (p.stun) {
    label('✦',x+Math.cos(simTime*10)*13,y-12+Math.sin(simTime*10)*3,12,'#fce16c');
    label('·',x-Math.cos(simTime*10)*13,y-13,12,'#fff1ad');
  }
  if (p.label && p.grappleCooldown>0) {
    rect(x-10,y+17,20,2,'#253235');
    rect(x-10,y+17,20*(1-p.grappleCooldown/GRAPPLE_COOLDOWN),2,'#f4c96d');
  }
  if (p.grip) {
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(p.grip.x,p.grip.y);
    ctx.strokeStyle='#ffe0a0';
    ctx.lineWidth=2;
    ctx.stroke();
  }
  if (p.catchWindow && flight) label('↑',x+12,y-11,13,'#ffe079');
  if (p.slip) rect(x-8,y+7,16,2,'#f3be8f');
  if (p.label) {
    const tag=p.replayCarrier===undefined && state!=='menu' && p===qb() && (phase==='ready' || phase==='live' && !returning) ? p.label+' QB' : p.label;
    const w=tag.length*7+5;
    rect(x-w/2,y-29,w,12,'#172426');
    label(tag,x,y-19,10,color);
  }
  if (p.replayCarrier ?? (carrier===p)) {
    rect(x+8,y-2,8,5,'#74412f');
    rect(x+10,y-1,4,2,'#fcefca');
    label('▼',x,y-(p.label?32:20),13,'#ffe06d');
  }
}

function updateLobby(dt) {
  const difficulty=String(cpuDifficulty);
  if ($('cpu-difficulty').textContent!==difficulty) {
    $('cpu-difficulty').textContent=difficulty;
    $('cpu-level').value=cpuDifficulty;
  }
  const humans=players.filter(p=>p.profile);
  for (const p of humans) {
    const {profile}=p;
    profile.position ||= {x:p.team===0 ? 260 : 700,y:84+p.slot*44,step:0,fx:p.team===0 ? 1 : -1};
    const position=profile.position;
    let input=control(p);
    if (p.owner==='keyboard' && canStartFrom('keyboard')) {
      const adjusting=keys.has('KeyR');
      adjustCpuDifficulty(keyboardProfile,adjusting ? input.y : 0,performance.now());
      if (adjusting) input={...input,x:0,y:0};
    }
    const magnitude=Math.hypot(input.x,input.y);
    const speed=145*dt/Math.max(1,magnitude);
    position.x=clamp(position.x+input.x*speed,40,920);
    position.y=clamp(position.y+input.y*speed,TOP+29,BOTTOM-13);
    if (magnitude>.05) {
      position.step+=dt*15;
      position.fx=input.x || position.fx;
    }
    const badge=p.owner==='keyboard' || (!input.edge[0] && !input.edge[2]) ? null : $('lobby-roster').querySelector('[data-controller="'+p.owner+'"]');
    if (input.edge[2]) {
      profile.helmet=(profile.helmet+1)%helmetColors.length;
      profile.customHelmet=true;
      const color=helmetColors[profile.helmet];
      badge?.style.setProperty('--helmet',color);
      burst(position.x,position.y-7,color,10,.43,56);
      sound(620+profile.helmet*39,.09);
    }
    if (input.edge[0]) {
      profile.boot=(profile.boot+1)%bootColors.length;
      const color=bootColors[profile.boot];
      badge?.style.setProperty('--boots',color);
      burst(position.x,position.y+9,color,10,.43,56);
      sound(470+profile.boot*34,.09);
    }
    Object.assign(p,position,{dive:0,shield:false,boost:0,stun:0,grapple:0,grappleCooldown:0,grip:null,catchWindow:0,slip:0});
  }
  const captain=humans.find(p=>canStartFrom(p.owner));
  const caption=humans.length ? humans.length+'/14 JOINED · '+captain.label+' STARTS' : 'PRESS BOTTOM FACE BUTTON TO JOIN';
  const hint=captain?.owner==='keyboard' ? 'Enter or I' : captain ? 'Top face button or Start' : 'Click the field if your controller does not respond';
  if ($('lobby-host').textContent!==hint) $('lobby-host').textContent=hint;
  if (caption!==liveStatus) {
    liveStatus=caption;
    $('status').textContent='● '+caption;
    $('lobby-start').textContent=captain ? captain.label+' · START MATCH' : 'START CPU MATCH';
  }
  if (captain?.owner==='keyboard' && control(captain).edge[3]) start();
}

function drawLobby() {
  ctx.drawImage(field,0,0);
  rect(350,169,260,85,'#174b3ce8');
  label('PLAYER LOBBY',480,204,25,'#fff1bb');
  label('FIND YOUR PLAYER · TRY YOUR CONTROLS',480,229,11,'#c6e4c3');
  for (const p of players.filter(p=>p.profile).sort((a,b)=>a.y-b.y)) {
    sprite(p);
    if (canStartFrom(p.owner)) label('★',p.x,p.y-33,13,'#ffd470');
  }
  if (!reducedMotion?.matches) {
    for (const p of particles) rect(p.x,p.y,p.size,p.size,p.color);
  }
}

function drawPrizeWheel() {
  const {index,team,revealed}=wheel;
  const reward=rewards[index];
  const angle=reducedMotion?.matches && !revealed ? 0 : wheelAngle(wheel);
  const x=335, y=221, radius=143, slice=Math.PI*2/rewards.length;
  rect(0,0,960,432,'#0b171bd9');
  rect(171,52,618,330,'#1a272b');
  rect(171,52,618,3,'#f9d477');
  for (const [i,option] of rewards.entries()) {
    const begin=angle-Math.PI/2+i*slice;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.arc(x,y,radius,begin,begin+slice);
    ctx.closePath();
    ctx.fillStyle=option.color;
    ctx.fill();
    ctx.strokeStyle='#1a272b';
    ctx.lineWidth=2;
    ctx.stroke();
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(begin+slice/2);
    label(option.wedge,101,4,10,'#142529');
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(x,y,25,0,Math.PI*2);
  ctx.fillStyle='#1a272b';
  ctx.fill();
  label('7',x,y+9,22,'#fbd16a');
  label('▼',x,y-radius+5,26,'#fff6df');
  label('PRIZE WHEEL',511,114,24,'#ffe08b','left');
  label(names[team]+' CLAIMED IT',511,143,13,colors[team],'left');
  label(revealed ? reward.name.toUpperCase() : 'SPINNING…',511,215,21,revealed ? reward.color : '#fff6df','left');
  if (revealed) {
    const words=reward.detail.split(' ');
    let row='', rowY=242;
    for (const word of words) {
      if ((row+' '+word).length>34) {
        label(row,511,rowY,11,'#d1dfd8','left');
        row=word;
        rowY+=17;
      } else row=row ? row+' '+word : word;
    }
    if (row) label(row,511,rowY,11,'#d1dfd8','left');
    label(reward.seconds+' SECONDS OF LIVE PLAY',511,315,11,'#ffe08b','left');
  }
  label('PLAY PAUSED',511,350,11,'#abbbbb','left');
}

function refAnnouncing() {
  return flagScene && between>=REPLAY_TIME && between<REF_SEQUENCE;
}

function drawOfficial() {
  const {x,y}=official;
  const acting=refAnnouncing();
  const age=between-REPLAY_TIME;
  const cue=acting ? clamp((age-.22)*3,0,1) : 0;
  const signal=acting && !reducedMotion?.matches ? cue*(.82+.18*Math.sin(age*9)) : cue;
  rect(x-10,y+9,21,4,'#10272499');
  rect(x-7,y-5,14,13,'#20282d');
  for (let i=0;i<3;i++) rect(x-6+i*5,y-4,2,10,'#f4f1da');
  rect(x-6,y+8,4,5,'#20282d');
  rect(x+2,y+8,4,5,'#20282d');
  rect(x-5,y-12,10,6,'#dfaf83');
  rect(x-6,y-15,12,5,'#fcf7df');
  rect(x-4,y-16,8,2,'#e1dac5');
  ctx.beginPath();
  ctx.moveTo(x-6,y-3);
  ctx.lineTo(x-9-10*signal,y+3-12*signal);
  ctx.moveTo(x+6,y-3);
  const right=flagScene?.title==='DEFENSIVE HOLDING';
  ctx.lineTo(x+9+(right ? -8 : 10)*signal,y+3-12*signal);
  ctx.lineWidth=3;
  ctx.strokeStyle='#f4f1da';
  ctx.stroke();
  if (acting && age<.83) {
    const air=clamp(age/.83,0,1);
    const flagX=x+15+air*22;
    const flagY=y-5-Math.sin(air*Math.PI)*19+air*7;
    rect(flagX,flagY,7,5,'#ffdb58');
  }
}

function drawFlagCall() {
  const {title,message}=flagScene;
  rect(136,294,688,100,'#161f23f2');
  rect(136,294,688,3,'#ffdb58');
  label('FLAG ON THE PLAY',480,318,13,'#ffdb58');
  label(title,480,354,33,'#fff3d1');
  label(message,480,378,14,'#e3ce95');
}

function replayFrame(replay,progress) {
  const end=replay.length-1;
  return replay[reducedMotion?.matches ? end : Math.floor(clamp(progress,0,1)*end)];
}

function drawReplayField(frame,x,y,highlight) {
  const zoom=2.2;
  ctx.save();
  ctx.translate(480,216);
  ctx.scale(zoom,zoom);
  ctx.translate(-clamp(x,225,735),-clamp(y,109,323));
  ctx.drawImage(field,0,0);
  highlight();
  for (const p of [...frame.avatars].sort((a,b)=>a.y-b.y)) sprite(p);
  if (frame.ball) rect(frame.ball.x-5,frame.ball.y-3,10,6,'#f7bc76');
  ctx.restore();
}

function drawReplayLabels(caption,color) {
  rect(18,17,181,30,'#19252b');
  rect(18,17,4,30,color);
  label('INSTANT REPLAY',31,37,14,'#fff0b2','left');
  rect(262,378,436,36,'#19252b');
  label(caption,480,402,18,color);
}

function drawFlagReplay() {
  const {x,y,replay,title}=flagScene;
  const frame=replayFrame(replay,between/REPLAY_TIME);
  if (!frame) return;
  drawReplayField(frame,x,y,()=>{
    ctx.beginPath();
    ctx.arc(x,y,19,0,Math.PI*2);
    ctx.lineWidth=1.5;
    ctx.strokeStyle='#ffe267';
    ctx.stroke();
  });
  drawReplayLabels(title,'#ffe267');
}

function touchdownSequenceAge() {
  return between-(flagScene ? REF_SEQUENCE : 0);
}

function touchdownAge() {
  return touchdownSequenceAge()-TOUCHDOWN_REPLAY;
}

function drawTouchdownReplay() {
  const {team:side,x,replay,scorer,scorerIndex}=touchdownScene;
  const frame=replayFrame(replay,touchdownSequenceAge()/(TOUCHDOWN_REPLAY-.28));
  const runner=frame.avatars[scorerIndex];
  const color=colors[side];
  drawReplayField(frame,runner?.x ?? x,runner?.y ?? MID,()=>{
    rect(x-1,TOP,3,BOTTOM-TOP,color);
    if (runner) {
      ctx.beginPath();
      ctx.arc(runner.x,runner.y,15,0,Math.PI*2);
      ctx.lineWidth=1.5;
      ctx.strokeStyle='#ffe267';
      ctx.stroke();
    }
  });
  drawReplayLabels(scorer+' · TOUCHDOWN',color);
}

function drawTouchdown() {
  const {team:side,x,scorer}=touchdownScene;
  const age=touchdownAge(), motion=!reducedMotion?.matches;
  const color=colors[side];
  const zoneX=x===RIGHT ? RIGHT+3 : 15;
  for (let i=0;i<8;i++) {
    if (!motion || (i+Math.floor(age*13))%3!==0) rect(zoneX,TOP+i*42,63,5,color);
  }
  const eased=motion ? 1-Math.pow(1-clamp(age/.28,0,1),3) : 1;
  const y=83-(1-eased)*55;
  rect(270,y,420,93,'#152327f4');
  rect(270,y,420,5,color);
  label('TOUCHDOWN!',480,y+51,39,'#fff4d5');
  label(scorer+'  ·  +6',480,y+75,15,color);
  if (!motion) return;
  for (let i=0;i<34;i++) {
    const fromLeft=i%2===0;
    const x=(fromLeft ? 46 : 914)+(fromLeft ? 1 : -1)*(i%17)*13*age;
    const y=94+((i*47+age*(46+i%7*9))%262);
    rect(x,y,5,i%3 ? 3 : 6,i%4===0 ? '#ffdb69' : color);
  }
}

function drawHalftime() {
  const {clips}=halftime;
  const clipTime=between-HALF_INTRO;
  if (clipTime<0 || !clips.length) {
    ctx.drawImage(field,0,0);
    rect(0,0,960,432,'#162126b0');
    rect(202,104,556,224,'#182429');
    rect(202,104,556,5,'#ffda72');
    label('HALFTIME',480,167,46,'#fff2ce');
    label(names[0],344,215,13,colors[0]);
    label(names[1],616,215,13,colors[1]);
    label(String(score[0]),344,258,35,colors[0]);
    label(String(score[1]),616,258,35,colors[1]);
    label(clips.length ? 'FIRST-HALF HIGHLIGHTS' : 'SECOND HALF UP NEXT',480,295,12,'#ffda72');
    return;
  }
  const index=Math.min(clips.length-1,Math.floor(clipTime/HALF_CLIP));
  const clip=clips[index];
  const progress=(clipTime-index*HALF_CLIP)/(HALF_CLIP-.22);
  const frame=replayFrame(clip.replay,progress);
  const focus=frame.avatars[clip.index];
  const x=focus?.x ?? clip.x, y=focus?.y ?? clip.y;
  const color=clip.kind==='flag' ? '#ffda72' : colors[clip.side];
  drawReplayField(frame,x,y,()=>{
    ctx.beginPath();
    ctx.arc(x,y,17,0,Math.PI*2);
    ctx.strokeStyle=color;
    ctx.lineWidth=1.5;
    ctx.stroke();
  });
  rect(18,17,236,31,'#182429');
  rect(18,17,4,31,color);
  label('HALFTIME  ·  '+(index+1)+' / '+clips.length,31,37,14,'#fff2ce','left');
  rect(228,378,504,36,'#182429');
  label(clip.title,480,402,17,color);
}

function draw() {
  if (state==='menu') {drawLobby();return;}
  if (phase==='halftime') {
    drawHalftime();
    const status=state==='paused' ? 'PAUSED' : 'HALFTIME SHOW';
    if (liveStatus!==status) {
      liveStatus=status;
      $('status').textContent='● '+status;
    }
    return;
  }
  ctx.save();
  if (refAnnouncing() && !reducedMotion?.matches) {
    const progress=clamp((between-REPLAY_TIME)/.42,0,1);
    const zoom=1+1.6*(1-Math.pow(1-progress,3));
    ctx.translate(official.x+(480-official.x)*progress,official.y+(211-official.y)*progress);
    ctx.scale(zoom,zoom);
    ctx.translate(-official.x,-official.y);
  }
  ctx.drawImage(field,0,0);
  const motion = !reducedMotion?.matches;
  if (motion && impact) ctx.translate(Math.sin(simTime*102)*impact*12,Math.cos(simTime*124)*impact*8);
  if (crowdUntil>simTime) {
    for (let i=0;i<45;i++) {
      const x=23+i*21, h=motion ? Math.sin(i*.8-simTime*15)*4 : 0;
      rect(x,34+h,8,4,colors[i%2]);
      rect(x,391-h,8,4,colors[(i+1)%2]);
    }
  }
  if (phase!=='dead' && phase!=='kickMeter' && phase!=='kickFlight' && !returning) {
    rect(line,TOP,2,BOTTOM-TOP,'#70d9f5bb');
    rect(goal,TOP,2,BOTTOM-TOP,'#ffdb67dd');
    label('LOS',line,BOTTOM+16,10,'#9ce7f3');
    label('TO GAIN',goal,TOP-8,10,'#ffe18d');
  }
  for (const wall of walls) {
    rect(wall.x-23,wall.y-23,46,46,'#963e75');
    rect(wall.x-21,wall.y-22,42,40,'#df64ab');
    rect(wall.x-16,wall.y-17,32,9,'#fe9cc9');
    label('BOING',wall.x,wall.y+10,9,'#471e49');
  }
  drawHazard();
  if (crate && elapsed>=crate.at) {
    const y=crate.y-(motion ? Math.sin(simTime*8)*4 : 0);
    ctx.beginPath();
    ctx.arc(crate.x,crate.y,17,0,Math.PI*2);
    ctx.lineWidth=1.5;
    ctx.strokeStyle='#ffd975ab';
    ctx.stroke();
    rect(crate.x-11,crate.y+8,22,5,'#192e2a80');
    rect(crate.x-10,y-12,20,20,'#ffc857');
    rect(crate.x-8,y-10,16,2,'#ffeaa4');
    label('?',crate.x,y+4,15,'#784625');
    rect(crate.x+13,y-8,3,3,'#fff3b2');
    rect(crate.x-14,crate.y+13,28,4,'#163029');
    rect(crate.x-13,crate.y+14,26*clamp(crate.progress/CLAIM_TIME,0,1),2,'#ffe279');
    label(crate.claimer ? 'CLAIMING' : 'PRIZE',crate.x,crate.y-22,10,'#ffdf8e');
  }
  if (phase==='ready' && state==='playing') drawPlayRoutes();
  drawOfficial();
  for (const p of [...players].sort((a,b)=>a.y-b.y)) {
    if (touchdownScene?.team===p.team && touchdownAge()>=0 && motion && dist(p,carrier || p)<96) {
      sprite({...p,replayCarrier:p===carrier,rise:Math.abs(Math.sin(touchdownAge()*8+p.slot*.35))*(p===carrier ? 20 : 12)});
    } else sprite(p);
  }
  if (phase==='live' && carrier?.aim) drawPassAim(carrier);
  if (flight) {
    if (flight.manual) {
      rect(flight.toX-6,flight.toY,13,1,'#ffe177');
      rect(flight.toX,flight.toY-6,1,13,'#ffe177');
    }
    const f=flight.t/flight.duration;
    const height=passHeight(flight,f);
    const y=flight.y-height;
    const catchable=canPickPass(f,height);
    rect(flight.x-5,flight.y+5,10,3,height>35 ? '#14332888' : '#143328');
    if (catchable) rect(flight.x-8,y-4,16,9,'#ffda71');
    rect(flight.x-6,y-3,12,7,'#613b2d');
    rect(flight.x-4,y-2,8,5,'#efae65');
    rect(flight.x-1,y-1,3,2,'#fff4d7');
  }
  if (kickFlight) drawKickFlight();
  if (kickMeter) drawKickMeter();
  if (motion) {
    for (const p of particles) {
      ctx.globalAlpha=Math.min(1,p.life*3);
      rect(p.x,p.y,p.size,p.size,p.color);
    }
    ctx.globalAlpha=1;
  }
  ctx.restore();
  if (phase==='ready' && state==='playing') {
    rect(145,395,670,24,'#102724');
    const attack=qb(), defender=defenseCaptain();
    label((attack.label || 'CPU')+' QB ↑↓ '+(puntSelected() ? 'PUNT' : plays[playIndex].name),170,411,12,colors[team],'left');
    label('J / BOTTOM TO '+(puntSelected() ? 'PUNT' : 'SNAP'),480,411,11,'#ffe08b');
    label((defender.label || 'CPU')+' DEF ↑↓ '+formations[defenseIndex].name,790,411,12,colors[1-team],'right');
  }
  if (prize && phase==='live' && !wheel) {
    rect(306,397,348,22,'#14272b');
    label(names[prize.team]+' · '+prize.reward.name.toUpperCase()+' · '+Math.ceil(prize.left)+'s',
      480,412,11,prize.reward.color);
  }
  if (wheel && state==='playing') drawPrizeWheel();
  if (flagScene && between<REPLAY_TIME) drawFlagReplay();
  else if (refAnnouncing()) drawFlagCall();
  else if (touchdownScene && touchdownSequenceAge()>=0 && touchdownAge()<0) drawTouchdownReplay();
  else if (touchdownScene && touchdownAge()>=0) drawTouchdown();
  const kicking = phase==='kickMeter' || phase==='kickFlight';
  const status=state==='paused'?'PAUSED':state==='over'?'FINAL SCORE':refAnnouncing() ? 'FLAG · '+flagScene.title : flagScene && between<REPLAY_TIME ? 'INSTANT REPLAY' : touchdownScene ? (touchdownAge()<0 ? 'TOUCHDOWN REPLAY' : 'TOUCHDOWN · '+names[touchdownScene.team]) : wheel ? 'PRIZE WHEEL · PLAY PAUSED' : flag ? 'FLAG DOWN · PLAY LIVE' :
    names[team]+(kicking ? ' KICKING  ·  ' : ' BALL  ·  ')+(phase==='try' ? 'CHOOSE KICK OR GO FOR TWO' : phase==='kickMeter' ? kickTitle(kickMeter.kind)+' · TIME THE KICK' : phase==='kickFlight' ? kickTitle(kickFlight.kind)+' · IN THE AIR' :
    phase==='ready' ? 'AT THE LINE' : phase==='live' ? returning ? (returning==='kickoff' ? 'KICKOFF RETURN' : 'INTERCEPTION RETURN') : tryMode ? 'TWO-POINT TRY' : pocketPressure ? 'POCKET COLLAPSING' : 'PLAY LIVE' : 'WHISTLE');
  if (liveStatus!==status) {
    liveStatus=status;
    $('status').textContent='● '+status;
  }
}

function choosePhonePlay(owner,choice) {
  if (state!=='playing' || phase!=='ready' || owner==null || choice.id!==playbookId ||
    !Number.isInteger(choice.index) || choice.index<0) return;
  if (choice.kind==='defense') {
    if (owner!==defenseCaptain().owner || choice.index>=formations.length) return;
    defenseIndex=choice.index;
  } else {
    if (owner!==qb().owner || choice.index>=plays.length+Number(down===4)) return;
    playIndex=choice.index;
  }
  positionFormation();
  sound(590,.06);
}

const phoneBookCache={};
function phonePlaybook(kind) {
  const stamp=playbookId+':'+team+':'+down+':'+offense().map(p=>Number(p.owner===null)).join('');
  const selected=kind==='defense' ? defenseIndex : playIndex;
  if (phoneBookCache[kind]?.stamp!==stamp) phoneBookCache[kind]={stamp,book:buildPhonePlaybook(kind)};
  return {...phoneBookCache[kind].book,selected};
}

function buildPhonePlaybook(kind) {
  if (kind==='defense') return {
    id:playbookId,kind,selected:defenseIndex,
    options:formations.map(formation=>({
      name:formation.name,rushers:formation.rushers,players:formation.x.map((x,i)=>[x,formation.y[i]])
    }))
  };
  const options=[...plays.map(play=>play.name),...(down===4 ? ['PUNT'] : [])];
  const point=({x,y})=>[Math.round((x-line)*direction()),Math.round(y-MID)];
  return {id:playbookId,kind,selected:playIndex,options:options.map((name,index)=>{
    const starts=offensivePositions(index);
    return {name,players:starts.map(point),routes:playRoutes(index,starts)
      .map(({type,points})=>[type,points.map(point)])};
  })};
}

function describePhones() {
  const labels={_open:14-controllers.size-Number(keyboard)};
  const currentHost=host();
  let offenseBook, defenseBook;
  for (const p of players) {
    if (typeof p.owner!=='number' || p.owner<1000) continue;
    const captain=p===qb();
    const onOffense=p.team===team;
    const special=captain && ['kickMeter','try'].includes(phase) ? phase : null;
    let mode;
    if (state==='menu') mode='lobby';
    else if (state==='paused') mode='paused';
    else if (state==='over') mode='final';
    else if (special) mode=special;
    else if (phase==='ready') mode=onOffense ? (captain ? 'ready' : 'waiting') :
      p===defenseCaptain() ? 'defenseReady' : 'waiting';
    else if (phase!=='live' || wheel) mode='waiting';
    else if (!onOffense) mode='defense';
    else if (p===carrier && canPass(p)) mode='offense';
    else if (p===carrier) mode='runner';
    else mode='receiver';
    const playbook=mode==='ready' ? (offenseBook ??= phonePlaybook('offense')) :
      mode==='defenseReady' ? (defenseBook ??= phonePlaybook('defense')) : undefined;
    labels[p.owner]={player:p.label,team:names[p.team],host:p.owner===currentHost,mode,playbook};
  }
  return labels;
}
window.blitzPhones?.describe(()=>{
  const labels=describePhones();
  for (const label of Object.values(labels)) {
    if (label.mode==='kickMeter' || label.mode==='try') label.mode='kick';
  }
  return labels;
});
window.couchJoinstick?.describe(describePhones);
window.couchJoinstick?.onBlitzCommand?.(choosePhonePlay);

assignSeats();
reset();
drawField();
function frame(now) {
  const dt=Math.min(.034,(now-lastFrame)/1000);
  lastFrame=now;
  if (state!=='paused' && !wheel) {
    simTime+=dt;
    updateEffects(dt);
  }
  readInputs();
  if (state==='menu') updateLobby(dt);
  else tick(dt);
  if (simTime>noticeUntil && phase!=='try' && phase!=='kickMeter') $('call').hidden=true;
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
