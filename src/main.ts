import './styles/app.css';
import { renderPage, type Route, type HuntLike } from './ui/render';
import { HuntEngine } from './game/HuntEngine';
import { RealtimeHuntEngine } from './game/RealtimeHuntEngine';
import { STUDENT_ROOM } from './worlds/studentRoom';
import { PlayCanvasScene } from './scene/PlayCanvasScene';
import { XRManager } from './xr/XRManager';
import { VOCAB } from './data/vocabulary';
import { cloudEnabled } from './services/supabase';
import { AuthService, type AppUser } from './services/AuthService';
import { MatchService } from './services/MatchService';
import { RealtimeRoom } from './services/RealtimeRoom';
import { AdminUserService, type AdminAccount } from './services/AdminUserService';
import type { MatchSnapshot, RoomEvent } from './services/realtimeTypes';

const root=document.getElementById('app')!;
const localHunt=new HuntEngine();
const realtimeHunt=new RealtimeHuntEngine();
const auth=new AuthService();
const matches=new MatchService();
const realtime=new RealtimeRoom();
const adminUsers=new AdminUserService();

let hunt:HuntLike=localHunt;
let user:AppUser|null=null;
let match:MatchSnapshot|null=null;
let presence:Record<string,any[]>={};
let connectionStatus=cloudEnabled?'idle':'local';
let adminAccounts:AdminAccount[]=[];
let accountsLoading=false;
let accountsLoaded=false;
let route:Route=(location.hash.slice(1) as Route)||(new URLSearchParams(location.search).has('admin')?'admin-dashboard':'splash');
let scene:PlayCanvasScene|null=null;
let xr:XRManager|null=null;
let arPlaced=false;
let timerHandle:number|undefined;
let refreshTimer:number|undefined;
let finishing=false;
const history:Route[]=[];
const poses=new Map<string,any>();

function ensureLocalHunt(){if(!localHunt.targets.length){const candidates=STUDENT_ROOM.objects.filter(o=>o.interactive&&o.vocabId).map(o=>({id:o.id,vocabId:o.vocabId!}));localHunt.start(candidates,12,7358291)}}
function useLocalHunt(){hunt=localHunt;ensureLocalHunt()}
function useRealtimeHunt(){if(match&&user){realtimeHunt.sync(match,user.id);hunt=realtimeHunt}}
function go(r:Route,push=true){if(r.startsWith('admin-')&&user?.role!=='admin'){showError(new Error('Halaman admin hanya untuk akun admin.'));r=user?'home':'splash'}if(push&&route!==r)history.push(route);route=r;location.hash=r;render()}
function back(){go(history.pop()||'home',false)}
function saveMatch(){if(match)localStorage.setItem('ahb.activeMatchId',match.match.id);else localStorage.removeItem('ahb.activeMatchId')}

function render(){
  clearInterval(timerHandle); if(route!=='ar-place'){scene=null;xr=null;}
  if(route==='hunt3d'&&match)useRealtimeHunt(); else if(['hunt3d','hunt-ar','result'].includes(route)&&!match)useLocalHunt();
  root.innerHTML=renderPage({route,hunt,arStatus:statusOnly(),arPlaced,cloudEnabled,user,match,connectionStatus,presence,accounts:adminAccounts,accountsLoading});
  bind();
  if(route==='hunt3d'||route==='hunt-ar')mountScene(route==='hunt-ar');
  if(route==='ar-place'&&!scene)mountARPreview();
  if(route==='admin-live')startClock();
  updateAdminPoses();
  if(route==='admin-accounts'&&user?.role==='admin'&&!accountsLoaded&&!accountsLoading)window.setTimeout(()=>loadAccounts(false),0);
}
function statusOnly(){const nav:any=navigator;const known=xr?.status?.();return known||{webxr:!!nav.xr,ar:!!nav.xr,hitTest:!!nav.xr,anchors:!!nav.xr}}

function bind(){
  root.querySelectorAll<HTMLElement>('[data-go]').forEach(el=>el.onclick=()=>go(el.dataset.go as Route));
  root.querySelectorAll<HTMLElement>('[data-nav]').forEach(el=>el.onclick=()=>go(el.dataset.nav as Route));
  root.querySelector('[data-action="back"]')?.addEventListener('click',back);
  root.querySelector('#login-form')?.addEventListener('submit',e=>{e.preventDefault();void loginAccount()});
  root.querySelector('[data-action="toggle-password"]')?.addEventListener('click',()=>togglePassword('login-password'));
  root.querySelector('[data-action="toggle-account-password"]')?.addEventListener('click',()=>togglePassword('account-password'));
  root.querySelector('[data-action="sign-out"]')?.addEventListener('click',()=>run(async()=>{await leaveMatch();await auth.signOut();user=null;adminAccounts=[];accountsLoaded=false;go('splash')}));
  root.querySelector('[data-action="admin-create-user"]')?.addEventListener('click',()=>void createAdminUser());
  root.querySelector('[data-action="refresh-accounts"]')?.addEventListener('click',()=>void loadAccounts(true));
  root.querySelectorAll<HTMLElement>('[data-action="reset-user-password"]').forEach(el=>el.addEventListener('click',()=>void resetUserPassword(el.dataset.userId!,el.dataset.userName||'user')));
  root.querySelectorAll<HTMLElement>('[data-action="toggle-user-active"]').forEach(el=>el.addEventListener('click',()=>void toggleUserActive(el.dataset.userId!,el.dataset.active!=='1')));
  root.querySelector('[data-action="create-room"]')?.addEventListener('click',()=>createRoom(false));
  root.querySelector('[data-action="admin-create-room"]')?.addEventListener('click',()=>createRoom(true));
  root.querySelector('[data-action="join-room"]')?.addEventListener('click',joinRoom);
  root.querySelector('[data-action="toggle-ready"]')?.addEventListener('click',toggleReady);
  root.querySelector('[data-action="start-match"]')?.addEventListener('click',startMatch);
  root.querySelector('[data-action="host-toggle-pause"]')?.addEventListener('click',()=>pauseMatch(match?.match.status!=='paused'));
  root.querySelector('[data-action="admin-pause"]')?.addEventListener('click',()=>pauseMatch(true));
  root.querySelector('[data-action="admin-resume"]')?.addEventListener('click',()=>pauseMatch(false));
  root.querySelector('[data-action="start-ar-session"]')?.addEventListener('click',startARSession);
  root.querySelector('[data-action="place-ar"]')?.addEventListener('click',()=>{try{if(!xr)throw new Error('Mulai sesi AR terlebih dahulu.');xr.place();arPlaced=true;const m=root.querySelector('#ar-message');if(m)m.textContent='Arena dikunci. AR placement siap.'}catch(e:any){showError(e)}});
  root.querySelector('[data-action="reset-ar"]')?.addEventListener('click',()=>{xr?.reset();arPlaced=false;const m=root.querySelector('#ar-message');if(m)m.textContent='Gerakkan HP mencari permukaan.'});
  root.querySelectorAll<HTMLElement>('[data-speak]').forEach(el=>el.onclick=()=>speak(el.dataset.speak!));
}

async function ensureUser(_name='Player'){if(user)return user;throw new Error('Silakan login memakai username dan password yang diberikan admin.');}

async function loginAccount(){await run(async()=>{
  const username=root.querySelector<HTMLInputElement>('#login-username')?.value||'';
  const password=root.querySelector<HTMLInputElement>('#login-password')?.value||'';
  user=await auth.login(username,password);
  accountsLoaded=false;
  go(user.role==='admin'?'admin-dashboard':'home',false);
})}
function togglePassword(id:string){const el=root.querySelector<HTMLInputElement>(`#${id}`);if(el)el.type=el.type==='password'?'text':'password'}
async function loadAccounts(force=false){
  if(user?.role!=='admin'||!cloudEnabled)return;
  if(accountsLoading||(!force&&accountsLoaded))return;
  accountsLoading=true;render();
  try{adminAccounts=await adminUsers.list();accountsLoaded=true;}catch(e){showError(e)}finally{accountsLoading=false;render()}
}
async function createAdminUser(){await run(async()=>{
  if(user?.role!=='admin')throw new Error('Hanya admin yang dapat membuat akun.');
  const q=(id:string)=>root.querySelector<HTMLInputElement|HTMLSelectElement>(`#${id}`);
  const username=q('account-username')?.value||'';
  const displayName=q('account-display-name')?.value||'';
  const password=q('account-password')?.value||'';
  const role=(q('account-role')?.value||'player') as 'admin'|'player';
  if(!displayName.trim())throw new Error('Nama tampilan wajib diisi.');
  if(password.length<8)throw new Error('Password minimal 8 karakter.');
  await adminUsers.create({username,displayName,password,role});
  accountsLoaded=false;await loadAccounts(true);alert(`Akun @${username.trim().toLowerCase()} berhasil dibuat.`);
})}
async function resetUserPassword(userId:string,username:string){
  const password=prompt(`Password baru untuk @${username} (minimal 8 karakter):`);if(password===null)return;
  await run(async()=>{if(password.length<8)throw new Error('Password minimal 8 karakter.');await adminUsers.resetPassword(userId,password);alert('Password berhasil direset.');});
}
async function toggleUserActive(userId:string,active:boolean){await run(async()=>{await adminUsers.setActive(userId,active);accountsLoaded=false;await loadAccounts(true)})}

async function createRoom(admin:boolean){await run(async()=>{
  await ensureUser(admin?'Admin':'Player');
  if(admin&&user?.role!=='admin')throw new Error('Hanya admin yang dapat membuat match dari dashboard admin.');
  if(!cloudEnabled){if(admin)throw new Error('Admin realtime membutuhkan Supabase. Isi .env lalu jalankan migration.');useLocalHunt();go('hunt3d');return;}
  const q=(id:string)=>root.querySelector<HTMLInputElement|HTMLSelectElement>(`#${id}`);
  const opt={
    gameMode:(q(admin?'admin-mode':'create-mode')?.value||'3d') as '3d'|'ar',
    maxPlayers:Number(q(admin?'admin-players':'create-players')?.value||4),
    targetCount:Number(q(admin?'admin-targets':'create-targets')?.value||12),
    durationSeconds:Number(q(admin?'admin-duration':'create-duration')?.value||180),
    difficulty:(q(admin?'admin-difficulty':'create-difficulty')?.value||'medium') as 'easy'|'medium'|'hard',worldSlug:'student-room',spectatorHost:admin
  };
  match=await matches.create(opt);saveMatch();useRealtimeHunt();await connectRealtime();go(admin?'admin-lobby':'lobby');
})}
async function joinRoom(){await run(async()=>{
  await ensureUser('Player');const code=root.querySelector<HTMLInputElement>('#join-code')?.value||'';if(!code.trim())throw new Error('Masukkan room code.');
  match=await matches.join(code);saveMatch();useRealtimeHunt();await connectRealtime();go('lobby');
})}
async function toggleReady(){if(!match||!user)return;const me=match.players.find(p=>p.playerId===user!.id);await run(async()=>{await matches.setReady(match!.match.id,!me?.ready);await refreshMatch(true)})}
async function startMatch(){if(!match)return;await run(async()=>{match=await matches.start(match!.match.id);useRealtimeHunt();if(route.startsWith('admin-'))go('admin-live');else go('hunt3d')})}
async function pauseMatch(paused:boolean){if(!match)return;await run(async()=>{await matches.pause(match!.match.id,paused);await refreshMatch(true)})}

async function connectRealtime(){
  if(!match||!user||!cloudEnabled)return;
  connectionStatus='connecting';renderSoft();
  await realtime.join(match.match.id,{id:user.id,name:user.name},{
    status:s=>{connectionStatus=s.toLowerCase();renderSoft()},
    presence:state=>{presence=state;applyPresence();if(route==='lobby'||route==='admin-lobby'||route==='admin-players')scheduleRefresh(true)},
    event:(event,payload)=>handleRoomEvent(event,payload)
  });
}
function applyPresence(){if(!match)return;const online=new Set(Object.keys(presence));match.players.forEach(p=>p.connected=online.has(p.playerId))}
function handleRoomEvent(event:RoomEvent,payload:any){
  if(event==='PLAYER_POSE'){if(payload?.player_id)poses.set(payload.player_id,payload);updateAdminPoses();return;}
  if(event==='MATCH_START'){void refreshMatch(false).then(()=>{if(!match||!['countdown','running'].includes(match.match.status))return;if(route==='lobby')go('hunt3d');else if(route==='admin-lobby')go('admin-live');});return;}
  if(event==='MATCH_END'){void refreshMatch(false).then(()=>{if(match?.match.status!=='ended')return;if(!route.startsWith('admin-'))go('result');else render();});return;}
  if(event==='TARGET_CLAIMED'||event==='CLAIM_REJECTED'||event==='SCORE_UPDATE'){scheduleRefresh(false);return;}
  scheduleRefresh(true);
}
function scheduleRefresh(rerender:boolean){clearTimeout(refreshTimer);refreshTimer=window.setTimeout(()=>refreshMatch(rerender),90)}
async function refreshMatch(rerender=false){if(!match)return;try{match=await matches.snapshot(match.match.id);applyPresence();useRealtimeHunt();if(rerender)render();else updateLiveUI();}catch(e){console.warn('snapshot refresh failed',e)}}
function renderSoft(){const badge=root.querySelector('.cloud-badge');if(badge)badge.textContent=`● ${cloudEnabled?'Realtime Cloud':'Demo Lokal'} · ${connectionStatus}`}

function mountScene(ar:boolean){
  const canvas=root.querySelector<HTMLCanvasElement>('#pc-canvas');if(!canvas)return;scene=new PlayCanvasScene(canvas);scene.loadWorld(STUDENT_ROOM);
  scene.onPose=pose=>{if(match&&user&&route==='hunt3d')realtime.sendPose({match_id:match.match.id,player_id:user.id,...pose},true)};
  if(match&&user&&route==='hunt3d')void realtime.sendPose({match_id:match.match.id,player_id:user.id,...scene.getPose()},false);
  scene.onPick=async p=>{
    if(ar||!match){const r=localHunt.claim(p.objectId);scene?.highlight(p.objectId,r.ok);navigator.vibrate?.(r.ok?35:[20,40,20]);updateLiveUI();if(localHunt.ended)setTimeout(()=>go('result'),400);return;}
    try{
      const result=await matches.claim(match.match.id,p.objectId);scene?.highlight(p.objectId,result.ok);navigator.vibrate?.(result.ok?35:[20,40,20]);
      await realtime.sendPose({match_id:match.match.id,player_id:user?.id,...scene!.getPose(),lookingAt:p.objectId},true);
      await refreshMatch(false);if(result.matchEnded)setTimeout(()=>go('result'),300);
    }catch(e){showError(e)}
  };
  updateLiveUI();startClock();if(ar)scene.setWorldScale(.1);
}
function startClock(){clearInterval(timerHandle);updateTime();timerHandle=window.setInterval(updateTime,200)}
function updateTime(){
  const ms=hunt.timeLeft();const txt=fmt(ms);const el=root.querySelector('#time-left');if(el)el.textContent=txt;const ae=root.querySelector('#admin-time');if(ae)ae.textContent=txt;
  const overlay=root.querySelector<HTMLElement>('#countdown-overlay');if(match&&overlay&&match.match.startedAt){const now=Date.now()+realtimeHunt.serverOffsetMs,left=Date.parse(match.match.startedAt)-now;if(left>0){overlay.style.display='flex';overlay.textContent=String(Math.ceil(left/1000));}else overlay.style.display='none';}
  if(match&&ms<=0&&!finishing&&match.match.status!=='ended'){finishing=true;matches.finishIfDue(match.match.id).catch(()=>{}).finally(()=>setTimeout(()=>finishing=false,1200));}
}
function updateLiveUI(){
  const score=root.querySelector('#score-value');if(score)score.textContent=String(hunt.score.score);const mini=root.querySelector('#mini-score');if(mini)mini.textContent=String(hunt.score.score);
  const pr=root.querySelector('#target-progress');if(pr)pr.textContent=`${hunt.score.claims}/${hunt.targets.length}`;
  hunt.targets.forEach(t=>{const chip=root.querySelector<HTMLElement>(`.target-chip[data-object="${cssEscape(t.objectId)}"]`);if(chip){chip.classList.toggle('claimed',!!t.claimedBy);const i=chip.querySelector('i');if(i)i.textContent=t.claimedBy?'✓':'○'}});
  const strip=root.querySelector('.score-strip');if(strip&&match){strip.innerHTML=[...match.players].sort((a,b)=>b.score-a.score).slice(0,4).map((p,i)=>`<span>${i===0?'👑':i+1} ${escapeHtml(p.displayName)} <b>${p.score}</b></span>`).join('')}
  if(match?.match.status==='ended'&&!route.startsWith('admin-')&&route==='hunt3d')go('result');
}
function updateAdminPoses(){const layer=root.querySelector<HTMLElement>('#admin-pose-layer');if(!layer||!match)return;layer.innerHTML='';const palette=['#2676ff','#e54d5e','#29a36a','#8d62d9','#e69b22','#16a6b6','#ce4ab5','#687387'];match.players.forEach((p,i)=>{const pose=poses.get(p.playerId);if(!pose)return;const x=clamp(50+(pose.position?.[0]||0)*7,7,93),y=clamp(50+(pose.position?.[2]||0)*7,7,93);const n=document.createElement('i');n.className='p live-pose';n.style.left=`${x}%`;n.style.top=`${y}%`;n.style.background=palette[i%palette.length];n.textContent=initial(p.displayName);n.title=`${p.displayName}${pose.lookingAt?' → '+pose.lookingAt:''}`;layer.appendChild(n)})}

function mountARPreview(){const canvas=root.querySelector<HTMLCanvasElement>('#pc-canvas');if(!canvas)return;scene=new PlayCanvasScene(canvas);scene.loadWorld(STUDENT_ROOM);scene.setWorldScale(.1);xr=new XRManager(scene)}
async function startARSession(){if(!scene||!xr)mountARPreview();try{await xr!.enterAR(()=>{const m=root.querySelector('#ar-message');if(m)m.textContent='AR aktif. Gerakkan HP hingga reticle menemukan meja/lantai.'})}catch(e){showError(e)}}
function speak(id:string){const v=VOCAB[id];if(!v||!('speechSynthesis'in window))return;const u=new SpeechSynthesisUtterance(v.arabic);u.lang='ar-SA';speechSynthesis.cancel();speechSynthesis.speak(u)}

async function leaveMatch(){await realtime.leave();match=null;saveMatch();poses.clear();hunt=localHunt}
async function run(fn:()=>Promise<void>){try{await fn()}catch(e){showError(e)}}
function showError(e:any){const msg=e?.message||String(e);console.error(e);alert(msg.replace(/^.*?: /,''))}
function fmt(ms:number){const m=Math.max(0,Math.floor(ms/60000)),s=Math.max(0,Math.floor((ms%60000)/1000));return `${m}:${String(s).padStart(2,'0')}`}
function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}
function cssEscape(s:string){return CSS.escape(s)}
function escapeHtml(s:string){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!))}
function initial(s:string){return (s.trim()[0]||'P').toUpperCase()}

window.addEventListener('hashchange',()=>{const h=location.hash.slice(1) as Route;if(h&&h!==route){route=h;render()}});
window.addEventListener('online',()=>{connectionStatus='network-online';if(match&&user)connectRealtime().catch(()=>{});renderSoft()});
window.addEventListener('offline',()=>{connectionStatus='offline';renderSoft()});
if(import.meta.env.PROD&&'serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));

async function bootstrap(){
  if(cloudEnabled){try{
    user=await auth.restore();
    if(user){
      if(route.startsWith('admin-')&&user.role!=='admin')route='home';
      const id=localStorage.getItem('ahb.activeMatchId');
      if(id){
        match=await matches.snapshot(id);useRealtimeHunt();await connectRealtime();
        if(match.match.status==='running'||match.match.status==='countdown'||match.match.status==='paused')route=user.role==='admin'&&route.startsWith('admin-')?'admin-live':'hunt3d';
        else if(match.match.status==='waiting')route=user.role==='admin'&&route.startsWith('admin-')?'admin-lobby':'lobby';
      }else if(route==='splash')route=user.role==='admin'?'admin-dashboard':'home';
    }else route='splash';
  }catch(e){console.warn('restore failed',e);localStorage.removeItem('ahb.activeMatchId');user=null;route='splash'}}
  else route='splash';
  render();
}
bootstrap();
