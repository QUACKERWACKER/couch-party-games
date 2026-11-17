'use strict';

const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

const canvas = new Proxy({measureText:text=>({width:text.length*6})},{get:(object,key)=>object[key] || (()=>{})});

function element() {
  return {
    children:[], dataset:{}, style:{setProperty(){}}, classList:{add(){},remove(){},toggle(){}},
    addEventListener(){}, setAttribute(){}, focus(){}, scrollIntoView(){},
    append(...children){ this.children.push(...children); },
    replaceChildren(...children){ this.children = children; },
    getContext(){ return canvas; },
  };
}

const elements = new Map();
const getElement = id => {
  if (!elements.has(id)) elements.set(id,element());
  return elements.get(id);
};
let now=1000;
const sandbox = vm.createContext({
  assert, document:{getElementById:getElement,createElement:element,body:element(),cookie:''},
  window:{addEventListener(){},matchMedia:()=>({matches:false})},navigator:{getGamepads:()=>[]},
  performance:{now:()=>now}, setClock:value=>{now=value;}, requestAnimationFrame(){},
  Image:class { addEventListener(){} },
});
for (const file of ['../game-runtime.js','cards.js','cosmetics.js','maps.js','card-effects.js','build-mode.js','kinetic.js','game.js']) {
  vm.runInContext(readFileSync(join(__dirname,'..',file),'utf8'),sandbox,{filename:file});
}
vm.runInContext(readFileSync(join(__dirname,'scenarios.js'),'utf8'),sandbox,{filename:'scenarios.js'});
console.log('Ringout card scenarios passed.');
