// Ephemeral messages stay in memory only; never enter answer history or local drafts.
export function mountWhispers({getSession,request,seal,unseal,esc,names,chooseRole}) {
 const root=document.querySelector('#mailbox'),title='留言箱';
 const tones={joy:'小确幸',warmth:'超开心',grumble:'小在意',serious:'认真说说'};
 const tone=()=>root.querySelector('input[name=message-tone]:checked')?.value;
 const radios=[...root.querySelectorAll('input[name=message-tone]')];
 const input=root.querySelector('textarea'),form=root.querySelector('form');
 const list=root.querySelector('[data-whisper-list]'),status=root.querySelector('[data-whisper-status]');
 const send=root.querySelector('[data-whisper-send]'),count=root.querySelector('[data-whisper-count]');
 const compose=root.querySelector('details'),label=root.querySelector('[data-whisper-label]');
 let generation=0,notes=[],clockOffset=0,busy=false,loading=false,pending=null,signature='';
 const path=s=>`/api/rooms/${s.id}/notes`,time=()=>Date.now()+clockOffset;
 function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);status.hidden=!text;}
 function controls(){const s=getSession();input.disabled=!s||busy;for(const radio of radios)radio.disabled=!s||busy;send.disabled=busy||!!s&&(!input.value.trim()||!tone());send.textContent=busy?'发送中…':s?'发送给 '+names[s.slot==='a'?'b':'a']:'选择身份';count.textContent=input.value.length+' / 600';label.textContent=s?'给 '+names[s.slot==='a'?'b':'a']+' 的一句话':'给对方的一句话';}
 function remaining(expiry){const minutes=Math.max(1,Math.ceil((expiry-time())/60000));return minutes>=60?`${Math.floor(minutes/60)} 小时${minutes%60?' '+minutes%60+' 分钟':''}后消失`:`${minutes} 分钟后消失`;}
 function render(){
  const s=getSession();notes=notes.filter(n=>n.expiresAt>time());
  const key=JSON.stringify([s?.slot,notes]);
  if(key!==signature){signature=key;
   list.innerHTML=!s?'<p class="whisper-empty">选择身份后，看看对方留了什么话。</p>':!notes.length?'<p class="whisper-empty">这里暂时没有留言，想说的时候就写一句。</p>':notes.map(n=>`<article class="whisper-note ${n.slot===s.slot?'outgoing':'incoming'}"><div class="whisper-note-head"><strong>${n.slot===s.slot?'我 → '+names[s.slot==='a'?'b':'a']:names[n.slot]+' → 我'}</strong><span data-expiry="${n.expiresAt}">${remaining(n.expiresAt)}</span></div><span class="message-tone tone-${esc(n.kind)}">${esc(tones[n.kind]||'留言')}</span><p class="whisper-text">${esc(n.text)}</p>${n.slot===s.slot?`<button type="button" class="text-btn" data-withdraw="${esc(n.id)}">撤回</button>`:''}</article>`).join('');
  }
  for(const el of list.querySelectorAll('[data-expiry]'))el.textContent=remaining(Number(el.dataset.expiry));
 }
 async function refresh({quiet=false}={}){
  const s=getSession();if(!s||loading)return;const g=generation;loading=true;
  try{
   const started=Date.now(),data=await request(path(s),{token:s.token});
   const offset=data.serverNow-(started+Date.now())/2;
   const decoded=await Promise.all(data.notes.map(async n=>({...n,text:await unseal(n.payload,'whisper:'+n.id,'v1',n.slot,s)})));
   if(g!==generation||getSession()!==s)return;
   clockOffset=offset;notes=decoded;render();if(!busy)message('');
  }catch(e){if(g===generation&&getSession()===s&&!busy)message(title+'暂未同步，请点刷新重试。',true);}
  finally{if(g===generation)loading=false;}
 }
 function reset(){generation++;notes=[];clockOffset=0;busy=false;loading=false;pending=null;input.value='';for(const r of radios)r.checked=false;compose.open=false;message('');controls();render();refresh();}
 input.addEventListener('input',()=>{controls();if(pending?.text!==input.value.trim())pending=null;});
 radios.forEach(r=>r.addEventListener('change',()=>{pending=null;controls();}));
 form.addEventListener('submit',async event=>{
  event.preventDefault();const s=getSession();if(!s){chooseRole();return;}
  const text=input.value.trim(),kind=tone();if(!text||!kind||busy)return;const g=generation;busy=true;controls();message('');
  try{
   if(!pending||pending.text!==text){const id=Array.from(crypto.getRandomValues(new Uint8Array(16)));const key=btoa(String.fromCharCode(...id)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');pending={id:key,text,payload:await seal(text,'whisper:'+key,'v1',s)};}
   if(g!==generation||getSession()!==s)return;
   const result=await request(path(s),{method:'POST',token:s.token,body:{id:pending.id,kind,role:s.slot,payload:pending.payload}});
   if(g!==generation||getSession()!==s)return;
   // Invalidate any earlier poll before displaying the confirmed send.
   generation++;loading=false;notes=[{...result,text},...notes.filter(n=>n.id!==result.id)];
   clockOffset=result.createdAt>Date.now()?result.createdAt-Date.now():clockOffset;
   pending=null;input.value='';for(const r of radios)r.checked=false;compose.open=false;render();message('已送达云端，对方打开页面就能看到。');
  }catch(e){if(g===generation&&getSession()===s){message(e.status===429?e.message:'未确认发送成功，内容还在输入框里，请重试。',true);if(e.status===410||e.status===409)pending=null;}}
  finally{if(getSession()===s){busy=false;controls();}}
 });
 list.addEventListener('click',async event=>{
  const button=event.target.closest('[data-withdraw]');if(!button)return;
  const s=getSession(),g=generation;button.disabled=true;
  try{await request(path(s)+'/'+button.dataset.withdraw+'?role='+s.slot,{method:'DELETE',token:s.token});if(g!==generation||getSession()!==s)return;generation++;loading=false;notes=notes.filter(n=>n.id!==button.dataset.withdraw);render();message('已撤回。');}
  catch{if(g===generation)message('撤回未确认，请刷新后重试。',true);}
  finally{button.disabled=false;}
 });
 root.querySelector('[data-whisper-refresh]').onclick=()=>refresh();
 setInterval(()=>{render();},1000);
 setInterval(()=>{if(!document.hidden)refresh({quiet:true});},20000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh({quiet:true});}});
 window.addEventListener('online',()=>refresh({quiet:true}));
 controls();render();return {reset};
}
