export function installBedrockPhone({actions, sticks, send, neutral, installStick, setActionLabel, setStick, publish}) {
  const $=id=>document.getElementById(id);
  let state, panelKind, request=0, lastReceipt, signature='';
  document.body.classList.add('bedrock-v2');
  const style=document.createElement('style');
  style.textContent=`
    body.bedrock-v2 .controller-viewport {position:relative;left:0;top:0;width:100%;height:100dvh;transform:none;--pad-height:100dvh;overflow:auto}
    body.bedrock-v2 {overflow:auto}
    body.bedrock-v2 main {max-width:1000px;min-height:100dvh;grid-template-rows:44px auto minmax(150px,1fr) 44px;gap:6px;padding:max(8px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}
    body.bedrock-v2 header{display:flex;align-items:center} body.bedrock-v2 #controls {grid-area:3/1;grid-template-columns:1fr .65fr 1fr;position:relative;gap:10px}
    body.bedrock-v2 #movement{grid-area:1/1}body.bedrock-v2 #aim{grid-area:1/3}
    body.bedrock-v2 #actions{grid-area:1/2;width:100%}
    body.bedrock-v2 #face-buttons {display:flex;flex-direction:column;gap:12px}
    body.bedrock-v2 #face-buttons::before{display:none}
    body.bedrock-v2 #face-buttons .action{width:100%;height:auto;min-height:62px;border-radius:16px;font-size:1rem}
    body.bedrock-v2 .face-letter{display:none}
    body.bedrock-v2 .stick{width:min(100%,190px,43dvh);min-width:90px}
    body.bedrock-v2 #utility-buttons{width:auto;max-width:none;display:flex;gap:8px}
    body.bedrock-v2 #utility-buttons .action{min-width:76px}
    body.bedrock-v2 .controller-footer{grid-area:4/1;min-height:44px}
    .br-status{grid-area:2/1;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:.8rem;color:#f2e4d4}
    .br-objective{font-weight:900;color:var(--accent)}
    .br-panel{grid-area:3/1;z-index:4;align-self:stretch;background:var(--base);border:1px solid var(--edge);border-radius:14px;padding:10px;overflow:auto;display:grid;align-content:start;gap:8px}
    .br-panel header{min-height:44px}.br-panel button{min-height:44px;min-width:44px}.br-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .br-choices button{min-height:70px;text-align:left;display:flex;flex-direction:column;justify-content:center;gap:5px}
    .br-choices small{display:block;color:var(--muted);font-size:.75rem;font-weight:500}
    .br-choices button[aria-pressed=true]{border:2px solid var(--accent)}
    .br-choices button:disabled{opacity:.5}
    .br-notice{color:#ffd494;font-size:.8rem;min-height:20px}
    body.bedrock-v2[data-br-active=false] #controls{grid-template-columns:1fr}
    body.bedrock-v2[data-br-active=false] #actions{grid-area:1/1;width:min(100%,380px)}
    body.bedrock-v2[data-br-active=false] #face-buttons{flex-direction:row;flex-wrap:wrap}
    body.bedrock-v2[data-br-active=false] #face-buttons .action{flex:1;min-width:120px}
    body.bedrock-v2 .action[aria-disabled=true]{opacity:.5}
    @media(orientation:portrait){
      body.bedrock-v2 main{height:100dvh;grid-template-rows:minmax(64px,auto) auto minmax(200px,1fr) minmax(76px,auto)}
      body.bedrock-v2 #controls{grid-template-columns:1fr 1fr;grid-template-rows:1fr 66px}
      body.bedrock-v2 #movement{grid-area:1/1}body.bedrock-v2 #aim{grid-area:1/2}
      body.bedrock-v2 #actions{grid-area:2/1/span 1/span 2}
      body.bedrock-v2 #face-buttons{flex-direction:row}
      body.bedrock-v2 #face-buttons .action{flex:1}
      body.bedrock-v2 .stick{width:min(40vw,190px)}
      .br-choices{grid-template-columns:repeat(2,minmax(0,1fr))}
      .br-panel{max-height:65dvh}
      body.bedrock-v2 .controller-footer{flex-wrap:wrap;height:auto;align-content:center}body.bedrock-v2 h1{font-size:1.1rem}body.bedrock-v2 header{align-items:start}body.bedrock-v2 .identity{max-width:45%}
      body.bedrock-v2 #utility-buttons{margin-left:0}body.bedrock-v2 .utilities{gap:6px}body.bedrock-v2 .utilities button{font-size:.8rem;padding:6px 9px}
    }
    @media(max-height:390px) and (orientation:landscape){
      body.bedrock-v2 main{grid-template-rows:34px 22px minmax(120px,1fr) 36px}
      body.bedrock-v2 .stick{width:min(100%,140px)}
      body.bedrock-v2 #face-buttons .action{min-height:46px}
      body.bedrock-v2 #hint{font-size:.72rem}
    }
  `;
  document.head.append(style);
  const meters=document.createElement('div');meters.className='br-status';meters.setAttribute('aria-label','Player status');
  const objective=document.createElement('span');objective.className='br-objective';
  const resources=document.createElement('span');
  meters.append(objective,resources);$('controls').before(meters);
  const panel=document.createElement('section');panel.className='br-panel';panel.hidden=true;panel.setAttribute('aria-label','Equipment and match choices');
  const header=document.createElement('header'), title=document.createElement('strong'), back=document.createElement('button');
  back.textContent='Back';back.type='button';header.append(title,back);
  const choices=document.createElement('div');choices.className='br-choices';
  const notice=document.createElement('p');notice.className='br-notice';notice.setAttribute('role','status');
  panel.append(header,choices,notice);$('controls').after(panel);
  const aim=document.querySelector('[data-stick=aim]');
  if(!sticks.aim) installStick(aim);
  $('aim-label').textContent='Aim & fire';
  $('leave').textContent='Leave';
  const dig=actions.get(0).element;
  let digPointer=null,origin;
  dig.addEventListener('pointerdown',event=>{
    if(actions.get(0).local || !state || state.hp<=0 || state.carrying || event.button!==0) return;
    digPointer=event.pointerId;origin={x:event.clientX,y:event.clientY};
  });
  dig.addEventListener('pointermove',event=>{
    if(event.pointerId!==digPointer || sticks.aim.pointer!==null) return;
    const dx=event.clientX-origin.x,dy=event.clientY-origin.y;
    if(Math.hypot(dx,dy)<12) return;
    setStick(sticks.aim,dx/38,dy/38);
    publish();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']) dig.addEventListener(type,event=>{
    if(event.pointerId!==digPointer) return;
    digPointer=null;
    if(sticks.aim.pointer===null){setStick(sticks.aim,0,0);publish();}
  });
  $('move-label').textContent='Move · up jets';
  const command=(command,extra={})=>send({bedrock:{command,...extra}});
  function close() {
    neutral();panel.hidden=true;panelKind=null;
    $('controls').inert=false;
  }
  back.onclick=close;
  function option(label,detail,onClick,{disabled=false,selected=false}={}) {
    const button=document.createElement('button');button.type='button';button.disabled=disabled;
    const strong=document.createElement('strong');strong.textContent=label;
    const small=document.createElement('small');small.textContent=detail;
    button.append(strong,small);button.setAttribute('aria-pressed',String(selected));button.onclick=onClick;
    choices.append(button);
  }
  function renderPanel() {
    if(!panelKind || !state) return;
    choices.replaceChildren();
    const kind=panelKind;
    if(kind==='gadget') {
      title.textContent='Pick a gadget · '+state.remaining+'s';
      state.gadgets.forEach((g,i)=>option(g.name,g.detail,()=>command('gadgetChoice',{choice:i}),{selected:state.gadget===i}));
      back.hidden=true;
    } else if(kind==='settings') {
      title.textContent='Match options';back.hidden=false;
      option(state.muted ? 'Sound off' : 'Sound on','Toggle game sound',()=>command('settings',{muted:!state.muted}));
      option(state.reducedMotion ? 'Motion reduced' : 'Full effects','Toggle particle effects',()=>command('settings',{reducedMotion:!state.reducedMotion}));
      option('Practice','20 seconds to learn movement and tools',()=>{close();command('practice');});
    } else {
      title.textContent=(kind==='minion' ? 'Crew' : 'Upgrades')+' · '+state.ore+' ore';
      back.hidden=false;
      option(kind==='minion' ? 'See upgrades →' : 'See crew →','Switch shop',()=>open(kind==='minion'?'upgrade':'minion'));
      const options=kind==='minion' ? state.minions : state.upgrades;
      options.forEach((item,i)=>{
        const max=typeof item.cost!=='number';
        const unavailable=max || state.ore<item.cost || (kind==='minion' && state.crew>=4) || state.hp<=0;
        option(item.name+' · '+(max?'MAX':item.cost+' ore'),item.detail+(kind==='upgrade' ? ' · Level '+item.level+'/2' : ''),()=>{
          request++;
          send({bedrock:{kind,choice:i,buy:true,request:session+':'+request}});
          notice.textContent='Buying…';
        },{disabled:unavailable});
      });
    }
  }
  const session=crypto.randomUUID();
  function open(kind) {
    neutral();panelKind=kind;panel.hidden=false;$('controls').inert=true;
    notice.textContent='';renderPanel();
  }
  for(const action of actions.values()) action.local=()=>{};
  actions.get(0).local=null;
  actions.get(2).local=()=>command('gadget');
  actions.get(3).local=()=>open('minion');
  actions.get(5).local=()=>state?.phase==='lobby' || state?.phase==='result' ? command('team') : command('crew');
  actions.get(7).local=()=>command('ready');
  const settings=document.createElement('button');settings.type='button';settings.textContent='Options';
  settings.onclick=()=>open('settings');$('system-buttons').append(settings);
  function update(info) {
    if(!info || info.version!==2) return;
    const before=state;state=info;
    if(before?.phase!==info.phase || before?.player!==info.player || before?.carrying!==info.carrying || (before?.hp>0)!==(info.hp>0)) close();
    const active=Boolean(info.player) && (info.phase==='play' || info.phase==='practice');
    document.body.dataset.brActive=String(active);
    $('movement').hidden=$('aim').hidden=!active || info.hp<=0;
    $('controls').dataset.phase=info.phase;
    settings.hidden=!info.host || active || info.phase==='loadout';
    let labels;
    if(active) {
      labels={0:info.hp>0 && !info.carrying ? 'Dig' : null,
        2:info.hp>0 ? info.gadgets[info.gadget].name+(info.cooldown?' · '+info.cooldown+'s':'') : null,
        3:'Shop',5:info.holdCrew?'Hunters: HOLD':'Hunters: FOLLOW',7:info.host&&info.phase==='practice'?'Skip practice':null};
      actions.get(7).local=()=>command('skip');
      actions.get(0).local=null;
      objective.textContent=info.hp<=0 ? 'Respawn in '+info.respawn+'s' : info.objective;
      resources.textContent=info.hp+'/'+info.maxHp+' HP · Jet '+info.fuel*10+'% · '+info.ore+' ore · '+info.crew+'/4 crew';
      $('hint').textContent=info.carrying ? 'Carry it to your home lift. You can shoot and use your gadget.'
        : info.phase==='practice' ? 'Learn: '+['Move','Dig','Fire','Crystal'].map((name,i)=>(info.practice?.[i]?'✓ ':'')+name).join(' · ') : 'Right pad aims & fires. Drag Dig to steer your drill.';
      actions.get(2).element.setAttribute('aria-disabled',String(info.cooldown>0));
    } else {
      const lobby=info.phase==='lobby' || info.phase==='result';
      labels={0:!info.player && lobby ? 'Join' : info.host && lobby ? (info.phase==='result'?'Next mine':'Start') : null,
        5:info.player && lobby ? 'Switch team' : null,
        7:info.player && !info.host && lobby ? (info.ready?'Unready':'Ready') : null};
      actions.get(0).local=null;
      actions.get(7).local=()=>command('ready');
      objective.textContent=info.phase==='loadout' ? info.map : !info.player ? 'STEAL THEIR CRYSTAL · BRING IT HOME' : info.ready ? 'READY' : 'PICK YOUR TEAM';
      resources.textContent=info.player ? info.size+'v'+info.size : '';
      $('hint').textContent=info.phase==='loadout' ? 'Pick a gadget. Watch the shared screen when the round starts.'
        : info.player ? info.host && !info.allReady ? 'Waiting for everyone to tap Ready.' : 'Mine a route. Steal their crystal. Carry it home.'
        : info.phase==='play' ? 'Join the next round from here.' : 'Tap Join. Your phone becomes your controller.';
    }
    for(const [number,action] of actions) {
      if(number===1) {setActionLabel(action,null);continue;}
      setActionLabel(action,labels[number]);
      const group=number===5 || number===7 ? $('utility-buttons') : $('face-buttons');
      if(action.element.parentElement!==group) group.append(action.element);
    }
    $('player').textContent=info.player || 'Paired';
    $('status').textContent=info.team || 'Bedrock Rivals';
    if(info.phase==='loadout') {if(panelKind!=='gadget')open('gadget');else renderPanel();}
    if(info.receipt && info.receipt.id!==lastReceipt) {
      lastReceipt=info.receipt.id;
      notice.textContent=info.receipt.text;
      if(info.receipt.ok) {
        navigator.vibrate?.(25);
        close();
      }
    }
    const next=JSON.stringify([info.ore,info.crew,info.hp>0,info.upgrades,info.gadget,info.muted,info.reducedMotion]);
    if(panelKind && signature!==next) renderPanel();
    signature=next;
  }
  function reset() {if(!panel.hidden)close();}
  return {update,reset};
}
