import {canonicalQuestion} from './question-groups.js?v=20261021-depth';
// An editorial pace for this question box, not a diagnostic relationship timeline.
export const ANNIVERSARY='2026-10-06';
export const SCHEDULE_START='2026-10-22';
export const STAGES=[
 {id:'start',minDay:1,name:'初识与日常',range:'第 1–20 天',description:'喜好、生活故事、相处习惯，先认识具体的你。'},
 {id:'closer',minDay:21,name:'了解与磨合',range:'第 21–90 天',description:'情绪、分歧、价值观与亲密边界；过往经历低频出现，共同回忆稍晚加入。'},
 {id:'future',minDay:91,name:'长期与共同生活',range:'第 91 天起',description:'共同回顾、金钱、家庭与未来安排，也保留轻松的话题。'}
];
const MEMBERS={
 start:[1,2,4,5,6,7,8,9,11,19,20,25,28,30,34,37,40,44,57,61,65,87,96,97,101,104,121,122,123,124,125,126,127,128,129,130],
 closer:[10,15,22,27,32,39,41,46,47,48,49,55,56,58,64,67,73,74,75,77,78,79,80,91,95,102,115,117,118,119,131,132,133,134,135,136],
 future:[18,66,69,70,82,89,92,93,103,106,107,108,109,110,111,137,138,139,140]
};
// A few prompts need shared experience or trust; keep them in the same broad stage.
const LATER=new Set([10,15,55,80,136]);
const stageByNumber=new Map();
for(const stage of STAGES)for(const n of MEMBERS[stage.id]){
 if(stageByNumber.has(n))throw Error('Duplicate question stage: '+n);
 stageByNumber.set(n,stage);
}
export function policyFor(question){
 const number=Number(canonicalQuestion(question.id).slice(1));
 // q76 was retired without a replacement and is retained only for old history.
 const stage=stageByNumber.get(number)||(number===76?STAGES[1]:null);
 if(!stage)throw Error('Missing question stage: '+question.id);
 return {stage:stage.id,minDay:LATER.has(number)||number===76?61:stage.minDay};
}
export function relationshipDay(day){return Math.max(1,Math.floor((Date.parse(day+'T00:00:00Z')-Date.parse(ANNIVERSARY+'T00:00:00Z'))/86400000)+1);}
