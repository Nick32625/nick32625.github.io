const API='https://czy-lmj-couple-box.pages.dev';
const $=s=>document.querySelector(s);
function readEntry(){try{const s=JSON.parse(localStorage.getItem('czy-lmj-private-box-v1')||'null');return s?.v===2&&/^[A-Za-z0-9_-]{22}$/.test(s.id)&&/^[A-Za-z0-9_-]{43}$/.test(s.token)&&/^[A-Za-z0-9_-]{43}$/.test(s.key)?s:null;}catch{return null;}}
async function fingerprint(s){if(!s)return null;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s.id+':'+s.token));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,12);}
async function probe(label,path,{token,opaque=false}={}){
 const start=performance.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const r=await fetch(API+path,{cache:'no-store',credentials:'omit',mode:opaque?'no-cors':'cors',headers:token?{Authorization:'Bearer '+token}:{},signal:controller.signal});
  if(r.type==='opaque')return {label,result:'opaque',note:'收到了不可读响应；不能判断 HTTP 状态或服务是否放行。',ms:Math.round(performance.now()-start)};
  const contentType=r.headers.get('content-type')||'',challenge=r.headers.get('cf-mitigated')==='challenge';let data;try{data=await r.json();}catch{}
  const pass=r.ok&&(label==='私人入口读取'?data?.id!==undefined&&Array.isArray(data?.questions):data?.ok===true&&data?.storage===true);
  let note=pass?'成功':challenge?'Cloudflare 浏览器验证':r.status===403&&!data?'收到 403 拒绝页面，尚未进入正常的 JSON 接口':r.status===403&&data?.error==='来源不被允许。'?'应用拒绝了当前页面的跨域来源':(r.status===401||r.status===403)&&data?'接口拒绝了访问凭据':r.status===404&&label==='私人入口读取'?'该私人入口对应的提问箱不存在':r.ok?'返回内容不符合接口预期':'HTTP 请求未成功';
  return {label,result:pass?'pass':'fail',status:r.status,content_type:contentType,ray:r.headers.get('cf-ray')||null,note,ms:Math.round(performance.now()-start)};
 }catch(e){return {label,result:'fail',status:null,note:e.name==='AbortError'?'15 秒内没有完成请求':'浏览器未能读取响应：网络连接、跨域限制或入口拦截均有可能',error:e.name==='AbortError'?'timeout':'fetch_failed',ms:Math.round(performance.now()-start)};}finally{clearTimeout(timer);}
}
function render(row){const div=document.createElement('div');div.className='network-result '+row.result;const title=document.createElement('strong');title.textContent=row.label+' · '+(row.result==='pass'?'通过':row.result==='skip'?'未检测':'待排查');const desc=document.createElement('p');desc.textContent=row.note+(row.ms!==undefined?'（'+row.ms+' ms）':'');div.append(title,desc);$('#results').append(div);}
$('#run').onclick=async()=>{
 $('#run').disabled=true;$('#copy').disabled=true;$('#results').replaceChildren();$('#summary').textContent='正在检测，请保持页面打开…';
 try{
  const entry=readEntry(),id='net-'+Date.now().toString(36)+'-'+crypto.randomUUID().slice(0,8),stamp=new Date().toISOString(),query='?diagnostic='+encodeURIComponent(id);
  $('#direct').href=API+'/api/health'+query+'-direct';
  const tasks=[probe('基础接口', '/api/health'+query+'-basic'),probe('带凭据的跨域请求','/api/health'+query+'-auth',{token:entry?.token||'diagnostic-read-only'}),entry?probe('私人入口读取','/api/rooms/'+entry.id+'/state?role=a&diagnostic='+encodeURIComponent(id),{token:entry.token}):Promise.resolve({label:'私人入口读取',result:'skip',note:'这个浏览器没有保存私人入口。请先打开完整私人链接，再回到此页检测。'})];
  const rows=await Promise.all(tasks);if(rows[0].error)rows.push(await probe('网络响应辅助检查','/api/health'+query+'-opaque',{opaque:true}));rows.forEach(render);
  const summary=rows[0].result==='fail'?'基础接口也未通过，问题不只是身份选择或私人链接。':rows[1].result==='fail'?'基础接口可用，但带凭据请求未通过，需要检查跨域验证或入口规则。':!entry?'云端基础连接正常；此浏览器缺少私人入口。':rows[2].result==='pass'?'当前设备可以访问云端和私人提问箱。':'基础连接正常，但私人入口未通过，请保留检测报告。';
  $('#summary').textContent=summary;
  const report={version:1,diagnostic_id:id,time_utc:stamp,time_shanghai:new Date(stamp).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}),network_note:$('#network-note').value.trim(),browser:navigator.userAgent,private_entry_present:!!entry,entry_fingerprint:await fingerprint(entry),results:rows,summary};
  $('#report').value=JSON.stringify(report,null,2);$('#copy').disabled=false;$('#report-details').open=true;
 }catch{$('#summary').textContent='检测未能完成，请直接打开下方云端检测地址。';}finally{$('#run').disabled=false;}
};
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#report').value);$('#copy').textContent='已复制';}catch{$('#report').focus();$('#report').select();$('#copy').textContent='请复制已选中的报告';}};
