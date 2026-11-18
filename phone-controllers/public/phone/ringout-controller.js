export function createRingoutController({send,neutral}) {
  const panel=document.createElement('section');
  panel.id='ringout-upgrades';
  panel.hidden=true;
  panel.setAttribute('aria-label','Choose your upgrade');
  document.getElementById('controls').after(panel);
  let token, selected=-1, latest, pending=false;
  function update(info) {
    latest=info;
    const draft=info?.draft;
    panel.hidden=!draft;
    document.body.classList.toggle('ringout-drafting',Boolean(draft));
    if(!draft) {token=undefined;pending=false;return;}
    if(token===draft.token && selected===draft.selected && panel.dataset.ready===String(draft.unlocked)) return;
    const changed=token!==draft.token;
    token=draft.token;selected=draft.selected;
    if(changed) {neutral();pending=false;}
    panel.dataset.ready=String(draft.unlocked);
    const title=document.createElement('strong');
    title.textContent=draft.unlocked?'Choose one upgrade':'Read your choices · get ready';
    const list=document.createElement('div');list.className='ringout-cards';
    draft.cards.forEach((card,index)=>{
      const button=document.createElement('button');
      button.type='button';button.disabled=!draft.unlocked || pending;
      button.setAttribute('aria-pressed',String(index===draft.selected));
      const name=document.createElement('strong'),text=document.createElement('span');
      name.textContent=card.name;text.textContent=card.text;
      button.append(name,text);
      button.addEventListener('click',()=>{
        if(pending || latest?.draft?.token!==draft.token || !latest.draft.unlocked)return;
        pending=true;title.textContent='Sending pick…';
        for(const choice of list.children) choice.disabled=true;
        send({ringoutChoice:{token:draft.token,pick:index}});
        // The shared host acknowledges by updating the phase or the waiting state.
        setTimeout(()=>{
          if(latest?.draft?.token!==draft.token)return;
          pending=false;selected=-1;update(latest);
        },1500);
      });
      list.append(button);
    });
    const owned=document.createElement('small');
    owned.textContent=draft.owned.length?'Your build · '+draft.owned.join(' · '):'Your first upgrade';
    panel.replaceChildren(title,list,owned);
  }
  return {update,reset(){neutral();panel.hidden=true;document.body.classList.remove('ringout-drafting');}};
}
