export type GameMode='3d'|'ar';
export type MatchStatus='waiting'|'countdown'|'running'|'paused'|'ended';
export type PlayerRole='host'|'player'|'spectator';
export interface RealtimePlayer {playerId:string;displayName:string;avatarUrl?:string|null;role:PlayerRole;ready:boolean;score:number;claims:number;wrongTaps:number;combo:number;bestCombo:number;connected?:boolean;}
export interface RealtimeTarget {id:string;objectId:string;vocabSlug:string;arabic:string;meaningId?:string;points:number;claimedBy?:string|null;claimedAt?:string|null;}
export interface RealtimeActivity {id:string;playerId:string;displayName:string;objectId:string;arabic?:string;correct:boolean;points:number;reason?:string|null;createdAt:string;}
export interface RealtimeMatch {id:string;roomCode:string;hostId:string;worldSlug:string;gameMode:GameMode;maxPlayers:number;targetCount:number;durationSeconds:number;difficulty:string;targetCategories?:string[]|null;classId?:string|null;seed:number;status:MatchStatus;startedAt?:string|null;endsAt?:string|null;pausedRemainingSeconds?:number|null;}
export interface MatchSnapshot {match:RealtimeMatch;players:RealtimePlayer[];targets:RealtimeTarget[];activity:RealtimeActivity[];serverNow:string;}
export type RoomEvent='PLAYER_JOINED'|'PLAYER_READY'|'PLAYER_LEFT'|'MATCH_START'|'MATCH_PAUSE'|'MATCH_RESUME'|'TARGET_CLAIMED'|'CLAIM_REJECTED'|'SCORE_UPDATE'|'PLAYER_POSE'|'MATCH_END'|'STATE_INVALIDATED';
export interface ClaimResult {ok:boolean;reason:'accepted'|'wrong'|'already_claimed'|'not_running'|'not_member'|'ended'|string;targetId?:string|null;objectId:string;playerId:string;pointsAwarded:number;score:number;combo:number;bestCombo:number;matchEnded?:boolean;}
