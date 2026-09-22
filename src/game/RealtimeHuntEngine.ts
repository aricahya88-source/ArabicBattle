import type { MatchSnapshot, RealtimeTarget } from '../services/realtimeTypes';
import type { HuntScore, HuntTarget } from './HuntEngine';

export class RealtimeHuntEngine {
  targets:HuntTarget[]=[];
  score:HuntScore={playerId:'',score:0,claims:0,wrong:0,combo:0,bestCombo:0};
  startedAt=0; durationMs=180000; ended=false; endsAtMs=0; serverOffsetMs=0; pausedRemainingMs=0; status='waiting';
  sync(snapshot:MatchSnapshot,userId:string){
    this.targets=snapshot.targets.map((t:RealtimeTarget)=>({targetId:t.id,vocabId:t.vocabSlug,objectId:t.objectId,claimedBy:t.claimedBy||undefined,claimedAt:t.claimedAt?Date.parse(t.claimedAt):undefined,points:t.points}));
    const p=snapshot.players.find(x=>x.playerId===userId);
    this.score={playerId:userId,score:p?.score||0,claims:p?.claims||0,wrong:p?.wrongTaps||0,combo:p?.combo||0,bestCombo:p?.bestCombo||0};
    this.durationMs=snapshot.match.durationSeconds*1000;this.startedAt=snapshot.match.startedAt?Date.parse(snapshot.match.startedAt):0;this.endsAtMs=snapshot.match.endsAt?Date.parse(snapshot.match.endsAt):0;
    this.serverOffsetMs=Date.parse(snapshot.serverNow)-Date.now();this.ended=snapshot.match.status==='ended';this.status=snapshot.match.status;this.pausedRemainingMs=(snapshot.match.pausedRemainingSeconds||0)*1000;
  }
  timeLeft(){if(this.status==='paused')return this.pausedRemainingMs;const now=Date.now()+this.serverOffsetMs;if(this.startedAt&&now<this.startedAt)return this.durationMs;if(!this.endsAtMs)return this.durationMs;return Math.max(0,this.endsAtMs-now);}
  remaining(){return this.targets.filter(x=>!x.claimedBy).length;}
}
