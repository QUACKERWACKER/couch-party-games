'use strict';
const card = name => deck.find(row=>row[0]===name);
let a,b;
const neutral = {x:0,y:0};
function player(x,y,stats={}) {
  return {x,y,fx:1,fy:0,dx:1,dy:0,vx:0,vy:0,walkX:0,walkY:0,stats,look:{shape:0,color:0,emote:1},
    color:'#8cf',dash:0,charge:0,slide:0,dashCooldown:0,pushCooldown:0,dodgeCooldown:0,pulse:0};
}
function scene(statsA={},statsB={},settings={}) {
  resetCardWorld();
  comboProps=[]; effects=[]; echoes=[]; obstacles=[];
  upcomingMap=upcomingWalls=null;
  matchTime=10; humanCount=2; roundPending=false; ghostImpactUntil=0;
  currentMap=maps[0]; rules={...baseRules,terrain:false,bananas:false,hazards:false,...settings};
  builds=[[],[]]; state='playing'; endless=false; objective=null; roundsMode=false; score=[0,0]; teamScore=[0,0];
  slots.splice(0,slots.length,-2,-1);
  matchStats=Array.from({length:2},()=>({attempts:0,landed:0,dashes:0,pushes:0,falls:0,emotes:0}));
  a=player(360,220,statsA); b=player(420,220,statsB); players=[a,b];
}
const count = kind => cardObjects.filter(o=>o.kind===kind && activeCardObject(o)).length;
const find = kind => cardObjects.find(o=>o.kind===kind && activeCardObject(o));
const tick = (dt=.016,inputA=neutral,inputB=neutral) => move([inputA,inputB],dt);

assert.equal(new Set(deck.map(c=>c[0])).size,deck.length);
assert.equal(card('Heel Turn'),undefined);
assert.equal(card('Phoenix Engine'),undefined);
assert.equal(dealCards([],false,()=>.2,{},maps[0],true).filter(c=>c[1]==='Common').length,3);
const fallback=dealCards([card('Second Chance')],false,()=>.2,{walls:false,radicalCards:false},maps[0]);
assert.equal(fallback.length,3);
assert(fallback.every(c=>!synergyNote(c,[card('Second Chance')]) && !isRadicalCard(c)));
assert(dealCards([card('Bank Shot')],false,()=>.25,{},maps[0]).some(c=>synergyNote(c,[card('Bank Shot')])));
assert(!cardEligible(card('Power Slide'),{superDash:false},maps[0]));
assert(!cardEligible(card('Gale Anchor'),{},maps[0]));
assert(cardEligible(card('Gale Anchor'),{},maps.find(m=>m.name==='Wind Tunnel')));
assert(cardEligible(card('Rally Flag'),{teams:true},maps[0]));
assert(cardEligible(card('Rally Flag'),{coop:true},maps[0]));
assert(!cardEligible(card('Pulse Train'),{roundsPreset:true},maps[0],[]));
assert(cardEligible(card('Pulse Train'),{roundsPreset:true},maps[0],[card('Thunder Tread')]));
assert.equal(makeSharedPool(5,[],()=>.24,{},maps[0]).length,5);

scene({focusCone:1,turntable:1});
resolvePushes([{p:a,power:.2}]);
assert.equal(a.pulsePattern.force,1.45);
a.dodge=.2; blockPush(a,b,-1,0,{force:380});
resolvePushes([{p:a,power:.2}]);
assert.equal(a.pulsePattern.arc,Math.PI);
assert.equal(a.pulsePattern.force,1);
resolvePushes([{p:a,power:.2}]);
assert.equal(a.pulsePattern.force,1.45);

scene({bankShot:1},{sender:1,borrowed:1});
b.x=323; b.dodge=.2; b.fx=1;
obstacles=[{x:405,y:190,w:20,h:70,integrity:5}];
resolvePushes([{p:a,power:.1}]);
assert.equal(find('shove').dx,-1);
for (let i=0;i<6;i++) updateCardWorld(.018);
assert.equal(find('shove').dx,1);
assert.equal(count('arrow'),1);
assert.equal(b.vx,0);
a.x=350; a.fx=-1; obstacles=[];
cardOnManualPush(a,.1,100,pushPattern(a,false));
assert.equal(count('arrow'),0);
assert(cardObjects.some(o=>o.owner===a && o.noArrow));

scene({standIn:1,stunt:1},{});
a.standReady=true; cardOnEmote(a);
assert.equal(count('cardboard'),1);
a.y=255;
resolvePushes([{p:a,power:.8}]);
assert.equal(count('cardboard'),0);
assert(b.vx>0);

scene({carom:1});
a.x=310; b.x=432;
obstacles=[{x:467,y:200,w:20,h:65,integrity:Infinity}];
resolvePushes([{p:a,power:1}]);
moveAxis(b,'x',35,1);
assert(b.vx<0 && b.carom);
a.x=b.x-28;
collide(b,a);
assert(a.vx<0 && !b.carom);

scene({stunt:1,'hollow-double':1});
placeComboProp(a,'decoy',410,{x:370,y:220});
resolvePushes([{p:a,power:.7}]);
assert.equal(comboProps[0].expires,0);
a.stats={stunt:1,afterimage:1};
a.recallPoint={x:370,y:220,source:'afterimage'};
resolvePushes([{p:a,power:.7}]);
assert.equal(a.recallPoint,null);

scene({comboEngine:1,pulseTrain:1,dashBurst:1,popCircuit:1},{backbeat:1,dodgeRate:.2});
a.comboUntil=13; a.dashCooldown=1; a.dashFinisher=true;
b.dodge=.2;
finishDash(a);
assert.equal(echoes.length,1);
assert.equal(count('parryEcho'),1);
assert.equal(a.dashCooldown,1);
assert.equal(a.comboUntil,13);
b.dodge=0;
resolvePushes([{p:a,power:.3}]);
assert.equal(a.dashCooldown,0);

scene({mineCart:1,'backbeat-mine':1},{});
a.dashFinisher=true; finishDash(a);
assert.equal(comboProps.filter(p=>p.kind==='mine').length,1);
comboProps[0].x+=39;
resolvePushes([{p:a,power:.1}]);
assert(comboProps[0].moving && comboProps[0].timed);
assert(comboProps[0].armedAt-matchTime<.5);

scene({wrongFloor:1},{});
b.y=335;
resolvePushes([{p:a,power:.9}]);
const launch=find('launch');
assert(launch);
b.x=launch.x; b.y=launch.y;
matchTime=launch.trigger+.01; updateCardWorld(.016);
assert(b.airDash && b.airUntil>matchTime);
b.dash=.16; b.dashSpeed=610; cardDashStart(b,false);
assert(!b.airDash && b.dash>.16 && b.dashSpeed>610);

scene({pocketLedge:1});
a.x=currentMap.bounds.right+22; a.dashFinisher=true; a.airLedge=true;
finishDash(a);
assert(onPlatform(a.x,a.y,b)); assert(a.ledgeUsed);
updateCardWorld(.016);
assert(find('ledge').until<=matchTime+1);
resetCardWorld(true);
assert(!a.ledgeUsed && !onPlatform(a.x,a.y,a));

scene({cord:1});
obstacles=[{x:400,y:270,w:30,h:40,integrity:3}];
cardOnEmote(a); assert(a.cord);
a.dash=.16; cardDashStart(a,false); assert(a.cord.swing);
cardShove(a,b,1,0,500,{generated:true}); assert(!a.cord);

scene({floorYours:1});
a.x=currentMap.bounds.right-10; b.x=a.x; b.y=a.y+6;
cardOvercharge(a); assert(a.tileUsed);
const tile=find('tile'); assert(tile && !fixedCardFloor(a.x,a.y));
matchTime=tile.trigger+.1;
const previousX=b.x; updateCardWorld(.1); assert(b.x>previousX);
matchTime=tile.until+.1; updateCardWorld(.016);
assert(!onPlatform(b.x,b.y,b));
resetCardWorld(true);
assert(!a.tileUsed && fixedCardFloor(currentMap.bounds.right-10,a.y));

scene({groupHug:1});
cardOnManualHit(a,b,1); cardOnManualHit(a,b,1);
assert.equal(cardTethers.length,1);
cardDashStart(b,false);
cardOnDodge(a);
updateCardWorld(.016);
assert.equal(cardTethers.length,0);
assert(a.groupUsed);
resetCardWorld(true);
assert(!a.groupUsed);

scene({lastWord:1});
a.x=currentMap.bounds.right+4; b.x=currentMap.bounds.right-27;
a.lastShove={owner:b,until:matchTime+1};
tick(); assert(a.out && a.ghost && roundPending);
assert.equal(score[1],0);
for(let i=0;i<27;i++) tick(.016,{x:-1,y:0});
tick(.016,{x:-1,y:0,push:true});
assert(a.ghost.fire>matchTime);
for(let i=0;i<100 && state==='playing';i++) tick();
assert(!roundPending && state!=='playing');

scene({centerStage:1,houseLights:1},{},{teams:true,friendlyPush:false});
a.team=b.team=0;
areaPush(a,a.x,a.y,110,500);
assert.equal(b.vx,0);
a.lastSpot={x:b.x,y:b.y};
cardOnEmote(a);
assert.equal(count('spotlight'),2);
matchTime+=.6; updateCardWorld(.016);
assert.equal(b.vx,0);
assert(Math.hypot(a.vx,a.vy)>0);

scene();
rules={...modeSettings.coop};
endless=true; startWave();
assert(players.length>humanCount && waveEnemies>0);
waveEnemies=0; wave=2;
updateEndless(.016);
assert.equal(state,'draft'); assert.equal(choices.length,3);
advanceWave();
assert.equal(wave,3); assert.equal(state,'countdown'); assert.equal(cardObjects.length,0);

scene();
editingMode='classic'; setup=false; state='menu';
primary();
assert(startingDraft && state==='draft' && choices.every(row=>row[1]==='Common'));
setClock(1600); pickCard(0,-1); assert.equal(builds[0].length,0);
pickCard(0,-2); assert.equal(builds[0].length,1);
nextDraft();
setClock(2200); pickCard(0,-1); nextDraft();
assert.equal(state,'countdown'); assert.equal(winsNeeded(),2);
assert(builds.every(picks=>picks.length===1));

scene({echo:1},{sender:1});
a.charge=.9*chargeMax; a.pushReleaseAt=matchTime-.08;
b.x=a.x+38; b.dodge=.2;
tick();
assert(echoes.some(echo=>echo.reflectable));
b.dodge=.2; updateEffects(.35);
assert(find('shove')?.owner===b);

scene({pinball:1,anchor:1});
a.pinballReady=true; a.knockbackSteer=true; a.vx=-350; a.dash=.16;
obstacles=[{x:392,y:185,w:25,h:72,integrity:2}];
cardDashStart(a,false);
assert(a.vx>0);
moveAxis(a,'x',20,1);
assert(a.dx<0 && !a.pinballActive);

scene({cleanShoes:1,snapback:1});
a.slide=.4; cardOvercharge(a);
assert(a.slide===0 && count('banana')===1);
cardShove(a,b,1,0,250);
a.vx=20; matchTime+=.2;
cardTerrain(a,neutral);
assert(movementBoost(a)>=.22);

scene({delivery:1,brakeLights:1,cornerStore:1},{},{bananas:true});
peel={x:a.x,y:a.y,type:pickupTypes[0]}; peelTimer=3; updatePeel(.016);
assert(a.delivery && !a.pickup);
resolvePushes([{p:a,power:.1}]);
for(let i=0;i<7;i++) updateCardWorld(.02);
assert.equal(b.pickup,pickupTypes[0]);
a.dashFinisher=true; finishDash(a);
assert.equal(count('bumper'),1);
obstacles=[{x:520,y:185,w:25,h:72,integrity:.4}];
damageWall(obstacles[0],1,a);
assert.equal(count('bumper'),2);

scene({smoke:1,catapult:1},{jammer:1});
cardOnDodge(a);
b.x=a.x+50; b.fx=-1;
resolvePushes([{p:b,power:.1}]);
assert.equal(count('smoke'),0);
cardOvercharge(a);
const pad=find('catapult');
a.vx=0; matchTime=pad.trigger+.05; updateCardWorld(.016);
assert(a.vx>500);
b.dodge=.2;
blockPush(b,a,1,0,{force:400});
assert(count('jammer')===1);
b.dodge=0;
tick(.016,{...neutral,dash:true});
assert(a.jamHop && a.dashSpeed===315);

scene({stepping:1,catchThrow:1},{});
a.x=currentMap.bounds.left+20; a.dodge=.2;
blockPush(a,b,-1,0,{force:3000});
assert.equal(a.caughtForce,520);
const step=find('foothold'); assert(step);
assert(onPlatform(step.x,step.y,a) && !onPlatform(step.x,step.y,b));
a.dodge=0; a.x=360;
resolvePushes([{p:a,power:.2}]);
assert(!a.caughtForce && b.vx>520);

scene({freeze:1,treads:1},{});
dashHit(a,b,'x',1);
assert(b.iceSlideUntil>matchTime && !b.frozen);
arena=nextArena=1;
cardTerrain(a,{x:1,y:0}); assert(count('slick')===1);
arena=nextArena=0;

scene({groupHug:1,lastWord:1},{});
a.x=currentMap.bounds.right+10; b.x=currentMap.bounds.right-120;
a.lastShove={owner:b,until:matchTime+1};
tick(); assert(a.ghost);
a.ghost.fire=matchTime+.01;
a.ghost.dx=-1;
tick(.016);
assert(cardRoundPending() && !a.ghost);
for(let i=0;i<120 && state==='playing';i++) tick(.016);
assert.equal(score[1],1);
assert.equal(state,'round');

scene();
editingMode='draft'; setup=false; state='menu';
primary();
assert.equal(draftQueue[0],0);
assert.equal(sharedDraft.pool.length,4);
for (let pass=0;pass<4;pass++) {
  const [first,second]=pass%2===0?[-2,-1]:[-1,-2];
  assert.equal(slots[draftQueue[0]],first);
  setClock(5000+pass*2000); pickCard(0,first); nextDraft();
  assert.equal(slots[draftQueue[0]],second);
  assert.equal(sharedDraft.pool.length,3);
  setClock(5600+pass*2000); pickCard(0,second); nextDraft();
}
assert.equal(state,'countdown');
assert(builds.every(picks=>picks.length===4));

scene({grin:1,'mirrored-step':1});
a.emoteUntil=matchTime+1;
cardShove(a,b,1,0,400);
assert.equal(a.vx,260);
assert(a.hitSlideUntil>matchTime && a.sideReady);
cardShove(a,b,1,0,400);
assert.equal(a.vx,660);
const sidestep=sideDestination(a);
cardOnEmote(a);
assert.equal(a.sideCommit.point.y,sidestep.y);
matchTime=a.sideCommit.at+.01;
cardTerrain(a,neutral);
assert.equal(a.y,sidestep.y);

scene({soles:1},{});
peel={x:a.x,y:a.y,type:null}; a.dash=.15; peelTimer=2;
updatePeel(.016);
assert(count('banana')===1 && !a.slide);

scene({windGuard:1},{},{hazards:true});
currentMap=maps.find(m=>m.name==='Wind Tunnel');
a.x=220; a.y=220;
tick(.016,{...neutral,charging:true});
assert(a.windStored);
resolvePushes([{p:a,power:.3}]);
assert(!a.windStored && find('shove'));

scene({powerSlide:1},{});
a.cardSuperDash=true; a.dashFinisher=true;
finishDash(a);
assert(b.vx>0);

scene({lastWord:1});
a.x=currentMap.bounds.right+10; a.y=currentMap.bounds.bottom-65;
b.x=currentMap.bounds.right-12; b.y=currentMap.bounds.bottom-35;
a.lastShove={owner:b,until:matchTime+1};
tick();
a.ghost.fire=matchTime+.01;
a.ghost.dx=-.4; a.ghost.dy=.92;
for(let i=0;i<135 && state==='playing';i++) tick();
assert.equal(state,'round');
assert.equal(get('title').textContent,'DRAW');
assert.equal(score[1],0);

scene({standIn:1,stunt:1,focusCone:1,turntable:1,cord:1});
a.standReady=true; a.charge=.75; a.caughtForce=250;
obstacles=[{x:390,y:270,w:30,h:30,integrity:3}];
cardOnEmote(a);
cardObject('shove',a,{x:400,y:250},1,{dx:1,dy:0});
cardObject('launch',a,{x:480,y:260},1,{radius:40,trigger:matchTime+.5});
draw();

scene({lastWord:1},{},{teams:true,friendlyPush:false});
a.team=0; b.team=1;
a.x=currentMap.bounds.right+6;
a.lastShove={owner:b,until:matchTime+1};
tick();
assert(a.ghost && teamScore[1]===0);
for(let i=0;i<130 && state==='playing';i++) tick();
assert.equal(teamScore[1],1);
assert.equal(state,'round');

scene();
editingMode='builds'; setup=false; state='menu';
primary();
assert(startingDraft && winsNeeded()===2);

function buildScene(statsA={},statsB={}) {
  scene(statsA,statsB,{divergence:true,minFights:4,wins:3});
  buildEnd();
  currentMap=buildArenas[0];
  buildStartedAt=matchTime;
  buildFight=0;
  buildStarterPool=[];
}
const newCard=key=>buildDeck.find(c=>buildKeys(c)===key);
for (const route of buildRoutes) {
  buildScene({[route[0]]:1});
  obstacles=[{x:438,y:190,w:18,h:75,integrity:Infinity}];
  assert(buildCast(a),route[0]+' can cast alone');
  assert(buildObjects.length || a.buildTether || a.buildSlide>matchTime);
  const selected=[newCard(route[0])];
  for(let phase=1;phase<=3;phase++) {
    const offer=buildChoices(selected,()=>.49);
    assert.equal(offer.length,3);
    assert(offer.includes(newCard(route[phase])));
    selected.push(newCard(route[phase]));
  }
}
buildScene({pitch:1,focusCone:1,buildCarom:1,cabinet:1},{wrongNumber:1});
obstacles=[{x:470,y:185,w:15,h:70,integrity:Infinity}];
buildTrick(a);
const ball=buildOwned(a,'ball');
ball.x=452;
moveBuildProp(ball,.05);
assert(ball.vx<0);
assert.equal(buildObjects.filter(o=>o.kind==='shot').length,1);
buildSplit(a,ball,{x:1,y:0},650,ball.rally);
assert.equal(buildObjects.filter(o=>o.kind==='shot').length,1);
b.dodge=.2;
buildHit(a,b,{x:1,y:0},600,{creator:a});
assert(buildObjects.some(o=>o.kind==='shot' && o.creator===a && o.instigator===b));
b.team=a.team=0;rules.friendlyPush=false;
b.dodge=0;
assert.equal(buildHit(a,b,{x:1,y:0},750),false);

buildScene({grapple:1,longReach:1,friction:1,slingshot:1});
b.vx=250;
assert(buildCast(a));
matchTime+=.2;
b.x+=29;
releaseBuildLine(a);
assert(b.vx>650);
resolvePushes([{p:a,power:.7}]);
assert(buildOwned(a,'slick'));

buildScene({puppet:1,quickFeet:1,buildStunt:1,bodyDouble:1});
buildCast(a);
const puppet=buildOwned(a,'puppet');
buildCast(a);assert.equal(buildBody(a),puppet);
buildCast(a);assert.equal(buildBody(a),a);
resolvePushes([{p:a,power:.8}]);
assert(buildOwned(a,'stunt'));
puppet.safePoint={x:550,y:220};puppet.x=currentMap.bounds.right-2;puppet.vx=420;
updateBuildWorld(.016);
assert(puppet.warning);
buildTrick(a);
assert(a.buildRescue && !buildOwned(a,'puppet') && !a.out);
a.x=currentMap.bounds.right+1;tick();
assert(a.out);

buildScene({rig:1,sweepCone:1,velcro:1,passBuck:1});
buildCast(a);
const rig=buildOwned(a,'rig');
resolvePushes([{p:a,power:.1}]);
assert.equal(a.buildCarry,rig);
buildDash(a);
assert(!a.buildCarry && rig.vx>400);
buildOnParry(a,{});
resolvePushes([{p:a,power:.7}]);
assert(!a.passBuck && buildOwned(a,'rig')!==rig);

buildScene({dare:1,cornering:1,recoil:1,noBrakes:1});
buildCast(a);
assert(a.buildSlide>matchTime);
buildDash(a);
assert(buildObjects.some(o=>o.kind==='shot'));
buildDash(a);
assert.equal(buildObjects.filter(o=>o.kind==='shot').length,1);

buildScene({bell:1,quickDraw:1,buildVerse:1,deadSwitch:1,focusCone:1});
buildCast(a);
resolvePushes([{p:a,power:.1}]);
assert(a.circleUntil>matchTime);
resolvePushes([{p:a,power:.8}]);
assert.equal(a.pulsePattern.arc,Math.PI);
assert.equal(a.pulsePattern.force,1);
assert(buildOwned(a,'ring') && buildOwned(a,'replay'));
resolvePushes([{p:a,power:.8}]);
assert.equal(a.pulsePattern.force,1.45);

buildScene();
state='menu';setup=false;editingMode='tricks';primary();
let testClock=18000;
function chooseBoth() {
  for(let n=0;n<2;n++) {
    setClock(testClock+=600);
    pickCard(0,slots[draftQueue[0]]);
    nextDraft();
  }
}
chooseBoth();
assert.equal(state,'countdown');
assert.notEqual(builds[0][0],builds[1][0]);
for(let fight=1;fight<=3;fight++) {
  finishRound(0);
  assert.equal(state,'draft');
  assert.equal(draftQueue[0],1);
  chooseBoth();
  begin();
  assert(builds.every(cards=>cards.length===fight+1));
}
finishRound(0);
assert.equal(state,'match');
assert.equal(buildObjects.length,0);

buildScene({pitch:1},{rig:1,wrongNumber:1});
const crowd=[a,b];
for(let i=0;i<5;i++) crowd.push(player(300+i*41,335,{[buildRoutes[i][0]]:1}));
players=crowd;humanCount=crowd.length;
slots.splice(0,slots.length,-2,-1,0,1,2,3,4);
for(let i=0;i<crowd.length;i++) buildTrick(crowd[i]);
assert(buildObjects.some(o=>o.kind==='ball') && buildObjects.some(o=>o.kind==='rig'));
for(let i=0;i<60;i++) move(crowd.map(()=>({...neutral})),.016);
draw();
buildEnd();
assert.equal(buildObjects.length,0);

scene();
a.x=350;b.x=446;
move([{x:1,y:0,aimX:0,aimY:1,charging:true},{...neutral}],.016);
assert.equal(a.fx,0);assert.equal(a.fy,1);assert(a.charge>0);

buildScene({pitch:1,cabinet:1},{rig:1,wrongNumber:1});
a.x=270;b.x=420;
const bankBall=buildObject('ball',a,{x:375,y:220},{vx:410,force:510,banks:2,rally:{split:false},until:matchTime+3});
buildObject('rig',b,{x:394,y:220},{fx:1,fy:0});
updateBuildWorld(.016);
assert.equal(bankBall.instigator,b);
assert.equal(bankBall.creator,a);
assert(bankBall.rally.split);

buildScene({pitch:1},{wrongNumber:1});
const controllerButtons=Array.from({length:17},()=>({pressed:false}));
slots[0]=0;
previous.delete(0);
readInput(0,{axes:[0,0,0,0],buttons:controllerButtons});
controllerButtons[5].pressed=true;
const gamepadInput=readInput(0,{axes:[0,0,1,0],buttons:controllerButtons});
assert(gamepadInput.trick && gamepadInput.aimX===1);
tick(.016,gamepadInput);
assert(buildOwned(a,'ball'));

buildScene();
buildStartedAt=matchTime-59;
a.x=currentMap.center.x;a.y=currentMap.center.y;
b.x=a.x+70;b.y=a.y;
tick();
assert.equal(score[0],1);
assert.equal(matchStats[0].tiebreaks,1);

buildScene({pitch:1,velcro:1,deadSwitch:1});
buildCast(a); resolvePushes([{p:a,power:.1}]);
assert(a.buildCarry);
buildDash(a);
resolvePushes([{p:a,power:.85}]);
assert(buildOwned(a,'replay'));

buildScene({grapple:1,buildCarom:1,cabinet:1});
obstacles=[{x:474,y:184,w:12,h:70,integrity:Infinity}];
assert(buildCast(a));
matchTime+=.2;
a.dx=1;a.dy=0;buildDash(a);
assert(Math.abs(a.dy)>.6);
resolvePushes([{p:a,power:1}]);
moveAxis(b,'x',61);
assert(b.buildBank?.banked);

buildScene({puppet:1,tripwire:1,deadSwitch:1});
buildCast(a);resolvePushes([{p:a,power:.8}]);
assert(buildOwned(a,'replay'));
buildDash(a);a.y+=51;buildDashFinish(a);
assert(buildOwned(a,'wire'));

buildScene({rig:1,buildCarom:1,cabinet:1});
buildCast(a);
const aimRig=buildOwned(a,'rig');
b.x=aimRig.x-19;b.y=aimRig.y;b.walkX=140;
updateBuildWorld(.016);
assert(b.vx>0);
assert(buildObjects.some(o=>o.kind==='shot'));

buildScene({dare:1,buildPotato:1,slingshot:1});
buildCast(a);b.vx=210;
resolvePushes([{p:a,power:.76}]);
assert(buildOwned(a,'fuse'));
buildDash(a);
assert(a.buildTether);
matchTime+=.2;b.x+=55;
releaseBuildLine(a);
assert(b.vx>760);

buildScene({bell:1,buildStunt:1,passBuck:1});
buildCast(a);
const firstBell=buildOwned(a,'bell');
buildOnParry(a,{});
resolvePushes([{p:a,power:.85}]);
assert(buildOwned(a,'bell')!==firstBell);
assert(buildOwned(a,'stunt'));

const kineticCard=name=>kineticDeck.find(card=>card[0]===name);
function kineticScene() {
  scene({},{},{kinetic:true,wins:5});
  kineticReset();
  currentMap=kineticStages[0];
  a.x=370;b.x=500;
}
kineticScene();
const initial=kineticOffers([],4,()=>.44);
assert.equal(new Set(initial).size,4);
for(let i=0;i<45;i++) tick(.016,{x:0,y:0,charging:true});
tick();
assert.equal(kineticWaves.length,0);
for(let i=0;i<14;i++) tick();
assert(b.x>500 || b.vx>0);

kineticScene();
builds[0]=['Pinball God','Triple Trouble','Echo Fist'].map(kineticCard);
b.x=a.x+45;
resolvePushes([{p:a,power:1}]);
assert.equal(a.pulsePattern.lanes.length,3);
assert(b.vx>1000 && b.kinLaunch.power===1);
assert.equal(kineticWaves.length,0);
assert.equal(kineticQueue.length,1);
const beforeEcho=b.vx;
matchTime+=.34;
kineticUpdate(.01);
assert.equal(b.vx,beforeEcho);
assert.equal(kineticQueue.length,0);
obstacles=[{x:b.x+25,y:b.y-30,w:12,h:60,integrity:Infinity}];
moveAxis(b,'x',24);
assert(b.vx<0);

kineticScene();
builds[0]=[kineticCard('Rocket Boots')];
kineticHooks(a,'dash');
assert.equal(kineticWaves.length,0);
a.dashCooldown=.8;
b.x=a.x+151;
resolvePushes([{p:a,power:1}]);
assert(b.vx>0 && a.dashCooldown<.8);

kineticScene();
builds[1]=[kineticCard('Mirror Match')];
b.dodge=.2;
kineticEmit(a,b,1,0,600);
const reflected=kineticWaves[0];
kineticHit(reflected,b);
assert.equal(reflected.owner,b);
assert.equal(reflected.creator,a);
assert.equal(reflected.generation,1);
assert.equal(kineticWaves.length,1);
assert(b.kinMirror);
b.dodge=0;
b.fx=1;a.x=b.x-40;
resolvePushes([{p:b,power:.1}]);
assert(a.vx<0 && !b.kinMirror);

kineticScene();
rules.friendlyPush=false;a.team=b.team=0;
kineticEmit(a,b,1,0,600);
kineticHit(kineticWaves[0],b);
assert.equal(b.vx,0);

kineticScene();
players.push(player(520,260),player(600,245));humanCount=4;
slots.splice(0,slots.length,-2,-1,0,1);
builds=[[],[],[],[]];score=[1,0,0,0];
finishRound(0);
assert.equal(state,'kineticDraft');
assert.equal(kineticDraft.picks[0],null);
assert(kineticDraft.picks.slice(1).every(p=>p.offers.length===4));
setClock(performance.now()+2300);
kineticPick(1,0);kineticPick(2,1);kineticPick(3,2);
assert.deepEqual(builds.map(p=>p.length),[0,1,1,1]);
tickKineticDraft([neutral,neutral,neutral,neutral],performance.now());
setClock(performance.now()+510);
tickKineticDraft([neutral,neutral,neutral,neutral],performance.now());
assert.equal(state,'countdown');
assert(!kineticWaves.length && !kineticProps.length && !kineticQueue.length);

kineticScene();
a.x=332;a.y=210;
currentMap=kineticStages[1];
kineticSurface(a,.1);assert(a.x>332);
currentMap=kineticStages[2];
obstacles=[{x:390,y:190,w:20,h:60,integrity:1}];
a.x=378;a.y=216;
kineticEmit(a,a,1,0,850);
kineticUpdate(.02);assert.equal(obstacles.length,0);

kineticScene();
state='menu';setup=false;editingMode='rounds';primary();
assert.equal(state,'countdown');assert(builds.every(p=>p.length===0));
assert(kineticStages.includes(currentMap));
for(let fight=1;fight<=5;fight++) {
  finishRound(0);
  if(fight===5) break;
  assert.equal(state,'kineticDraft');
  setClock(performance.now()+2300);
  kineticPick(1,0);
  assert.equal(builds[0].length,0);
  assert.equal(builds[1].length,fight);
  begin();
}
assert.equal(state,'match');

kineticScene();
builds[0]=[kineticCard('Gravity Hands'),kineticCard('Reverse Card')];
b.x=a.x+60;
kineticChargePull(a,.05);
assert(b.vx<0);
b.vx=0;
kineticParry(a,{});
resolvePushes([{p:a,power:.2}]);
assert(b.vx<0 && !a.kinReverse);

kineticScene();
b.x=a.x+70;
obstacles=[{x:a.x+32,y:a.y-28,w:12,h:56,integrity:Infinity}];
resolvePushes([{p:a,power:1}]);
assert.equal(b.vx,0);

// Phone phase changes must consume held actions until the player releases.
scene();
slots[0]=1000000;
previous.delete(slots[0]);
const phoneButtons=Array.from({length:17},()=>({pressed:false}));
phoneButtons[2].pressed=true;
const phoneSample={phone:true,axes:[1,0,1,0],buttons:phoneButtons};
assert(readInput(0,phoneSample).inputLost);
assert(!readInput(0,phoneSample).charging);
phoneButtons[2].pressed=false;
readInput(0,phoneSample);
phoneButtons[2].pressed=true;
assert(readInput(0,phoneSample).charging);
state='paused';
assert(!readInput(0,phoneSample).charging);

// Host navigation and external gamepads cannot claim seats.
scene();
state='menu';editingMode=null;slots.length=0;
const phonePool=[];
window.couchJoinstick={sample:()=>phonePool,reserved:index=>index>=1000000,label:index=>'Phone '+index};
navigator.getGamepads=()=>[{index:7,connected:true,buttons:[{pressed:true}],axes:[1,0]}];
assert.equal(phoneInputs().length,0);
assert(!join(7));
for(let i=0;i<7;i++) {
  const buttons=Array.from({length:17},()=>({pressed:false}));buttons[0].pressed=true;
  phonePool.push({index:1000000+i,phone:true,mapping:'standard',connected:true,axes:[0,0,0,0],buttons});
  phoneInputs();
}
assert.equal(slots.length,6);
assert.equal(describeRingoutPhones()[1000006].hint,'All six seats are taken.');
phonePool.forEach(pad=>pad.buttons[0].pressed=false);
phoneInputs();
// A stale or another player's token cannot choose an upgrade.
builds=slots.map(()=>[]);score=slots.map(()=>0);humanCount=6;
startKineticDraft(0);
setClock(performance.now()+2300);
const view=phoneDraftView(1);
ringoutPhoneCommand(slots[2],{token:view.token,pick:0});
assert.equal(builds[2].length,0);
ringoutPhoneCommand(slots[1],{token:view.token,pick:0});
assert.equal(builds[1].length,1);
ringoutPhoneCommand(slots[1],{token:view.token,pick:1});
assert.equal(builds[1].length,1);
