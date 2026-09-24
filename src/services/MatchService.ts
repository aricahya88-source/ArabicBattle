import { supabase } from './supabase';
import type { ClaimResult, GameMode, MatchSnapshot, RealtimeActivity, RealtimeMatch, RealtimePlayer, RealtimeTarget } from './realtimeTypes';

export interface CreateMatchOptions { gameMode:GameMode; maxPlayers:number; targetCount:number; durationSeconds:number; difficulty:'easy'|'medium'|'hard'; worldSlug?:string; spectatorHost?:boolean; categories?:string[]; classId?:string|null; }

export class MatchService {
  async create(options:CreateMatchOptions):Promise<MatchSnapshot>{
    this.requireCloud();
    const {data,error}=await supabase!.rpc('create_hunt_match_v060',{
      p_game_mode:options.gameMode,p_max_players:options.maxPlayers,p_target_count:options.targetCount,
      p_duration_seconds:options.durationSeconds,p_difficulty:options.difficulty,p_world_slug:options.worldSlug||'student-room',
      p_as_spectator:!!options.spectatorHost,p_categories:options.categories?.length?options.categories:null,p_class_id:options.classId||null
    });
    if(error)throw error;const row=Array.isArray(data)?data[0]:data;return this.snapshot(row.match_id);
  }
  async join(roomCode:string):Promise<MatchSnapshot>{this.requireCloud();const {data,error}=await supabase!.rpc('join_hunt_match',{p_room_code:roomCode.trim().toUpperCase()});if(error)throw error;const row=Array.isArray(data)?data[0]:data;return this.snapshot(row.match_id)}
  async setReady(matchId:string,ready:boolean){this.requireCloud();const {error}=await supabase!.rpc('set_match_ready',{p_match_id:matchId,p_ready:ready});if(error)throw error}
  async start(matchId:string):Promise<MatchSnapshot>{this.requireCloud();const {error}=await supabase!.rpc('start_hunt_match',{p_match_id:matchId});if(error)throw error;return this.snapshot(matchId)}
  async pause(matchId:string,paused:boolean){this.requireCloud();const {error}=await supabase!.rpc(paused?'pause_hunt_match':'resume_hunt_match',{p_match_id:matchId});if(error)throw error}
  async end(matchId:string){this.requireCloud();const {error}=await supabase!.rpc('end_hunt_match',{p_match_id:matchId});if(error)throw error}
  async finishIfDue(matchId:string){if(!supabase)return false;const {data,error}=await supabase.rpc('finish_hunt_match_if_due',{p_match_id:matchId});if(error)throw error;return !!data}
  async claim(matchId:string,objectId:string):Promise<ClaimResult>{this.requireCloud();const {data,error}=await supabase!.rpc('claim_hunt_target',{p_match_id:matchId,p_object_id:objectId});if(error)throw error;const r=Array.isArray(data)?data[0]:data;return {ok:!!r.ok,reason:r.reason,targetId:r.target_id,objectId:r.object_id,playerId:r.player_id,pointsAwarded:r.points_awarded||0,score:r.score||0,combo:r.combo||0,bestCombo:r.best_combo||0,matchEnded:!!r.match_ended}}
  async snapshot(matchId:string):Promise<MatchSnapshot>{
    this.requireCloud();
    const [{data:m,error:me},{data:p,error:pe},{data:t,error:te},{data:a,error:ae},{data:serverNow,error:se}]=await Promise.all([
      supabase!.from('matches').select('id,room_code,host_id,game_mode,max_players,target_count,duration_seconds,difficulty,target_categories,class_id,seed,status,started_at,ends_at,paused_remaining_seconds,worlds(slug)').eq('id',matchId).single(),
      supabase!.from('match_players').select('player_id,role,ready,score,wrong_taps,claims,combo,best_combo,profiles(display_name,avatar_url)').eq('match_id',matchId).order('joined_at'),
      supabase!.from('match_targets').select('id,object_id,points,claimed_by,claimed_at,vocabulary(slug,arabic,meaning_id)').eq('match_id',matchId).order('sort_order'),
      supabase!.from('claims').select('id,player_id,object_id,correct,points_awarded,reason,created_at,profiles(display_name),match_targets(vocabulary(arabic))').eq('match_id',matchId).order('created_at',{ascending:false}).limit(24),
      supabase!.rpc('ahb_server_now')
    ]);
    if(me)throw me;if(pe)throw pe;if(te)throw te;if(ae)throw ae;if(se)throw se;
    const match:RealtimeMatch={id:m.id,roomCode:m.room_code,hostId:m.host_id,worldSlug:m.worlds?.slug||'student-room',gameMode:m.game_mode,maxPlayers:m.max_players,targetCount:m.target_count,durationSeconds:m.duration_seconds,difficulty:m.difficulty,targetCategories:m.target_categories,classId:m.class_id,seed:Number(m.seed),status:m.status,startedAt:m.started_at,endsAt:m.ends_at,pausedRemainingSeconds:m.paused_remaining_seconds};
    const players:RealtimePlayer[]=(p||[]).map((x:any)=>({playerId:x.player_id,displayName:x.profiles?.display_name||'Player',avatarUrl:x.profiles?.avatar_url,role:x.role,ready:x.ready,score:x.score,claims:x.claims,wrongTaps:x.wrong_taps,combo:x.combo,bestCombo:x.best_combo}));
    const targets:RealtimeTarget[]=(t||[]).map((x:any)=>({id:x.id,objectId:x.object_id,vocabSlug:x.vocabulary?.slug||'',arabic:x.vocabulary?.arabic||x.object_id,meaningId:x.vocabulary?.meaning_id||'',points:x.points,claimedBy:x.claimed_by,claimedAt:x.claimed_at}));
    const activity:RealtimeActivity[]=(a||[]).map((x:any)=>({id:x.id,playerId:x.player_id,displayName:x.profiles?.display_name||'Player',objectId:x.object_id,arabic:x.match_targets?.vocabulary?.arabic||undefined,correct:!!x.correct,points:x.points_awarded||0,reason:x.reason,createdAt:x.created_at}));
    return {match,players,targets,activity,serverNow:String(serverNow||new Date().toISOString())};
  }
  async listActive(){if(!supabase)return [];const {data,error}=await supabase.from('matches').select('id,room_code,game_mode,status,max_players,worlds(name),match_players(count)').in('status',['waiting','countdown','running','paused']).order('created_at',{ascending:false}).limit(12);if(error)throw error;return data||[]}
  private requireCloud(){if(!supabase)throw new Error('Supabase belum dikonfigurasi. Salin .env.example menjadi .env dan isi Project URL + publishable key.')}
}
