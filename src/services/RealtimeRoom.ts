import { supabase } from './supabase';
import type { RoomEvent } from './realtimeTypes';

export class RealtimeRoom {
  private channel:any=null;
  private poseLast=0;
  private topic='';
  private callbacks:{event?:(event:RoomEvent,payload:any)=>void;presence?:(state:any)=>void;status?:(status:string)=>void}={};

  async join(matchId:string,user:{id:string;name:string},callbacks:{event?:(event:RoomEvent,payload:any)=>void;presence?:(state:any)=>void;status?:(status:string)=>void}){
    if(!supabase)return false;
    await this.leave(); this.callbacks=callbacks; this.topic=`match:${matchId}`;
    this.channel=supabase.channel(this.topic,{config:{private:true,presence:{key:user.id},broadcast:{self:false,ack:true}}});
    const events:RoomEvent[]=['PLAYER_JOINED','PLAYER_READY','PLAYER_LEFT','MATCH_START','MATCH_PAUSE','MATCH_RESUME','TARGET_CLAIMED','CLAIM_REJECTED','SCORE_UPDATE','PLAYER_POSE','MATCH_END','STATE_INVALIDATED'];
    events.forEach(ev=>this.channel.on('broadcast',{event:ev},({payload}:any)=>this.callbacks.event?.(ev,payload)));
    this.channel.on('presence',{event:'sync'},()=>this.callbacks.presence?.(this.channel.presenceState()));
    this.channel.on('presence',{event:'join'},()=>this.callbacks.presence?.(this.channel.presenceState()));
    this.channel.on('presence',{event:'leave'},()=>this.callbacks.presence?.(this.channel.presenceState()));
    await new Promise<void>((resolve,reject)=>{
      this.channel.subscribe(async(status:string,err:any)=>{
        this.callbacks.status?.(status);
        if(status==='SUBSCRIBED'){
          try{await this.channel.track({user_id:user.id,name:user.name,status:'online',at:new Date().toISOString()});resolve();}catch(e){reject(e)}
        } else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT') reject(err||new Error(status));
      });
    });
    return true;
  }
  async send(event:RoomEvent,payload:any){if(!this.channel)return;return this.channel.send({type:'broadcast',event,payload});}
  async sendPose(payload:any,moving=true){const now=performance.now(),interval=moving?180:900;if(now-this.poseLast<interval)return;this.poseLast=now;return this.send('PLAYER_POSE',payload);}
  async updatePresence(payload:any){return this.channel?.track({...payload,at:new Date().toISOString()});}
  async leave(){if(this.channel&&supabase){try{await this.channel.untrack()}catch{}await supabase.removeChannel(this.channel);}this.channel=null;this.topic='';}
}
