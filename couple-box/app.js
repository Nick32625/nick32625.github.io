import {STAGES,relationshipDay,SCHEDULE_START} from './question-policy.js?v=20261021-curated';
import {mountWhispers} from './whispers.js?v=20261021-mailbox';
import {QUESTIONS,TOPICS,SOURCES} from './questions.js?v=20261021-curated';
const API='https://czy-lmj-couple-box.pages.dev';
const STORE='czy-lmj-private-box-v1';
const NAMES={a:'CZY',b:'LMJ'};
const ANNIVERSARY='2026-10-06';
function paintAnniversary(){const days=Math.floor((Date.parse(cnDay()+'T00:00:00Z')-Date.parse(ANNIVERSARY+'T00:00:00Z'))/86400000)+1;$('#relationship-days').textContent=String(Math.max(1,days));}
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qById=new Map(QUESTIONS.map(q=>[q.id,q])),topicById=new Map(TOPICS.map(t=>[t.id,t]));
const cnDay=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const dayLabel=day=>new Date(day+'T12:00:00+08:00').toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Shanghai'});
const timeLabel=iso=>new Date(iso).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'});
const depths={1:'轻松聊聊',2:'认真听听',3:'慢慢说也好'};
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decode=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
let entry=null, session=null, dayState=null, view='today', historyDay=null, historyData=[],filter='all',toastTimer,syncBusy=false,syncGeneration=0,syncError='',pendingSlot=null,submitting=false, modalBusy=false;
// Retain the last private entrance, including an existing v2 link, without creating another box.
try{
 const saved=JSON.parse(localStorage.getItem(STORE)||'null');
 const old=JSON.parse(localStorage.getItem('haohaoshuo-rooms-v2')||'{}')[localStorage.getItem('haohaoshuo-active-v2')];
 const candidate=saved||(old?{...old,v:2}:null);
 if(validLink(candidate))entry={v:2,id:candidate.id,key:candidate.key,token:candidate.token};
}catch{}
function persistSession(s){entry={v:2,id:s.id,key:s.key,token:s.token};session=s;try{localStorage.setItem(STORE,JSON.stringify(entry));}catch{toast('此浏览器无法记住入口，请收藏你们的专属链接。');}}
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function showError(message){$('#page-error').textContent=message||'';$('#page-error').hidden=!message;}
function modal(html){$('#modal-body').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();$('#modal-body').scrollTop=0;}
function closeModal(){if(modalBusy)return;$('#modal').close();}
function modalError(message){let box=$('#modal-error');if(!box){box=document.createElement('div');box.id='modal-error';box.className='message error';box.setAttribute('role','alert');$('#modal-body').append(box);}box.textContent=message;}
function busy(button,on,label='处理中…'){if(!button)return;if(on){button.dataset.original=button.textContent;button.textContent=label;button.disabled=true;}else{button.textContent=button.dataset.original||button.textContent;button.disabled=false;}}
async function request(path,{method='GET',body,token=session?.token}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
 try{const res=await fetch(API+path,{method,cache:'no-store',credentials:'omit',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
 let data;try{data=await res.json();}catch{const err=new Error(res.status===403?'云端访问被拒绝（403）。请保留拦截页的错误码和 Ray ID；已有答案不会因此丢失。':res.headers.get('cf-mitigated')==='challenge'?'云端要求浏览器验证，答案暂未提交；本机草稿仍在。':'云端返回了非预期内容，答案暂未提交；本机草稿仍在。');err.status=res.status;throw err;}
 if(!res.ok){const err=new Error(data.error||'暂时无法完成，请稍后重试。');err.status=res.status;throw err;}return data;
 }catch(e){if(e.name==='AbortError'||e instanceof TypeError){const error=new Error('当前网络未连上云端。请点刷新重试，已有答案和草稿会保留。');error.network=true;throw error;}throw e;}finally{clearTimeout(timer);}
}
function roomPath(s=session){return '/api/rooms/'+s.id;}
function draftKey(day,q){return `hh-draft:${session.id}:${session.slot}:${day}:${q}${dayState?.answerEpoch?':'+dayState.answerEpoch:''}`;}
function readDraft(day,q){try{return localStorage.getItem(draftKey(day,q));}catch{return null;}}
function writeDraft(day,q,text){try{localStorage.setItem(draftKey(day,q),text);return true;}catch{return false;}}
async function aesKey(s=session){return crypto.subtle.importKey('raw',decode(s.key),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function seal(text,day,q,s=session){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(`${s.id}:${day}:${q}:${s.slot}`)},await aesKey(s),new TextEncoder().encode(text));return {iv:encode(iv),cipher:encode(new Uint8Array(cipher))};}
async function unseal(payload,day,q,slot,s=session){const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(payload.iv),additionalData:new TextEncoder().encode(`${s.id}:${day}:${q}:${slot}`)},await aesKey(s),decode(payload.cipher));return new TextDecoder().decode(plain);}
async function unpack(state,s){for(const [qid,answer]of Object.entries(state.answers)){if(answer.mine)answer.mine.text=await unseal(answer.mine.payload,answer.mine.sourceDay||state.day,answer.mine.sourceQuestionId||qid,s.slot,s);if(answer.partner)answer.partner.text=await unseal(answer.partner.payload,answer.partner.sourceDay||state.day,answer.partner.sourceQuestionId||qid,s.slot==='a'?'b':'a',s);}return state;}
function paintAccount(){document.body.classList.toggle('has-room',!!session);$('#account-label').textContent=session?'我是'+NAMES[session.slot]:'选择身份';$('#room-strip').hidden=!session;$('#room-names').textContent='CZY  &  LMJ';$('#invite-btn').hidden=!entry;$('#join-status').textContent='各自填写 · 一起看答案';}
function draftMessage(mine,draft){if(draft!==null&&draft!==(mine?.text||''))return '草稿在本机 · 提交后保存到云端';return mine?(mine.sourceQuestionId?'沿用相近问题「'+(qById.get(mine.sourceQuestionId)?.text||mine.sourceQuestionId)+'」的答案，可修改':mine.sourceDay?'沿用 '+mine.sourceDay+' 的答案，可继续修改':'云端已保存 · '+timeLabel(mine.updatedAt)):'草稿只保存在本机';}
function cardHTML(q,index,state,preview=false){
 const topic=topicById.get(q.topic),data=state?.answers?.[q.id]||{},mine=data.mine,partner=data.partner,day=state?.day||cnDay();
 const draft=session?readDraft(day,q.id):null;const text=draft??mine?.text??'';const myName=NAMES[session?.slot||'a'],theirName=NAMES[(session?.slot||'a')==='a'?'b':'a'];
 let partnerHTML=partner?esc(partner.text):`<div><span class="letter-icon">✉</span>${!session?'各自写下心里的答案':data.partnerSubmitted&&!mine?'对方已提交，等你写好再一起打开':mine?'你的心意已寄出，等对方写下答案':'两个人都提交后，一起打开答案'}<br><span class="muted">${!session?'用你们共同收藏的专属链接进入':state?.joined?'不急，慢慢写就好':'把提问箱链接发给另一位'}</span></div>`;
 return `<article class="q-card ${topic.color}" data-question="${q.id}" data-day="${day}"><div class="question-meta"><span class="tag ${topic.color}"><span>${topic.icon}</span> ${topic.name}</span><span class="question-meta-right">${depths[q.depth]} <span>0${index+1} / 0${state?.questions?.length||2}</span></span></div><h3 class="question-title">${esc(q.text)}</h3><p class="question-hint">${esc(q.hint)}</p><div class="answer-grid"><div><label class="answer-label" for="input-${day}-${q.id}"><span><span class="avatar">${esc(myName.slice(0,1))}</span>${esc(myName)}的答案</span><span class="small">写下你的真实想法</span></label>${preview?'<button type="button" class="answer-preview">选择身份后填写 ↗</button>':`<textarea class="answer-input" id="input-${day}-${q.id}" data-q="${q.id}" data-day="${day}" maxlength="1200" enterkeyhint="enter" placeholder="想到什么，就从哪里开始写…">${esc(text)}</textarea>`}<div class="draft-note ${mine&&(!draft||draft===mine.text)?'saved':''}" data-note="${q.id}">${preview?'专属链接进入 · 选择 CZY 或 LMJ':esc(draftMessage(mine,draft))}</div><div class="answer-foot"><span><span data-count="${q.id}">${text.length}</span> / 1200</span><button class="btn primary submit-answer" data-q="${q.id}" ${session&&!text.trim()?'disabled':''}>${mine?'更新答案':'提交答案'} <span>↗</span></button></div></div><div><div class="answer-label"><span><span class="avatar partner">${esc(theirName.slice(0,1))}</span>${esc(theirName)}的答案</span><span class="small">${partner?'已一起打开':data.partnerSubmitted?'已提交':'还没打开的信'}</span></div><div class="partner-answer ${partner?'revealed':''}">${partnerHTML}</div>${partner?`<p class="draft-note saved">云端已保存 · ${timeLabel(partner.updatedAt)}${partner.sourceQuestionId?' · 原题：'+esc(qById.get(partner.sourceQuestionId)?.text):''}</p>`:''}</div></div><div class="question-bottom"><span>${partner?'♡ 谢谢你愿意让我更了解你。':'♡ 不需要一样的答案，只需要真实的你。'}</span><button class="skip-question" data-q="${q.id}">今天先跳过 ↗</button></div></article>`;
}
function renderCards(){const isHistory=view==='history'&&historyDay;const holder=isHistory?$('#history-detail-cards'):$('#daily-cards');if(!holder)return;if(session&&!dayState){holder.innerHTML=syncError?`<div class="message error" role="alert"><strong>已选择 ${NAMES[session.slot]}</strong><p>${esc(syncError)}</p><button class="btn" data-retry-sync>重新连接</button></div>`:'<div class="loading-card" role="status">正在读取你们的每日两问…</div>';paintAccount();return;}
 const qs=(dayState?.questions||['q01','q20']).map(id=>qById.get(id)).filter(Boolean);
 if(session&&dayState&&!qs.length){holder.innerHTML='<div class="empty-state"><h3>今天暂时没有新的题目</h3><p>未共同完成的题会继续抽取，亲密话题会留出间隔。也可以翻翻旧答案，或给对方留一句话。</p></div>';holder.dataset.context='';paintAccount();return;}
 const context=JSON.stringify([session?.id,session?.slot,dayState?.day,dayState?.answerEpoch,qs.map(q=>q.id)]),next=document.createElement('div');next.innerHTML=qs.map((q,i)=>cardHTML(q,i,dayState,!session)).join('');
 if(session&&holder.dataset.context===context&&holder.querySelectorAll('.q-card').length===qs.length){
  // Keep the live editor node: replacing it interrupts focus, selection and Chinese input.
  $$('.q-card',holder).forEach((card,i)=>{const fresh=next.children[i],input=$('.answer-input',card),updated=$('.answer-input',fresh);
   if(document.activeElement!==input&&input.value!==updated.value)input.value=updated.value;
   $('.answer-grid',card).children[1].replaceWith($('.answer-grid',fresh).children[1]);
   const note=$('.draft-note',card),newNote=$('.draft-note',fresh);note.textContent=newNote.textContent;note.className=newNote.className;
   const button=$('.submit-answer',card),newButton=$('.submit-answer',fresh);button.innerHTML=newButton.innerHTML;button.disabled=newButton.disabled;
   $('[data-count]',card).textContent=input.value.length;$('.question-bottom',card).replaceWith($('.question-bottom',fresh));
  });
 }else{holder.replaceChildren(...next.childNodes);holder.dataset.context=context;}
 if(!isHistory){$('#date-label').textContent=session?dayLabel(dayState?.day||cnDay())+' · 每日两问':'先认识一下 · 两道示例问题';$('#daily-title').textContent=session?'今天，想听你说':'从一个小问题开始';}
 paintAccount();
}
function clearOldDrafts(state,s){
 if(!state.answerEpoch)return;
 try{const prefix='hh-draft:'+s.id+':',suffix=':'+state.answerEpoch;for(const key of Object.keys(localStorage))if(key.startsWith(prefix)&&!key.endsWith(suffix))localStorage.removeItem(key);}catch{}
}
async function sync({quiet=false}={}){if(!session||syncBusy)return;syncBusy=true;syncError='';const snap=session,generation=++syncGeneration,day=(view==='history'&&historyDay)||'';$('#sync-state').textContent='正在同步…';if(!dayState)renderCards();
 const current=()=>generation===syncGeneration&&session===snap&&day===((view==='history'&&historyDay)||'');
 try{const data=await request(roomPath(snap)+'/state?role='+snap.slot+(day?'&day='+day:''),{token:snap.token});const decoded=await unpack(data,snap);if(!current())return;clearOldDrafts(decoded,snap);dayState=decoded;session.names=NAMES;persistSession(session);showError('');$('#sync-state').textContent='云端已连接';renderCards();}
 catch(e){if(!current())return;syncError=e.message;$('#sync-state').textContent='未连接 · 草稿仍在';showError(dayState?e.message:'');if(!dayState)renderCards();if(!quiet)toast(e.message);}finally{if(generation===syncGeneration)syncBusy=false;}
}
function setView(next){syncGeneration++;syncBusy=false;syncError='';view=next;historyDay=null;$$('.view').forEach(el=>el.hidden=el.id!=='view-'+next);$$('.nav-tab').forEach(el=>{el.classList.toggle('active',el.dataset.view===next);el.setAttribute('aria-current',el.dataset.view===next?'page':'false');});if(next==='today'){dayState=null;renderCards();if(session)sync({quiet:true});}if(next==='library')renderLibrary();if(next==='history')loadHistory();window.scrollTo({top:0,behavior:'smooth'});}
function renderLibrary(){
 const term=$('#question-search').value.trim(),age=relationshipDay(cnDay());
 const list=QUESTIONS.filter(q=>!q.retired&&(filter==='all'||q.topic===filter)&&(!term||`${q.text} ${q.hint} ${topicById.get(q.topic).name}`.includes(term)));
 const ready=list.filter(q=>q.minDay<=age&&(!q.notBefore||cnDay()>=q.notBefore)).length;
 $('#library-count').textContent=`共 ${list.length} 道题 · 当前阶段已开放 ${ready} 道 · ${cnDay()<SCHEDULE_START?'10 月 22 日起按阶段抽题':'每天随机 2 问，双方答完的题不再抽取'}`;
 $('#question-library').innerHTML=list.length?STAGES.map(stage=>{
  const items=list.filter(q=>q.stage===stage.id).sort((a,b)=>a.depth-b.depth||a.id.localeCompare(b.id));if(!items.length)return '';
  return `<section class="library-stage"><div class="library-stage-heading"><h2>${stage.name}</h2><span>${stage.range} · ${items.length} 题</span></div><p class="library-stage-description">${stage.description}${age<stage.minDay?' 暂不进入每日抽题，仍可提前浏览。':''}</p><div class="question-grid">${items.map(q=>{const t=topicById.get(q.topic);return `<article class="library-card"><span class="tag ${t.color}">${t.icon} ${t.name}</span><h3>${esc(q.text)}</h3><p>${esc(q.hint)}</p><span class="library-depth">${depths[q.depth]} · ${q.id.toUpperCase()}</span></article>`;}).join('')}</div></section>`;
 }).join(''):'<div class="empty-state"><p>还没找到这类问题，试试换个关键词。</p></div>';
}
function baseURL(){return 'https://nick32625.github.io/couple-box/';}
function roomLink(){return baseURL()+'#room='+encode(new TextEncoder().encode(JSON.stringify(entry)));}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('已复制专属链接');return true;}catch{toast('请长按选中链接后复制');return false;}}
function entranceModal(){roleModal();}
function privateLinkModal(){if(!entry){entranceModal();return;}modal(`<h2 class="modal-title">收藏这一个入口</h2><p class="modal-desc">CZY 和 LMJ 共用同一个链接。打开后选择自己的身份即可。</p><label class="form-field">你们的专属链接<textarea id="private-link" readonly>${esc(roomLink())}</textarea></label><button class="btn primary full" id="copy-private-link">复制专属链接 ↗</button><p class="modal-foot">链接是访问凭据，请只保存在彼此的设备上。</p>`);$('#copy-private-link').onclick=()=>copy(roomLink());}
function roleModal(){
 modal(`<h2 class="modal-title">选择身份</h2><p class="modal-desc">两个人每天分别填写自己的答案。</p><div class="modal-actions role-choices"><button type="button" class="btn ${session?.slot==='a'?'primary':''} full" id="choose-boy" aria-pressed="${session?.slot==='a'}">我是 CZY</button><button type="button" class="btn ${session?.slot==='b'?'primary':''} full" id="choose-girl" aria-pressed="${session?.slot==='b'}">我是 LMJ</button></div>${entry?'<p class="modal-foot">同一个提问箱，两栏独立保存。</p>':'<p class="modal-foot" id="entry-hint">这台设备尚未保存私人入口。请打开你们的完整专属链接，或在下方粘贴链接恢复。</p><details id="restore-entry"><summary>粘贴专属链接</summary><form id="restore-form"><label class="form-field">完整私人链接<textarea id="restore-link" required placeholder="https://…/couple-box/#room=…" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea></label><button type="submit" class="btn primary full">恢复入口</button></form></details>'}`);
 $('#choose-boy').onclick=()=>switchRole('a');$('#choose-girl').onclick=()=>switchRole('b');
 if($('#restore-form'))$('#restore-form').onsubmit=e=>{e.preventDefault();handleLink($('#restore-link').value.trim(),pendingSlot);};
}
function switchRole(slot){
 if(submitting){toast('答案正在保存，请稍后切换身份。');return;}
 if(!entry){pendingSlot=slot;$('#choose-boy').setAttribute('aria-pressed',String(slot==='a'));$('#choose-girl').setAttribute('aria-pressed',String(slot==='b'));$('#choose-boy').classList.toggle('primary',slot==='a');$('#choose-girl').classList.toggle('primary',slot==='b');$('#entry-hint').textContent='已选择 '+NAMES[slot]+'。请先恢复你们的专属链接，才能读取私人答案。';$('#restore-entry').open=true;$('#restore-link').focus();return;}
 persistSession({...entry,slot,names:NAMES});whispers.forEach(box=>box.reset());pendingSlot=null;closeModal();showError('');setView('today');paintAccount();
}
function validLink(data){return data?.v===2&&/^[A-Za-z0-9_-]{22}$/.test(data.id)&&/^[A-Za-z0-9_-]{43}$/.test(data.key)&&/^[A-Za-z0-9_-]{43}$/.test(data.token)&&(data.slot===undefined||data.slot==='a'||data.slot==='b');}
function handleLink(value,slot=null){let data;try{const url=new URL(value,location.href),raw=new URLSearchParams(url.hash.slice(1)).get('room');if(!raw)throw Error();data=JSON.parse(new TextDecoder().decode(decode(raw)));if(!validLink(data))throw Error();}catch{modal('<h2 class="modal-title">链接不完整</h2><p class="modal-desc">请重新打开你们收藏的完整专属链接。</p>');return;}
 entry={v:2,id:data.id,key:data.key,token:data.token};session=null;whispers.forEach(box=>box.reset());dayState=null;syncGeneration++;syncBusy=false;try{localStorage.setItem(STORE,JSON.stringify(entry));}catch{}history.replaceState(null,'','#room='+encode(new TextEncoder().encode(JSON.stringify(entry))));if(slot==='a'||slot==='b'){switchRole(slot);}else{setView('today');roleModal();}
}
async function submitAnswer(btn){if(!session){entranceModal();return;}if(submitting)return;const card=btn.closest('.q-card'),q=card.dataset.question,day=card.dataset.day,text=$('textarea',card).value.trim();if(!text){toast('先写一点你的想法吧');return;}if(!dayState){toast('请先连接云端，再提交答案');return;}submitting=true;busy(btn,true,'保存到云端…');const s=session,version=dayState.answers[q]?.mine?.version||0,baseDay=dayState.answers[q]?.mine?.sourceDay||day,baseQuestionId=dayState.answers[q]?.mine?.sourceQuestionId||q,answerEpoch=dayState.answerEpoch||'';
 try{const result=await request(roomPath(s)+'/answers/'+day+'/'+q,{method:'PUT',token:s.token,body:{role:s.slot,payload:await seal(text,day,q,s),baseVersion:version,baseDay,baseQuestionId,answerEpoch}});if(session!==s)return;localStorage.removeItem(draftKey(day,q));dayState.answers[q]||={};dayState.answers[q].mine={...result,text};toast('已提交，答案已保存到云端');renderCards();await sync({quiet:true});}catch(e){showError(e.message);toast(e.message);if(e.status===409)await sync({quiet:true});}finally{submitting=false;busy(btn,false);}
}
async function loadHistory(){const holder=$('#history-content');if(!session){holder.innerHTML='<div class="empty-state"><span class="empty-icon">✉</span><h3>故事还没落笔</h3><p>选择身份后，就能查看你们按日期保存的答案。</p><button class="btn primary" id="history-create">选择身份 ↗</button></div>';$('#history-create').onclick=entranceModal;return;}holder.innerHTML='<div class="loading-card">正在翻开你们的记录…</div>';try{const data=await request(roomPath()+'/history?role='+session.slot);if(view!=='history'||historyDay)return;historyData=data.days;renderHistoryList();}catch(e){holder.innerHTML=`<div class="message error">${esc(e.message)}</div><button class="btn" id="retry-history">重新加载</button>`;$('#retry-history').onclick=loadHistory;}}
function renderHistoryList(){const holder=$('#history-content'),days=historyData;if(!days.length){holder.innerHTML='<div class="empty-state"><span class="empty-icon">♡</span><h3>第一封心事，等你写下</h3><p>提交第一道题后，这里就会有属于你们的记录。</p><button class="btn primary" id="back-today">去回答今天的问题 ↗</button></div>';$('#back-today').onclick=()=>setView('today');return;}holder.innerHTML=`<div class="history-summary"><div><strong>${days.length}</strong><span>个写下答案的日子</span></div><div><strong>${days.reduce((n,d)=>n+d.together,0)}</strong><span>道一起打开的问题</span></div></div><div class="history-list">${days.map(d=>`<button class="history-row" data-history-day="${d.day}"><span class="history-day">${d.day.slice(5).replace('-','.')}<small>${d.day.slice(0,4)}</small></span><span class="history-body"><strong>${d.together?'那天，有些话被好好听见':'有一份心事，正在等回信'}</strong><p>你答了 ${d.mine}/2 题 · 对方答了 ${d.partner}/2 题</p></span><span class="history-status">一起打开 ${d.together}/2</span><span class="history-arrow">↗</span></button>`).join('')}</div>`;$$('[data-history-day]',holder).forEach(b=>b.onclick=()=>openHistoryDay(b.dataset.historyDay));}
async function openHistoryDay(day){historyDay=day;dayState=null;$('#history-content').innerHTML=`<div class="history-date-bar"><h2>${esc(dayLabel(day))}</h2><button class="text-btn" id="back-history">← 所有记录</button></div><div id="history-detail-cards" class="daily-cards"><div class="loading-card">正在读取当天的答案…</div></div>`;$('#back-history').onclick=()=>{historyDay=null;loadHistory();};await sync({quiet:true});}
function helpModal(){modal(`<h2 class="modal-title">打开，就能聊</h2><ol class="steps"><li>打开你们共同收藏的专属链接</li><li>选择 CZY 或 LMJ，填写自己的答案</li><li>点击提交，答案保存到云端</li><li>双方答完同题后互相查看，历史随时回看</li></ol><ul class="help-list"><li>每日题目按上海时间 00:00 更新。按恋爱天数逐步加入新话题，每天从当前阶段未共同完成的题中随机选两道。只有双方都提交过的题才不再抽取；只有一方答过的题再次出现时，会带上之前的答案。相近问法只留一道。每天的题目固定，不会因提交而临时换题。“爱与性”保留 7 道题，初始化后前三天不出现，此后每次出现至少间隔 10 天。</li><li>留言发送后直接可见，不用先答题。发送满 24 小时后隐藏并停止读取，云端加密内容随后由每 5 分钟运行的任务清理（运行可能延迟）。不进入回答历史，也不保存本机草稿；对方未打开页面时不会收到推送。</li><li>未提交草稿只在本机；看到“云端已保存”才表示提交成功。</li><li>专属链接是访问凭据。选择身份不验证本人，持有链接的人可以切换两栏；请只分享给彼此。</li><li>答案在浏览器加密后上传，不写入公开 GitHub 仓库。换设备时打开同一条专属链接。</li></ul>${entry?'<button class="btn full" id="save-entry">保存专属链接 ↗</button>':''}`);if($('#save-entry'))$('#save-entry').onclick=privateLinkModal;}
$$('.nav-tab').forEach(btn=>btn.onclick=()=>setView(btn.dataset.view));$('#account-btn').onclick=roleModal;$('#close-modal').onclick=closeModal;$('#modal').addEventListener('cancel',e=>{if(modalBusy)e.preventDefault();});$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
$('#start-btn').onclick=()=>session?$('#daily-anchor').scrollIntoView({behavior:'smooth'}):entranceModal();$('#invite-btn').onclick=privateLinkModal;$('#refresh-btn').onclick=()=>sync();$('#help-btn').onclick=helpModal;
$('#main').addEventListener('input',event=>{const input=event.target;if(!input.matches('.answer-input'))return;if(!session){entranceModal();return;}const q=input.dataset.q,day=input.dataset.day;const ok=writeDraft(day,q,input.value);const card=input.closest('.q-card');$('[data-count]',card).textContent=input.value.length;const note=$('[data-note]',card);note.classList.remove('saved');note.textContent=ok?'草稿在本机 · 提交后保存到云端':'本机存储已满 · 请尽快提交到云端';$('.submit-answer',card).disabled=!input.value.trim();});
$('#main').addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.matches('[data-retry-sync]'))sync();if(button.matches('.answer-preview'))entranceModal();if(button.matches('.submit-answer'))submitAnswer(button);if(button.matches('.skip-question')){const card=button.closest('.q-card'),cards=$$('.q-card',card.parentElement),next=cards[cards.indexOf(card)+1];if(next)next.scrollIntoView({behavior:'smooth',block:'start'});else toast('今天先到这里也很好，答案随时可以回来写。');}});
$('#topic-filters').innerHTML='<button class="filter-chip selected" data-topic="all">全部话题</button>'+TOPICS.map(t=>`<button class="filter-chip" data-topic="${t.id}">${t.icon} ${t.name}</button>`).join('');$('#topic-filters').onclick=e=>{const b=e.target.closest('[data-topic]');if(!b)return;filter=b.dataset.topic;$$('.filter-chip').forEach(x=>x.classList.toggle('selected',x===b));renderLibrary();};$('#question-search').oninput=renderLibrary;$('#source-list').innerHTML=SOURCES.map(s=>`<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><br>${esc(s.note)}</li>`).join('');
const whispers=[mountWhispers({getSession:()=>session,request,seal,unseal,esc,names:NAMES,chooseRole:roleModal})];
paintAnniversary();renderCards();
if(location.hash){handleLink(location.href);}else{roleModal();}
window.addEventListener('hashchange',()=>{if(location.hash){handleLink(location.href);}});
setInterval(()=>{paintAnniversary();if(document.hidden||!session||submitting||syncBusy||$('#modal').open)return;if(view==='today'||view==='history'&&historyDay){const editing=document.activeElement?.matches('.answer-input');if(!editing)sync({quiet:true});}},20000);
window.addEventListener('online',()=>{if(session)sync({quiet:true});});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&!document.activeElement?.matches('.answer-input')&&(view==='today'||historyDay))sync({quiet:true});});
