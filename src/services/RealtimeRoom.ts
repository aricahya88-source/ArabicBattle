import { supabase } from './supabase';
import type { RoomEvent } from './realtimeTypes';

export class RealtimeRoom {
  private channel:any=null;
  private poseLast=0;
  private topic='';
  private callbacks:{event?:(event:RoomEvent,payload:any)=>void;presence?:(state:any)=>void;status?:(status:string)=>void}={};

  async join(matchId:string,user:{id:string;name:string},callbacks:{event?:(event:RoomEvent,payload:any)=>void;presence?:(state:any)=>void;status?:(status:string)=>void}){
    if(!supabase)return false;
    await this.leave();
    this.callbacks=callbacks;
    this.topic=`match:${matchId}`;
    this.channel=supabase.channel(this.topic,{config:{private:true,presence:{key:user.id},broadcast:{self:false,ack:true}}});

    const events:RoomEvent[]=['PLAYER_JOINED','PLAYER_READY','PLAYER_LEFT','MATCH_START','MATCH_PAUSE','MATCH_RESUME','TARGET_CLAIMED','CLAIM_REJECTED','SCORE_UPDATE','PLAYER_POSE','MATCH_END','STATE_INVALIDATED'];
    events.forEach(ev=>this.channel.on('broadcast',{event:ev},({payload}:any)=>this.callbacks.event?.(ev,payload)));
    const syncPresence=()=>this.callbacks.presence?.(this.channel?.presenceState?.()||{});
    this.channel.on('presence',{event:'sync'},syncPresence);
    this.channel.on('presence',{event:'join'},syncPresence);
    this.channel.on('presence',{event:'leave'},syncPresence);

    await new Promise<void>((resolve,reject)=>{
      let settled=false;
      const finish=(fn:()=>void)=>{if(settled)return;settled=true;window.clearTimeout(timeout);fn()};
      const timeout=window.setTimeout(()=>finish(()=>reject(new Error('Realtime timeout. Periksa koneksi dan policy realtime.messages.'))),12000);
      this.channel.subscribe(async(status:string,err:any)=>{
        this.callbacks.status?.(status);
        if(status==='SUBSCRIBED'){
          try{await this.channel.track({user_id:user.id,name:user.name,status:'online',at:new Date().toISOString()});finish(resolve)}catch(e){finish(()=>reject(e))}
        }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
          finish(()=>reject(err||new Error(`Realtime ${status.toLowerCase()}`)));
        }
      });
    });
    return true;
  }

  async send(event:RoomEvent,payload:any){if(!this.channel)return;try{return await this.channel.send({type:'broadcast',event,payload})}catch(e){console.warn('Realtime broadcast failed',event,e)}}
  async sendPose(payload:any,moving=true){const now=performance.now(),interval=moving?200:1000;if(now-this.poseLast<interval)return;this.poseLast=now;return this.send('PLAYER_POSE',payload)}
  async updatePresence(payload:any){try{return await this.channel?.track({...payload,at:new Date().toISOString()})}catch(e){console.warn('Presence update failed',e)}}
  async leave(){if(this.channel&&supabase){try{await this.channel.untrack()}catch{}try{await supabase.removeChannel(this.channel)}catch{}}this.channel=null;this.topic='';this.poseLast=0}
}
