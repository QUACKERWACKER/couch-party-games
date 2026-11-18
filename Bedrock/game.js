'use strict';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const ground = document.createElement('canvas');
const terrainCtx = ground.getContext('2d');
const ui = Object.fromEntries(['overlay','eyebrow','title','brief','roster','prompt','hint']
  .map(id => [id, document.getElementById(id)]));
const W = 1248, H = 536, TOP = 83, STEP = 4;
const NX = W/STEP, NY = H/STEP;
const CORE = 94;
const maps = [
  {name:'FAULTLINE',detail:'A direct clash through the mountain.',bases:[264,264]},
  {name:'SWITCHBACK',detail:'Climb and descend through offset caverns.',bases:[196,340]},
  {name:'FORKED DEPTHS',detail:'Two approaches. Choose a flank.',bases:[264,264]}
];
const gadgets = [
  {name:'DASH',detail:'Burst in your aim direction.',cooldown:10},
  {name:'STICKY BOMB',detail:'Sticks to rock. Explodes after one second.',cooldown:12},
  {name:'SHIELD',detail:'Block damage for two seconds.',cooldown:15}
];
const wins=[0,0];
let mapIndex=-1, phaseTime=0, overtime=false, crystals=[], bombs=[];
let practiceSeen=false, muted=false, reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const developerControls=new URLSearchParams(location.search).has('dev');
const ORDINARY = 0, BEDROCK = 1, FORTIFICATION = 2;
const AUTO_JET_Y = -.38;
const STEP_UP = 16, STEP_DOWN = 5;
const colors = ['#67f2d3','#ffab65'];
const names = ['MINT','EMBER'];
const minionTypes = [
  {name:'BORER',cost:12,hp:58,blurb:'Digs and earns ore'},
  {name:'HUNTER',cost:18,hp:42,blurb:'Follows you, or holds your command position'},
  {name:'SENTRY',cost:22,hp:104,blurb:'Holds this position'}
];
const upgradeTypes = [
  {name:'DRILL',blurb:'Faster carving'},
  {name:'ARMOR',blurb:'More health'},
  {name:'JET',blurb:'Longer flight'},
  {name:'BLASTER',blurb:'Faster fire'}
];
const empty = {x:0,y:0,b:[]};
const lift = [{x:55,y:264},{x:W-55,y:264}];
const keys = new Set();
let roster=[], host=null, sequence=0, mode='lobby', previous=new Map();
let teams, players=[], units=[], shots=[], particles=[], time=0, breachAt=null, result;
let message='', messageUntil=0, audio;
let terrain, rock, ore, terrainImage, dirty=true, tunnelChanged=true, previousScan=0;
let round=0, caches=[], relay=null;
ground.width=NX;
ground.height=NY;

const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const sideDir = side => side ? -1 : 1;
const norm = (x,y) => Math.hypot(x,y);
const between = (a,b) => norm(a.x-b.x,a.y-b.y);
const pressed = (control,b,was) => control.b[b] && !was.b[b];
const timer = value => {
  const second=Math.max(0,Math.ceil(value));
  return Math.floor(second/60)+':'+String(second%60).padStart(2,'0');
};
const inCore = x => Math.abs(x-W/2) < CORE;

function noise(x,y) {
  const value=Math.imul(x+17,374761393)^Math.imul(y+round*17,668265263);
  return ((Math.imul(value^(value>>>13),1274126177)>>>0)%1024)/1024;
}

function makeTerrain() {
  terrain=new Float32Array(NX*NY);
  rock=new Uint8Array(NX*NY);
  ore=new Uint8Array(NX*NY);
  terrainImage=terrainCtx.createImageData(NX,NY);
  const crewFactor=1+Math.min(3,teamSize()-1)*.66;
  for (let iy=0;iy<NY;iy++) {
    const y=iy*STEP+2;
    const seam=Math.sin(y*.028+round)*23+Math.sin(y*.081)*12;
    const fortDepth=215+Math.sin(y*.045)*10;
    const coreVariation=Math.cos(y*.038+round)*38;
    for (let ix=0;ix<NX;ix++) {
      const x=ix*STEP+2,i=iy*NX+ix;
      const side=Number(x>W/2), depth=Math.min(x,W-x);
      const baseY=lift[side].y;
            const cavern=mapIndex===2 && depth>230 && depth<W/2-CORE && Math.min(Math.abs(y-170),Math.abs(y-366))<25;

      const grain=noise(Math.min(ix,NX-1-ix),ix<NX/2 ? iy : NY-1-iy);
      const pocket=depth>142 && depth<W/2-CORE &&
        Math.sin(depth*.025+y*.013+round)*Math.cos(y*.044-depth*.009)>.82;
      const base=depth<105 && y>baseY-53 && y<baseY+19 ||
        depth<143 && Math.abs(y-baseY)<17 ||
        depth<58 && y>baseY-98 && y<baseY-9;
      const edge=x<7 || x>W-7 || y<8 || y>H-8;
      const liftPlatform=Math.abs(depth-55)<34 && y>=baseY+20 && y<baseY+32;
      const crystal=Math.sin(depth*.065+(side ? H-y : y)*.063+round)*Math.sin(depth*.027-(side ? H-y : y)*.075)>.60;
      const core=inCore(x);
      const fort=depth>=143 && depth<fortDepth && !pocket;
      rock[i]=core ? BEDROCK : fort ? FORTIFICATION : ORDINARY;
      terrain[i]=edge || liftPlatform ? Infinity : base || (pocket || cavern) && !inCore(x) ? 0 :
        core ? (430+grain*35+coreVariation*.4)*crewFactor*(mapIndex===2 ? .82 : 1) :
        fort ? (150+grain*20)*Math.sqrt(crewFactor) :
        depth>250+seam && grain>.39 ? 11 : 7;
      if (!edge && !liftPlatform && !core && !fort && !base && !pocket && crystal) ore[i]=1;
      paintCell(ix,iy);
    }
  }
  dirty=tunnelChanged=true;
}

function paintCell(ix,iy) {
  const i=iy*NX+ix, data=terrainImage.data, k=i*4;
  const h=terrain[i], grain=noise(Math.min(ix,NX-1-ix),iy);
  const band=Math.sin(iy*.18+ix*.028)*8;
  let rgb;
  if (!h) rgb=[17+grain*6,15+grain*5,27+grain*8];
  else if (h===Infinity) rgb=[29+grain*20,29+grain*15,42+grain*20];
  else if (rock[i]===BEDROCK) rgb=[45+grain*30+band+(500-h)*.09,52+grain*22,85+grain*39+band];
  else if (rock[i]===FORTIFICATION) rgb=[49+grain*18+band,71+grain*22,70+grain*23+band];
  else if (ore[i]) rgb=[138+grain*106,82+grain*90,45+grain*46];
  else if (h>7) rgb=[66+grain*25+band,49+grain*18,81+grain*28+band];
  else rgb=[103+grain*29+band,65+grain*22,83+grain*18+band];
  data[k]=rgb[0]; data[k+1]=rgb[1]; data[k+2]=rgb[2]; data[k+3]=255;
}
function solid(x,y) {
  if (x<0 || x>=W || y<0 || y>=H) return true;
  return terrain[Math.floor(y/STEP)*NX+Math.floor(x/STEP)]>0;
}
function fits(x,y,r) {
  const d=r*.69;
  return !solid(x,y) && !solid(x-r,y) && !solid(x+r,y) && !solid(x,y-r) && !solid(x,y+r) &&
    !solid(x-d,y-d) && !solid(x+d,y-d) && !solid(x-d,y+d) && !solid(x+d,y+d);
}

function carve(x,y,r,strength,side,drillLevel=0,earner=null) {
  const left=clamp(Math.floor((x-r)/STEP),1,NX-2), right=clamp(Math.floor((x+r)/STEP),1,NX-2);
  const top=clamp(Math.floor((y-r)/STEP),1,NY-2), bottom=clamp(Math.floor((y+r)/STEP),1,NY-2);
  let dug=0, enriched=0, worked=0;
  for (let iy=top;iy<=bottom;iy++) {
    for (let ix=left;ix<=right;ix++) {
      const px=ix*STEP+2,py=iy*STEP+2,i=iy*NX+ix;
      const range=(px-x)**2+(py-y)**2;
      if (!terrain[i] || terrain[i]===Infinity ||
          range>r*r*(.84+noise(ix,iy)*.19)) continue;
      let power=strength;
      if (rock[i]===BEDROCK) power*=.72+.59*drillLevel;
      if (rock[i]===FORTIFICATION) power*=Number(px>W/2)===side ? 2.1 : .70+.29*drillLevel;
      terrain[i]=Math.max(0,terrain[i]-power);
      worked++;
      if (!terrain[i]) {
        dug++;
        enriched+=ore[i];
        ore[i]=0;
      }
      paintCell(ix,iy);
      dirty=true;
    }
  }
  if (dug) tunnelChanged=true;
  if (dug && teams) {
    const miner=earner || players.find(p=>p.side===side);
    if (miner) {
      miner.ore+=dug*.025+enriched*.15;
      miner.mined+=dug;
    }
    if (dug>5) burst(x,y,enriched>3 ? '#ffce7d' : '#ad7685',3);
  }
  return worked;
}

const bedrockSounds={dig:[135,68,.07],shot:[235,62,.13],buy:[433,855,.15],alarm:[180,520,.45],win:[440,905,.65]};

function sound(name) {
  if (muted) return;
  const [start,end,length]=bedrockSounds[name];
  playGameTone(audio,start,length,name==='shot' ? 'triangle' : 'sine',.035,0,end);
}
function enableSound() {
  if (!window.AudioContext) return;
  audio ??= new AudioContext();
  if (audio.state==='suspended') audio.resume().catch(()=>{});
}
document.addEventListener('pointerdown',enableSound);
document.addEventListener('keydown',event=>{
  if (event.altKey || event.metaKey || event.ctrlKey) return;
  if (!['Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyZ','KeyX','KeyC','KeyV','Space','KeyA','KeyS','KeyD'].includes(event.code)) return;
  if (event.code==='Enter' && document.activeElement?.tagName==='A') return;
  event.preventDefault();
  keys.add(event.code);
  enableSound();
});
document.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>keys.clear());
window.addEventListener('gamepadconnected',enableSound);

function input() {
  const current=new Map();
  const has=key=>Number(keys.has(key));
  if (developerControls) current.set('keyboard',{
    x:has('ArrowRight')-has('ArrowLeft'), y:has('ArrowDown')-has('ArrowUp'),
    b:['KeyZ','KeyX','KeyC','KeyV','Space','KeyA','KeyD', 'KeyS'].map(key=>keys.has(key)),
    autoJet:keys.has('ArrowUp'),
    join:keys.has('Enter')
  });
  for (const pad of gameControllerInputs()) {
    if (!pad?.connected || pad.axes.length<2 || pad.buttons.length<4) continue;
    if (!developerControls && !window.couchJoinstick?.label(pad.index)) continue;
    const b=pad.buttons.slice(0,8).map(button=>button.pressed || button.value>.55);
    const [x,y]=pad.axes;
    const aimX=pad.axes[2] || 0, aimY=pad.axes[3] || 0;
    const aimLength=Math.hypot(aimX,aimY);
    const aim=aimLength>.20 ? {ax:aimX/aimLength,ay:aimY/aimLength} : {};
    current.set('pad:'+pad.index,{x,y,b,...aim,independent:Boolean(window.couchJoinstick?.label(pad.index)),autoJet:y<AUTO_JET_Y,join:b.slice(0,4).some(Boolean)});
  }
  return current;
}

function overlay() {
  ui.overlay.hidden=mode==='play' || mode==='practice';
  if (mode==='play' || mode==='practice') return;
  const won=mode==='result';
  ui.eyebrow.textContent=won ? 'CRYSTAL RUN COMPLETE' : mode==='loadout' ? 'PICK A GADGET ON YOUR PHONE' : 'STEAL · ESCAPE · DELIVER';
  ui.title.innerHTML=won ? (result===null ? 'ROUND<span>DRAW</span>' : names[result]+'<span>WINS</span>') : 'BEDROCK<span>RIVALS</span>';
  ui.brief.innerHTML=won ? resultSummary()
    : mode==='loadout' ? 'Choose your gadget · '+Math.ceil(phaseTime)+'s<br>'+maps[(mapIndex+1)%maps.length].name+' · '+maps[(mapIndex+1)%maps.length].detail
    : 'Mine a route. Steal their crystal. Bring it home.<br>Pair your phone to join. Up jets automatically.';
  ui.roster.replaceChildren();
  function badge(label,side) {
    const item = gameElement('span', {text: label});
    item.style.color=colors[side];
    ui.roster.append(item);
  }
  roster.forEach(p=>badge((window.couchJoinstick?.profile?.(p.index)?.name || 'P'+p.number)+' · '+names[p.side]+' · '+(p.ready ? 'READY' : 'PICKING')+(p.id===host ? ' · HOST' : ''),p.side));
  const size=teamSize();
  for (let side=0;side<2;side++) {
    const count=size-roster.filter(p=>p.side===side).length;
    if (count && host) badge(count+' CPU · '+names[side],side);
  }
  const hostOnPhone=roster.some(p=>p.id===host && p.phone);
  const action=won ? 'Rematch' : 'Start';
  const confirm=host==='keyboard' ? 'Enter / Z' : 'A / ✕';
  ui.prompt.textContent=!host ? 'Press any face button to join'
    : hostOnPhone ? 'Host · '+action+' on phone' : 'Host · '+confirm+' '+action.toLowerCase();
  ui.hint.textContent=developerControls ? 'Developer controls · arrows / Z dig / X fire / D gadget / C team'
    : 'Ready on your phone · '+size+'v'+size+' · CPUs fill empty seats';

}
function teamSize() {
  return Math.max(1,...[0,1].map(side=>roster.filter(p=>p.side===side).length));
}
function smallerSide() {
  return Number(roster.filter(p=>p.side===0).length>roster.length/2);
}
function unseat(id) {
  roster=roster.filter(p=>p.id!==id);
  if (id===host) host=roster[0]?.id ?? null;
  overlay();
}

function menu(current) {
  const keep=roster.filter(p=>current.has(p.id) || (p.phone && window.couchJoinstick?.label(p.index)));
  if (keep.length!==roster.length) {
    roster=keep;
    if (!roster.some(p=>p.id===host)) host=roster[0]?.id ?? null;
    overlay();
  }
  for(const seat of roster) {
    if(current.has(seat.id)) seat.offlineAt=null;
    else seat.offlineAt ??= performance.now();
  }
  const hostSeat=roster.find(p=>p.id===host);
  if(hostSeat) {
    if(current.has(host)) hostSeat.offlineAt=null;
    else {
      hostSeat.offlineAt ??= performance.now();
      if(performance.now()-hostSeat.offlineAt>3000) {
        const replacement=roster.find(p=>current.has(p.id));
        if(replacement) {host=replacement.id;overlay();}
      }
    }
  }
  let start=false;
  for (const [id,control] of current) {
    const was=previous.get(id) ?? empty;
    const known=roster.some(p=>p.id===id);
    if (!known && control.join && !was.join && roster.length<8) {
      if (!previous.has(id) && id!=='keyboard' && control.b[0] && performance.now()<400 && document.referrer) continue;
      if (!roster.length) sequence=0;
      const index=id==='keyboard' ? null : Number(id.slice(4));
      roster.push({id,index,phone:Boolean(window.couchJoinstick?.label(index)),number:++sequence,side:smallerSide(),ready:false,gadget:0});
      host ??= id;
      overlay();
    } else if (known) {
      if (pressed(control,1,was)) {
        unseat(id);
      } else if (pressed(control,2,was)) {
        switchTeam(roster.find(p=>p.id===id));
      } else if ((id===host || !current.has(host)) &&
          (pressed(control,0,was) || (id==='keyboard' && control.join && !was.join))) {
        host=id;
        start=roster.every(p=>p.id===host || p.ready || !p.phone || !current.has(p.id));
      }
    }
  }
  if (start && host) {
    if (!practiceSeen) {
      practiceSeen=true;
      startMatch(true);
    } else beginLoadout();
  }
}

function spawn(p) {
  p.x=lift[p.side].x+sideDir(p.side)*(38+(p.slot%3)*2);
  p.y=lift[p.side].y-20-(p.slot%2)*12;
  p.vx=0; p.vy=0; p.ax=sideDir(p.side); p.ay=0;
  p.hp=health(p); p.fuel=1; p.digAt=0; p.shotAt=0; p.shield=time+1.6; p.backAt=0; p.picker=null; p.diggingUntil=0;p.navigation=null;p.noPickupUntil=0;
}
function health(p) {return 100+25*p.level[1];}
function startMatch(practice=false) {
  round+=practice ? 0 : 1; time=0; breachAt=null; previousScan=0;
  mapIndex=(mapIndex+1)%maps.length;
  lift.forEach((base,side)=>base.y=maps[mapIndex].bases[side]);
  crystals=lift.map((base,side)=>({...base,side,state:'home',carrier:null,returnAt:0}));
  bombs=[]; overtime=false;
  shots=[]; units=[]; particles=[]; relay=null;
  caches=[{x:265,y:routeY(265)-95},{x:420,y:routeY(420)+80},{x:W-265,y:routeY(W-265)+95},{x:W-420,y:routeY(W-420)-80}];
  const count=[0,0];
  const playing=roster.slice();
  const size=teamSize();
  for (let side=0;side<2;side++) {
    const humans=roster.filter(p=>p.side===side).length;
    for (let slot=humans;slot<size;slot++) playing.push({id:'cpu:'+side+':'+slot,side,number:0});
  }
  players=playing.map(p=>({...p,slot:count[p.side]++,r:10,level:[0,0,0,0],
    minion:0,upgrade:0,ore:24,mined:0,practiceMoved:0,practiceDug:false,practiceFired:false,practicePicked:false,returns:0,gadget:p.gadget ?? 0,
    gadgetAt:0,holdCrew:false,seenRequests:new Set(),receipt:null,missingSince:null,navigation:null}));
  teams=count.map(()=>({}));
  makeTerrain();
  players.forEach(p=>{
    spawn(p);
    units.push({type:0,side:p.side,owner:p.id,x:p.x,y:p.y,dx:sideDir(p.side),dy:0,r:8,hp:58,shotAt:0,digAt:0,stalled:0});
  });
  for (let side=0;side<2;side++) {
    const {hp}=minionTypes[2], dir=sideDir(side);
    units.push({type:2,guard:'lift',side,x:lift[side].x+dir*25,y:lift[side].y-17,r:9,hp:Math.round(hp*Math.sqrt(size)),maxHp:Math.round(hp*Math.sqrt(size)),shotAt:0});
    units.push({type:2,guard:'outpost',side,x:lift[side].x+dir*75,y:lift[side].y+2,r:8,hp:Math.round(76*Math.sqrt(size)),maxHp:Math.round(76*Math.sqrt(size)),shotAt:0});
  }
  mode=practice ? 'practice' : 'play';
  phaseTime=practice ? 20 : 0;
  if (practice) {
    units=units.filter(u=>!u.guard);
    crystals.forEach((c,side)=>{c.x=lift[1-side].x+sideDir(1-side)*245;c.y=lift[1-side].y-5;});
    terrain.fill(0);
    for(let y=0;y<NY;y++) for(let x=0;x<NX;x++) {
      if (x<2 || x>=NX-2 || y<2 || y>=NY-2 || y===Math.floor((lift[0].y+20)/STEP)) terrain[y*NX+x]=Infinity;
      else if (Math.abs(x*STEP-260)<35 && Math.abs(y*STEP-lift[0].y)<35) terrain[y*NX+x]=4;
      paintCell(x,y);
    }
    dirty=tunnelChanged=true;
  }
  announce(practice ? 'PRACTICE · MOVE, DRILL, FIRE, PICK UP' : 'STEAL THEIR CRYSTAL · BRING IT HOME',5);
  overlay();
}
function announce(text,duration) {message=text; messageUntil=time+duration;}
function note(p,text) {p.note=text; p.noteUntil=time+2;}
function burst(x,y,color,count) {
  for (let i=0;i<Math.min(count,reducedMotion ? 4 : 32);i++) {
    const angle=Math.random()*Math.PI*2, speed=25+Math.random()*91;
    particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
      life:.24+Math.random()*.26,color});
  }
}

makeTerrain();

function stepUp(p,x) {
  for (let rise=1;rise<=STEP_UP;rise++) {
    const y=p.y-rise;
    if (!fits(p.x,y,p.r)) return false;
    if (!fits(x,y,p.r)) continue;
    p.x=x;
    p.y=y;
    p.vy=0;
    return true;
  }
  return false;
}

function settleToSlope(p) {
  for (let drop=0;drop<=STEP_DOWN;drop++) {
    if (!fits(p.x,p.y+drop,p.r)) {
      p.y+=Math.max(0,drop-1);
      p.vy=0;
      return;
    }
  }
}

function axis(p,amount,key,canStep=false) {
  if (!amount) return;
  const count=Math.ceil(Math.abs(amount)/3), delta=amount/count;
  for (let i=0;i<count;i++) {
    const x=p.x+(key==='x' ? delta : 0), y=p.y+(key==='y' ? delta : 0);
    if (!fits(x,y,p.r)) {
      if (key==='x' && canStep && stepUp(p,x)) continue;
      p[key==='x' ? 'vx' : 'vy']=0;
      return;
    }
    p.x=x; p.y=y;
  }
}

function move(p,control,dt) {
  if(mode==='practice' && Math.abs(control.x)>.2) p.practiceMoved+=dt;
  const grounded=!fits(p.x,p.y+2,p.r);
  const thrust=(control.autoJet || control.b[4]) && p.fuel>.005;
  const level=p.level[2];
  const target=Math.abs(control.x)>.13 ? control.x*(151+level*9)*(carrying(p) ? .85 : 1) : 0;
  p.vx+=(target-p.vx)*Math.min(1,dt*(grounded ? 16 : 9));
  p.vy=clamp(p.vy+(thrust ? -620-level*42 : 460)*dt,-167-level*12,250);
  if (thrust) {
    p.fuel=Math.max(0,p.fuel-dt/(1.55+level*.66));
    if (Math.random()<dt*24) burst(p.x,p.y+10,'#ffc47b',1);
  } else {
    p.fuel=Math.min(1,p.fuel+dt*(grounded ? .72 : .28));
  }
  const onFoot=grounded && !thrust && p.vy>=0;
  const beforeX=p.x;
  axis(p,p.vx*dt,'x',onFoot);
  if (onFoot && p.x!==beforeX) settleToSlope(p);
  axis(p,p.vy*dt,'y');
}

function dig(p) {
  if (carrying(p)) {note(p,'CARRY HOME · NO DRILL');return;}
  p.digAt=time+.29-p.level[0]*.035;
  if(mode==='practice') p.practiceDug=true;
  const x=p.x+p.ax*25,y=p.y+p.ay*25;
  const power=1.55+p.level[0]*.65;
  const mouth=carve(p.x+p.ax*8,p.y+p.ay*8,20,power*.6,p.side,p.level[0],p);
  const front=carve(x,y,27+p.level[0]*2,power,p.side,p.level[0],p);
  if ((mouth || front) && p.number) sound('dig');
  p.diggingUntil=time+.18;
}

function fire(from,dx,dy,unit=false) {
  if(mode==='practice' && !unit) from.practiceFired=true;
  const level=unit ? 0 : from.level[3];
  from.shotAt=time+(from.guard ? .93 : unit ? .79 : .58-level*.065);
  const x=from.x+dx*9,y=from.y+dy*9;
  const damage=from.guard ? 24 : unit ? 12 : 23+level*5;
  const life=from.guard ? .36 : unit ? .29 : .4+level*.04;
  shots.push({x,y,dx,dy,side:from.side,dmg:damage,life});
  if (!unit && from.number) sound('shot');
}
function hurt(target,damage,side) {
  if (target.hp<=0 || target.shield>time) return;
  target.hp-=damage;
  target.flashUntil=time+.13;
  burst(target.x,target.y,colors[target.side],5);
  if (target.hp>0) return;
  const miner=players.find(p=>p.side===side && p.hp>0);
  if (miner) miner.ore+=target.level ? 7 : 3;
  if (target.level) dropCrystal(target);
  if (target.level) target.backAt=time+3;
  burst(target.x,target.y,colors[target.side],11);
}
function updateShots(dt) {
  const targets=units.concat(players);
  for (const shot of shots) {
    shot.life-=dt;
    for (let step=0;step<4 && shot.life>0;step++) {
      shot.x+=shot.dx*440*dt/4;
      shot.y+=shot.dy*440*dt/4;
      if (solid(shot.x,shot.y)) {
        burst(shot.x,shot.y,'#fcba90',2);
        shot.life=0;
        break;
      }
      if (breachAt===null) continue;
      let victim=null, nearest=Infinity;
      for (const target of targets) {
        if (target.side===shot.side || target.hp<=0 || target.shield>time) continue;
        const distance=between(target,shot);
        const hitRadius=target.type===1 ? 15 : target.r+4;
        if (distance>=hitRadius || distance>=nearest || !clearShot(shot,target)) continue;
        victim=target;
        nearest=distance;
      }
      if (!victim) continue;
      hurt(victim,shot.dmg,shot.side);
      shot.life=0;
    }
  }
  shots=shots.filter(shot=>shot.life>0);
}
function purchase(p) {
  const selected=p.upgrade, cap=2, tier=p.level[selected];
  if (tier===cap) {note(p,'MAX LEVEL'); return false;}
  const cost=upgradeCost(tier);
  if (p.ore<cost) {note(p,'NEED '+cost+' ORE'); return false;}
  p.ore-=cost;
  p.level[selected]++;
  if (selected===1) p.hp+=25;
  if (selected===2) p.fuel=1;
  note(p,upgradeTypes[selected].name+' '+p.level[selected]);
  if (p.number) sound('buy');
  return true;
}
function upgradeCost(level) {return 16+level*12;}
function ownedUnits(p) {return units.filter(u=>u.owner===p.id && u.hp>0 && !u.finished).length;}
function unitCount(side) {return units.filter(u=>u.side===side && u.hp>0 && !u.guard).length;}
function summon(p) {
  const type=p.minion, spec=minionTypes[type];
  if (ownedUnits(p)>=4) {note(p,'CREW FULL · 4 MAX'); return false;}
  if (p.ore<spec.cost) {note(p,'NEED '+spec.cost+' ORE'); return false;}
  p.ore-=spec.cost;
  const aheadX=p.x+p.ax*16,aheadY=p.y+p.ay*16;
  const ahead=fits(aheadX,aheadY,8);
  units.push({type,side:p.side,owner:p.id,x:ahead ? aheadX : p.x,y:ahead ? aheadY : p.y,
    dx:p.ax,dy:p.ay,r:8,hp:spec.hp,shotAt:time,digAt:time,stalled:0});
  note(p,'+'+spec.name);
  if (p.number) sound('buy');
  return true;
}
function clearShot(a,b) {
  const d=between(a,b);
  const samples=Math.ceil(d/3);
  for (let i=1;i<samples;i++) {
    const portion=i/samples;
    if (solid(a.x+(b.x-a.x)*portion,a.y+(b.y-a.y)*portion)) return false;
  }
  return true;
}
function closestEnemy(p,range) {
  let target=null, best=range;
  for (const enemy of players.concat(units)) {
    if (enemy.side===p.side || enemy.hp<=0 || enemy.shield>time) continue;
    const d=between(p,enemy);
    if (d>=best || !clearShot(p,enemy)) continue;
    target=enemy; best=d;
  }
  return target;
}
function drift(u,dx,dy,dt) {
  if (fits(u.x+dx*dt,u.y,u.r)) u.x+=dx*dt;
  if (fits(u.x,u.y+dy*dt,u.r)) u.y+=dy*dt;
}
function updateBorer(u,dt) {
  if (u.digAt<=time) {
    u.digAt=time+.47;
    const owner=players.find(p=>p.id===u.owner);
    const level=owner?.level[0] ?? 0;
    const mouth=carve(u.x+u.dx*8,u.y+u.dy*8,17,.76,u.side,level,owner);
    const front=carve(u.x+u.dx*19,u.y+u.dy*19,23,1.24,u.side,level,owner);
    if (mouth || front) u.stalled=0;
  }
  const x=u.x,y=u.y;
  drift(u,u.dx*41,u.dy*41,dt);
  const advance=(u.x-x)*u.dx+(u.y-y)*u.dy;
  u.stalled=advance>dt*6 ? 0 : u.stalled+dt;
  const margin=u.r+2*STEP;
  const endX=u.x+u.dx*2, endY=u.y+u.dy*2;
  const atEnd=(u.dx<0 && endX<margin) || (u.dx>0 && endX>=W-margin) ||
    (u.dy<0 && endY<margin) || (u.dy>0 && endY>=H-margin);
  if (!atEnd && u.stalled<1.2) return;
  u.finished=true;
  burst(u.x,u.y,colors[u.side],6);
}

function updateGuard(guard) {
  if (breachAt===null) return;
  if (guard.charge) {
    if (time<guard.charge.until) return;
    fire(guard,guard.charge.dx,guard.charge.dy,true);
    guard.charge=null;
    return;
  }
  if (time<guard.shotAt) return;
  const enemy=closestEnemy(guard,guard.guard==='lift' ? 150 : 115);
  if (!enemy) return;
  const d=Math.max(1,between(guard,enemy));
  guard.charge={dx:(enemy.x-guard.x)/d,dy:(enemy.y-guard.y)/d,distance:d,until:time+.39};
}

function updateUnits(dt) {
  for (const u of units) {
    if (u.hp<=0) continue;
    if (u.type===0) {
      updateBorer(u,dt);
      continue;
    }
    if (u.guard) {
      updateGuard(u);
      continue;
    }
    const enemy=breachAt!==null ? closestEnemy(u,125) : null;
    const owner=players.find(p=>p.id===u.owner);
    if (enemy) {
      const d=Math.max(1,between(u,enemy));
      if (u.shotAt<=time) fire(u,(enemy.x-u.x)/d,(enemy.y-u.y)/d,true);
    }
    if (u.type===2) continue;
    const target=owner?.holdCrew ? u.holdPosition || (u.holdPosition={x:u.x,y:u.y}) : enemy || (owner?.hp>0 ? owner : lift[u.side]);
    const distance=between(u,target);
    if (!owner?.holdCrew) u.holdPosition=null;
    if (distance> (owner?.holdCrew ? 4 : 34)) drift(u,(target.x-u.x)*112/distance,(target.y-u.y)*112/distance,dt);
  }
  units=units.filter(u=>u.hp>0 && !u.finished);
}

function bot(p) {
  const direction=sideDir(p.side);
  const ready=breachAt!==null;
  const goal=lift[1-p.side];
  const cargo=carrying(p);
  const own=crystals[p.side];
  const returnTarget=own.state!=='home' ? own : null;
  const defending=p.slot%2===1 && returnTarget;
  const target=cargo ? (returnTarget || lift[p.side]) : defending ? returnTarget : crystals[1-p.side];
  const targetPlayer=target?.carrier && players.find(q=>q.id===target.carrier);
  const destination=targetPlayer || target || goal;
  const home=lift[p.side];
  const prepCache=!ready && p.level[0]<2 && caches.find(cache=>
    !cache.claimed && (cache.x<W/2)===(p.side===0) && cache.y>routeY(cache.x));
  let xGoal=prepCache ? prepCache.x : destination.x;
  let yGoal=prepCache ? prepCache.y : Math.abs(p.x-destination.x)<130 ? destination.y : routeY(p.x);
  if ((cargo || ready) && !clearShot(p,{x:xGoal,y:yGoal})) {
    const waypoint=navigate(p,destination);
    if (waypoint) {xGoal=waypoint.x;yGoal=waypoint.y;}
  }
  p.botProgress ??= {x:p.x,y:p.y,at:time};
  if(between(p,p.botProgress)>15) p.botProgress={x:p.x,y:p.y,at:time};
  if(cargo && time-p.botProgress.at>2) {
    dropCrystal(p);
    p.noPickupUntil=time+2;
    p.botProgress.at=time;
  }
  const near=Math.abs(xGoal-p.x)<(cargo || ready ? 3 : 10);
  let dx=near ? 0 : Math.sign(xGoal-p.x),dy=clamp((yGoal-p.y)/22,-1,1);
  const enemy=breachAt!==null && closestEnemy(p,155+p.level[3]*15);
  const shotX=enemy ? enemy.x-p.x : near && Math.abs(dy)>.3 ? 0 : dx || direction;
  const shotY=enemy ? enemy.y-p.y : dy;
  const length=Math.max(1,norm(shotX,shotY));
  const available=p.ore;
  let buy=-1, unit=-1;
  const crew=units.filter(u=>u.side===p.side && u.owner===p.id);
  if (crew.length===0 && available>=12 && !ready && p.level[0]>0) unit=0;
  else if (p.level[0]<2 && available>=upgradeCost(p.level[0])) buy=0;
  else if (ready && crew.length<2 && available>=18) unit=1;
  else if (p.level[1]<2 && available>=upgradeCost(p.level[1])) buy=1;
  else if (p.level[3]<2 && available>=upgradeCost(p.level[3])) buy=3;
  else if (p.level[2]<2 && available>=upgradeCost(p.level[2])) buy=2;
  if (enemy && p.gadgetAt<=time) useGadget(p);
  if (p.phone || cargo) buy=unit=-1;
  return {x:dx,y:dy,ax:shotX/length,ay:shotY/length,b:[!enemy && !cargo,Boolean(enemy),false,false,p.y>yGoal+4],buy,unit};
}
const PICK_HOLD = .23;
const minionArrows = ['←','↑','→'];
const upgradeArrows = ['←','↑','→','↓'];

function updatePicker(p,control,was) {
  if (!p.picker) {
    if (pressed(control,5,was)) p.picker={button:5,field:'minion',choices:minionTypes,started:time};
    else if (pressed(control,7,was)) p.picker={button:7,field:'upgrade',choices:upgradeTypes,started:time};
  }
  if (!p.picker) return false;
  const {button,field,choices,started}=p.picker;
  const opened=time-started>=PICK_HOLD;
  if (!control.b[button]) {
    if (!opened) {
      p[field]=(p[field]+1)%choices.length;
      note(p,choices[p[field]].blurb);
    }
    p.picker=null;
    return false;
  }
  if (!opened) return false;
  const {x,y}=control;
  if (norm(x,y)>.55) {
    const choice=Math.abs(x)>Math.abs(y) ? x<0 ? 0 : 2 : y<0 ? 1 : 3;
    if (choice<choices.length) p[field]=choice;
  }
  return true;
}

function updatePlayer(p,control,was,dt) {
  if (p.hp<=0) {
    if (p.backAt<=time) spawn(p);
    return;
  }
  if (mode==='practice' && pressed(control,3,was)) {beginLoadout();return;}
  if (mode==='loadout') return;
  if (pressed(control,6,was)) useGadget(p);
  if (updatePicker(p,control,was)) {
    move(p,empty,dt);
    return;
  }
  const magnitude=norm(control.x,control.y);
  if (control.ax!==undefined) {
    p.ax=control.ax; p.ay=control.ay;
  } else if (!control.independent && magnitude>.26) {
    p.ax=control.x/magnitude; p.ay=control.y/magnitude;
  }
  if (control.unit>=0) {
    p.minion=control.unit;
    summon(p);
  } else if (pressed(control,2,was)) summon(p);
  if (control.buy>=0) {
    p.upgrade=control.buy;
    purchase(p);
  } else if (pressed(control,3,was)) purchase(p);
  if (control.b[1] && !control.b[0] && p.shotAt<=time && !(p.diggingUntil>time)) {
    fire(p,p.ax,p.ay);
    p.digAt=Math.max(p.digAt,time+.18);
  } else if (control.b[0] && p.digAt<=time) dig(p);
  move(p,control,dt);
}

function tunnelsConnect(side) {
  const stride=STEP, width=NX,height=NY;
  const visited=new Uint8Array(width*height), queue=new Int32Array(width*height);
  const parent=new Int32Array(width*height).fill(-1);
  let front=0, back=0;
  function add(x,y,from=-1) {
    if (x<1 || x>=width-1 || y<1 || y>=height-1) return;
    const index=y*width+x;
    if (visited[index]) return;
    visited[index]=1;
    if (fits(x*stride+stride/2,y*stride+stride/2,6)) {
      queue[back++]=index;
      parent[index]=from;
    }
  }
  add(Math.floor(lift[side].x/stride),Math.floor(lift[side].y/stride));
  while (front<back) {
    const index=queue[front++], x=index%width,y=Math.floor(index/width);
    const offset=(x*stride+stride/2-W/2)*sideDir(side);
    if (offset>=CORE+8) {
      let middle=index;
      while (parent[middle]>=0 && ((middle%width)*stride+stride/2-W/2)*sideDir(side)>0) middle=parent[middle];
      return {x:(middle%width)*stride+stride/2,y:Math.floor(middle/width)*stride+stride/2,owner:null};
    }
    add(x+1,y,index); add(x-1,y,index); add(x,y+1,index); add(x,y-1,index);
  }
  return false;
}
function updateSupply(dt) {
  for (const cache of caches) {
    if (cache.claimed) continue;
    const finder=players.find(p=>p.hp>0 && between(cache,p)<24 && clearShot(p,cache));
    if (!finder) continue;
    cache.claimed=true;
    finder.ore+=24;
    note(finder,'+24 ORE CACHE');
    burst(cache.x,cache.y,'#ffcd78',16);
    if (finder.number) sound('buy');
  }
  if (!relay) return;
  const nearby=players.filter(p=>p.hp>0 && between(p,relay)<52 && clearShot(p,relay));
  const mint=nearby.some(p=>p.side===0), ember=nearby.some(p=>p.side===1);
  relay.owner=mint===ember ? null : Number(ember);
  if (relay.owner!==null) {
    const occupants=nearby.filter(p=>p.side===relay.owner);
    for (const p of occupants) p.ore+=dt*.65/occupants.length;
  }
}

function carrying(p) {return crystals.find(c=>c.carrier===p.id);}
function dropCrystal(p) {
  const crystal=carrying(p);
  if (!crystal) return;
  Object.assign(crystal,{x:p.x,y:p.y,state:'dropped',carrier:null,returnAt:time+12});
  announce(names[p.side]+' DROPPED THE CRYSTAL',2);
}
function returnCrystal(c,defender=null) {
  Object.assign(c,{...lift[c.side],state:'home',carrier:null,returnAt:0});
  if (defender) {defender.returns++;defender.ore+=5;}
  announce(names[c.side]+' CRYSTAL RETURNED',2);
}
function finish(side) {
  if (mode!=='play') return;
  result=side;
  if (side!==null) wins[side]++;
  mode='result';
  overlay();
  sound('win');
}
function updateCrystals() {
  for (const c of crystals) {
    const carrier=c.carrier && players.find(p=>p.id===c.carrier);
    if (carrier) {
      if (carrier.hp<=0) {dropCrystal(carrier);continue;}
      c.x=carrier.x;c.y=carrier.y;
    }
    if (c.state==='dropped') {
      const defender=players.find(p=>p.side===c.side && p.hp>0 && between(p,c)<23 && clearShot(p,c));
      if (defender || time>=c.returnAt) {returnCrystal(c,defender);continue;}
    }
    if (c.state==='carried') continue;
    if (c.state==='home' && units.some(u=>u.guard==='lift' && u.side===c.side && u.hp>0)) continue;
    const thief=players.find(p=>p.side!==c.side && p.hp>0 && !(p.noPickupUntil>time) && !carrying(p) && between(p,c)<24 && clearShot(p,c));
    if (thief) {
      Object.assign(c,{carrier:thief.id,state:'carried'});
      if(mode==='practice') thief.practicePicked=true;
      announce(names[thief.side]+' HAS THE CRYSTAL · BRING IT HOME',3);
      sound('alarm');
    }
  }
  // Evaluate delivery after both crystals update, making simultaneous steals fair.
  for (const p of players) {
    if (p.hp<=0 || !carrying(p) || between(p,lift[p.side])>=30 || !clearShot(p,lift[p.side])) continue;
    if (crystals[p.side].state==='home') {
      if(mode==='practice') {returnCrystal(carrying(p));note(p,'DELIVERED · YOU KNOW THE GOAL');}
      else {finish(p.side);return;}
    }
    note(p,'RETURN YOUR CRYSTAL FIRST');
  }
}
function step(current,dt,prior=previous) {
  time+=dt;
  if (breachAt===null && time>=previousScan+.7) {
    previousScan=time;
    if (tunnelChanged) {
      relay=tunnelsConnect(0) || tunnelsConnect(1);
      tunnelChanged=false;
    }
    if (!relay) {
      const crossed=players.find(p=>p.hp>0 && (p.x-W/2)*sideDir(p.side)>=CORE+8);
      if (crossed) {
        // A player's actual crossing also counts when a tight diagonal escapes the flood fill.
        let center=null;
        for (let y=12;y<H-12;y+=STEP) {
          if (fits(W/2,y,6) && (center===null || Math.abs(y-crossed.y)<Math.abs(center-crossed.y))) center=y;
        }
        relay={x:W/2,y:center ?? crossed.y,owner:null};
      }
    }
    if (relay) {
      breachAt=time;
      announce('BREACH · TUNNEL WAR BEGINS',4);
      sound('alarm');
    }
  }
  for (const p of players) p.ore+=dt*.18;
  for (const p of players) {
    const control=p.phoneLeft ? undefined : current.get(p.id);
    if (control) p.missingSince=null;
    else if (p.phone) {
      p.missingSince ??= time;
      p.picker=null;
    }
    const fallback=p.phone && time-p.missingSince<3 ? empty : bot(p);
    updatePlayer(p,control ?? fallback,prior.get(p.id) ?? empty,dt);
  }
  updateUnits(dt);
  updateShots(dt);
  updateSupply(dt);
  updateBombs(dt);
  if (mode==='practice') updateCrystals();
  if (mode==='play') {
    updateCrystals();
    if (!overtime && time>=180) {
      overtime=true;
      for(let i=0;i<terrain.length;i++) if (rock[i]===BEDROCK && terrain[i]!==Infinity) {
        terrain[i]=Math.min(terrain[i],2);
        paintCell(i%NX,Math.floor(i/NX));
      }
      dirty=tunnelChanged=true;
      announce('OVERTIME · 30 SECONDS · BEDROCK CRACKED',5);
    }
    if (time>=210) finish(null);
  }
  for (const particle of particles) {
    particle.x+=particle.vx*dt; particle.y+=particle.vy*dt;
    particle.vy+=280*dt; particle.life-=dt;
  }
  particles=particles.filter(p=>p.life>0);
}

function rect(x,y,w,h,color) {
  ctx.fillStyle=color;
  ctx.fillRect(x,y,w,h);
}
function label(value,x,y,size,color='#fff0d5',align='left',weight=800) {
  ctx.fillStyle=color; ctx.font=weight+' '+size+'px system-ui,sans-serif';
  ctx.textBaseline='middle'; ctx.textAlign=align;
  ctx.fillText(value,x,y);
}
function line(x,y,toX,toY,color,width=2) {
  ctx.lineWidth=width; ctx.strokeStyle=color;
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(toX,toY); ctx.stroke();
}
function circle(x,y,r,color,stroke=false,width=2) {
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  if (stroke) {
    ctx.strokeStyle=color; ctx.lineWidth=width; ctx.stroke();
  } else {
    ctx.fillStyle=color; ctx.fill();
  }
}
function scene(now) {
  if (dirty) {
    terrainCtx.putImageData(terrainImage,0,0);
    dirty=false;
  }
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(ground,0,TOP,W,H);
  if(breachAt===null && mode==='play') {
    label('BEDROCK',W/2,TOP+25,14,'#bfa6f7','center');
    label('DRILL UPGRADES CUT FASTER',W/2,TOP+44,10,'#c1abd4','center');
  }
  for (const cache of caches) {
    if (cache.claimed) continue;
    const y=TOP+cache.y;
    circle(cache.x,y,17,'#efb571a0',true);
    circle(cache.x,y,10,'#3b252e');
    label('◆',cache.x,y,16,'#ffd68d','center');
  }
  if (relay) {
    const color=relay.owner===null ? '#dfb6df' : colors[relay.owner];
    const y=TOP+relay.y;
    circle(relay.x,y,52,color+'25');
    circle(relay.x,y,52,color+'94',true);
    circle(relay.x,y,11,'#241828');
    label('◆',relay.x,y,16,color,'center');
    label('ORE RELAY',relay.x,y-58,11,color,'center');
  }
  const active=breachAt!==null;
  for (let side=0;side<2;side++) {
    const p=lift[side], color=colors[side], y=TOP+p.y;
    circle(p.x,y,40,color+'13');
    circle(p.x,y,40,active ? color+'b0' : color+'3c',true);
    rect(p.x-16,y-16,32,33,'#10111a');
    rect(p.x-15,y-16,30,2,color);
    rect(p.x-15,y+15,30,2,color);
    rect(p.x-12,y-12,5,25,color+'af');
    rect(p.x+7,y-12,5,25,color+'af');
    const guarded=units.some(u=>u.guard==='lift' && u.side===side);
    label(active && !guarded ? '⇅' : '×',p.x,y,18,color,'center');
    label(names[side]+' HOME',p.x,y-49,11,color,'center');
  }
  for (const crystal of crystals) {
    const color=colors[crystal.side], y=TOP+crystal.y-(crystal.carrier ? 34 : 0);
    circle(crystal.x,y,18,color+'24');
    label('◆',crystal.x,y,27,color,'center');
    if (crystal.state==='dropped') label(timer(crystal.returnAt-time),crystal.x,y-23,12,color,'center');
    if (crystal.carrier) {
      const carrier=players.find(p=>p.id===crystal.carrier);
      line(crystal.x,y-18,lift[carrier.side].x,TOP+lift[carrier.side].y,colors[carrier.side]+'55',2);
    }
  }
  for (const bomb of bombs) {
    circle(bomb.x,TOP+bomb.y,8,'#ffb679');
    circle(bomb.x,TOP+bomb.y,11+(Math.sin(now*16)+1)*2,'#ffb679',true);
  }
  for (const u of units) {
    const y=TOP+u.y,color=u.flashUntil>time ? '#fff2ce' : colors[u.side];
    if (u.charge) {
      const {dx,dy,distance}=u.charge;
      line(u.x,y,u.x+dx*distance,y+dy*distance,color+'a0',2);
      circle(u.x,y,12,color,true);
    }
    circle(u.x,y,9,'#100f1a');
    if (u.type===0) {
      rect(u.x-6,y-5,12,10,color);
      line(u.x,y,u.x+u.dx*12,y+u.dy*12,'#fff2b4',3);
    } else if (u.type===1) {
      circle(u.x,y,6,color);
      rect(u.x-10,y-1,20,3,color);
    } else {
      rect(u.x-7,y-6,14,13,color);
      rect(u.x-3,y-10,6,9,color);
    }
    if (u.guard) label(u.guard==='lift' ? 'LIFT GUARD' : 'OUTPOST',u.x,y-16,10,color,'center');
    rect(u.x-8,y+10,16*Math.min(1,u.hp/(u.maxHp || minionTypes[u.type].hp)),2,color+'ac');
  }
  for (const p of players) {
    const color=colors[p.side], profile=window.couchJoinstick?.profile?.(p.index);
    const identity=profile?.name || (p.number ? 'P'+p.number : 'CPU');
    if (p.hp<=0) {
      label(identity+' · '+timer(p.backAt-time),p.x,TOP+p.y-11,12,color,'center');
      continue;
    }
    const x=p.x,y=TOP+p.y;
    if (p.shield>time) circle(x,y,15,color+'91',true);
    circle(x,y,12,'#131020');
    rect(x-7,y-4,14,12,color);
    rect(x-5,y+8,4,4,'#f1c292');
    rect(x+1,y+8,4,4,'#f1c292');
    rect(x-7,y-10,14,8,profile?.accent || '#ffe0a9');
    rect(x-9,y-5,18,3,'#fff1d6');
    line(x+p.ax*8,y+p.ay*8,x+p.ax*16,y+p.ay*16,'#fff1d6',4);
    label(identity,x,y-22,14,profile?.accent || color,'center');
    rect(x-12,y+16,24,3,'#271d29');
    rect(x-12,y+16,24*clamp(p.hp/health(p),0,1),3,color);
    if (p.fuel<.99) rect(x-12,y+20,24*p.fuel,2,'#ffc46e');
    if (p.diggingUntil>time && !carrying(p)) {
      const tx=clamp(Math.floor((p.x+p.ax*25)/STEP),0,NX-1),ty=clamp(Math.floor((p.y+p.ay*25)/STEP),0,NY-1);
      const i=ty*NX+tx;
      if(terrain[i]>0 && terrain[i]!==Infinity) {
        const max=rock[i]===BEDROCK ? 550*(1+Math.min(3,teamSize()-1)*.66) : rock[i]===FORTIFICATION ? 250 : 12;
        const fraction=clamp(1-terrain[i]/max,.02,1);
        rect(x-19,y+26,38,3,'#32293e');
        rect(x-19,y+26,38*fraction,3,rock[i]===BEDROCK?'#bba1ff':'#ffd28b');
      }
    }
    if (p.noteUntil>time) label(p.note,x,y-37,12,'#fff1d6','center');
  }
  for (const shot of shots) {
    line(shot.x-shot.dx*13,TOP+shot.y-shot.dy*13,shot.x,TOP+shot.y,colors[shot.side],5);
    circle(shot.x,TOP+shot.y,2.5,'#fff4d7');
  }
  for (const particle of particles) {
    ctx.globalAlpha=Math.min(1,particle.life*4);
    rect(particle.x,TOP+particle.y,3,3,particle.color);
  }
  ctx.globalAlpha=1;
  if ((mode==='play' || mode==='practice') && messageUntil>time) {
    const alpha=Math.min(1,(messageUntil-time)*2);
    ctx.globalAlpha=alpha*(.93+Math.sin(now*5)*.07);
    rect(W/2-257,TOP+12,514,34,'#161321ed');
    label(message,W/2,TOP+30,17,'#ffe0a5','center',900);
    ctx.globalAlpha=1;
  }
}
function dashboard() {
  rect(0,0,W,TOP,'#191624');
  rect(0,TOP+H,W,700-TOP-H,'#191624');
  line(0,TOP-1,W,TOP-1,'#65485b');
  line(0,TOP+H+1,W,TOP+H+1,'#65485b');
  for (let side=0;side<2;side++) {
    const x=side ? W-24 : 24, align=side ? 'right' : 'left', color=colors[side], team=teams?.[side];
    label(names[side],x,22,23,color,align,950);
    label(team ? 'CRYSTAL '+(crystals[side]?.state || 'home').toUpperCase()+'  ·  '+wins[side]+' WINS' : 'MINING COMPANY',
      x,49,15,'#e9d2d5',align,750);
  }
  const phase=mode==='practice' ? 'PRACTICE · '+Math.ceil(phaseTime)+'s' : overtime ? 'OVERTIME' : breachAt===null ? 'MINE & BUILD' : 'STEAL & ESCAPE';
  const objective=mode==='practice' ? phaseTime>14 ? 'LEFT THUMB MOVES · UP JETS'
      : phaseTime>8 ? 'DRAG RIGHT TO FIRE · HOLD DIG TO TUNNEL' : 'TOUCH THEIR CRYSTAL · CARRY IT HOME'
    : 'STEAL THEIR CRYSTAL → BRING IT HOME';
  label(phase,W/2,22,20,breachAt===null ? '#73efda' : '#ffc580','center',900);
  label(objective,W/2,49,14,'#ead7e0','center');
  if (mode==='play') label(maps[mapIndex].name+' · '+timer((overtime ? 210 : 180)-time),W/2,69,13,'#f4bd88','center');
  if (!players.length) {
    label('MINE A ROUTE   /   STEAL THEIR CRYSTAL   /   CARRY IT HOME',W/2,659,14,'#cdb8cf','center');
    return;
  }
  const humans=players.filter(p=>p.number);
  const shown=humans.slice(0,8);
  const columns=Math.min(4,shown.length);
  const width=W/columns;
  shown.forEach((p,i)=>{
    const x=width*(i%columns)+14,y=TOP+H+13+Math.floor(i/columns)*37;
    const color=colors[p.side], minion=minionTypes[p.minion], upgrade=upgradeTypes[p.upgrade], tier=p.level[p.upgrade];
    const profile=window.couchJoinstick?.profile?.(p.index);
    label(profile?.name || 'P'+p.number,x,y+5,13,profile?.accent || color);
    if (p.picker && time-p.picker.started>=PICK_HOLD) {
      const {choices,field}=p.picker, isUpgrade=field==='upgrade';
      const arrows=isUpgrade ? upgradeArrows : minionArrows;
      label(isUpgrade ? 'UPGRADES' : 'MINIONS',x+29,y+5,12,color);
      choices.forEach((item,j)=>{
        const level=p.level[j];
        const cost=isUpgrade ? level===2 ? 'MAX' : upgradeCost(level) : item.cost;
        const compact=width<500;
        const columns=compact ? 2 : choices.length;
        label(arrows[j]+item.name+' '+cost,x+29+(j%columns)*(width-43)/columns,y+17+Math.floor(j/columns)*12,11,
          j===p[field] ? color : '#d5bfd6');
      });
    } else {
      label(Math.floor(p.ore)+' ORE · '+ownedUnits(p)+'/4 CREW',x+64,y+5,12,'#f2e2ed');
      label(carrying(p) ? (p.side ? 'CARRY HOME →' : '← CARRY HOME') : gadgets[p.gadget].name+' · '+(p.gadgetAt>time ? Math.ceil(p.gadgetAt-time)+'s' : 'READY'),
        x+29,y+21,12,'#d5bfd6');
    }
  });
}
let last=performance.now(), accumulator=0;
function frame(now) {
  const dt=clamp((now-last)/1000,0,.1);
  last=now;
  const current=input();
  if (mode==='play' || mode==='practice') {
    accumulator+=dt;
    let prior=previous;
    while (accumulator>=1/60 && (mode==='play' || mode==='practice')) {
      step(current,1/60,prior);
      if (mode==='practice') {
        phaseTime-=1/60;
        if (phaseTime<=0) beginLoadout();
      }
      prior=current;
      accumulator-=1/60;
    }
    previous=prior;
  } else {
    accumulator=0;
    if (mode==='loadout') {
      phaseTime-=dt;
      if (phaseTime<=0) startMatch();
      else overlay();
    } else menu(current);
    previous=current;
  }
  scene(now/1000);
  dashboard();
  requestAnimationFrame(frame);
}
function routeY(x) {
  const t=clamp((x-143)/(W-286),0,1);
  if (mapIndex===1) return 196+144*t+Math.sin(t*Math.PI*2)*38;
  return mapIndex===2 ? 264+Math.sin(t*Math.PI*2)*80 : 278;
}
function switchTeam(seat) {
  if (!seat) return;
  if (roster.length>1 && roster.filter(p=>p.side===seat.side).length===1) return;
  seat.side=1-seat.side;seat.ready=false;
  overlay();
}
function beginLoadout() {
  if(mode==='practice') mapIndex=-1;
  mode='loadout';phaseTime=8;
  roster.forEach(p=>p.ready=false);
  overlay();
}
function resultSummary() {
  const top=players.reduce((best,p)=>p.mined>(best?.mined ?? -1) ? p : best,null);
  const name=p=>(window.couchJoinstick?.profile?.(p.index)?.name || (p.number ? 'P'+p.number : 'CPU')).replace(/[&<>"']/g,'');
  const returns=players.reduce((best,p)=>p.returns>(best?.returns ?? 0) ? p : best,null);
  return 'Round '+round+' · '+timer(time)+' · '+wins[0]+'–'+wins[1]+' team wins<br>'+
    (returns ? name(returns)+' returned '+returns.returns+' crystal'+(returns.returns===1 ? '' : 's')
      : top ? name(top)+' mined '+Math.round(top.mined*16/1000)+'k rock' : 'Choose a gadget for the next mine.');
}
function navigate(p,destination) {
  const spacing=12,width=Math.floor(W/spacing),height=Math.floor(H/spacing);
  const indexOf=(x,y)=>clamp(Math.floor(y/spacing),0,height-1)*width+clamp(Math.floor(x/spacing),0,width-1);
  const target=indexOf(destination.x,destination.y);
  if (p.navigation && p.navigation.until>time && p.navigation.target===target) {
    const path=p.navigation.path;
    while(path.length>1 && between(p,path[0])<9) path.shift();
    return path[0];
  }
  let start=indexOf(p.x,p.y);
  let closest=Infinity;
  for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) {
    const x=Math.floor(p.x/spacing)+dx,y=Math.floor(p.y/spacing)+dy;
    const point={x:x*spacing+6,y:y*spacing+6};
    const d=between(p,point);
    if(x<1 || x>=width-1 || y<1 || y>=height-1 || d>=closest || !fits(point.x,point.y,10) || !clearShot(p,point)) continue;
    start=y*width+x;closest=d;
  }
  const visited=new Uint8Array(width*height),parent=new Int32Array(width*height).fill(-1);
  const queue=[start];visited[start]=1;
  let end=start,best=Infinity;
  for(let head=0;head<queue.length;head++) {
    const index=queue[head],x=index%width,y=Math.floor(index/width);
    const point={x:x*spacing+6,y:y*spacing+6};
    const distance=between(point,destination);
    if(distance<best){best=distance;end=index;}
    if(distance<22) break;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const nx=x+dx,ny=y+dy,next=ny*width+nx;
      if(nx<1 || nx>=width-1 || ny<1 || ny>=height-1 || visited[next]) continue;
      visited[next]=1;
      const to={x:nx*spacing+6,y:ny*spacing+6};
      if(!fits(to.x,to.y,10) || !clearShot(point,to)) continue;
      parent[next]=index;queue.push(next);
    }
  }
  const path=[];
  while(end!==start && end>=0) {
    path.unshift({x:(end%width)*spacing+6,y:Math.floor(end/width)*spacing+6});
    end=parent[end];
  }
  p.navigation={until:time+.7,target,path};
  return path[Math.min(1,path.length-1)];
}
function useGadget(p) {
  if (p.hp<=0 || p.gadgetAt>time) return false;
  const spec=gadgets[p.gadget];
  p.gadgetAt=time+spec.cooldown;
  if (p.gadget===0) {
    for(let i=0;i<32;i++) {
      const x=p.x+p.ax*4,y=p.y+p.ay*4;
      if(!fits(x,y,p.r)) break;
      p.x=x;p.y=y;
      if(!reducedMotion && i%3===0) burst(x,y,colors[p.side],1);
    }
    p.vy=Math.min(p.vy,0);
  } else if(p.gadget===1) {
    bombs.push({x:p.x,y:p.y,dx:p.ax,dy:p.ay,side:p.side,owner:p.id,explodeAt:time+1,stuck:false});
  } else p.shield=time+2;
  note(p,spec.name);
  sound('buy');
  return true;
}
function updateBombs(dt) {
  for(const bomb of bombs) {
    if(!bomb.stuck) {
      for(let i=0;i<4;i++) {
        const x=bomb.x+bomb.dx*240*dt/4,y=bomb.y+bomb.dy*240*dt/4;
        if(solid(x,y)){bomb.stuck=true;break;}
        bomb.x=x;bomb.y=y;
      }
    }
    if(time<bomb.explodeAt) continue;
    // One explosion hits each cell once. Bedrock takes less than one drill pulse.
    const left=clamp(Math.floor((bomb.x-57)/STEP),1,NX-2),right=clamp(Math.ceil((bomb.x+57)/STEP),1,NX-2);
    const top=clamp(Math.floor((bomb.y-57)/STEP),1,NY-2),bottom=clamp(Math.ceil((bomb.y+57)/STEP),1,NY-2);
    for(let y=top;y<=bottom;y++) for(let x=left;x<=right;x++) {
      const index=y*NX+x;
      if(Math.hypot(x*STEP-bomb.x,y*STEP-bomb.y)>55 || !terrain[index] || terrain[index]===Infinity) continue;
      terrain[index]=Math.max(0,terrain[index]-(rock[index]===BEDROCK ? .5 : 35));
      if(!terrain[index]) {ore[index]=0;tunnelChanged=true;}
      paintCell(x,y);dirty=true;
    }
    if(breachAt!==null) for(const target of players.concat(units)) {
      if(target.side!==bomb.side && between(target,bomb)<58) hurt(target,48,bomb.side);
    }
    burst(bomb.x,bomb.y,'#ffbd81',reducedMotion ? 5 : 22);
    sound('shot');
    bomb.done=true;
  }
  bombs=bombs.filter(b=>!b.done);
}
function phoneCommand(index,data) {
  const id='pad:'+index;
  const seat=roster.find(p=>p.id===id);
  const p=players.find(p=>p.id===id && p.phone && !p.phoneLeft);
  if(data.leave===true) {
    unseat(id);
    if(p) {dropCrystal(p);p.phoneLeft=true;}
    return;
  }
  if(!seat) return;
  if(data.command==='ready' && (mode==='lobby' || mode==='result')) {
    seat.ready=!seat.ready;overlay();return;
  }
  if(data.command==='team' && (mode==='lobby' || mode==='result')) {switchTeam(seat);return;}
  if(data.command==='gadgetChoice' && mode==='loadout' && Number.isInteger(data.choice) && gadgets[data.choice]) {
    seat.gadget=data.choice;return;
  }
  if(seat.id===host && data.command==='practice' && (mode==='lobby' || mode==='result')) {
    practiceSeen=true;startMatch(true);return;
  }
  if(seat.id===host && data.command==='skip' && mode==='practice') {beginLoadout();return;}
  if(data.command==='settings') {
    if(seat.id!==host) return;
    if(typeof data.muted==='boolean') muted=data.muted;
    if(typeof data.reducedMotion==='boolean') reducedMotion=data.reducedMotion;
    return;
  }
  if(!p || (mode!=='play' && mode!=='practice')) return;
  if(data.command==='crew') {p.holdCrew=!p.holdCrew;note(p,p.holdCrew ? 'HUNTERS HOLD' : 'HUNTERS FOLLOW');return;}
  if(data.command==='gadget') {useGadget(p);return;}
  if(data.kind!=='minion' && data.kind!=='upgrade') return;
  const options=data.kind==='minion' ? minionTypes : upgradeTypes;
  if(!Number.isInteger(data.choice) || !options[data.choice]) return;
  // Selection from a previous phone build remains compatible.
  if(data.buy!==true) {p[data.kind]=data.choice;return;}
  if(typeof data.request!=='string' || data.request.length>100 || p.seenRequests.has(data.request)) return;
  p.seenRequests.add(data.request);
  if(p.seenRequests.size>200) p.seenRequests.delete(p.seenRequests.values().next().value);
  p[data.kind]=data.choice;
  const success=p.hp>0 && (data.kind==='minion' ? summon(p) : purchase(p));
  if(p.hp<=0) note(p,'RESPAWNING · BUY WHEN READY');
  p.receipt={id:data.request,ok:Boolean(success),text:p.note};
}
function describePhones() {
  const descriptions={_default:{version:2,phase:mode}};
  for (const seat of roster) {
    if(!seat.phone) continue;
    const p=(mode==='play' || mode==='practice') && players.find(p=>p.id===seat.id);
    const info={version:2,player:window.couchJoinstick?.profile?.(seat.index)?.name || 'P'+seat.number,
      team:names[seat.side],color:colors[seat.side],phase:mode,host:seat.id===host,
      ready:seat.ready,allReady:roster.every(s=>s.id===host || s.ready || s.offlineAt!=null),size:teamSize(),
      gadgets,gadget:seat.gadget ?? 0,remaining:Math.ceil(phaseTime),muted,reducedMotion,
      map:maps[(mode==='loadout' ? mapIndex+1 : Math.max(0,mapIndex))%maps.length].name};
    if(p) {
      Object.assign(info,{minion:p.minion,upgrade:p.upgrade,hp:Math.max(0,Math.ceil(p.hp)),maxHp:health(p),
        fuel:Math.round(p.fuel*10),ore:Math.floor(p.ore),crew:ownedUnits(p),holdCrew:p.holdCrew,
        cooldown:Math.max(0,Math.ceil(p.gadgetAt-time)),carrying:Boolean(carrying(p)),
        objective:carrying(p) ? crystals[p.side].state==='home' ? 'BRING IT HOME' : 'RETURN YOUR CRYSTAL FIRST'
          : crystals[p.side].state!=='home' ? 'YOUR CRYSTAL IS STOLEN' : 'STEAL THEIR CRYSTAL',
        practice:mode==='practice' ? [p.practiceMoved>.3,p.practiceDug,p.practiceFired,p.practicePicked] : null,
        respawn:p.hp<=0 ? Math.max(0,Math.ceil(p.backAt-time)) : 0,receipt:p.receipt,
        minions:minionTypes.map(({name,cost,blurb})=>({name,cost,detail:blurb})),
        upgrades:upgradeTypes.map(({name,blurb},i)=>({name,detail:blurb,level:p.level[i],cost:p.level[i]===2 ? 'Max' : upgradeCost(p.level[i])}))});
    }
    descriptions[seat.index]=info;
  }
  return descriptions;
}
window.couchJoinstick?.describe(describePhones);
window.couchJoinstick?.onBedrockMessage?.(phoneCommand);
overlay();
requestAnimationFrame(frame);
