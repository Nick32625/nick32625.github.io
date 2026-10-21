// Questions and replies use separate authenticated encryption contexts.
export function mountPersonalQuestions({getSession,request,seal,unseal,esc,names,chooseRole}){
 const root=document.querySelector('#personal-questions'),list=root.querySelector('[data-personal-list]'),input=root.querySelector('#personal-input'),send=root.querySelector('[data-personal-send]'),status=root.querySelector('[data-personal-status]'),more=root.querySelector('[data-personal-more]');
 let generation=0,items=[],loading=false,sending=false,pending=null,filter='all',visible=10;
 const drafts=new Map(),saving=new Set(),versions=new Map();
 const path=s=>`/api/rooms/${s.id}/questions`,peer=s=>s.slot==='a'?'b':'a';
 const date=value=>new Date(value).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'});
 function message(text,error=false){status.textContent=text;status.hidden=!text;status.classList.toggle('error',error);}
 function controls(){const s=getSession();for(const form of list.querySelectorAll('[data-personal-answer]'))form.querySelector('button').disabled=sending||saving.size>0||!form.querySelector('textarea').value.trim();input.disabled=!s||sending;send.disabled=sending||saving.size>0||!!s&&!input.value.trim();send.textContent=sending?'发送中…':s?'发送给 '+names[peer(s)]:'选择身份';root.querySelector('[data-personal-label]').textContent=s?'想问 '+names[peer(s)]+' 什么？':'想问对方什么？';root.querySelector('[data-personal-count]').textContent=input.value.length+' / 600';}
 function render(){
  const s=getSession();root.querySelector('[data-personal-pending]').textContent=items.filter(q=>q.to===s?.slot&&!q.answer).length;
  // Never replace a live editor during polling or an in-flight submission.
  if(saving.size||list.contains(document.activeElement)&&document.activeElement.tagName==='TEXTAREA')return;
  const open=new Set([...list.querySelectorAll('details[open]')].map(d=>d.dataset.reply));
  const selected=items.filter(q=>filter==='all'||filter==='mine'&&q.from===s?.slot||filter==='pending'&&q.to===s?.slot&&!q.answer);
  more.hidden=!s||selected.length<=visible;
  list.innerHTML=!s?'<p class="whisper-empty">选择身份后，可以向对方提问或回答。</p>':!selected.length?`<p class="whisper-empty">${filter==='pending'?'暂时没有等你回答的问题。':'这里还没有问答，有想了解的就问一句。'}</p>`:selected.slice(0,visible).map(q=>{
   const canReply=q.to===s.slot,dirty=drafts.has(q.id),text=dirty?drafts.get(q.id):q.answerText||'';
   if(!dirty)versions.set(q.id,q.version);
   return `<article class="personal-card" data-personal-id="${q.id}"><div class="whisper-note-head"><strong>${q.from===s.slot?'我 → '+names[q.to]:names[q.from]+' → 我'}</strong><span>${date(q.createdAt)} · ${q.answer?'已回答':'待回答'}</span></div><h3>${esc(q.text)}</h3>${q.answer?`<div class="personal-answer"><strong>${esc(names[q.to])}的回答</strong><p>${esc(q.answerText)}</p><span class="draft-note saved">云端已保存 · ${date(q.answer.updatedAt)}</span></div>`:`<p class="whisper-empty">${canReply?'对方想听听你的想法。':'等 '+names[q.to]+' 写下回答。'}</p>`}${canReply?`<details class="whisper-compose personal-reply" data-reply="${q.id}" ${!q.answer||dirty||open.has(q.id)?'open':''}><summary>${q.answer?'修改回答':'回答这个问题'}</summary><form data-personal-answer="${q.id}"><label for="reply-${q.id}">你的回答</label><textarea id="reply-${q.id}" data-reply-input="${q.id}" maxlength="1200" rows="3" placeholder="慢慢说，我在听……">${esc(text)}</textarea><div class="whisper-compose-foot"><span data-reply-count>${text.length} / 1200</span><button type="submit" class="btn primary" ${!text.trim()?'disabled':''}>${q.answer?'更新回答':'提交回答'}</button></div></form></details>`:''}</article>`;
  }).join('');
 }
 async function decode(q,s){return {...q,text:await unseal(q.question,'personal:'+q.id,'question-v1',q.from,s),answerText:q.answer?await unseal(q.answer.payload,'personal:'+q.id,'answer-v1',q.to,s):null};}
 async function refresh({quiet=false}={}){
  const s=getSession();if(!s||loading)return;const g=generation;loading=true;
  try{const data=await request(path(s),{token:s.token}),decoded=await Promise.all(data.questions.map(q=>decode(q,s)));if(g!==generation||getSession()!==s)return;items=decoded;render();if(!quiet)message('');}
  catch{if(g===generation&&getSession()===s)message('专属问答暂未同步，请点刷新重试。输入的内容仍在。',true);}
  finally{if(g===generation)loading=false;}
 }
 function reset(){generation++;items=[];loading=false;sending=false;pending=null;drafts.clear();versions.clear();saving.clear();input.value='';filter='all';visible=10;root.querySelector('.personal-compose').open=false;list.innerHTML='';root.querySelectorAll('[data-personal-filter]').forEach(b=>{b.classList.toggle('selected',b.dataset.personalFilter===filter);b.setAttribute('aria-pressed',String(b.dataset.personalFilter===filter));});message('');controls();render();refresh();}
 input.addEventListener('input',()=>{if(pending?.text!==input.value.trim())pending=null;controls();});
 root.querySelector('[data-personal-compose]').addEventListener('submit',async event=>{
  event.preventDefault();const s=getSession();if(!s){chooseRole();return;}const text=input.value.trim();if(!text||sending||saving.size)return;const g=generation;sending=true;controls();message('');
  try{
   if(!pending||pending.text!==text){const id=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');pending={id,text,payload:await seal(text,'personal:'+id,'question-v1',s)};}
   if(g!==generation||getSession()!==s)return;
   const record=await request(path(s),{method:'POST',token:s.token,body:{id:pending.id,role:s.slot,payload:pending.payload}});
   if(g!==generation||getSession()!==s)return;
   const decoded=await decode(record,s);if(g!==generation||getSession()!==s)return;generation++;loading=false;items=[decoded,...items.filter(q=>q.id!==record.id)];pending=null;input.value='';root.querySelector('.personal-compose').open=false;render();message('问题已保存，对方打开页面就能看到。');
  }catch(e){if(g===generation&&getSession()===s)message('未确认发送成功，问题仍在输入框里，请重试。',true);}
  finally{if(getSession()===s){sending=false;controls();}}
 });
 list.addEventListener('input',event=>{const el=event.target,id=el.dataset.replyInput;if(!id)return;drafts.set(id,el.value);const form=el.closest('form');form.querySelector('[data-reply-count]').textContent=el.value.length+' / 1200';form.querySelector('button').disabled=!el.value.trim();});
 list.addEventListener('submit',async event=>{
  const form=event.target,id=form.dataset.personalAnswer;if(!id)return;event.preventDefault();const s=getSession(),g=generation,q=items.find(x=>x.id===id),text=form.querySelector('textarea').value.trim();if(!s||!q||q.to!==s.slot||!text||saving.size||sending)return;
  saving.add(id);const button=form.querySelector('button'),editor=form.querySelector('textarea');button.disabled=true;editor.disabled=true;button.textContent='保存中…';controls();message('');
  try{
   const payload=await seal(text,'personal:'+id,'answer-v1',s);if(g!==generation||getSession()!==s)return;
   const record=await request(path(s)+'/'+id,{method:'PUT',token:s.token,body:{role:s.slot,payload,baseVersion:versions.get(id)??q.version}});
   if(g!==generation||getSession()!==s)return;
   generation++;loading=false;items=items.map(x=>x.id===id?{...record,text:q.text,answerText:text}:x);drafts.delete(id);versions.set(id,record.version);message('回答已保存，对方可以看到了。');
  }catch(e){if(g===generation&&getSession()===s){message(e.status===409?'回答已在另一处更新。请刷新核对后再提交，你输入的内容仍在。':'未确认保存成功，回答仍在输入框里，请重试。',true);if(e.status===409){await refresh({quiet:true});const latest=items.find(x=>x.id===id);if(latest)versions.set(id,latest.version);}}}
  finally{if(getSession()===s){saving.delete(id);button.disabled=false;editor.disabled=false;button.textContent=q.answer?'更新回答':'提交回答';render();controls();}}
 });
 root.querySelectorAll('[data-personal-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.personalFilter;visible=10;root.querySelectorAll('[data-personal-filter]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});render();});
 more.onclick=()=>{visible+=10;render();};root.querySelector('[data-personal-refresh]').onclick=()=>refresh();
 setInterval(()=>{if(!document.hidden&&!root.closest('[hidden]'))refresh({quiet:true});},20000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh({quiet:true});});window.addEventListener('online',()=>refresh({quiet:true}));
 controls();render();return {reset};
}
