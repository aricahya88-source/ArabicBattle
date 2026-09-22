import { VOCAB } from '../data/vocabulary';
export interface HuntTarget { targetId:string; vocabId:string; objectId:string; claimedBy?:string; claimedAt?:number; points:number; }
export interface HuntScore { playerId:string; score:number; claims:number; wrong:number; combo:number; bestCombo:number; }
export class HuntEngine {
  targets:HuntTarget[]=[]; score:HuntScore={playerId:'local-player',score:0,claims:0,wrong:0,combo:0,bestCombo:0};
  startedAt=0; durationMs=180000; ended=false;
  start(objectCandidates:{id:string;vocabId:string}[], count=12, seed=7358291){
    const rng=mulberry32(seed); const shuffled=[...objectCandidates].sort(()=>rng()-.5);
    this.targets=shuffled.slice(0,Math.min(count,shuffled.length)).map((x,i)=>({targetId:`T${i+1}`,vocabId:x.vocabId,objectId:x.id,points:VOCAB[x.vocabId]?.points||50}));
    this.score={playerId:'local-player',score:0,claims:0,wrong:0,combo:0,bestCombo:0}; this.startedAt=Date.now(); this.ended=false;
  }
  claim(objectId:string){
    if(this.ended) return {ok:false,reason:'ended'} as const;
    const t=this.targets.find(x=>x.objectId===objectId && !x.claimedBy);
    if(!t){ this.score.score=Math.max(0,this.score.score-15); this.score.wrong++; this.score.combo=0; return {ok:false,reason:'wrong'} as const; }
    t.claimedBy=this.score.playerId; t.claimedAt=Date.now(); this.score.claims++; this.score.combo++; this.score.bestCombo=Math.max(this.score.bestCombo,this.score.combo);
    const comboBonus=Math.min(40,(this.score.combo-1)*10); this.score.score+=t.points+comboBonus;
    if(this.targets.every(x=>x.claimedBy)) this.ended=true;
    return {ok:true,target:t,comboBonus} as const;
  }
  remaining(){ return this.targets.filter(x=>!x.claimedBy).length; }
  timeLeft(){ return Math.max(0,this.durationMs-(Date.now()-this.startedAt)); }
}
function mulberry32(a:number){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
