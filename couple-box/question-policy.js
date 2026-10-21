// The stages are a gentle editorial order, not a relationship assessment.
export const ANNIVERSARY='2026-10-06';
export const SCHEDULE_START='2026-10-22';
export const STAGES=[
 {id:'start',minDay:1,name:'刚在一起',range:'第 1–30 天',description:'日常喜好、约会、爱的表达和相处边界。'},
 {id:'closer',minDay:31,name:'慢慢熟悉',range:'第 31–60 天',description:'成长经历、情绪支持，以及更深入的亲密期待。'},
 {id:'memories',minDay:61,name:'一起回看',range:'第 61–90 天',description:'积累一些共同经历后，再聊回忆、默契和相处调整。'},
 {id:'future',minDay:91,name:'认真计划',range:'第 91 天起',description:'长期生活、婚姻、家庭与共同责任。'}
];
const DEFAULT_STAGE={daily:'start',memory:'memories',support:'closer',love:'start',space:'start',repair:'closer',growth:'closer',intimacy:'closer',future:'future'};
const OVERRIDES={
 start:[11,19,20,21,23,46,47,49,50,54,57,59,61,64,65,73,74,77,79,81,86,90,104,120],
 closer:[10,13,14,15,16,22,24,25,26,27,29,32,35,42,55,56,58,62,63,67,70,72,75,76,78,80,84,89,91,97,99,102,105,110,113,114,115,116,117,118,119],
 memories:[18,36,51,52,53,71,82,106,107],
 future:[66,69,88,92,93,100,103,108,109,111]
};
export function policyFor(question){
 const number=Number(question.id.slice(1));
 const stage=STAGES.find(s=>OVERRIDES[s.id]?.includes(number))||STAGES.find(s=>s.id===DEFAULT_STAGE[question.topic]);
 return {stage:stage.id,minDay:stage.minDay};
}
export function relationshipDay(day){return Math.max(1,Math.floor((Date.parse(day+'T00:00:00Z')-Date.parse(ANNIVERSARY+'T00:00:00Z'))/86400000)+1);}
