'use strict';

const $=id=>document.getElementById(id);
const stick=$('stick');
const buttons=[...document.querySelectorAll('[data-bit]')];
const fingers=new Map();
let token=null, stickPointer=null, origin, x=0, y=0, mask=0;
let pending=[], dirty=false, busy=false, lastSent=0, lastReply=0;

async function request(path, body) {
  const cancel=new AbortController();
  const timeout=setTimeout(()=>cancel.abort(),1100);
  try {
    return await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),cache:'no-store',signal:cancel.signal});
  } finally {clearTimeout(timeout);}
}

function state() {return [x,y,mask];}

function mark() {
  dirty=true;
  pending.push(state());
  if (pending.length > 48) pending.shift();
  transmit();
}

function setButton(bit, down) {
  const flag=1<<bit;
  const next=down ? mask|flag : mask&~flag;
  if(next===mask) return;
  mask=next;
  buttons.find(button=>Number(button.dataset.bit)===bit).classList.toggle('held',down);
  mark();
}

function resetStick() {
  stickPointer=null;
  x=0;y=0;
  stick.classList.remove('active');
  stick.style.setProperty('--dx','0px');
  stick.style.setProperty('--dy','0px');
  dirty=true;
}

function neutral() {
  resetStick();
  fingers.clear();
  for(const button of buttons)button.classList.remove('held');
  mask=0;
  pending=[state()];
  dirty=true;
  transmit();
}

function setLabels(info) {
  const {player,mode,host,team}=info;
  $('player').textContent=player ? player+(host ? ' ★' : '') : 'JOINING';
  $('status').textContent=team || 'Waiting for the game';
  const lobby=mode==='lobby' || !mode;
  const defense=mode==='defense';
  const kicking=mode==='kickMeter' || mode==='kickFlight';
  const trying=mode==='try', ready=mode==='ready', paused=mode==='paused';
  $('controls').classList.toggle('offense',mode==='offense');
  $('top').textContent=lobby ? 'START' : paused ? 'RESUME' : kicking || trying || ready ? 'KICK' : 'HANDOFF';
  $('top-help').textContent=lobby || paused ? 'P1' : trying ? '+1' : kicking ? 'TIME IT' : '';
  $('bottom').textContent=lobby ? 'BOOTS' : trying ? 'GO FOR 2' : ready ? 'SNAP' : defense ? 'PICK' : 'PASS';
  $('bottom-help').textContent=lobby || ready ? 'TAP' : defense ? 'TIME IT' : trying ? '+2' : 'HOLD';
  $('left').textContent=lobby ? 'HELMET' : 'DASH';
  $('right').textContent=lobby ? 'LEAVE' : defense ? 'GRAPPLE' : 'SPRINT';
  $('hint').textContent=lobby ? 'Tap R1 to switch sides. P1 can hold R1 + stick up/down to adjust CPUs.'
    : paused ? 'P1 can resume with Start.'
    : trying ? 'Choose Kick for one point or Go for 2.'
    : ready ? 'Use the stick to change the play. Tap Snap when ready.'
    : defense ? 'Dash to close the gap. Hold Grapple when you’re facing the runner.'
    : kicking ? 'Press Kick when the marker reaches the target.'
    : 'Hold Pass to charge, aim with the stick, and release to throw.';
  $('stick-label').textContent=lobby ? 'MOVE' : 'MOVE / AIM';
}

async function transmit() {
  if (!token || busy) return;
  const now=performance.now();
  if (!dirty && now-lastSent<480) return;
  busy=true;
  lastSent=now;
  dirty=false;
  const events=pending.splice(0,48);
  try {
    const reply=await request('input',{token,state:state(),events});
    if (reply.status===410) {
      token=null;
      neutral();
      $('join').hidden=false;
      $('controls').hidden=true;
      $('player').textContent='OFFLINE';
      $('status').textContent='Press Join to reconnect';
      return;
    }
    if (reply.ok) {
      setLabels(await reply.json());
      lastReply=performance.now();
    }
  } catch {
    if (performance.now()-lastReply>850) $('status').textContent='Reconnecting…';
  } finally {
    busy=false;
    if (token && pending.length) transmit();
  }
}

$('connect').onclick=async()=>{
  $('connect').disabled=true;
  try {
    const reply=await request('join',{});
    if (!reply.ok) {
      $('status').textContent='The room is full';
      return;
    }
    ({token}=await reply.json());
    $('join').hidden=true;
    $('controls').hidden=false;
    lastReply=performance.now();
    neutral();
  } catch {$('status').textContent='Could not reach Blitz 7';}
  finally {$('connect').disabled=false;}
};

stick.addEventListener('pointerdown',event=>{
  if (stickPointer!==null) return;
  origin={x:event.clientX,y:event.clientY};
  stickPointer=event.pointerId;
  stick.setPointerCapture(event.pointerId);
  stick.classList.add('active');
});

stick.addEventListener('pointermove',event=>{
  if (event.pointerId!==stickPointer) return;
  const dx=event.clientX-origin.x, dy=event.clientY-origin.y;
  const distance=Math.hypot(dx,dy), radius=44;
  const power=Math.min(1,Math.max(0,(distance-5)/(radius-5)));
  x=distance ? Math.round(dx/distance*power*100)/100 : 0;
  y=distance ? Math.round(dy/distance*power*100)/100 : 0;
  stick.style.setProperty('--dx',x*radius+'px');
  stick.style.setProperty('--dy',y*radius+'px');
  dirty=true;
});

for(const button of buttons) {
  button.addEventListener('pointerdown',event=>{
    const bit=Number(button.dataset.bit);
    fingers.set(event.pointerId,bit);
    button.setPointerCapture(event.pointerId);
    setButton(bit,true);
  });
}

function release(event) {
  if (event.pointerId===stickPointer) resetStick();
  if (!fingers.has(event.pointerId)) return;
  const bit=fingers.get(event.pointerId);
  fingers.delete(event.pointerId);
  if (![...fingers.values()].includes(bit)) setButton(bit,false);
}

for(const element of [...buttons,stick]) {
  for(const event of ['pointerup','pointercancel','lostpointercapture']) element.addEventListener(event,release);
  element.addEventListener('contextmenu',event=>event.preventDefault());
}
window.addEventListener('blur',neutral);
window.addEventListener('pagehide',neutral);
document.addEventListener('visibilitychange',()=>{if(document.hidden) neutral();});
setInterval(transmit,33);
