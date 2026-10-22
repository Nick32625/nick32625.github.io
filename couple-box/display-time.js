// All shared timestamps use Shanghai time, including on devices in other time zones.
const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function dateLabel(value){
 const date=new Date(value);if(value==null||!Number.isFinite(date.getTime()))return '';
 const p=Object.fromEntries(formatter.formatToParts(date).map(x=>[x.type,x.value]));
 return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}
export function timeHTML(value){
 const label=dateLabel(value);return label?`<time class="record-time" datetime="${new Date(value).toISOString()}" title="北京时间">${label}</time>`:'';
}
