'use strict';

const kineticChargeTime = .68;
const kineticPulseThreshold = .59;
const kineticDeck = [
  {name:'Pinball God', text:'Fighters you hit with a charged shove rebound off one wall.', tags:['bank','impact'], rebound:(p,t,axis,force,power)=>{if(power<kineticPulseThreshold)return; t['v'+axis]*=-.86;return true;}},
  {name:'Triple Trouble', text:'Your shove covers three lanes. Side lanes trade force for coverage.', tags:['split','impact'], shape:'triple'},
  {name:'Echo Fist', text:'Charged shoves repeat in place after a short beat at reduced force.', tags:['echo','impact'], echo:true},
  {name:'Rocket Boots', text:'Dash primes your next shove to travel farther. Land it to recover part of your dash.', tags:['dash','impact'], dash:p=>{p.kinRocketUntil=matchTime+1.1;}},
  {name:'Gravity Hands', text:'Charging draws nearby fighters closer. Release to shove them back out.', tags:['pull','impact'], pull:true},
  {name:'Mirror Match', text:'Perfect parries prime your next shove to hit behind you too.', tags:['guard','split','impact'], defense:p=>{p.kinMirror=true;}},
  {name:'Swap Meet', text:'A full shove swaps you with a fighter when both landings are clear.', tags:['trick','impact'], strike:(p,t,power)=>{if(power>=.99 && clearComboLanding(t,p,t) && clearComboLanding(p,t,p)){const spot={x:p.x,y:p.y};comboTeleport(p,t);comboTeleport(t,spot);}}},
  {name:'Domino Effect', text:'Fighters you launch kick a pulse sideways when they hit a wall.', tags:['impact','bank','wave'], wallImpact:(p,t,axis,force)=>kineticEmit(p,t,axis==='x'?0:p.fx,axis==='x'?p.fy||1:0,force*.64,{generation:1})},
  {name:'Boomerang', text:'A charged shove sends a delayed return shove back toward you from its outer edge.', tags:['bank','echo','impact'], returnShove:true},
  {name:'Slingshot', text:'Dash against a launch to bank its momentum for your next shove.', tags:['dash','impact'], dash:p=>{if(p.fx*p.vx+p.fy*p.vy< -110){p.kinStored=Math.min(620,Math.hypot(p.vx,p.vy));flash('marker',p.x,p.y,p.color,38,.4);}}},
  {name:'Puppet Master', text:'Dash leaves a decoy. Charged shoves also come from that spot at reduced force.', tags:['trick','impact','dash'], dash:p=>kineticDecoy(p), decoy:true},
  {name:'Black Hole', text:'A charged shove leaves a short pull field at the edge of its reach for your next setup.', tags:['pull','impact'], charge:(p,point,profile)=>kineticField(p,{x:point.x+p.fx*profile.range*.82,y:point.y+p.fy*profile.range*.82},'well')},
  {name:'Punching Bag', text:'Move slower and absorb part of a hit to power your next shove.', tags:['guard','impact'], weight:true, absorb:(p,force)=>{p.kinStored=Math.min(660,(p.kinStored||0)+force*.33);return force*.69;}},
  {name:'Chain Lightning', text:'A shove that lands sends a pulse toward another nearby fighter.', tags:['impact','wave'], strike:(p,t)=>{const next=players.find(q=>q!==t && q!==p && !q.out && !friendly(p,q) && nearPoint(t,q,190));if(next)kineticEmit(p,t,next.x-t.x,next.y-t.y,540,{generation:1});}},
  {name:'House of Cards', text:'Your shove hits build bumpers. Fighters and pulses can use them.', tags:['impact','bank'], strike:(p,t)=>kineticBumper(p,t)},
  {name:'Last Laugh', text:'Once per fight, brake a dangerous launch near the rim and prime a stronger shove.', tags:['guard','impact'], rescue:true},
  {name:'Reverse Card', text:'Perfect parries prime your next shove to pull fighters toward you.', tags:['guard','pull','impact'], defense:p=>{p.kinReverse=true;}},
  {name:'Superball', text:'Charged shoves launch fighters into two elastic wall rebounds.', tags:['bank','impact'], rebound:(p,t,axis,force,power)=>{if(power<kineticPulseThreshold)return;t['v'+axis]*=-.96;return true;}, rebounds:2},
].map((effect,i)=>[effect.name,i%5===0?'Epic':'Rare',effect.text,{['kinetic'+i]:1},effect]);

const kineticWaves=[];
const kineticProps=[];
const kineticQueue=[];
const kineticLimits={waves:56, props:28, queue:32, generation:2};
const kineticRoundLimit=43;
let kineticStarted=0;
let kineticImpact=0;
let kineticShake=0;
let kineticAudio;
let kineticDraft=null;

function kineticHooks(p,event,...args) {
  for (const card of builds[players.indexOf(p)] || []) card[4]?.[event]?.(...(['emit','pulse'].includes(event) ? args : [p,...args]));
}
function kineticHas(p,name) {
  return (builds[players.indexOf(p)] || []).some(card=>card[4]?.[name]);
}
function kineticReset() {
  kineticWaves.length=kineticProps.length=kineticQueue.length=0;
  kineticStarted=matchTime;
  kineticImpact=kineticShake=0;
  kineticDraft=null;
}
const kineticSounds={charge:[330,510,.10],release:[186,77,.12],hit:[122,50,.15],parry:[480,980,.19],bank:[380,240,.08],out:[220,38,.28]};

function kineticSound(kind,scale=1) {
  const [start,end,length]=kineticSounds[kind];
  playGameTone(kineticAudio,start,length,kind==='parry'?'sine':'triangle',.09*Math.min(1.4,scale),0,end,.014);
}
function unlockKineticAudio() {
  const Type=window.AudioContext || window.webkitAudioContext;
  if (!Type) return;
  try {kineticAudio ||= new Type();kineticAudio.resume().catch(()=>{});} catch {}
}
window.addEventListener('keydown',unlockKineticAudio);
window.addEventListener('pointerdown',unlockKineticAudio);

function kineticEmit(owner,point,dx,dy,force,options={}) {
  const length=Math.hypot(dx,dy);
  if (!length || force<95 || (options.generation||0)>kineticLimits.generation) return;
  const event={owner,x:point.x,y:point.y,angle:Math.atan2(dy,dx),angles:[0],force,...options};
  if (!options.generation) kineticHooks(owner,'emit',event);
  kineticSpawn(event);
  if (event.repeat && kineticQueue.length<kineticLimits.queue) {
    kineticQueue.push({...event,echo:true,repeat:false,at:matchTime+.32,force:event.force*.68,refund:false});
    flash('marker',point.x,point.y,owner.color,33,.32);
  }
}
function kineticSpawn(e) {
  for(const offset of e.angles) {
    if (kineticWaves.length>=kineticLimits.waves) return;
    const angle=e.angle+offset;
    const w={owner:e.owner,creator:e.creator||e.owner,x:e.x,y:e.y,vx:Math.cos(angle),vy:Math.sin(angle),
      force:e.force,speed:650,banks:0,gain:1,until:matchTime+.44,generation:e.generation||0,refund:e.refund,touch:new Set(e.skip)};
    if (!w.generation) kineticHooks(w.owner,'pulse',w);
    if (w.banks) w.until+=.72;
    kineticWaves.push(w);
  }
}
function kineticProp(owner,point,kind,ttl,extra={}) {
  if (kineticProps.length>=kineticLimits.props) kineticProps.shift();
  kineticProps.push({owner,x:point.x,y:point.y,kind,until:matchTime+ttl,...extra});
}
function kineticField(p,point,kind) {
  kineticProp(p,point,kind,kind==='pull'?.25:1.25,{radius:104});
}
function kineticBumper(p,target) {
  const point={x:target.x,y:target.y};
  if (!currentMap.safeFootprint(point.x,point.y,17)) return;
  if(kineticProps.filter(o=>o.owner===p && o.kind==='bumper').length>=3) return;
  kineticProp(p,point,'bumper',4.8,{dx:p.fx,dy:p.fy});
}
function kineticDecoy(p) {
  for(const o of kineticProps) if(o.owner===p && o.kind==='decoy') o.until=0;
  kineticProp(p,p,'decoy',4,{vx:0,vy:0});
}
function kineticPushProfile(p,power,pattern,range) {
  const charged=power>=kineticPulseThreshold;
  const lanes=pattern.lanes.slice();
  const triple=pattern.arc!==Math.PI && kineticHas(p,'shape');
  const mirror=p.kinMirror && pattern.arc!==Math.PI;
  const rocket=p.kinRocketUntil>matchTime;
  if(triple) lanes.push(-.85,.85);
  if(mirror) lanes.push(Math.PI);
  return {range:range*(rocket?1.28:1), pattern:{...pattern,lanes,arc:triple?.39:pattern.arc},
    triple,mirror,rocket,reverse:p.kinReverse,charged};
}
function kineticCharge(p,power,skip,profile) {
  kineticSound('release',power>.8?1.4:1);
  p.kinMirror=p.kinReverse=false;
  p.kinRocketUntil=0;
  if(!profile.charged) return;
  const aim={x:p.fx,y:p.fy};
  const point={x:p.x,y:p.y};
  kineticHooks(p,'charge',point,profile);
  const queue=(origin,direction,delay,multiplier)=>{
    if(kineticQueue.length>=kineticLimits.queue) return;
    kineticQueue.push({owner:p,x:origin.x,y:origin.y,aim:direction,profile,skip,at:matchTime+delay,force:(320+490*power)*multiplier,shove:true});
    flash('marker',origin.x,origin.y,p.color,profile.range*.67,delay);
  };
  if(kineticHas(p,'echo')) queue(point,aim,.30,.67);
  if(kineticHas(p,'returnShove')) {
    const wall=wallRay(point,aim,profile.range);
    const reach=wall ? Math.max(0,wall.distance-10) : profile.range;
    queue({x:point.x+aim.x*reach,y:point.y+aim.y*reach},{x:-aim.x,y:-aim.y},.37,.62);
  }
  const decoy=kineticHas(p,'decoy') && kineticProps.find(o=>o.owner===p && o.kind==='decoy' && o.until>matchTime);
  if(decoy) queue(decoy,aim,.10,.63);
}
function kineticFollowup(e) {
  const range=e.profile.range*.83;
  for(const target of players) {
    if(e.skip.includes(target)) continue;
    const x=target.x-e.x,y=target.y-e.y,distance=Math.hypot(x,y);
    if(distance<1 || distance>range || !inPushPattern(Math.atan2(y,x),angleOf(e.aim),e.profile.pattern) ||
      wallRay(e,{x:x/distance,y:y/distance},distance)) continue;
    cardShove(target,e.owner,x/distance,y/distance,e.force*pushFalloff(distance,range),{generated:true});
  }
  flash('burst',e.x,e.y,e.owner.color,range,.24);
}
function kineticChargePull(p,dt) {
  if(!kineticHas(p,'pull')) return;
  for(const target of players) {
    if(target===p || target.out || target.dodge>0 || friendly(p,target)) continue;
    const dx=p.x-target.x,dy=p.y-target.y,length=Math.hypot(dx,dy);
    if(length<38 || length>126 || wallRay(target,{x:dx/length,y:dy/length},length)) continue;
    target.vx+=dx/length*620*dt;target.vy+=dy/length*620*dt;
  }
}
function kineticMark(target,owner,force,generation=0,power=0) {
  target.kinLaunch={owner,force,generation,power,rebounds:0,until:matchTime+1.2};
  if(force>520) {
    kineticImpact=Math.max(kineticImpact,.028);
    kineticShake=Math.max(kineticShake,Math.min(6,force/180));
    kineticSound('hit',force/660);
  }
}
function kineticWall(p,axis) {
  const launch=p.kinLaunch;
  if (!rules.kinetic || !launch || launch.until<=matchTime || launch.generation>=2 || Math.abs(p['v'+axis])<210) return;
  const cards=builds[players.indexOf(launch.owner)] || [];
  const limit=kineticHas(launch.owner,'rebounds') ? 2 : 1;
  const wall=cards.map(card=>card[4]).find(effect=>effect?.rebounds) || cards.map(card=>card[4]).find(effect=>effect?.rebound);
  if(!launch.rebounds) kineticHooks(launch.owner,'wallImpact',p,axis,launch.force);
  if(launch.rebounds>=limit || !wall?.rebound(launch.owner,p,axis,launch.force,launch.power)) {p.kinLaunch=null;return false;}
  launch.rebounds++;
  flash('burst',p.x,p.y,launch.owner.color,30,.24);
  kineticSound('bank');
  return true;
}
function kineticParry(p,hit) {
  if(!rules.kinetic) return;
  kineticSound('parry');
  kineticImpact=Math.max(kineticImpact,.032);
  if(hit.generated && !hit.kinetic) return;
  kineticHooks(p,'defense',hit);
}
function kineticDirect(p,t,power,force) {
  kineticMark(t,p,force,0,power);
  kineticHooks(p,'strike',t,power);
}
function kineticHit(w,p) {
  const {vx,vy}=w;
  if(p.out || p===w.owner || friendly(w.owner,p) || w.touch.has(p) || p.kinGrace>matchTime) return;
  w.touch.add(p);
  if (blockPush(p,w.owner,vx,vy,{force:w.force,generated:true,kinetic:true})) {
    if(p.dodge>=dodgeDuration-parryDuration && w.generation<kineticLimits.generation) {
      w.owner=p;w.refund=false;w.vx=p.fx;w.vy=p.fy;w.force*=.78;w.generation++;w.touch.clear();w.until=matchTime+.55;
      flash('trail',p.x,p.y,p.color,24,.25,p.x+p.fx*48,p.y+p.fy*48);
    } else w.until=0;
    return;
  }
  if(cardShove(p,w.owner,vx,vy,Math.min(590,w.force),{generated:true,unblocked:true})) {
    p.kinGrace=matchTime+.15;
    kineticMark(p,w.owner,w.force,w.generation);
    if(w.refund){w.owner.dashCooldown=Math.max(0,w.owner.dashCooldown-.57);w.refund=false;}
    flash('trail',p.x,p.y,w.owner.color,32,.24,p.x+vx*53,p.y+vy*53);
  }
  w.force*=.66;
}

const kineticStages=[
  buildMap({name:'Pinball Palace',platforms:[[125,68,750,344]]}),
  buildMap({name:'Conveyor Chaos',platforms:[[126,68,748,344]],holes:[[480,67,40,61],[480,352,40,61]]}),
  buildMap({name:'Crumbling Castle',buildCenter:{x:557,y:240},platforms:[[138,68,724,344]],holes:[[466,183,68,114]]}),
];
function kineticArena() {
  upcomingMap=kineticStages[(score.reduce((a,b)=>a+b,0)+kineticStageOffset)%kineticStages.length];
  const row=kineticStages.indexOf(upcomingMap);
  const geometry=[[[255,113,124,18],[621,349,124,18],[490,205,20,70]],
    [[258,106,20,86],[722,288,20,86]],[[327,195,18,92],[655,195,18,92],[441,140,118,18],[441,322,118,18]]][row];
  upcomingWalls=geometry.map(([x,y,w,h])=>({x,y,w,h,integrity:row===2?2.4:Infinity}));
}
let kineticStageOffset=0;
function kineticSurface(p,dt) {
  if(currentMap===kineticStages[1] && p.x>289 && p.x<711 && Math.abs(p.y-240)<56) {
    moveAxis(p,'x',(p.y<240?1:-1)*76*dt);
  }
}
function kineticUpdate(dt) {
  for(let i=kineticQueue.length-1;i>=0;i--) {
    const e=kineticQueue[i];
    if(e.at>matchTime) continue;
    kineticQueue.splice(i,1);
    if(e.shove) kineticFollowup(e);
    else if(e.generate) kineticEmit(e.owner,e,Math.cos(e.angle),Math.sin(e.angle),e.force,{skip:e.skip});
    else kineticSpawn(e);
  }
  for(const o of kineticProps) {
    if(o.until<=matchTime) continue;
    if(o.kind==='decoy') {
      const speed=Math.hypot(o.vx,o.vy);
      if(speed>1 && !wallRay(o,{x:o.vx/speed,y:o.vy/speed},speed*dt,12)){o.x+=o.vx*dt;o.y+=o.vy*dt;}
      else o.vx=o.vy=0;
      o.vx*=Math.exp(-3*dt);o.vy*=Math.exp(-3*dt);
      if(!onPlatform(o.x,o.y)) o.until=0;
    }
    if(o.kind==='pull' || o.kind==='well') for(const p of players) {
      if(p.out || p===o.owner || friendly(p,o.owner) || !nearPoint(p,o,o.radius)) continue;
      const angle=Math.atan2(o.y-p.y,o.x-p.x);
      p.vx+=Math.cos(angle)*850*dt;p.vy+=Math.sin(angle)*850*dt;
    }
    if(o.kind==='bumper') for(const p of players) {
      if(p.out || p.kinBump>matchTime || !nearPoint(p,o,25) || p.vx*o.dx+p.vy*o.dy<135) continue;
      p.kinBump=matchTime+.45;p.vx+=o.dx*280;p.vy+=o.dy*280;
      flash('burst',o.x,o.y,o.owner.color,25,.2);
    }
  }
  for(const w of kineticWaves) {
    if(w.until<=matchTime) {
      if(!w.returnable || w.returned || w.owner.out) continue;
      const aim=buildVector(w.owner.x-w.x,w.owner.y-w.y);
      w.vx=aim.x;w.vy=aim.y;w.returned=true;w.until=matchTime+.48;
    }
    const distance=w.speed*dt;
    const hit=wallRay(w,{x:w.vx,y:w.vy},distance,4);
    if(hit) {
      if(currentMap===kineticStages[2]) damageWall(hit.wall,.42+w.force/780,w.owner,true);
      if(w.banks>0 || (currentMap===kineticStages[0] && !w.stageBank)) {
        if(w.banks>0) w.banks--;else w.stageBank=true;
        w.x=hit.x-w.vx*.6;w.y=hit.y-w.vy*.6;
        w['v'+hit.axis]*=-1;w.force=Math.min(590,w.force*w.gain);
        kineticSound('bank');flash('burst',hit.x,hit.y,w.owner.color,24,.23);
      } else {w.until=matchTime;if(!w.returnable) continue;}
    } else {w.x+=w.vx*distance;w.y+=w.vy*distance;}
    for(const o of kineticProps) {
      if(o.until<=matchTime || !nearPoint(w,o,o.radius||26)) continue;
      if(o.kind==='well' || o.kind==='pull') {
        const aim=buildVector(w.vx+(o.x-w.x)*dt*.46,w.vy+(o.y-w.y)*dt*.46);
        w.vx=aim.x;w.vy=aim.y;
      } else if(w.prop!==o) {
        if(o.kind==='bumper'){w.vx=o.dx;w.vy=o.dy;w.force=Math.min(590,w.force*1.15);if(w.owner!==o.owner){w.owner=o.owner;w.refund=false;}}
        else if(o.kind==='decoy'){o.vx=w.vx*w.force*.65;o.vy=w.vy*w.force*.65;w.force*=.81;}
        w.prop=o;
      }
    }
    for(const p of players) if(w.until>matchTime && nearPoint(p,w,(p.radius||half)+9)) kineticHit(w,p);
    if(w.force<95) {w.returnable=false;w.until=0;}
  }
  for(const list of [kineticWaves,kineticProps]) for(let i=list.length-1;i>=0;i--) {
    const o=list[i];
    if(o.until<=matchTime && !(o.returnable && !o.returned && !o.owner.out)) list.splice(i,1);
  }
  kineticShake*=Math.exp(-19*dt);
}
function kineticDraw() {
  if(state==='playing' && matchTime-kineticStarted>34) {
    const center=currentMap.buildCenter || currentMap.center;
    const left=Math.max(0,Math.ceil(kineticRoundLimit-(matchTime-kineticStarted)));
    drawCardLabel('CENTER TIEBREAK · '+left+'s',center.x,currentMap.bounds.top+18,'#ffe194');
    ctx.save();ctx.strokeStyle='#ffe194';ctx.setLineDash([5,4]);ctx.beginPath();
    ctx.arc(center.x,center.y,42,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  if(currentMap===kineticStages[1]) {
    ctx.save();ctx.fillStyle='#67e5cf25';ctx.fillRect(289,184,422,112);ctx.restore();
    for(let x=315;x<695;x+=55) {drawCardArrow(x+(matchTime*40)%25,215,1,0,20,'#74cdb7');drawCardArrow(x-(matchTime*40)%25,265,-1,0,20,'#74cdb7');}
  }
  for(const o of kineticProps) {
    if(o.kind==='decoy') {
      ctx.save();ctx.globalAlpha=.48;drawCharacter(ctx,o.owner.look,o.x-26,o.y-26,52);ctx.restore();
      drawCardLabel('DECOY',o.x,o.y-24,o.owner.color);
    } else if(o.kind==='bumper') {
      ctx.strokeStyle=o.owner.color;ctx.strokeRect(o.x-11,o.y-11,22,22);
      drawCardArrow(o.x,o.y,o.dx,o.dy,31,o.owner.color);
    } else {
      ctx.save();ctx.strokeStyle=o.owner.color;ctx.globalAlpha=.5;ctx.setLineDash([5,6]);
      ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.stroke();ctx.restore();
      drawCardLabel(o.kind==='well'?'BLACK HOLE':'GRAVITY',o.x,o.y,o.owner.color);
    }
  }
  for(const e of kineticQueue) {
    if(!e.shove) continue;
    const {lanes,arc}=e.profile.pattern;
    const aim=angleOf(e.aim),radius=e.profile.range*.83;
    ctx.save();ctx.strokeStyle=e.owner.color;ctx.globalAlpha=.54;ctx.setLineDash([6,5]);
    for(const lane of lanes) {
      ctx.beginPath();ctx.arc(e.x,e.y,radius,aim+lane-arc,aim+lane+arc);ctx.stroke();
    }
    ctx.restore();
  }
  for(const w of kineticWaves) {
    ctx.save();ctx.globalAlpha=.34;ctx.strokeStyle=w.owner.color;ctx.lineWidth=6;
    ctx.beginPath();ctx.moveTo(w.x-w.vx*35,w.y-w.vy*35);ctx.lineTo(w.x,w.y);ctx.stroke();ctx.restore();
    drawCardArrow(w.x,w.y,w.vx,w.vy,w.banks?30:22,w.owner.color);
  }
  for(const p of players || []) if(!p.out) {
    if(kineticHas(p,'weight')) {ctx.strokeStyle=p.color;ctx.strokeRect(p.x-22,p.y-22,44,44);}
    if(p.charge>0 && kineticHas(p,'pull')) {
      ctx.save();ctx.strokeStyle=p.color;ctx.globalAlpha=.5;ctx.setLineDash([5,5]);
      ctx.beginPath();ctx.arc(p.x,p.y,126,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    if(p.kinRocketUntil>matchTime || p.kinMirror || p.kinReverse) {
      drawCardLabel(p.kinReverse?'PULL READY':p.kinMirror?'DOUBLE-SIDED':'LONG SHOVE',p.x,p.y+44,p.color);
    }
    if(p.kinStored) drawCardLabel('FORCE BANKED',p.x,p.y-27,p.color);
  }
}
function kineticOffers(owned,count,random=Math.random) {
  const pool=kineticDeck.filter(card=>!owned.includes(card));
  const tags=new Set(owned.flatMap(card=>card[4].tags));
  const pick=list=>list[Math.floor(random()*list.length)];
  const related=pool.filter(card=>card[4].tags.some(tag=>tags.has(tag)));
  const offers=related.length && random()<.85?[pick(related)]:[];
  while(offers.length<count && offers.length<pool.length) offers.push(pick(pool.filter(card=>!offers.includes(card))));
  return offers;
}
function startKineticDraft(winner,tiebreak = false) {
  const low=Math.min(...score);
  const picks=builds.map((owned,i)=>i===winner || owned.length>=kineticDeck.length?null:{offers:kineticOffers(owned,score[i]===low?4:3),selected:0,done:false});
  kineticDraft={picks,lockedUntil:performance.now()+300,deadline:performance.now()+19000,continueAt:0};
  show('kineticDraft',tiebreak?'CENTER TIEBREAK · P'+(winner+1):'UPGRADE','PICK YOUR POWER','Browse left/right · confirm with Dash · lowest score gets an extra option');
  get('kineticDraft').hidden=false;
  renderKineticDraft();
}
const kineticGlyph={bank:'↗',split:'⋔',echo:'◌',dash:'»',pull:'◎',guard:'◇',trick:'♧',impact:'✦',wave:'≈'};
function renderKineticDraft() {
  if(!kineticDraft) return;
  get('kineticDraft').replaceChildren(...kineticDraft.picks.flatMap((pick,i)=>{
    if(!pick) return [];
    const panel=document.createElement('section');
    const heading = gameElement('strong', {text: 'P'+(i+1)+(pick.done?' · READY':'')});
    heading.style.color=palette[lookFor(i).color];
    panel.append(heading);
    const owned=builds[i];
    if(owned.length>0) {
      const label = gameElement('small', {text: owned.slice(-3).map(card=>card[0]).join(' · ')});
      panel.append(label);
    }
    (pick.done?[pick.offers[pick.selected]]:pick.offers).forEach((card,index)=>{
      const button=document.createElement(slots[i]<0?'button':'article');
      button.className='kinetic-offer'+(index===pick.selected || pick.done?' chosen':'');
      const synergy=owned.find(previous=>previous!==card && previous[4]?.tags.some(tag=>card[4].tags.includes(tag)));
      const icon=document.createElement('b'),title=document.createElement('strong'),desc=document.createElement('span');
      icon.textContent=kineticGlyph[card[4].tags[0]];icon.setAttribute('aria-hidden','true');title.textContent=card[0];
      desc.textContent=pick.done?'Locked in':card[2];
      button.append(icon,title,desc);
      if(synergy && !pick.done){const note=document.createElement('small');note.textContent='Pairs with '+synergy[0];button.append(note);}
      if(slots[i]<0 && !pick.done) button.addEventListener('click',()=>kineticPick(i,index));
      panel.append(button);
    });
    return [panel];
  }));
}
function kineticPick(i,index) {
  const pick=kineticDraft?.picks[i];
  if(!pick || pick.done || !pick.offers[index] || performance.now()<kineticDraft.lockedUntil) return;
  pick.selected=index;pick.done=true;builds[i].push(pick.offers[index]);
  renderKineticDraft();
}
function kineticBrowse(i,direction) {
  const pick=kineticDraft?.picks[i];
  if(!pick || pick.done || !direction) return;
  pick.selected=(pick.selected+direction+pick.offers.length)%pick.offers.length;
  renderKineticDraft();
}
function tickKineticDraft(inputs,now) {
  const draft=kineticDraft;
  inputs.forEach((input,i)=>{
    const pick=draft.picks[i];
    if(!pick || pick.done) return;
    kineticBrowse(i,Number(Boolean(input.right))-Number(Boolean(input.left)));
    if(input.dash || now>=draft.deadline) kineticPick(i,pick.selected);
  });
  draft.picks.forEach((pick,i)=>{if(pick && !pick.done && now>=draft.deadline) {
    if(pick.offers.length) kineticPick(i,pick.selected);
    else pick.done=true;
  }});
  if(!draft.picks.every(p=>!p || p.done)) return;
  draft.continueAt ||= now+500;
  if(now>=draft.continueAt) begin();
}
