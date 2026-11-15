'use strict';

const cardObjects = [];
const cardTethers = [];
const pointIn = (x,y,box) => x >= box.x && x <= box.x+box.w && y >= box.y && y <= box.y+box.h;
const nearPoint = (a,b,radius) => Math.hypot(a.x-b.x,a.y-b.y) <= radius;
const aimOf = p => ({x:p.fx,y:p.fy});
const angleOf = aim => Math.atan2(aim.y,aim.x);

function resetCardWorld(keepPlayers = false) {
  cardObjects.length = cardTethers.length = 0;
  if (!keepPlayers) return;
  for (const p of players) {
    if (p.delivery && !p.out) applyPickup(p,p.delivery.item);
    clearCardFighter(p);
    for (const field of ['ghost','grinUsed','slickAt','cleanPeelAt','groupUsed','ledgeUsed','tileUsed',
      'lastWordUsed','dashFinisher','cardSuperDash','arrowReady']) delete p[field];
  }
}

function clearCardFighter(p) {
  p.lastShove=p.carom=p.cord=p.delivery=p.sideCommit=p.lastSpot=p.recallPoint=null;
  p.airUntil=p.iceSlideUntil=p.hitSlideUntil=p.caughtForce=p.snapbackPending=0;
  p.standReady=p.pinballReady=p.pinballActive=p.windStored=p.knockbackSteer=p.jamHop=false;
  p.airDash=p.airLedge=p.sideReady=false;
}

function cardObject(kind, owner, point, duration, extra = {}) {
  const object = {kind,owner,x:point.x,y:point.y,until:matchTime+duration,...extra};
  cardObjects.push(object);
  return object;
}

function replaceCardObject(kind, owner, point, duration, extra) {
  for (const object of cardObjects) if (object.kind === kind && object.owner === owner) object.until = 0;
  return cardObject(kind,owner,point,duration,extra);
}

function activeCardObject(object) {
  return object.until > matchTime;
}

function wallRay(origin, aim, reach, radius = 0) {
  let nearest;
  for (const wall of obstacles) {
    const sides = [
      ['x','y', wall.x-radius, -1,'h'], ['x','y', wall.x+wall.w+radius, 1,'h'],
      ['y','x', wall.y-radius, -1,'w'], ['y','x', wall.y+wall.h+radius, 1,'w'],
    ];
    for (const [axis,cross,edge,normal,size] of sides) {
      if (aim[axis]*normal >= 0) continue;
      const distance = (edge-origin[axis])/aim[axis];
      const contact = origin[cross]+aim[cross]*distance;
      if (distance < 0 || distance > reach || distance >= (nearest?.distance ?? Infinity) ||
          contact < wall[cross]-radius || contact > wall[cross]+wall[size]+radius) continue;
      nearest = {wall,axis,distance,x:origin.x+aim.x*distance,y:origin.y+aim.y*distance};
    }
  }
  return nearest;
}

function rimAt(point, reach, detachable = false) {
  let best;
  for (const edge of detachable ? currentMap.detachableRims : currentMap.edges) {
    const along = edge.across ? point.x-edge.x : point.y-edge.y;
    if (along < 0 || along > edge.length || (detachable && (along<24 || along>edge.length-24))) continue;
    const x = edge.across ? point.x : edge.x;
    const y = edge.across ? edge.y : point.y;
    const distance = Math.hypot(point.x-x,point.y-y);
    if (distance > reach || distance >= (best?.distance ?? Infinity)) continue;
    const dx = edge.across ? 0 : currentMap.floor(x-3,y) ? 1 : -1;
    const dy = edge.across ? currentMap.floor(x,y-3) ? 1 : -1 : 0;
    best = {x,y,dx,dy,distance,across:edge.across};
  }
  return best;
}

function shoveTravel(owner, point, aim, force, extra = {}) {
  if (force < 85) return;
  return cardObject('shove',owner,point,.68,{dx:aim.x,dy:aim.y,speed:440,force,reflectable:true,...extra});
}

function cardShove(target, source, x, y, force, options = {}) {
  if (target.out || target === options.skip || target.respawnGuard > matchTime ||
      (target === source ? !options.self : friendly(source,target))) return false;
  if (!options.unblocked && blockPush(target,source,x,y,{...options,force})) return false;
  if (options.generated || options.applyGuard) {
    force *= (1-Math.min(.65,(target.stats.guard || 0)+(target.stats.lowCenter ? .23 : 0)))*pickupFactor(target,'guard')*comboGuard(target);
  }
  if (rules.kinetic) for(const card of builds[players.indexOf(target)] || []) {
    if(card[4]?.absorb) force=card[4].absorb(target,force);
  }
  if (options.pendingRound) ghostImpactUntil = matchTime+.7;
  if (!options.noCredit) {
    target.lastShove = {owner:source,until:matchTime+1.35,force,generated:options.generated};
    if (target.stats.anchor) target.knockbackSteer = true;
  }
  if (target.cord && Math.abs(force) >= 430) {
    flash('trail',target.x,target.y,'#ffa283',18,.32,target.cord.x,target.cord.y);
    target.cord = null;
  }
  if (target.stats.snapback && Math.abs(force)>=100) target.snapbackPending = matchTime+.12;
  if (target.stats.grin && target.emoteUntil>matchTime && !target.grinUsed) {
    target.grinUsed = true;
    target.hitSlideUntil = matchTime+.34;
    force *= .65;
    flash('burst',target.x,target.y,'#f8be96',38,.35);
  }
  transferObjective(source,target);
  target.vx += force*x;
  target.vy += force*y;
  if (!options.noCredit) fireCombo(target,'takeHit',undefined,{generated:options.generated});
  return true;
}

function cardOnBlock(target, aim, hit, parried) {
  if (target.stats.borrowed && hit.force >= 85 && !hit.noArrow && matchTime >= (target.arrowReady || 0)) {
    target.arrowReady = matchTime+.35;
    cardObject('arrow',target,target,1.15,{dx:aim.x,dy:aim.y,speed:120,force:Math.min(425,hit.force*.55)});
  }
  const rim = target.stats.stepping && rimAt(target,62);
  if (rim) {
    replaceCardObject('foothold',target,{x:rim.x+18*rim.dx,y:rim.y+18*rim.dy},2.1,{radius:25});
  }
  if (!parried) return;
  if (target.stats.sender && hit.reflectable) {
    shoveTravel(target,{x:target.x+target.fx*26,y:target.y+target.fy*26},aimOf(target),hit.force*.62,{pendingRound:hit.pendingRound});
  }
  if (target.stats.catchThrow) target.caughtForce = Math.min(520,Math.abs(hit.force || 0)*.44);
  if (target.stats.backbeat && !hit.echo) {
    replaceCardObject('parryEcho',target,target,2.02,{trigger:matchTime+1.5});
  }
  if (target.stats.jammer && !hit.echo) replaceCardObject('jammer',target,target,3,{radius:100});
}

function cardOnManualHit(owner,target,power) {
  if (power < .99) return;
  if (owner.stats.pinball) owner.pinballReady = true;
  if (owner.stats.groupHug && !owner.groupUsed) {
    owner.groupUsed = true;
    cardTethers.push({a:owner,b:target,until:matchTime+3});
  }
}

function cardOnWall(p,axis) {
  if (p.pinballActive && p.dash > 0 && p['d'+axis]*p['f'+axis]>.1) {
    p['d'+axis] *= -1;
    p.dash = Math.max(p.dash,.11);
    p.pinballActive = false;
    flash('burst',p.x,p.y,'#ffe592',35,.3);
    return true;
  }
  if (p.lastShove?.until > matchTime && p.lastShove.owner.stats.carom) {
    const speed = Math.abs(p['v'+axis]);
    if (speed >= 145) {
      p['v'+axis] *= -.65;
      p.carom = {owner:p.lastShove.owner,until:matchTime+.55,force:Math.min(500,speed*.54)};
      p.lastShove = null;
      flash('burst',p.x,p.y,'#ffbd91',37,.32);
      return true;
    }
  }
  return false;
}

function cardOnCollision(p,other) {
  if (!(p.carom?.until > matchTime) || (other!==p.carom.owner && friendly(p.carom.owner,other))) return;
  const dx = other.x-p.x, dy = other.y-p.y;
  const length = Math.hypot(dx,dy) || 1;
  cardShove(other,p.carom.owner,dx/length,dy/length,p.carom.force,{generated:true,self:true});
  p.carom = null;
}

function cardDashStart(p, superDash) {
  p.standReady = true;
  p.pinballActive = Boolean(p.pinballReady);
  p.pinballReady = false;
  p.cardSuperDash = superDash;
  if (p.knockbackSteer) {
    const strength = Math.min(500,Math.hypot(p.vx,p.vy));
    p.vx = p.fx*strength;
    p.vy = p.fy*strength;
    p.knockbackSteer = false;
  }
  if (p.airDash && p.airUntil > matchTime) {
    p.airDash = false;
    p.dashSpeed *= 1.26;
    p.dash *= 1.35;
  }
  if (p.cord && p.cord.until > matchTime && obstacles.includes(p.cord.wall)) {
    const dx = p.x-p.cord.x, dy = p.y-p.cord.y;
    const length = Math.hypot(dx,dy) || 1;
    const sign = (-dy*p.fx+dx*p.fy) >= 0 ? 1 : -1;
    p.cord.swing = sign;
    p.dx = -dy/length*sign;
    p.dy = dx/length*sign;
  }
  for (const link of cardTethers) {
    if (link.until <= matchTime || (link.a!==p && link.b!==p)) continue;
    (link.pulls ||= []).push({source:p,dx:p.dx,dy:p.dy,at:matchTime+.19});
  }
}

function cardDashEnd(p) {
  p.pinballActive = false;
  if (p.cord) p.cord.swing = 0;
  const solid = onPlatform(p.x,p.y,p);
  if (!solid && p.stats.pocketLedge && !p.ledgeUsed && p.airLedge) {
    p.ledgeUsed = true;
    cardObject('ledge',p,{x:p.x-25,y:p.y-20},3,{w:50,h:40,trigger:0});
  }
  if (!solid && !onPlatform(p.x,p.y,p)) return false;
  if (p.stats.brakeLights) replaceCardObject('bumper',p,p,3.3,{slow:.48});
  if (p.stats.mineCart && !p.stats['backbeat-mine']) placeComboProp(p,'mine',370,p);
  if (p.cardSuperDash && p.stats.powerSlide) {
    directionalCardShove(p,p,{x:p.dx,y:p.dy},116,575,{lanes:[0],arc:1.35,force:1});
  }
  return true;
}

function pushTargetPoint(p, aim, range, requireBare = false) {
  const contact = wallRay(p,aim,range);
  const last = Math.min(range,Math.max(0,(contact?.distance ?? range+8)-8));
  for (let distance=last;distance>=28;distance-=8) {
    const point = {x:p.x+aim.x*distance,y:p.y+aim.y*distance};
    if (!fixedCardFloor(point.x,point.y)) continue;
    if (!requireBare || (currentMap.safeFootprint(point.x,point.y,21) &&
        !players.some(other=>!other.out && nearPoint(other,point,38)) &&
        !obstacles.some(wall=>pointIn(point.x,point.y,wall)))) return point;
  }
  return requireBare ? null : fixedCardFloor(p.x,p.y) ? {x:p.x,y:p.y} : null;
}

function selectedDouble(p) {
  const copy = cardObjects.find(o=>o.owner===p && o.kind==='cardboard' && activeCardObject(o));
  const decoy = comboProps.find(o=>o.owner===p && o.kind==='decoy' && o.expires>matchTime);
  const afterimage = p.recallPoint?.source === 'afterimage' ? p.recallPoint : null;
  return copy || decoy || afterimage;
}

function directionalCardShove(owner,point,aim,range,force,pattern,options = {}) {
  const angle = angleOf(aim);
  flash('trail',point.x,point.y,owner.color || '#ffdba6',22,.30,point.x+aim.x*range,point.y+aim.y*range);
  for (const target of players) {
    const x = target.x-point.x, y = target.y-point.y, length = Math.hypot(x,y);
    if (length < 1 || length > range || !inPushPattern(Math.atan2(y,x),angle,pattern)) continue;
    cardShove(target,owner,x/length,y/length,force*pushFalloff(length,range),{...options,generated:true});
  }
}

function cardOnManualPush(p,power,range,pattern) {
  const aim = aimOf(p), angle = angleOf(aim);
  const tap = power < .25;
  const inRange = object=>nearPoint(p,object,range) &&
    inPushPattern(Math.atan2(object.y-p.y,object.x-p.x),angle,pattern);
  if (p.stats.bankShot && tap) {
    const contact = wallRay(p,aim,range);
    if (contact) {
      const bounced = {...aim,[contact.axis]:-aim[contact.axis]};
      shoveTravel(p,{x:contact.x+bounced.x*12,y:contact.y+bounced.y*12},bounced,410);
      flash('burst',contact.x,contact.y,'#ffe58d',29,.32);
    }
  }
  for (const object of [...cardObjects]) {
    if (!activeCardObject(object) || !inRange(object)) continue;
    if (object.kind==='arrow' && tap) {
      shoveTravel(p,object,aim,object.force,{noArrow:true});
      object.until = 0;
    } else if (object.kind==='cardboard') {
      object.dx = aim.x;
      object.dy = aim.y;
      object.speed = 290 + 390*pushCurve(power);
      object.pusher = p;
    } else if (object.kind==='smoke') {
      object.until = 0;
      areaPush(object.owner,object.x,object.y,72,360);
    }
  }
  if (tap && p.delivery) {
    cardObject('pickup',p,{x:p.x+p.fx*24,y:p.y+p.fy*24},2,{item:p.delivery.item,dx:p.fx,dy:p.fy,speed:410});
    p.delivery = null;
  }
  if (tap && p.stats.mineCart) {
    const mine = comboProps.find(prop=>prop.kind==='mine' && inRange(prop));
    if (mine) {
      mine.dx = aim.x;
      mine.dy = aim.y;
      mine.moving = true;
      mine.timed = true;
      mine.armedAt = matchTime+.48;
      mine.expires = matchTime+.55;
    }
  }
  if (p.windStored) {
    const wind = p.windStored;
    shoveTravel(p,p,{x:wind[4],y:wind[5]},325);
    p.windStored = null;
  }
  if (p.stats.centerStage || p.stats.houseLights) p.lastSpot = pushTargetPoint(p,aim,range);
  if (p.stats.stunt && power >= .42) {
    const double = selectedDouble(p);
    if (double) {
      if (double.kind==='cardboard') double.until = 0;
      else if (double.kind==='decoy') double.expires = 0;
      else p.recallPoint = null;
      directionalCardShove(p,double,aim,range*.84,(280+700*pushCurve(power))*pattern.force,pattern);
    }
  }
}

function cardOnEmptyHit(p,power,range) {
  if (!p.stats.wrongFloor || power < .45) return;
  const point = pushTargetPoint(p,aimOf(p),range,true);
  if (point) replaceCardObject('launch',p,point,.78,{radius:44,trigger:matchTime+.72});
}

function cardOnDodge(p) {
  if (p.stats.smoke) replaceCardObject('smoke',p,p,2.5,{radius:43});
  for (const link of cardTethers) {
    if ((link.a===p || link.b===p) && link.pulls?.some(pull=>pull.at>matchTime && pull.at-matchTime<=.20)) {
      link.until = 0;
      flash('burst',p.x,p.y,'#96f8f1',32,.35);
    }
  }
}

function sideDestination(p) {
  for (const sign of [1,-1]) {
    const point = {x:p.x+70*p.fy*sign,y:p.y-70*p.fx*sign};
    if (clearComboLanding(point,p)) return point;
  }
  return null;
}

function cardOnEmote(p) {
  p.grinUsed = false;
  const fallback = p.stats.stunt && !p.stats.standIn && !p.stats['hollow-double'] && !p.stats.afterimage;
  if ((p.stats.standIn && p.standReady) || fallback) {
    p.standReady = false;
    replaceCardObject('cardboard',p,p,5,{look:{...p.look,emote:1},speed:0});
  }
  if (p.stats.centerStage || p.stats.houseLights) {
    const aimSpot = p.lastSpot || (p.stats.houseLights && pushTargetPoint(p,aimOf(p),78));
    const points = p.stats.houseLights ? [aimSpot,p] : [aimSpot];
    for (const point of points) {
      if (!point || !onPlatform(point.x,point.y,p)) continue;
      cardObject('spotlight',p,point,.65,{trigger:matchTime+.59,radius:96});
    }
  }
  if (p.stats.cord) {
    const candidates = obstacles.filter(wall=>Number.isFinite(wall.integrity)).map(wall=>({
      wall,x:Math.max(wall.x,Math.min(p.x,wall.x+wall.w)),y:Math.max(wall.y,Math.min(p.y,wall.y+wall.h))
    }));
    candidates.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
    if (candidates[0] && nearPoint(p,candidates[0],180)) p.cord = {...candidates[0],until:matchTime+3};
  }
  if (p.sideReady) {
    const point = sideDestination(p);
    if (point) p.sideCommit = {point,at:matchTime+.22};
  }
}

function cardOvercharge(p) {
  if (p.stats.cleanShoes && (p.slide > 0 || (!rules.bananas && matchTime >= (p.cleanPeelAt || 0)))) {
    p.slide = 0;
    p.cleanPeelAt = matchTime+4;
    cardObject('banana',p,{x:p.x-27*p.fx,y:p.y-27*p.fy},2.1,{dx:-p.fx,dy:-p.fy,speed:235,trigger:matchTime+.17});
  }
  if (p.stats.backstage) replaceCardObject('backstage',p,p,3,{radius:43,kicked:false});
  if (p.stats.catapult) replaceCardObject('catapult',p,p,4,{dx:p.fx,dy:p.fy,radius:28,trigger:matchTime+.34});
  const rim = p.stats.floorYours && !p.tileUsed && rimAt(p,24,true);
  if (!rim) return;
  const w = rim.across ? 52 : 27, h = rim.across ? 27 : 52;
  const x = rim.x-w/2-rim.dx*12, y = rim.y-h/2-rim.dy*12;
  const footprint = {x,y,w,h};
  if (obstacles.some(wall=>wall.x<x+w && wall.x+wall.w>x && wall.y<y+h && wall.y+wall.h>y)) return;
  p.tileUsed = true;
  cardObject('tile',p,footprint,2.4,{w,h,dx:rim.dx,dy:rim.dy,footprint,trigger:matchTime+.38});
}

function fixedCardFloor(x,y) {
  return currentMap.floor(x,y) && !cardObjects.some(object=>object.kind==='tile' && pointIn(x,y,object.footprint));
}

function cardPlatform(x,y,p) {
  return cardObjects.some(object=>activeCardObject(object) && (
    ((object.kind==='tile' || object.kind==='ledge') && pointIn(x,y,object)) ||
    (object.kind==='foothold' && object.owner===p && nearPoint({x,y},object,object.radius))));
}

function cardTerrain(p, input) {
  if (p.snapbackPending && p.snapbackPending <= matchTime && Math.hypot(p.vx,p.vy)<175 && p.slide<=0 && !(p.frozen>0) && !(p.dodge>0)) {
    p.snapbackPending = 0;
    boostMovement(p,.22,2);
    flash('trail',p.x,p.y,'#aafbd7',20,.42,p.x-p.fx*38,p.y-p.fy*38);
  }
  if (p.sideCommit && matchTime >= p.sideCommit.at) {
    const {point} = p.sideCommit;
    if (clearComboLanding(point,p)) comboTeleport(p,point);
    p.sideReady = false;
    p.sideCommit = null;
  }
  if (p.cord && (p.cord.until<=matchTime || !obstacles.includes(p.cord.wall) || !nearPoint(p,p.cord,210))) p.cord = null;
  if (p.cord?.swing && p.dash>0) {
    const dx=p.x-p.cord.x,dy=p.y-p.cord.y,length=Math.hypot(dx,dy) || 1;
    p.dx=-dy/length*p.cord.swing;
    p.dy=dx/length*p.cord.swing;
  }
  if (p.stats.treads && Math.hypot(input.x,input.y)>.3 &&
      matchTime>=(p.slickAt || 0) && fixedCardFloor(p.x,p.y)) {
    p.slickAt=matchTime+(arena===1 ? .28 : .65);
    cardObject('slick',p,p,1.25,{radius:25});
  }
}

function updateCardWorld(dt) {
  for (const p of players) {
    if (p.delivery && p.delivery.until<=matchTime) {
      if (!p.out) applyPickup(p,p.delivery.item);
      p.delivery = null;
    }
  }
  for (const link of cardTethers) {
    if (link.a.out || link.b.out) link.until = 0;
    if (link.until<=matchTime || !link.pulls) continue;
    link.pulls = link.pulls.filter(pull=>{
      if (pull.at>matchTime) return true;
      for (const p of [link.a,link.b]) {
        p.vx += pull.dx*(p===pull.source ? 170 : 310);
        p.vy += pull.dy*(p===pull.source ? 170 : 310);
      }
      return false;
    });
  }
  for (let i=cardTethers.length-1;i>=0;i--) if (cardTethers[i].until<=matchTime) cardTethers.splice(i,1);
  for (const object of [...cardObjects]) {
    if (!activeCardObject(object)) continue;
    if (object.kind==='tile') {
      if (matchTime < object.trigger) continue;
      const dx=object.dx*80*dt,dy=object.dy*80*dt;
      for (const p of players) {
        if (!p.out && !(p.airUntil>matchTime) && pointIn(p.x,p.y,object)) {
          moveAxis(p,'x',dx);
          moveAxis(p,'y',dy);
        }
      }
      object.x+=dx;
      object.y+=dy;
      continue;
    }
    let previousPoint;
    if (object.speed) {
      previousPoint={x:object.x,y:object.y};
      const reach=object.speed*dt;
      const wall = wallRay(object,{x:object.dx,y:object.dy},reach,object.kind==='cardboard'?9:0);
      if (wall) {
        if (object.kind==='cardboard') flash('burst',wall.x,wall.y,'#e9c98f',24,.28);
        if (object.kind==='pickup' || object.kind==='banana') {
          object.speed=0;
        } else {
          object.until=0;
          continue;
        }
      }
      if (!wall) {
        object.x+=object.dx*reach;
        object.y+=object.dy*reach;
      }
      if (object.kind==='cardboard') object.speed*=Math.exp(-3.4*dt);
    }
    if (object.kind==='spotlight' && matchTime>=object.trigger) {
      areaPush(object.owner,object.x,object.y,object.radius,565,undefined,{self:true});
      object.until=0;
    }
    if (object.kind==='parryEcho' && matchTime>=object.trigger && !object.fired) {
      object.fired = true;
      areaPush(object.owner,object.x,object.y,49,245,undefined,{echo:true});
    }
    if (object.kind==='launch' && matchTime>=object.trigger) {
      for (const p of players) {
        if (p.out || !nearPoint(p,object,object.radius)) continue;
        p.airUntil=matchTime+.70;
        p.airDash=true;
      }
      flash('burst',object.x,object.y,'#cad2ff',object.radius,.42);
      object.until=0;
    }
    for (const p of players) {
      if (p.out) continue;
      const dx=object.x-(previousPoint?.x ?? object.x), dy=object.y-(previousPoint?.y ?? object.y);
      const fraction = (dx || dy) ? Math.max(0,Math.min(1,((p.x-previousPoint.x)*dx+(p.y-previousPoint.y)*dy)/(dx*dx+dy*dy))) : 1;
      const closest = {x:object.x-dx*(1-fraction),y:object.y-dy*(1-fraction)};
      const hit = nearPoint(p,closest,(object.radius || 10)+(p.radius || half));
      if (object.kind==='ledge' && pointIn(p.x,p.y,object) && !object.trigger) {
        object.trigger=matchTime;
        object.until=Math.min(object.until,matchTime+1);
      } else if (object.kind==='foothold' && p===object.owner && !fixedCardFloor(p.x,p.y) &&
          nearPoint(p,object,object.radius) && !object.trigger) {
        object.trigger=matchTime;
        object.until=Math.min(object.until,matchTime+.6);
      }
      if (!hit) continue;
      if (object.kind==='shove' && p!==object.owner && !friendly(object.owner,p)) {
        cardShove(p,object.owner,object.dx,object.dy,object.force,{generated:true,reflectable:true,noArrow:object.noArrow,pendingRound:object.pendingRound});
        object.until=0;
      } else if (object.kind==='cardboard' && object.speed>35 && p!==object.pusher) {
        if (friendly(object.pusher,p)) continue;
        cardShove(p,object.pusher,object.dx,object.dy,object.speed*.58,{generated:true});
        flash('burst',object.x,object.y,'#e9c98f',24,.28);
        object.until=0;
      } else if (object.kind==='pickup' && (p!==object.owner || object.speed===0)) {
        applyPickup(p,object.item);
        object.until=0;
      } else if (object.kind==='banana' && matchTime>=object.trigger) {
        if (p.stats.soles && p.dash>0) {
          object.dx=p.dx;
          object.dy=p.dy;
          object.speed=290;
          object.trigger=matchTime+.16;
          flash('burst',object.x,object.y,'#ffd86c',29,.25);
        } else {
          slipOnPeel(p);
          object.until=0;
        }
      } else if (object.kind==='catapult' && matchTime>=object.trigger) {
        p.vx+=object.dx*640;
        p.vy+=object.dy*640;
        flash('burst',object.x,object.y,'#cafe91',38,.35);
        object.until=0;
      } else if (object.kind==='slick' && p!==object.owner && !friendly(object.owner,p)) {
        p.iceSlideUntil=Math.max(p.iceSlideUntil || 0,matchTime+.18);
      } else if (object.kind==='bumper' && (!object.owner || (p!==object.owner && !friendly(object.owner,p)))) {
        p.slowUntil=matchTime+.65;
        p.slowStrength=object.slow;
        object.until=0;
      } else if (object.kind==='backstage') {
        if (p===object.owner && p.dash>0 && !object.kicked) {
          object.kicked=true;
          p.dashSpeed*=1.34;
          p.dash+=.07;
          flash('burst',p.x,p.y,'#bafcae',37,.35);
        } else if (p!==object.owner && !friendly(object.owner,p)) {
          p.slowUntil=matchTime+.32;
          p.slowStrength=.38;
        }
      }
      if (!activeCardObject(object)) break;
    }
  }
  for (let i=cardObjects.length-1;i>=0;i--) {
    const object=cardObjects[i];
    if (object.kind==='tile' && !activeCardObject(object)) object.tipped = true;
    else if (!activeCardObject(object)) cardObjects.splice(i,1);
  }
}

function markLastWord(p) {
  if (!p.stats.lastWord || p.lastWordUsed || p.lastShove?.until<=matchTime ||
      !p.lastShove || p.lastShove.owner===p) return;
  const rim = rimAt(p,100);
  if (!rim) return;
  p.lastWordUsed=true;
  p.ghost={x:rim.x,y:rim.y,ready:matchTime+.42,until:matchTime+1.75,dx:p.fx,dy:p.fy,fire:0};
}

function updateGhost(p,input) {
  const ghost=p.ghost;
  if (!ghost) return;
  if (input.inputLost) { p.ghost=null; return; }
  if (matchTime>=ghost.until && !ghost.fire) { p.ghost=null; return; }
  if (ghost.fire && matchTime>=ghost.fire) {
    shoveTravel(p,ghost,{x:ghost.dx,y:ghost.dy},660,{pendingRound:true});
    p.ghost=null;
    return;
  }
  if (!ghost.fire) {
    const length=Math.hypot(input.x,input.y);
    if (length>.12) {
      ghost.dx=input.x/length;
      ghost.dy=input.y/length;
    }
    if (matchTime>=ghost.ready && input.push) ghost.fire=matchTime+.27;
  }
}

function cardRoundPending() {
  return ghostImpactUntil>matchTime || players.some(p=>p.ghost) || cardObjects.some(object=>object.pendingRound && activeCardObject(object));
}

function drawCardWorld() {
  const colors={shove:'#ffe49b',arrow:'#83e7ff',smoke:'#b1a4cb',bumper:'#f9ae82',pickup:'#ffe7a2',
    banana:'#ffe8a2',spotlight:'#ff937b',launch:'#c4b6ff',catapult:'#c1fa97',slick:'#91e4ff',
    backstage:'#b6eaa2',parryEcho:'#d6b5ff',jammer:'#e4acff',ledge:'#9ef3d5',foothold:'#9ef3d5',tile:'#ffb985'};
  for (const object of cardObjects) {
    if (object.kind==='tile' && (object.tipped || matchTime >= object.trigger)) {
      ctx.save();
      ctx.fillStyle='#10151e';
      const {x,y,w,h}=object.footprint;
      ctx.fillRect(x,y,w,h);
      ctx.restore();
    }
    if (!activeCardObject(object)) continue;
    const color=colors[object.kind] || '#e6c891';
    ctx.save();
    ctx.fillStyle=color;
    ctx.strokeStyle=color;
    ctx.lineWidth=2;
    const age=object.until-matchTime;
    if (object.kind==='shove' || object.kind==='arrow' || object.kind==='catapult') {
      drawCardArrow(object.x,object.y,object.dx,object.dy,object.kind==='shove'?29:23,color);
    }
    if (object.kind==='cardboard') {
      ctx.translate(object.x,object.y);
      ctx.globalAlpha=.78;
      drawEmote(ctx,object.look,53,.53);
      ctx.strokeRect(-16,-20,32,41);
    } else if (object.w) {
      ctx.globalAlpha=object.kind==='tile' && age<.45 ? .35 : .72;
      ctx.fillRect(object.x,object.y,object.w,object.h);
      ctx.strokeRect(object.x,object.y,object.w,object.h);
      drawCardLabel(object.kind==='tile' ? (age<.45?'TIPPING':'RIM TILE') : 'LEDGE '+age.toFixed(1),
        object.x+object.w/2,object.y-5,color);
    } else if (object.kind==='banana' || object.kind==='pickup') {
      ctx.textAlign='center';
      ctx.font='bold 21px sans-serif';
      ctx.fillText(object.kind==='banana'?'🍌':'◆',object.x,object.y+6);
    } else if (object.radius || object.kind==='parryEcho' || object.kind==='bumper') {
      const radius=object.radius || (object.kind==='parryEcho'?37:24);
      ctx.beginPath();
      ctx.arc(object.x,object.y,radius,0,Math.PI*2);
      ctx.globalAlpha=.16;
      ctx.fill();
      ctx.globalAlpha=.85;
      ctx.setLineDash([6,4]);
      ctx.stroke();
      ctx.setLineDash([]);
      const label=({spotlight:'SPOTLIGHT',launch:'LAUNCH',parryEcho:'PARRY ECHO',jammer:'SHOVE-HOPS',
        foothold:'FOOTHOLD',bumper:'BUMPER'})[object.kind];
      if (label) drawCardLabel(label+(object.trigger>matchTime?' '+(object.trigger-matchTime).toFixed(1):''),object.x,object.y,color);
    }
    ctx.restore();
  }
  for (const link of cardTethers) {
    const warning=link.pulls?.some(pull=>pull.at>matchTime);
    drawCardLine(link.a,link.b,warning?'#fff294':'#a8efd9',warning?4:2);
  }
  for (const p of players) {
    if (p.ghost) {
      const g=p.ghost;
      ctx.save();
      ctx.globalAlpha=.68;
      drawCharacter(ctx,p.look,g.x-28,g.y-28,56);
      ctx.restore();
      drawCardArrow(g.x,g.y,g.dx,g.dy,56,g.fire?'#ffa886':'#e4bdff');
      drawCardLabel(g.fire?'LAST WORD!':g.ready>matchTime?'WINDUP':'TAP PUSH',g.x,g.y-28,'#e4bdff');
    }
    if (p.out) continue;
    if (p.cord) {
      drawCardLine(p,p.cord,'#fecf88',3);
      drawCardLabel('●',p.cord.x,p.cord.y,'#fecf88');
    }
    if (p.carom?.until>matchTime) drawCardLabel('CAROM',p.x,p.y-28,'#ffbd91');
    if (p.lastSpot) drawCardLabel('◉',p.lastSpot.x,p.lastSpot.y,'#ffc09d');
    const sidestep = p.sideCommit?.point || (p.sideReady && sideDestination(p));
    if (sidestep) {
      drawCardLine(p,sidestep,'#d9b4ff',2);
      drawCardLabel('STEP',sidestep.x,sidestep.y,'#d9b4ff');
    }
    if (p.stats.stunt) {
      const double=selectedDouble(p);
      if (double) drawCardLabel('STUNT',double.x,double.y-29,'#e6c891');
    }
    if (p.caughtForce) drawCardLabel('SHOVE STORED',p.x,p.y-29,'#ffde92');
    if (p.delivery) drawCardLabel('◆ TAP TO THROW',p.x,p.y-29,p.delivery.item.color);
    if (p.stats.floorYours && p.charge>0 && !p.tileUsed) {
      const rim = rimAt(p,24,true);
      if (rim) drawCardLabel('DETACH',rim.x,rim.y-7,'#ffb985');
    }
    if (p.windStored) drawCardArrow(p.x,p.y,p.windStored[4],p.windStored[5],49,'#a2eff9');
    if (p.pinballActive || p.pinballReady) {
      const aim=p.pinballActive?{x:p.dx,y:p.dy}:aimOf(p);
      const contact=wallRay(p,aim,130,p.radius || half);
      if (contact) {
        const bounced={...aim,[contact.axis]:-aim[contact.axis]};
        drawCardArrow(contact.x,contact.y,bounced.x,bounced.y,48,'#ffe592');
      } else if (p.pinballReady) drawCardLabel('BOUNCE READY',p.x,p.y-27,'#ffe592');
    }
  }
}

function drawCardLine(a,b,color,width) {
  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=width;
  ctx.beginPath();
  ctx.moveTo(a.x,a.y);
  ctx.lineTo(b.x,b.y);
  ctx.stroke();
  ctx.restore();
}

function drawCardArrow(x,y,dx,dy,length,color) {
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(Math.atan2(dy,dx));
  ctx.strokeStyle=color;
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.lineTo(length,0);
  ctx.moveTo(length-8,-6);
  ctx.lineTo(length,0);
  ctx.lineTo(length-8,6);
  ctx.stroke();
  ctx.restore();
}

function drawCardLabel(label,x,y,color) {
  ctx.save();
  ctx.textAlign='center';
  ctx.font='bold 12px monospace';
  ctx.strokeStyle='#151b26';
  ctx.lineWidth=4;
  ctx.fillStyle=color;
  ctx.strokeText(label,x,y);
  ctx.fillText(label,x,y);
  ctx.restore();
}
