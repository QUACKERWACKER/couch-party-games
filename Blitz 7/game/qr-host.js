'use strict';

(() => {
  const display=document.getElementById('qr-controller');
  const link=document.getElementById('phone-link');
  const image=document.getElementById('phone-qr');
  const hint=document.getElementById('qr-hint');
  const phones=new Map();
  const bits={0:0,1:1,2:2,3:3,5:4,9:5};
  let describe=()=>({}), enabled=false;

  async function post(path,body) {
    const response=await fetch('/qr/host/'+path,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'
    });
    if(!response.ok) throw new Error('Phone bridge unavailable');
    return response.json();
  }

  async function poll() {
    if(document.hidden) {setTimeout(poll,250);return;}
    try {
      const snapshot=await post('pads',describe());
      const present=new Set(snapshot.map(p=>p.index));
      for(const index of phones.keys()) if(!present.has(index)) phones.delete(index);
      for(const pad of snapshot) {
        const state=phones.get(pad.index)||{events:[]};
        state.events.push(...pad.events);
        if(state.events.length>48) state.events.splice(0,state.events.length-48);
        state.axes=pad.axes;
        state.mask=pad.mask;
        phones.set(pad.index,state);
      }
    } catch {phones.clear();}
    if(enabled) setTimeout(poll,25);
  }

  window.blitzPhones={
    describe(callback){describe=callback;},
    sample(){
      const now=performance.now();
      return [...phones].map(([index,state])=>{
        const current=state.events.shift()||[...state.axes,state.mask];
        return {connected:true,index,timestamp:now,axes:current.slice(0,2),
          buttons:Array.from({length:16},(_,i)=>({pressed:i in bits && !!(current[2]&(1<<bits[i]))}))};
      });
    },
    kick(index){
      phones.delete(index);
      if(enabled) post('kick',{index}).catch(()=>{});
    }
  };

  fetch('/qr/host',{cache:'no-store'}).then(response=>response.json()).then(({url})=>{
    if(!url) return;
    enabled=true;
    link.href=url;
    link.textContent='Open phone link';
    link.hidden=false;
    hint.textContent='Scan with your phone’s camera. Keep the phone and Mac on the same Wi‑Fi.';
    const showImage=()=>{
      if(display.open && !image.hasAttribute('src')) image.src='/qr/host/image';
    };
    image.addEventListener('load',()=>{image.hidden=false;});
    image.addEventListener('error',()=>{
      hint.textContent='Open the phone link or copy the address to a phone on the same Wi‑Fi.';
      link.textContent=url;
    });
    display.addEventListener('toggle',showImage);
    showImage();
    poll();
  }).catch(()=>{});
})();
