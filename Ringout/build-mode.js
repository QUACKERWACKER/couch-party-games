'use strict';

const buildDeck = [
  ['Pitcher','pitch','Throw a rubber ball anyone can bat. It banks off walls.'],
  ['Grappler','grapple','Hook a wall, loose prop, or sliding fighter. Dash to pull sideways.'],
  ['Puppeteer','puppet','Deploy a puppet or switch which body you steer. Protect your real fighter.'],
  ['Rigger','rig','Place a directional bumper. Anyone can aim it with a shove.'],
  ['Daredevil','dare','Enter a steerable slide. Shove while sliding to spend speed.'],
  ['Bellringer','bell','Place a bell. Shove it to ring along your aim.'],
  ['Wide Sweep','sweepCone','Cover a wide arc and operate several props. Each hit is weaker.'],
  ['Needlepoint','focusCone','A narrow shove reaches farther and hits harder.'],
  ['Quick Draw','quickDraw','Reach partial charge sooner. Maximum force stays the same.'],
  ['Heavy Hands','heavyHands','Full shoves hit harder. A full miss takes longer to recover.'],
  ['Low Center','lowCenter','Resist shoves at the cost of slower acceleration.'],
  ['Cornering','cornering','Turn more sharply while riding a slide or steering a puppet.'],
  ['Long Reach','longReach','Extend your Trick’s working range.'],
  ['Quick Feet','quickFeet','Recover dash sooner when it misses every fighter.'],
  ['Recoil Drive','recoil','Charged shoves kick you backward.'],
  ['Spot Weld','weld','Tap a movable prop to hold it in place briefly.'],
  ['Wrong Number','wrongNumber','Parry to return a weaker traveling shove along your aim.'],
  ['Carom','buildCarom','Launches you cause bank off one wall and can pass their momentum on.'],
  ['Stunt Double','buildStunt','Charged shoves also fire from your setup. Wall taps supply a cardboard stand-in.'],
  ['Velcro','velcro','Tap to carry a loose prop. Dash to fling it.'],
  ['Tripwire','tripwire','Dash to string a wire from your setup. Dodge to cross it safely.'],
  ['Friction Tax','friction','A charged shove makes the contact point slick for everyone.'],
  ['Second Verse','buildVerse','Tap a fighter or your own setup to load one full-circle shove.'],
  ['Hot Potato','buildPotato','Charge to stick a fuse on a fighter or prop. Tap to pass it before it bursts.'],
  ['Pinball Cabinet','cabinet','Your first bank or bumper kick in a rally splits off a second shove.'],
  ['Slingshot','slingshot','Release a stretched cable to fling the far end. Dashing alongside motion can supply a cable.'],
  ['Body Double','bodyDouble','Once per fight, press Trick during your decoy’s fall warning to swap if the landing is safe.'],
  ['Pass the Buck','passBuck','Parry to deploy your Trick at your next charged shove’s endpoint.'],
  ['No Brakes','noBrakes','Dash out of a fast slide to send its momentum down the old path.'],
  ['Dead Man’s Switch','deadSwitch','Queue a weaker replay at a charged shove’s target prop or endpoint.'],
].map(([name,key,description],i)=>[name,['Common','Rare','Epic','Legendary'][i<6?0:i<16?1:i<24?2:3],description,{[key]:1}]);

const buildRoutes = [
  ['pitch','focusCone','buildCarom','cabinet','velcro','wrongNumber'],
  ['grapple','longReach','friction','slingshot','buildCarom','cabinet'],
  ['puppet','quickFeet','buildStunt','bodyDouble','tripwire','deadSwitch'],
  ['rig','sweepCone','velcro','passBuck','buildCarom','cabinet'],
  ['dare','cornering','friction','noBrakes','recoil','slingshot'],
  ['bell','quickDraw','buildVerse','deadSwitch','buildStunt','passBuck'],
];
const buildKeys = card => Object.keys(card[3])[0];
const buildPhaseNames = ['TRICK','FOUNDATION','TWIST','BREAKER'];
const buildObjects = [];
let buildStarterPool = [];
let buildFight = 0;
let buildStartedAt = 0;

function buildChoices(owned, random = Math.random) {
  const phase = owned.length;
  const bounds = [0,6,16,24,30];
  const pool = buildDeck.slice(bounds[phase],bounds[phase+1]);
  if (!pool.length) return [];
  const route = buildRoutes.find(row=>row[0]===owned.map(buildKeys)[0]);
  const offers = [];
  const take = card => { if (card && !offers.includes(card)) offers.push(card); };
  if (!phase) {
    const unused = pool.filter(card=>!buildStarterPool.includes(card));
    const preferred = rules.mirrorTricks || !unused.length ? pool : unused;
    while (offers.length<3) {
      const left=preferred.filter(card=>!offers.includes(card));
      if (!left.length) break;
      take(left[Math.floor(random()*left.length)]);
    }
    return offers;
  }
  const ownedKeys=owned.map(buildKeys);
  if (phase===3) {
    const breaker = ownedKeys.includes('buildCarom') ? 'cabinet' :
      ownedKeys.includes('buildStunt') && ownedKeys.includes('puppet') ? 'bodyDouble' :
      ownedKeys.includes('recoil') && ownedKeys.includes('dare') ? 'noBrakes' :
      ownedKeys.includes('buildVerse') && ownedKeys.includes('bell') ? 'deadSwitch' : route?.[phase];
    take(pool.find(card=>buildKeys(card)===breaker));
  }
  take(pool.find(card=>buildKeys(card)===route?.[phase]));
  const alternate = {pitch:{2:'velcro',3:'deadSwitch'},grapple:{2:'buildCarom',3:'cabinet'},
    puppet:{2:'tripwire',3:'deadSwitch'},rig:{2:'buildCarom',3:'cabinet'},
    dare:{1:'recoil',2:'buildPotato',3:'slingshot'},bell:{2:'buildStunt',3:'passBuck'}};
  take(pool.find(card=>buildKeys(card)===alternate[route?.[0]]?.[phase]));
  if (phase===1) take(pool.find(card=>['quickDraw','recoil'].includes(buildKeys(card)) && !offers.includes(card)));
  while (offers.length<3) {
    const left=pool.filter(card=>!offers.includes(card));
    take(left[Math.floor(random()*left.length)]);
  }
  return offers;
}

function buildHint(card, owned) {
  const route=buildRoutes.find(row=>row[0]===owned.map(buildKeys)[0]);
  if (!route) return '';
  const hints={
    focusCone:'Line up a precise bat from farther away.', buildCarom:'Your launch can turn a wall into a second attack angle.',
    cabinet:'Bank your launch to threaten two exits at once.', longReach:'Your hook can catch a slide from farther away.',
    friction:'A slick patch gives sliding targets more momentum to catch.', slingshot:'Stretch the tether, then release toward your aim.',
    quickFeet:'Reposition the puppet without spending as long waiting for dash.', buildStunt:'Threaten from your fighter and your setup at once.',
    bodyDouble:'A falling puppet can become a one-time escape route.', sweepCone:'Aim several nearby props in one swing.',
    velcro:'Carry a prop through a fight and redeploy it with Dash.', passBuck:'Parry, then place your Trick across the fight.',
    cornering:'Carve around the rim while carrying slide speed.', recoil:'A charged shove can start your run even on a miss.',
    noBrakes:'Send your old slide one way and dash another.', quickDraw:'Ring your bell sooner inside a short opening.',
    buildVerse:'Tap your setup to load a ring and threaten fighters on both sides.',
    deadSwitch:'Layer the first hit with a marked replay.', tripwire:'Force a pursuer to cross the route you left behind.',
    wrongNumber:'Turn enemy projectiles into attacks from a new angle.',
  };
  const key=buildKeys(card);
  return hints[key] || '';
}

const buildDot = (a,b) => a.x*b.x+a.y*b.y;
const buildVector = (x,y) => {const length=Math.hypot(x,y)||1;return {x:x/length,y:y/length};};
const buildSpeed = body => Math.hypot(body.vx || 0,body.vy || 0);
const buildOwned = (p,kind) => buildObjects.find(o=>o.owner===p && o.kind===kind && activeCardObject(o));
const buildSetup = p => buildObjects.find(o=>o.owner===p && ['puppet','rig','bell','stand'].includes(o.kind) && activeCardObject(o));
const buildBody = p => p.puppetControl && buildOwned(p,'puppet') || p;
const buildFloor = (x,y) => onPlatform(x,y);
const buildSolid = point => obstacles.some(wall=>pointIn(point.x,point.y,wall));
const buildSafe = (p,o) => buildFloor(o.x,o.y) && clearComboLanding(o,p);
const buildCharged = .48;
let buildPractice = null;
function buildEnd() {
  buildObjects.length=0;
  buildPractice=null;
  for (const p of players || []) {
    p.buildCarry=p.buildTether=p.buildFuse=p.buildBank=null;
    p.puppetControl=false;
  }
}

function previewBuildTrick() {
  if (!rules.divergence || !startingDraft || !choices[selected]) return;
  const preview = get('trickPreview');
  const p = {x:34,y:44,fx:1,fy:0,look:lookFor(draftQueue[0])};
  buildPractice = {until:performance.now()+1450,key:buildKeys(choices[selected]),p};
  preview.hidden=false;
}

function drawBuildPractice() {
  if (!buildPractice || state!=='draft' || !startingDraft) return;
  const t=1-(buildPractice.until-performance.now())/1450;
  if (t>1) {buildPractice=null;return;}
  const {key,p}=buildPractice;
  const preview=get('trickPreview').getContext('2d');
  const {x,y}=p;
  const distance=165*Math.max(0,t);
  preview.clearRect(0,0,240,80);
  preview.fillStyle='#162337';
  preview.fillRect(0,0,240,80);
  preview.strokeStyle='#7b99b3';
  preview.strokeRect(5,8,230,64);
  drawCharacter(preview,p.look,x-22,y-22,44);
  const line=(x0,y0,x1,y1,color)=>{
    preview.strokeStyle=color;
    preview.lineWidth=3;
    preview.beginPath();
    preview.moveTo(x0,y0);
    preview.lineTo(x1,y1);
    preview.stroke();
  };
  if (key==='grapple') line(x,y,196,15,'#94dbff');
  if (key==='puppet') drawCharacter(preview,p.look,103+distance*.35,y-18,36);
  if (key==='pitch') {
    const ballX=distance<140?x+distance:314-distance;
    preview.beginPath();preview.arc(ballX,y,7,0,Math.PI*2);
    preview.fillStyle='#a1e4ff';preview.fill();
  }
  if (key==='rig') {
    preview.strokeStyle='#a9f2ca';
    preview.strokeRect(107,y-12,10,24);
    line(118,y,153,y,'#a9f2ca');
  }
  if (key==='bell') {
    preview.fillStyle='#ffe09e';
    preview.fillRect(95,y-10,14,20);
    line(109+distance*.5,y,130+distance*.5,y,'#ffe09e');
  }
  if (key==='dare') {
    line(x,y+16,x+distance,y+16,'#ffcb82');
    drawCharacter(preview,p.look,x+distance-17,y-17,34);
  }
}

function buildObject(kind,owner,point,extra={}) {
  const old=buildOwned(owner,kind);
  if (old) old.until=0;
  const object={kind,owner,instigator:owner,creator:owner,x:point.x,y:point.y,
    vx:0,vy:0,fx:owner.fx,fy:owner.fy,until:Infinity,...extra};
  buildObjects.push(object);
  return object;
}

function buildShot(owner,point,aim,force,extra={}) {
  if (force<85) return;
  buildObjects.push({kind:'shot',owner,creator:extra.creator || owner,instigator:owner,x:point.x,y:point.y,
    vx:aim.x*540,vy:aim.y*540,fx:aim.x,fy:aim.y,force,until:matchTime+.66,
    rally:extra.rally || {split:false},...extra});
}

function buildCast(p,aim=aimOf(p),point=p,remote=false) {
  const scale=p.stats.longReach?1.46:1;
  const at=(distance)=>({x:point.x+aim.x*distance*scale,y:point.y+aim.y*distance*scale});
  if (p.stats.pitch) {
    buildObject('ball',p,remote?point:at(27),{vx:aim.x*405,vy:aim.y*405,force:470,
      until:matchTime+3.6*scale,banks:4,rally:{split:false}});
  } else if (p.stats.grapple) {
    if (!remote && p.buildTether) { releaseBuildLine(p);return true; }
    const reach=190*scale;
    const origin=remote?at(-24):p;
    const wall=wallRay(origin,aim,reach);
    const candidates=[...buildObjects.filter(o=>isLoose(o)),...players.filter(o=>o!==p && !o.out && !friendly(p,o) && buildSpeed(o)>155)];
    const target=candidates.filter(o=>{
      const delta={x:o.x-origin.x,y:o.y-origin.y};
      const along=buildDot(delta,aim);
      return along>0 && along<(wall?.distance ?? reach) && Math.abs(delta.x*aim.y-delta.y*aim.x)<25;
    }).sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y))[0];
    if (!target && !wall && !remote) {flash('trail',p.x,p.y,'#b6deff',15,.2,at(190).x,at(190).y);return false;}
    p.buildTether={target:target || (wall && {x:wall.x,y:wall.y}) || point,wall:wall?.wall && !target ? wall.wall : null,
      until:matchTime+2.8,latch:matchTime+.18,aim};
  } else if (p.stats.puppet) {
    const puppet=buildOwned(p,'puppet');
    if (puppet && !remote) {p.puppetControl=!p.puppetControl;return true;}
    const place=remote?point:at(48);
    if (!buildFloor(place.x,place.y) || buildSolid(place)) return false;
    buildObject('puppet',p,place,{radius:13,look:p.look,safePoint:place});
  } else if (p.stats.rig || p.stats.bell) {
    const place=remote?point:at(p.stats.rig?58:49);
    if (!buildFloor(place.x,place.y) || buildSolid(place)) return false;
    buildObject(p.stats.rig?'rig':'bell',p,place,{fx:aim.x,fy:aim.y});
  } else if (p.stats.dare) {
    const force=Math.min(685,Math.max(385,buildSpeed(p)+115));
    if (remote) buildShot(p,point,aim,force*.85);
    else {
      const drift=buildSpeed(p)>230?buildVector(p.vx,p.vy):aim;
      p.vx=drift.x*force;p.vy=drift.y*force;
      p.buildSlide=matchTime+(p.stats.longReach?1.5:1.05);
    }
  } else return false;
  return true;
}

function isLoose(o) {
  return activeCardObject(o) && ['ball','rig','bell','stand','crate'].includes(o.kind) && !o.heldBy;
}

function buildTrick(p) {
  const decoy=buildOwned(p,'puppet') || buildOwned(p,'stand');
  if (p.stats.bodyDouble && decoy?.warning && !p.buildRescue && buildSafe(p,decoy)) {
    p.buildRescue=true;
    comboTeleport(p,decoy);
    decoy.until=0;
    p.puppetControl=false;
    return;
  }
  if (p.stats.slingshot && p.buildTether && !p.stats.grapple) {releaseBuildLine(p);return;}
  if (matchTime < (p.trickAt || 0) && !(p.stats.grapple && p.buildTether)) return;
  if (buildCast(p)) p.trickAt=matchTime+(p.stats.puppet? .33 : p.stats.grapple? .45 : 1.45);
}

function releaseBuildLine(p) {
  const line=p.buildTether;
  p.buildTether=null;
  if (!line || !p.stats.slingshot || line.target.dodge>0 || line.latch>matchTime ||
      Math.hypot(p.x-line.target.x,p.y-line.target.y)<63) return;
  const t=line.target;
  if (t.stats) buildHit(p,t,aimOf(p),760,{rally:{split:false}});
  else if (t.kind && activeCardObject(t)) propelBuildObject(t,p,aimOf(p),800);
  else {p.vx+=p.fx*445;p.vy+=p.fy*445;}
}

function buildHit(owner,target,aim,force,meta={}) {
  if (target.buildHitAt>matchTime && meta.generated!==false) return false;
  if (target===owner || friendly(owner,target)) return false;
  const landed=cardShove(target,owner,aim.x,aim.y,force,{generated:true,reflectable:true,buildMeta:meta});
  if (landed) {
    target.buildHitAt=matchTime+.14;
    if (owner.stats.buildCarom || owner.stats.cabinet) {
      target.buildBank={owner,force,expires:matchTime+.78,rally:meta.rally || {split:false}};
    }
  }
  return landed;
}

function propelBuildObject(o,p,aim,speed,rally={split:false}) {
  o.instigator=p;
  o.fx=aim.x;o.fy=aim.y;
  o.vx=aim.x*speed;o.vy=aim.y*speed;
  o.rally=rally;
  o.weldUntil=0;
  if (o.kind==='ball') {o.force=Math.min(1080,speed*1.18);o.banks=Math.max(o.banks,2);o.until=matchTime+2.6;}
  o.banked=false;
}

function buildSplit(owner,point,aim,force,rally) {
  if (!owner.stats.cabinet || !rally || rally.split) return;
  rally.split=true;
  const angle=angleOf(aim)+.48;
  buildShot(owner,point,{x:Math.cos(angle),y:Math.sin(angle)},force*.56,{rally,banks:1});
  flash('burst',point.x,point.y,'#fff19f',40,.4);
}

function buildEndpoint(p,range) {
  const aim=aimOf(p);
  const contact=wallRay(p,aim,range);
  const distance=contact ? Math.max(16,contact.distance-13) : range;
  return {x:p.x+aim.x*distance,y:p.y+aim.y*distance};
}

function buildQueue(owner,point,aim,force,target,delay,kind=delay>.5?'replay':'ring') {
  buildObject(kind,owner,point,{fx:aim.x,fy:aim.y,force,target,fire:matchTime+delay});
}

function buildManual(p,power,range,pattern) {
  if (!rules.divergence) return;
  const aim=aimOf(p);
  const endpoint=buildEndpoint(p,range);
  const charge=power>=buildCharged, tap=power<.25;
  const objects=buildObjects.filter(o=>activeCardObject(o) && o!==buildBody(p) &&
    (isLoose(o) || o.kind==='puppet') && nearPoint(p,o,range+12) &&
    inPushPattern(angleOf({x:o.x-p.x,y:o.y-p.y}),angleOf(aim),pattern))
    .sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
  const first=objects[0];
  const own=objects.find(o=>o.owner===p);
  const remote=buildSetup(p);
  p.buildFusePlanted=false;
  if (charge && p.stats.buildStunt && remote) buildQueue(p,remote,aim,425,remote,.23,'stunt');
  if (charge && p.stats.deadSwitch && (own || !remote)) buildQueue(p,own || endpoint,aim,465,own,.74);
  if (charge && p.stats.friction) buildObject('slick',p,first || endpoint,{until:matchTime+2.9,radius:53});
  if (charge && p.passBuck) {
    p.passBuck=false;
    if (buildFloor(endpoint.x,endpoint.y)) buildCast(p,aim,endpoint,true);
  }
  if (tap && p.stats.buildVerse && own) p.circleUntil=matchTime+20;
  if (tap && p.stats.buildStunt && !remote && !p.stats.puppet && !p.stats.bell && !p.stats.rig &&
      wallRay(p,aim,range)) buildObject('stand',p,endpoint);
  if (charge && first && p.stats.buildPotato) {plantBuildFuse(p,first);p.buildFusePlanted=true;}
  for (const o of objects) {
    if (o.kind==='puppet') {
      if (charge && o.owner!==p && !friendly(o.owner,p)) dropBuildPuppet(o);
      else if (!charge) propelBuildObject(o,p,aim,220);
    } else if (tap && p.stats.weld && !(o.weldUntil>matchTime)) {
      o.vx=o.vy=0;o.weldUntil=matchTime+1.15;
    } else if (tap && p.stats.velcro && !p.buildCarry && isLoose(o)) {
      p.buildCarry=o;o.heldBy=p;
    } else if (o.kind==='bell' && o.owner===p) {
      buildQueue(p,o,aim,charge?680:420,o,charge?.42:.22);
      o.weldUntil=0;
    } else if (o.weldUntil<=matchTime || !o.weldUntil || charge) {
      propelBuildObject(o,p,aim,260+590*pushCurve(power));
    }
    if (tap && p.buildFuse && o!==p.buildFuse.target) moveBuildFuse(p.buildFuse,o);
  }
  if (p.stats.heavyHands && power>=.99) p.buildHeavyCheck=true;
}

function plantBuildFuse(p,target) {
  const old=buildOwned(p,'fuse');
  if (old && old.target.buildFuse===old) old.target.buildFuse=null;
  const fuse=buildObject('fuse',p,target,{target,fire:matchTime+2.3});
  moveBuildFuse(fuse,target);
}

function moveBuildFuse(fuse,target) {
  if (fuse.target.buildFuse===fuse) fuse.target.buildFuse=null;
  fuse.target=target;
  target.buildFuse=fuse;
}

function buildOnHit(p,target,power,force) {
  if (!rules.divergence) return;
  if (p.stats.buildCarom || p.stats.cabinet) target.buildBank={owner:p,force,expires:matchTime+.78,rally:{split:false}};
  if (p.stats.buildVerse && power<.25) p.circleUntil=matchTime+20;
  if (p.buildFuse && power<.25) moveBuildFuse(p.buildFuse,target);
  if (p.stats.buildPotato && power>=buildCharged && !p.buildFusePlanted) {plantBuildFuse(p,target);p.buildFusePlanted=true;}
  if (p.stats.bodyDouble && !p.stats.puppet && power>=.99 && !p.buildStandMade) {
    p.buildStandMade=true;
    buildObject('stand',p,{x:p.x-p.fx*28,y:p.y-p.fy*28});
  }
  p.buildHeavyCheck=false;
}

function buildOnParry(p,hit) {
  if (!rules.divergence) return;
  if (p.stats.passBuck && (!hit.generated || hit.buildMeta)) p.passBuck=true;
  if (p.stats.wrongNumber && (!hit.generated || hit.buildMeta) && (hit.buildMeta?.returns || 0)<3) {
    const aim=aimOf(p), meta=hit.buildMeta || {};
    buildShot(p,{x:p.x+aim.x*24,y:p.y+aim.y*24},aim,
      Math.min(830,Math.abs(hit.force || 245)*.65),
      {creator:meta.creator,returns:(meta.returns || 0)+1,rally:meta.rally});
  }
}

function buildDash(p) {
  if (!rules.divergence) return;
  p.buildDashContact=false;
  p.buildDashOrigin={x:p.x,y:p.y};
  if (p.buildCarry) {
    propelBuildObject(p.buildCarry,p,aimOf(p),690);
    p.buildCarry.heldBy=null;p.buildCarry=null;
  }
  const speed=buildSpeed(p);
  if (p.stats.noBrakes && speed>260 && !p.brakeSpent) {
    buildShot(p,p,buildVector(p.vx,p.vy),speed*1.04);
    p.vx=p.vy=0;p.brakeSpent=true;
  }
  if (!p.buildTether && p.stats.slingshot) {
    const target=[...buildObjects.filter(isLoose),...players.filter(o=>o!==p && !o.out && !friendly(p,o))]
      .find(o=>buildSpeed(o)>150 && nearPoint(p,o,109));
    if (target) p.buildTether={target,until:matchTime+.8,latch:matchTime+.13,aim:aimOf(p)};
  }
  const line=p.buildTether;
  if (!line || line.latch>matchTime) return;
  const d=buildVector(line.target.x-p.x,line.target.y-p.y);
  const sign=(-d.y*p.fx+d.x*p.fy)<0?-1:1;
  p.dx=-d.y*sign;p.dy=d.x*sign;
  if (line.target.stats) buildHit(p,line.target,{x:p.dx,y:p.dy},390);
  else if (line.target.kind) propelBuildObject(line.target,p,{x:p.dx,y:p.dy},500);
}

function buildDashFinish(p) {
  if (!rules.divergence || !p.buildDashOrigin) return;
  if (p.stats.quickFeet && !p.buildDashContact) p.dashCooldown*=.68;
  if (p.stats.tripwire && buildFloor(p.x,p.y)) {
    const anchor=buildSetup(p) || p.buildDashOrigin;
    buildObject('wire',p,p,{anchor,until:matchTime+2.6,armed:matchTime+.16});
  }
  p.buildDashOrigin=null;
}

function dropBuildPuppet(o) {
  o.until=0;o.owner.puppetControl=false;o.owner.trickAt=matchTime+1.15;
}

function buildControl(p,input,dt) {
  if (!rules.divergence) return input;
  if (buildSpeed(p)<195) p.brakeSpent=false;
  if (input.trick) buildTrick(p);
  const o=buildBody(p);
  if (o===p) return input;
  const steer=Math.min(1,dt*(p.stats.cornering?26:16));
  const leash= p.stats.longReach?297:215;
  const ax=input.aimX ?? input.x, ay=input.aimY ?? input.y;
  if (Math.hypot(ax,ay)>.1) {const aim=buildVector(ax,ay); o.fx=aim.x;o.fy=aim.y;}
  if (!o.warning) {
    const outOfLeash=!nearPoint(p,o,leash) && input.x*(o.x-p.x)+input.y*(o.y-p.y)>0;
    const speed=outOfLeash?0:202;
    o.vx+=(input.x*speed-o.vx)*steer;o.vy+=(input.y*speed-o.vy)*steer;
    if (input.dash && !(o.dashAt>matchTime)) {
      const origin={x:o.x,y:o.y};
      o.vx+=o.fx*475;o.vy+=o.fy*475;
      o.dashAt=matchTime+.88;
      o.dashCheck=matchTime+.20;
      o.dashContact=false;
      if (p.stats.tripwire) buildObject('wire',p,origin,{anchor:p,until:matchTime+2.1,armed:matchTime+.16});
    }
    if (input.push && !(o.pushAt>matchTime)) {
      directionalCardShove(p,o,aimOf(o),71,285,{lanes:[0],arc:.75,force:1});
      o.pushAt=matchTime+.32;
    }
  }
  return {...input,x:0,y:0,aimX:undefined,aimY:undefined,dash:false,dashHeld:false,charging:false,push:false,dodge:input.dodge};
}

function buildOnWall(p,axis) {
  const bank=p.buildBank;
  if (!rules.divergence || !bank || bank.expires<=matchTime || Math.abs(p['v'+axis])<140 || bank.banked) return false;
  bank.banked=true;
  const aim=buildVector(axis==='x'?-p.vx:p.vx,axis==='y'?-p.vy:p.vy);
  buildSplit(bank.owner,p,aim,bank.force,bank.rally);
  if (!bank.owner.stats.buildCarom) return false;
  p['v'+axis]*=-.72;
  flash('burst',p.x,p.y,'#ffdc9d',30,.3);
  return true;
}

function buildContact(p,target) {
  const bank=p.buildBank;
  if (!bank?.banked || bank.expires<=matchTime || !bank.owner.stats.buildCarom ||
      (target!==bank.owner && friendly(bank.owner,target))) return;
  p.buildBank=null;
  const aim=buildVector(target.x-p.x,target.y-p.y);
  if (target===bank.owner) cardShove(target,p,aim.x,aim.y,bank.force*.45,{generated:true});
  else buildHit(bank.owner,target,aim,bank.force*.45,{rally:bank.rally});
}

function moveBuildProp(o,dt) {
  const speed=buildSpeed(o);
  if (speed<4) return;
  const aim=buildVector(o.vx,o.vy);
  const contact=wallRay(o,aim,speed*dt,o.radius || 9);
  if (contact) {
    o.x=contact.x-aim.x*.4;o.y=contact.y-aim.y*.4;
    if (o.kind==='stand' || (o.kind==='bell' && speed>465)) {o.until=0;return;}
    const canBank=o.banks>0 || (o.instigator.stats.buildCarom && !o.banked);
    if (canBank) {
      o.banked=true;
      if(o.banks>0)o.banks--;
      if (contact.wall.bankNormal) {
        const normal=contact.wall.bankNormal;
        const projection=buildDot({x:o.vx,y:o.vy},normal);
        o.vx=(o.vx-2*projection*normal.x)*.86;
        o.vy=(o.vy-2*projection*normal.y)*.86;
      } else o['v'+contact.axis]*=-.86;
      const bounced=buildVector(o.vx,o.vy);
      buildSplit(o.instigator,o,bounced,o.force || speed,o.rally);
      flash('burst',o.x,o.y,'#ffe797',22,.2);
    } else {o.vx=o.vy=0;if(o.kind==='shot')o.until=0;}
  } else {o.x+=o.vx*dt;o.y+=o.vy*dt;}
  if (!['ball','shot','puppet'].includes(o.kind)) {
    const drag=Math.exp(-4*dt);
    o.vx*=drag;o.vy*=drag;
  }
}

function updateBuildWorld(dt) {
  if (!rules.divergence) return;
  for (const p of players) {
    const line=p.buildTether;
    if (line && (line.until<=matchTime || line.target.out || line.target.dodge>0 ||
        (line.target.kind && !activeCardObject(line.target)) || (line.wall && !obstacles.includes(line.wall)) ||
        !nearPoint(p,line.target,355))) {
      if (line.target.dodge>0) flash('burst',line.target.x,line.target.y,'#a6efff',26,.25);
      p.buildTether=null;
    }
    if (p.out && p.buildCarry) {p.buildCarry.heldBy=null;p.buildCarry=null;}
  }
  for (const o of [...buildObjects]) {
    if (!activeCardObject(o)) continue;
    if (o.owner.out && o.kind!=='shot') {o.until=0;continue;}
    if (o.heldBy) {
      o.x=o.heldBy.x-o.heldBy.fy*27;o.y=o.heldBy.y+o.heldBy.fx*27;
      continue;
    }
    if (['ring','replay','stunt'].includes(o.kind)) {
      if (o.target && !activeCardObject(o.target)) {o.until=0;continue;}
      if (o.target) {o.x=o.target.x;o.y=o.target.y;}
      if (matchTime>=o.fire) {buildShot(o.owner,o,aimOf(o),o.force);o.until=0;}
      continue;
    }
    if (o.kind==='fuse') {
      const t=o.target;
      if (t.out || (t.kind && !activeCardObject(t))) {o.until=0;t.buildFuse=null;continue;}
      o.x=t.x;o.y=t.y;
      if (matchTime>=o.fire) {areaPush(o.owner,o.x,o.y,99,610,undefined,{self:true});o.until=0;t.buildFuse=null;}
      continue;
    }
    const before={x:o.x,y:o.y};
    if (o.kind==='puppet' || o.kind==='stand') {
      if (o.dashCheck) {
        if (players.some(p=>p!==o.owner && !p.out && nearPoint(p,o,29))) o.dashContact=true;
        if (o.dashCheck<=matchTime) {
          if (o.owner.stats.quickFeet && !o.dashContact) o.dashAt-=.25;
          o.dashCheck=0;
        }
      }
      if (o.warning && matchTime>=o.warning) {dropBuildPuppet(o);continue;}
      if (!o.warning) {
        if (buildSafe(o.owner,before)) o.safePoint=before;
        moveBuildProp(o,dt);
      }
      if (!buildFloor(o.x,o.y) && !o.warning) {
        if (o.owner.stats.bodyDouble && !o.owner.buildRescue && o.safePoint && buildSafe(o.owner,o.safePoint)) {
          o.x=o.safePoint.x;o.y=o.safePoint.y;o.warning=matchTime+.55;o.vx=o.vy=0;
        } else dropBuildPuppet(o);
      }
    } else if (o.weldUntil<=matchTime || !o.weldUntil) moveBuildProp(o,dt);
    if (!activeCardObject(o)) continue;
    if (['ball','shot'].includes(o.kind) && !nearPoint(o,currentMap.center,Math.max(currentMap.width,currentMap.height))) {o.until=0;continue;}
    if (!['shot','ball','wire','slick'].includes(o.kind) && !buildFloor(o.x,o.y)) {o.until=0;continue;}
    if (!activeCardObject(o.anchor || {until:Infinity})) {o.until=0;continue;}
    if ((o.kind==='shot' || o.kind==='ball') && buildSpeed(o)>110) {
      const bumper=buildObjects.find(b=>b.kind==='rig' && activeCardObject(b) && nearPoint(b,o,24) &&
        b!==o.lastBumper && buildDot({x:o.vx,y:o.vy},aimOf(b))>0);
      if (bumper) {
        o.lastBumper=bumper;
        const force=o.force;
        const rally=o.rally;
        const instigator=o.instigator;
        propelBuildObject(o,bumper.instigator,aimOf(bumper),630,rally);
        buildSplit(instigator,o,aimOf(bumper),force,rally);
      } else if (o.lastBumper && !nearPoint(o,o.lastBumper,45)) o.lastBumper=null;
      const decoy=buildObjects.find(b=>['puppet','stand'].includes(b.kind) && activeCardObject(b) &&
        b.owner!==o.instigator && !friendly(b.owner,o.instigator) && nearPoint(b,o,23));
      if (decoy && o.force>=420) {
        dropBuildPuppet(decoy);
        if (o.kind==='shot') {o.until=0;continue;}
      }
    }
    for (const p of players) {
      if (p.out) continue;
      if (o.kind==='slick' && nearPoint(o,p,o.radius)) p.iceSlideUntil=matchTime+.15;
      if (o.kind==='wire' && p!==o.owner && !friendly(o.owner,p) && !(p.dodge>0) && o.armed<=matchTime) {
        const delta={x:o.x-o.anchor.x,y:o.y-o.anchor.y}, length=buildDot(delta,delta);
        const t=length?buildDot({x:p.x-o.anchor.x,y:p.y-o.anchor.y},delta)/length:0;
        if(t>0 && t<1 && nearPoint(p,{x:o.anchor.x+t*delta.x,y:o.anchor.y+t*delta.y},17)) {
          buildHit(o.owner,p,buildVector(-delta.y,delta.x),485);o.until=0;break;
        }
      }
      if (!nearPoint(p,o,28)) continue;
      if (['shot','ball'].includes(o.kind) && buildSpeed(o)>100 && p!==o.instigator && !friendly(o.instigator,p) &&
          !(o.lastHit===p && o.lastHitAt>matchTime)) {
        buildHit(o.instigator,p,buildVector(o.vx,o.vy),o.force,{creator:o.creator,returns:o.returns,rally:o.rally});
        if(o.kind==='shot')o.until=0;
        else {o.vx*=.63;o.vy*=.63;o.lastHit=p;o.lastHitAt=matchTime+.48;}
        break;
      }
      if (o.kind==='rig' && matchTime>=(o.kickAt || 0) && !o.heldBy &&
          buildDot({x:(p.walkX || 0)+p.vx,y:(p.walkY || 0)+p.vy},aimOf(o))>28) {
        if (p===o.instigator) {p.vx+=o.fx*480;p.vy+=o.fy*480;}
        else buildHit(o.instigator,p,aimOf(o),680,{rally:o.rally});
        o.kickAt=matchTime+.55;
        buildSplit(o.instigator,o,aimOf(o),680,o.rally ||= {split:false});
      }
      if (o.kind==='bell' && p.dash>0 && o.lastDash!==p.buildDashOrigin) {
        o.lastDash=p.buildDashOrigin;
        propelBuildObject(o,p,{x:p.dx,y:p.dy},325);
      }
    }
  }
  for(let i=buildObjects.length-1;i>=0;i--) if(!activeCardObject(buildObjects[i])) {
    const object=buildObjects[i];
    if(object.heldBy) object.heldBy.buildCarry=null;
    buildObjects.splice(i,1);
  }
  if (matchTime-buildStartedAt>34) {
    const limit=buildLimit();
    for(const p of players) {
      if (p.out || pointIn(p.x,p.y,limit)) continue;
      p.buildOutside=(p.buildOutside || 0)+dt;
    }
  }
}

function buildLimit() {
  const {bounds}=currentMap;
  const center=currentMap.buildCenter || currentMap.center;
  const shrink=Math.max(.09,1-Math.max(0,matchTime-buildStartedAt-34)/18);
  const width=(bounds.right-bounds.left)*shrink, height=(bounds.bottom-bounds.top)*shrink;
  return {x:center.x-width/2,y:center.y-height/2,w:width,h:height};
}

function buildFall(p) {
  if (!rules.divergence || matchTime-buildStartedAt<=34) return false;
  if (pointIn(p.x,p.y,buildLimit())) p.buildOutside=0;
  return p.buildOutside>.5;
}

function drawBuildWorld() {
  if (!rules.divergence) return;
  if (matchTime-buildStartedAt>29 && state==='playing') {
    const limit=buildLimit();
    ctx.save();ctx.strokeStyle='#ff8b76';ctx.lineWidth=3;ctx.setLineDash([10,6]);
    ctx.strokeRect(limit.x,limit.y,limit.w,limit.h);ctx.restore();
    drawCardLabel('RING CLOSING',currentMap.center.x,limit.y-8,'#ffab8d');
  }
  const labels={rig:'BUMPER',bell:'BELL',ball:'BALL',puppet:'PUPPET',stand:'DECOY',crate:'CRATE',ring:'RING',stunt:'DOUBLE',replay:'REPLAY',fuse:'FUSE',slick:'SLICK'};
  for(const o of buildObjects) {
    if(!activeCardObject(o))continue;
    const color=o.instigator.color || '#ffd59a';
    if(o.kind==='wire') {drawCardLine(o.anchor,o,'#f8c999',3);continue;}
    if(['shot','ball','rig','ring','replay','stunt'].includes(o.kind)) drawCardArrow(o.x,o.y,o.fx,o.fy,o.kind==='shot'?44:31,color);
    ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=3;
    if(o.kind==='puppet' || o.kind==='stand') {
      ctx.globalAlpha=.65;drawCharacter(ctx,o.owner.look,o.x-27,o.y-27,54);
      ctx.globalAlpha=1;ctx.strokeRect(o.x-14,o.y-14,28,28);
    } else if(o.kind==='rig' || o.kind==='crate') {
      ctx.translate(o.x,o.y);ctx.rotate(angleOf(aimOf(o)));ctx.strokeRect(-8,-16,16,32);
    } else if(o.kind==='ball' || o.kind==='slick' || o.kind==='bell') {
      ctx.beginPath();ctx.arc(o.x,o.y,o.radius || (o.kind==='ball'?11:15),0,Math.PI*2);
      ctx.globalAlpha=o.kind==='slick'?.2:.72;ctx.fill();ctx.globalAlpha=1;ctx.stroke();
    }
    ctx.restore();
    const label=o.warning?'TRICK TO SWAP':o.kind==='puppet' && o.owner.puppetControl?'▶ PUPPET':labels[o.kind];
    if(label)drawCardLabel(label+(o.fire?( ' '+Math.max(0,o.fire-matchTime).toFixed(1)):''),o.x,o.y-25,color);
    if(o.weldUntil>matchTime)drawCardLabel('WELDED',o.x,o.y+24,color);
  }
  for(const p of players) {
    if(p.out)continue;
    const line=p.buildTether;
    if(line) {
      drawCardLine(p,line.target,line.latch>matchTime?'#eed2a1':'#94dbff',3);
      if(p.stats.slingshot)drawCardArrow(line.target.x,line.target.y,p.fx,p.fy,48,'#ffd397');
    }
    if(p.puppetControl)drawCardLabel('REAL FIGHTER',p.x,p.y-31,p.color);
    const starter=buildDeck.slice(0,6).find(card=>p.stats[buildKeys(card)]);
    if(starter)drawCardLabel(starter[0]+' · '+(p.trickAt>matchTime?(p.trickAt-matchTime).toFixed(1):'READY'),p.x,p.y+47,p.color);
    if (p.charge>0 && p.passBuck) {
      const target=buildEndpoint(p,66+70*pushCurve(p.charge/chargeMax));
      drawCardLabel('TRICK',target.x,target.y,'#ffd698');
    }
    const remote=p.stats.buildStunt && p.charge>0 && buildSetup(p);
    if(remote)drawCardArrow(remote.x,remote.y,p.fx,p.fy,50,'#ffd698');
  }
}

function addNeutralBuildProp() {
  const point=safeSpawn(currentMap,players,currentMap.center,obstacles);
  if (!point) return;
  const neutral={fx:1,fy:0,color:'#dfd5bd',stats:{},out:false};
  buildObject('crate',neutral,point);
}
