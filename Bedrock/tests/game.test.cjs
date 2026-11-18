'use strict';
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

function game() {
  const drawing=new Proxy({}, {get:(_,key)=>key==='createImageData' ? (w,h)=>({data:new Uint8ClampedArray(w*h*4)}) : ()=>{}});
  const element=()=>({style:{},replaceChildren(){},append(){},getContext:()=>drawing});
  const context=vm.createContext({
    assert,console,URLSearchParams,Math,matchMedia:()=>({matches:false}),location:{search:'?dev'},
    document:{querySelector:element,getElementById:element,createElement:element,addEventListener(){}},
    window:{addEventListener(){},couchJoinstick:{describe(){},onBedrockMessage(){},label:i=>i>=1000000?'Phone':undefined}},
    performance:{now:()=>1000},requestAnimationFrame(){},gameControllerInputs:()=>[],
    gameElement:element,playGameTone(){}
  });
  vm.runInContext(readFileSync(resolve(__dirname,'../game.js'),'utf8'),context);
  const run=code=>vm.runInContext(code,context);
  run("roster=[{id:'pad:1000000',index:1000000,phone:true,number:1,side:0,ready:true,gadget:0},{id:'pad:1000001',index:1000001,phone:true,number:2,side:1,ready:true,gadget:1}];host=roster[0].id;startMatch();");
  return run;
}

test('crystals need a defeated guard, drop on death, return on touch and deny delivery while home crystal is stolen',()=>{
  const run=game();
  run(`
    const a=players[0], b=players[1];
    Object.assign(a,lift[1]);
    updateCrystals();
    assert.equal(carrying(a),undefined);
    units.filter(u=>u.side===1&&u.guard==='lift').forEach(u=>u.hp=0);
    updateCrystals();
    assert.equal(crystals[1].carrier,a.id);
    Object.assign(a,lift[0]);
    Object.assign(crystals[0],{state:'carried',carrier:b.id});
    updateCrystals();
    assert.equal(mode,'play');
    b.shield=0;
    hurt(b,1000,0);
    assert.equal(crystals[0].state,'dropped');
    Object.assign(a,{x:crystals[0].x,y:crystals[0].y});
    updateCrystals();
    assert.equal(crystals[0].state,'home');
    Object.assign(a,lift[0]);
    updateCrystals();
    assert.equal(result,0);
    assert.equal(mode,'result');
    assert.equal(wins[0],1);
  `);
});

test('dropped crystals return after twelve seconds and carriers cannot drill',()=>{
  const run=game();
  run(`
    const a=players[0];
    Object.assign(crystals[1],{carrier:a.id,state:'carried'});
    let before=terrain.slice();
    dig(a);
    assert.deepEqual(terrain,before);
    dropCrystal(a);
    assert.equal(crystals[1].returnAt,12);
    players.forEach(p=>p.hp=0);
    time=12.1;
    updateCrystals();
    assert.equal(crystals[1].state,'home');
  `);
});

test('shopping validates requests, charges only the buyer, deduplicates and enforces crew limits',()=>{
  const run=game();
  run(`
    const a=players[0], b=players[1], bank=b.ore;
    const data={kind:'upgrade',choice:0,buy:true,request:'one'};
    phoneCommand(a.index,data);
    assert.equal(a.level[0],1);
    assert.equal(a.ore,8);
    assert.equal(b.ore,bank);
    phoneCommand(a.index,data);
    assert.equal(a.level[0],1);
    phoneCommand(a.index,{...data,request:'two',choice:999});
    assert.equal(a.ore,8);
    a.ore=1000;
    a.minion=1;
    for(let i=0;i<8;i++) summon(a);
    assert.equal(ownedUnits(a),4);
    a.hp=0;
    const balance=a.ore;
    phoneCommand(a.index,{...data,request:'dead'});
    assert.equal(a.ore,balance);
    assert.equal(a.receipt.ok,false);
  `);
});

test('gadgets respect collision, damage and cooldown; a shield and respawn upgrades persist correctly',()=>{
  const run=game();
  run(`
    const a=players[0],b=players[1];
    a.gadget=2;
    assert.equal(useGadget(a),true);
    const hp=a.hp;
    hurt(a,80,1);
    assert.equal(a.hp,hp);
    assert.equal(useGadget(a),false);
    time=16;a.gadget=1;
    useGadget(a);
    assert.equal(bombs.length,1);
    assert.equal(useGadget(a),false);
    time=18;updateBombs(1/60);
    assert.equal(bombs.length,0);
    a.level=[2,1,1,2];a.hp=0;
    spawn(a);
    assert.equal(a.hp,125);
    assert.equal(a.level[0],2);
  `);
});

test('a disconnected phone clears controls, uses a CPU after three seconds and regains control on neutral reconnect',()=>{
  const run=game();
  run(`
    const a=players[0];
    let x=a.x;
    step(new Map(),1/60);
    assert.equal(a.missingSince,1/60);
    assert.ok(Math.abs(a.x-x)<1);
    time+=3.1;
    for(let i=0;i<45;i++) step(new Map(),1/60);
    assert.ok(a.x>x+10);
    step(new Map([[a.id,empty]]),1/60);
    assert.equal(a.missingSince,null);
  `);
});

test('short ledges stay traversable, ordinary terrain yields wider tunnels, map rotation and overtime terminate rounds',()=>{
  const run=game();
  run(`
    const a=players[0];
    terrain.fill(0);
    for(let ix=0;ix<NX;ix++) for(let iy=Math.floor((ix*STEP<156?260:248)/STEP);iy<NY;iy++) terrain[iy*NX+ix]=Infinity;
    Object.assign(a,{x:121,y:249,vx:0,vy:0});
    for(let i=0;i<30;i++) move(a,{x:1,y:0,b:[]},1/60);
    assert.ok(a.x>175);
    const first=mapIndex;
    startMatch();
    assert.equal(mapIndex,(first+1)%3);
    startMatch();
    assert.equal(mapIndex,(first+2)%3);
    time=180;
    step(new Map(players.map(p=>[p.id,empty])),1/60);
    assert.equal(overtime,true);
    time=210;
    step(new Map(players.map(p=>[p.id,empty])),1/60);
    assert.equal(mode,'result');
    assert.equal(result,null);
    scene(time);dashboard();
  `);
});
