'use strict';

const mapSpecs = [
  {name:'Foundry', weight:10, platforms:[[151,72,698,325]]},
  {name:'Pocket', size:'small', weight:4, platforms:[[270,100,460,280]]},
  {name:'Crossroads', weight:7, platforms:[[130,150,740,180],[350,50,300,380]]},
  {name:'The Ring', weight:6, platforms:[[135,66,730,348]], holes:[[410,175,180,130]]},
  {name:'Twin Docks', weight:5, platforms:[[105,85,305,310],[590,85,305,310],[410,193,180,94]]},
  {name:'Switchback', weight:7, platforms:[[145,65,530,170],[325,195,530,220]]},
  {name:'Fault Line', weight:4, platforms:[[120,65,760,350]], holes:[[335,172,100,136],[565,172,100,136]],
    hazards:[[458,170,84,140]]},
  {name:'Reactor', weight:5, platforms:[[175,65,650,350]], hazards:[[403,159,194,162]]},
  {name:'Hourglass', weight:4, platforms:[[115,70,285,340],[600,70,285,340],[400,170,200,140]],
    hazards:[[455,190,90,100]]},
  {name:'Matchbox', size:'small', weight:3, platforms:[[395,168,210,144]]},
  {name:'Grand Circuit', size:'large', weight:4, platforms:[[-270,-145,1540,770]],
    holes:[[-130,-5,1260,490]], winds:[[-200,-145,460,140,0,-1],[770,485,460,140,0,1]]},
  {name:'Megadock', size:'large', weight:3, platforms:[[-850,160,2700,150],[-770,-410,150,1300],[1620,-410,150,1300]],
    winds:[[160,160,680,150,0,1],[-770,-270,150,340,-1,0],[1620,390,150,340,1,0]]},
  {name:'Skywalk', size:'large', weight:4, platforms:[[-570,-250,840,145],[125,-250,145,560],
    [125,165,905,145],[885,165,145,560],[885,580,685,145]],
    winds:[[310,165,450,145,0,-1],[885,370,145,190,1,0]]},
  {name:'Kite Frame', size:'large', weight:3, platforms:[[-440,-310,1880,140],[-440,650,1880,140],
    [-440,-310,140,1100],[1300,-310,140,1100],[430,-170,140,820]],
    winds:[[430,20,140,440,1,0],[760,-310,420,140,0,-1]]},
  {name:'Pinwheel', size:'small', weight:4, platforms:[[355,192,290,96],[452,109,96,262]],
    winds:[[355,192,66,96,0,1],[579,192,66,96,0,-1]]},
  {name:'Keyhole', size:'small', weight:3, platforms:[[355,130,290,214],[429,344,142,70]],
    holes:[[459,200,82,74]]},
  {name:'Wind Tunnel', weight:5, platforms:[[190,150,620,180],[330,76,340,328]],
    winds:[[190,150,140,180,0,-1],[670,150,140,180,0,1]]},

  {name:'Ferry Crossing', weight:6, platforms:[[120,100,275,280],[605,100,275,280]],
    ferries:[[315,185,160,110,210,0,4.5]],
    zones:[[160,125,106,82,'spring'],[744,270,94,84,'tar']]},
  {name:'Sky Elevator', weight:5, platforms:[[305,45,390,128],[305,307,390,128]],
    ferries:[[432,103,136,110,0,184,4.2]],
    zones:[[322,320,85,100,'shock'],[586,58,86,85,'spring']]},
  {name:'Switchyard', size:'large', weight:3,
    platforms:[[-380,165,490,150],[310,-85,150,650],[660,165,720,150]],
    ferries:[[35,179,145,122,225,0,5],[395,179,145,122,220,0,6]],
    zones:[[-300,166,155,148,'tar'],[1070,166,142,148,'shock']]},

  {name:'Archive Intake',weight:3,platforms:[[145,87,710,306]],
    holes:[[410,164,180,152]],zones:[[175,122,103,225,'tar'],[723,122,103,225,'tar']]},
  {name:'Archive Locks',weight:3,platforms:[[135,87,730,306]],
    holes:[[305,154,120,172],[576,154,120,172]],zones:[[449,150,102,190,'tar']]},

];

function buildMap(spec) {
  const contains = ([x,y,w,h], px, py) => px >= x && px <= x+w && py >= y && py <= y+h;
  const floor = (x,y) => spec.platforms.some(rect => contains(rect,x,y)) &&
    !(spec.holes || []).some(rect => contains(rect,x,y));
  const axes = axis => [...new Set([...spec.platforms,...(spec.holes || [])]
    .flatMap(rect => [rect[axis], rect[axis]+rect[axis+2]]))].sort((a,b)=>a-b);
  const xs = axes(0), ys = axes(1);
  const cells = [], edges = [];
  for (let j=0;j<ys.length-1;j++) {
    for (let i=0;i<xs.length-1;i++) {
      const x=xs[i], y=ys[j], w=xs[i+1]-x, h=ys[j+1]-y;
      const cx=x+w/2, cy=y+h/2;
      if (!floor(cx,cy)) continue;
      cells.push([x,y,w,h]);
      if (!floor(cx,y-1)) edges.push({x,y,length:w,across:true});
      if (!floor(cx,y+h+1)) edges.push({x,y:y+h,length:w,across:true});
      if (!floor(x-1,cy)) edges.push({x,y,length:h,across:false});
      if (!floor(x+w+1,cy)) edges.push({x:x+w,y,length:h,across:false});
    }
  }
  const zoneAt = (x,y) => (spec.zones || []).find(rect => contains(rect,x,y));
  const hazardous = (x,y) => (spec.hazards || []).some(rect => contains(rect,x,y));
  const windAt = (x,y) => (spec.winds || []).find(rect => contains(rect,x,y));
  const spawnHazards = [...(spec.hazards || []), ...(spec.zones || []), ...(spec.winds || [])];
  const safeFootprint = (x,y,r) => [-r,0,r].every(dx => [-r,0,r].every(dy=>floor(x+dx,y+dy))) &&
    !spawnHazards.some(([hx,hy,w,h]) => x+r>=hx && x-r<=hx+w && y+r>=hy && y-r<=hy+h);
  const ferryAt = (x,y,time) => ferryRects(time).find(rect => contains(rect,x,y));
  function ferryRects(time) {
    return (spec.ferries || []).map(([x,y,w,h,dx,dy,period]) => {
      const t=(1-Math.cos(2*Math.PI*time/period))/2;
      return [x+dx*t,y+dy*t,w,h];
    });
  }
  const bounds = {left:xs[0], right:xs.at(-1), top:ys[0], bottom:ys.at(-1)};
  const width = bounds.right-bounds.left, height = bounds.bottom-bounds.top;
  const center = {x:bounds.left+width/2,y:bounds.top+height/2};
  const zoom = Math.min(1.38, 880/width, 400/height);
  const spawns = [];
  for (let y=bounds.top+30;y<=bounds.bottom-30;y+=28) {
    for (let x=bounds.left+30;x<=bounds.right-30;x+=28) {
      if (safeFootprint(x,y,28)) {
        spawns.push({x,y});
      }
    }
  }
  const detachableRims = edges.filter(edge => edge.length >= 72 &&
    ((edge.across && [bounds.top,bounds.bottom].includes(edge.y)) ||
     (!edge.across && [bounds.left,bounds.right].includes(edge.x))));
  return {...spec, detachableRims, floor, hazardous, windAt, zoneAt, ferryAt, ferryRects, safeFootprint, cells, edges, spawns, bounds, center, width, height, zoom};
}

const maps = mapSpecs.map(buildMap);

function chooseMap(previous, count, random = Math.random) {
  const eligible = maps.filter(map => map !== previous &&
    (!['Matchbox','Pinwheel','Keyhole'].includes(map.name) || count <= 4) && (map.name !== 'Pocket' || count <= 10));
  if (count >= 9) {
    const roomy = eligible.filter(map => map.size === 'large');
    if (roomy.length) return roomy[Math.floor(random() * roomy.length)];
  }
  const extreme = random() < 1 / 3;
  const group = eligible.filter(map => Boolean(map.size) === extreme);
  const pool = group.length ? group : eligible;
  let roll = random() * pool.reduce((sum,map)=>sum+map.weight,0);
  return pool.find(map => (roll -= map.weight) < 0);
}

function safeSpawn(map, others = [], preferred = {x:500,y:240}, obstacles = [], radius = 18) {
  const spacing = point => others.reduce((distance,p) =>
    Math.min(distance, Math.max(Math.abs(point.x-p.x),Math.abs(point.y-p.y)) - radius - (p.radius || 18)), 110);
  const rating = point => spacing(point) - .045 * Math.hypot(point.x-preferred.x,point.y-preferred.y);
  const clear = map.spawns.filter(({x,y}) => !obstacles.some(wall =>
    x+radius>wall.x && x-radius<wall.x+wall.w && y+radius>wall.y && y-radius<wall.y+wall.h));
  const separated = clear.filter(point => spacing(point) >= 2);
  return (separated.length ? separated : clear).reduce((best, point) =>
    !best || rating(point)>rating(best) ? point : best, null);
}

function randomRoundSpawn(map, occupied, previous, walls, random = Math.random) {
  const candidates = map.spawns.filter(({x,y}) => !walls.some(wall =>
    x+18>wall.x && x-18<wall.x+wall.w && y+18>wall.y && y-18<wall.y+wall.h));
  const options = candidates.map(point => ({
    point,
    clearance: occupied.reduce((distance, other) => Math.min(distance,
      Math.max(Math.abs(point.x-other.x),Math.abs(point.y-other.y))), Infinity),
    change: previous ? Math.hypot(point.x-previous.x,point.y-previous.y) : Infinity,
  }));
  for (const [spacing,displacement] of [[94,88],[66,60],[38,52],[38,1],[38,0],[0,0]]) {
    const pool = options.filter(option => option.clearance >= spacing && option.change >= displacement);
    if (pool.length) return pool[Math.floor(random()*pool.length)].point;
  }
  return null;
}

const buildArenas = [
  buildMap({name:'Bank Hall',platforms:[[103,72,794,336]]}),
  buildMap({name:'Switchyard Routes',buildCenter:{x:564,y:240},platforms:[[121,63,758,354]],holes:[[470,202,60,76]]}),
];
function buildArenaWalls(map,count) {
  const interior=map===buildArenas[0]
    ? [[245,144,53,18],[307,162,42,18],[646,305,53,18],[698,287,42,18]]
    : [[367,120,22,68],[610,291,22,68],[249,262,85,19],[672,196,78,19]];
  const walls=interior.map(([x,y,w,h],i)=>({x,y,w,h,integrity:Infinity,
    bankNormal:map===buildArenas[0] ? {x:(i%2 ? 1 : -1)*.38,y:Math.sqrt(1-.38**2)} : null}));
  if(count>6) return walls.filter((_,i)=>i%2===0);
  return walls;
}
