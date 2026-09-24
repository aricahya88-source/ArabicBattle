import './styles/app.css';
import { renderPage, type Route, type HuntLike, type UISettings } from './ui/render';
import { HuntEngine } from './game/HuntEngine';
import { RealtimeHuntEngine } from './game/RealtimeHuntEngine';
import { VOCAB } from './data/vocabulary';
import { getWorld, getWorldCard } from './worlds/catalog';
import { cloudEnabled } from './services/supabase';
import { AuthService, type AppUser } from './services/AuthService';
import { MatchService } from './services/MatchService';
import { RealtimeRoom } from './services/RealtimeRoom';
import { AdminUserService, type AdminAccount } from './services/AdminUserService';
import { AdminDataService, type LearningClass, type MatchHistoryRow, type LeaderboardRow, type VocabularyRow } from './services/AdminDataService';
import type { MatchSnapshot, RoomEvent } from './services/realtimeTypes';
import type { PlayCanvasScene as PlayCanvasSceneType, SceneQuality } from './scene/PlayCanvasScene';
import type { XRManager as XRManagerType } from './xr/XRManager';

const root=document.getElementById('app')!;
const localHunt=new HuntEngine(),realtimeHunt=new RealtimeHuntEngine();
const auth=new AuthService(),matches=new MatchService(),realtime=new RealtimeRoom(),adminUsers=new AdminUserService(),adminData=new AdminDataService();
let hunt:HuntLike=localHunt,user:AppUser|null=null,match:MatchSnapshot|null=null,presence:Record<string,any[]>={};
let connectionStatus=cloudEnabled?'idle':'local',adminAccounts:AdminAccount[]=[],classes:LearningClass[]=[],historyRows:MatchHistoryRow[]=[],masteryRows:any[]=[],leaderboardRows:LeaderboardRow[]=[],arLeaderboardRows:LeaderboardRow[]=[],vocabularyRows:VocabularyRow[]=[];
let accountsLoading=false,accountsLoaded=false,adminDataLoading=false,classesLoaded=false,historyLoaded=false,masteryLoaded=false,leaderboardLoaded=false,vocabularyLoaded=false;
let route:Route=(location.hash.slice(1) as Route)||(new URLSearchParams(location.search).has('admin')?'admin-dashboard':'splash');
let selectedWorld=localStorage.getItem('ahb.selectedWorld')||'student-room';
let battleMode:('3d'|'ar')=(localStorage.getItem('ahb.battleMode') as any)||'3d';
let pendingJoinCode=(new URLSearchParams(location.search).get('join')||'').trim().toUpperCase();
let localMode:'practice'|'tutorial'|null=null,adminView:'3d'|'top'=(localStorage.getItem('ahb.adminView') as any)||'3d',rankingMode:'3d'|'ar'=(localStorage.getItem('ahb.rankingMode') as any)||'3d';
let settings:UISettings=loadSettings();
let scene:PlayCanvasSceneType|null=null,xr:XRManagerType|null=null,arPlaced=false,arSessionActive=false;
let arCapability={checked:false,secure:window.isSecureContext,webxr:false,immersiveAr:false,hitTest:false,anchors:false,domOverlay:false};
let timerHandle:number|undefined,refreshTimer:number|undefined,reconnectTimer:number|undefined,reconnectAttempts=0,finishing=false,claimBusy=false,sceneLoadToken=0;
let sceneModulePromise:Promise<typeof import('./scene/PlayCanvasScene')>|null=null,xrModulePromise:Promise<typeof import('./xr/XRManager')>|null=null;
const historyStack:Route[]=[],poses=new Map<string,any>();
const palette=['#2676ff','#e54d5e','#29a36a','#8d62d9','#e69b22','#16a6b6','#ce4ab5','#687387'];

function loadSettings():UISettings{try{return {...{quality:'auto',sound:true,translation:true,debug:false},...JSON.parse(localStorage.getItem('ahb.settings')||'{}')}}catch{return {quality:'auto',sound:true,translation:true,debug:false}}}
function preload3D(){sceneModulePromise??=import('./scene/PlayCanvasScene');return sceneModulePromise}
function preloadXR(){xrModulePromise??=import('./xr/XRManager');return xrModulePromise}
function startLocal(mode:'practice'|'tutorial',worldId=selectedWorld){localMode=mode;selectedWorld=worldId;localStorage.setItem('ahb.selectedWorld',worldId);const world=getWorld(worldId);const candidates=world.objects.filter(o=>o.interactive&&o.vocabId).map(o=>({id:o.id,vocabId:o.vocabId!}));const count=mode==='tutorial'?3:Math.min(12,candidates.length);localHunt.start(candidates,count,mode==='tutorial'?20260923:Math.floor(Math.random()*1e9));hunt=localHunt;void preload3D();go('hunt3d')}
function useRealtimeHunt(){if(match&&user){realtimeHunt.sync(match,user.id);hunt=realtimeHunt}}
function go(r:Route,push=true){if(r==='home'&&match?.match.status==='ended'&&user?.role!=='admin'){void realtime.leave();match=null;saveMatch();poses.clear()}if(r.startsWith('admin-')&&user?.role!=='admin'){showError(new Error('Halaman admin hanya untuk akun admin.'));r=user?'home':'splash'}if(push&&route!==r)historyStack.push(route);route=r;location.hash=r;render()}
function back(){go(historyStack.pop()||(user?.role==='admin'?'admin-dashboard':'home'),false)}
function saveMatch(){if(match)localStorage.setItem('ahb.activeMatchId',match.match.id);else localStorage.removeItem('ahb.activeMatchId')}
function destroyScene(){sceneLoadToken++;try{xr?.end?.()}catch{}xr=null;arSessionActive=false;arPlaced=false;try{scene?.destroy?.()}catch{}scene=null}

function render(){
  clearInterval(timerHandle);const arStatus=statusOnly();destroyScene();
  if((route==='hunt3d'||route==='hunt-ar')&&match)useRealtimeHunt();else if(['hunt3d','hunt-ar','result','review'].includes(route)&&!match)hunt=localHunt;
  root.innerHTML=renderPage({route,hunt,arStatus,arPlaced,arSessionActive,arCapability,battleMode,cloudEnabled,user,match,connectionStatus,presence,accounts:adminAccounts,accountsLoading,selectedWorld,pendingJoinCode,localMode,adminView,classes,history:historyRows,mastery:masteryRows,adminDataLoading,settings,leaderboard:leaderboardRows,arLeaderboard:arLeaderboardRows,rankingMode,vocabularyRows});
  bind();
  if(route==='hunt3d'||route==='hunt-ar')void mountScene(route==='hunt-ar');
  if(route==='ar-check')void checkARSupport();
  if(route==='admin-live'&&adminView==='3d')void mountAdminSpectator();
  if(route==='admin-live'||route==='admin-projector')startClock();
  updateAdminPoses();
  if(route==='admin-lobby'||route==='admin-projector')void renderRoomQR();
  if(['admin-accounts','admin-classes'].includes(route)&&user?.role==='admin'&&!accountsLoaded&&!accountsLoading)window.setTimeout(()=>loadAccounts(false),0);
  if(['admin-create','admin-classes'].includes(route)&&!classesLoaded&&!adminDataLoading)window.setTimeout(()=>loadAdminClasses(),0);
  if(route==='admin-history'&&!historyLoaded&&!adminDataLoading)window.setTimeout(()=>loadHistory(),0);
  if((route==='admin-analytics'||route==='progress')&&!masteryLoaded&&!adminDataLoading)window.setTimeout(()=>loadMastery(),0);
  if(route==='ranking'&&!leaderboardLoaded&&!adminDataLoading)window.setTimeout(()=>loadLeaderboard(),0);
  if(['admin-vocab','admin-worlds'].includes(route)&&!vocabularyLoaded&&!adminDataLoading)window.setTimeout(()=>loadVocabularyRows(),0);
}
function statusOnly(){const known=xr?.status?.();return known||{webxr:arCapability.webxr,ar:arCapability.immersiveAr,hitTest:arCapability.hitTest,anchors:arCapability.anchors,domOverlay:arCapability.domOverlay,active:arSessionActive,placed:arPlaced,anchorActive:false}}

function bind(){
  root.querySelectorAll<HTMLElement>('[data-go]').forEach(el=>el.onclick=()=>go(el.dataset.go as Route));
  root.querySelectorAll<HTMLElement>('[data-nav]').forEach(el=>el.onclick=()=>go(el.dataset.nav as Route));
  root.querySelectorAll<HTMLElement>('[data-action="select-mode"]').forEach(el=>el.onclick=()=>{battleMode=(el.dataset.mode as '3d'|'ar')||'3d';localStorage.setItem('ahb.battleMode',battleMode);if(battleMode==='ar')go('ar-check');else go('worlds')});
  root.querySelectorAll<HTMLElement>('[data-action="select-ranking-mode"]').forEach(el=>el.onclick=()=>{rankingMode=(el.dataset.mode as '3d'|'ar')||'3d';localStorage.setItem('ahb.rankingMode',rankingMode);render()});
  root.querySelector('[data-action="continue-ar-worlds"]')?.addEventListener('click',()=>{if(!arCapability.secure||!arCapability.webxr||!arCapability.immersiveAr){showError(new Error('Perangkat belum siap untuk immersive AR. Gunakan Android kompatibel melalui HTTPS.'));return}battleMode='ar';localStorage.setItem('ahb.battleMode','ar');go('worlds')});
  root.querySelector('[data-action="recheck-ar"]')?.addEventListener('click',()=>void checkARSupport(true));
  root.querySelector('[data-action="back"]')?.addEventListener('click',back);
  root.querySelector('#login-form')?.addEventListener('submit',e=>{e.preventDefault();void loginAccount()});
  root.querySelector('[data-action="toggle-password"]')?.addEventListener('click',()=>togglePassword('login-password'));
  root.querySelector('[data-action="toggle-account-password"]')?.addEventListener('click',()=>togglePassword('account-password'));
  root.querySelector('[data-action="sign-out"]')?.addEventListener('click',()=>run(async()=>{await leaveMatch();await auth.signOut();user=null;adminAccounts=[];accountsLoaded=false;go('splash')}));
  root.querySelectorAll<HTMLElement>('[data-action="select-world"]').forEach(el=>el.onclick=()=>{selectedWorld=el.dataset.world||'student-room';localStorage.setItem('ahb.selectedWorld',selectedWorld);go('world-detail')});
  root.querySelectorAll<HTMLElement>('[data-action="coming-soon"]').forEach(el=>el.onclick=()=>alert(`${getWorldCard(el.dataset.world).name} sedang disiapkan. Kartu world sudah aktif sebagai roadmap konten.`));
  root.querySelector('[data-action="start-practice"]')?.addEventListener('click',()=>startLocal('practice'));
  root.querySelector('[data-action="start-tutorial"]')?.addEventListener('click',()=>startLocal('tutorial','student-room'));
  root.querySelector('[data-action="leave-game"]')?.addEventListener('click',()=>void run(async()=>{if(match)await leaveMatch();localMode=null;go('home')}));
  root.querySelector('[data-action="save-settings"]')?.addEventListener('click',saveSettings);
  root.querySelector('[data-action="admin-create-user"]')?.addEventListener('click',()=>void createAdminUser());
  root.querySelector('[data-action="refresh-accounts"]')?.addEventListener('click',()=>void loadAccounts(true));
  root.querySelectorAll<HTMLElement>('[data-action="reset-user-password"]').forEach(el=>el.addEventListener('click',()=>void resetUserPassword(el.dataset.userId!,el.dataset.userName||'user')));
  root.querySelectorAll<HTMLElement>('[data-action="toggle-user-active"]').forEach(el=>el.addEventListener('click',()=>void toggleUserActive(el.dataset.userId!,el.dataset.active!=='1')));
  root.querySelector('[data-action="create-room"]')?.addEventListener('click',()=>createRoom(false));
  root.querySelector('[data-action="admin-create-room"]')?.addEventListener('click',()=>createRoom(true));
  root.querySelector('[data-action="join-room"]')?.addEventListener('click',joinRoom);
  root.querySelector('[data-action="toggle-ready"]')?.addEventListener('click',toggleReady);
  root.querySelector('[data-action="start-match"]')?.addEventListener('click',startMatch);
  root.querySelector('[data-action="admin-pause"]')?.addEventListener('click',()=>pauseMatch(true));
  root.querySelector('[data-action="admin-resume"]')?.addEventListener('click',()=>pauseMatch(false));
  root.querySelector('[data-action="host-toggle-pause"]')?.addEventListener('click',()=>pauseMatch(match?.match.status!=='paused'));
  root.querySelector('[data-action="admin-end"]')?.addEventListener('click',endMatch);
  root.querySelector('[data-action="rematch"]')?.addEventListener('click',rematch);
  root.querySelectorAll<HTMLElement>('[data-action="admin-view"]').forEach(el=>el.onclick=()=>{adminView=(el.dataset.view as any)||'3d';localStorage.setItem('ahb.adminView',adminView);render()});
  root.querySelector('[data-action="spectator-overview"]')?.addEventListener('click',()=>scene?.overview());
  root.querySelectorAll<HTMLElement>('[data-action="follow-player"]').forEach(el=>el.onclick=()=>scene?.followPlayer(el.dataset.player||null));
  root.querySelector('[data-action="open-projector"]')?.addEventListener('click',()=>window.open(`${location.origin}${location.pathname}#admin-projector`,'ahb-projector','noopener'));
  root.querySelector('[data-action="copy-room-code"]')?.addEventListener('click',()=>{if(match)navigator.clipboard?.writeText(match.match.roomCode).then(()=>toast('Room code copied'))});
  root.querySelector('[data-action="create-class"]')?.addEventListener('click',createClass);
  root.querySelector('[data-action="assign-class"]')?.addEventListener('click',assignClass);
  root.querySelector('[data-action="save-vocab"]')?.addEventListener('click',saveVocabulary);
  root.querySelectorAll<HTMLElement>('[data-action="admin-select-world"]').forEach(el=>el.onclick=()=>{selectedWorld=el.dataset.world||'student-room';localStorage.setItem('ahb.selectedWorld',selectedWorld);render()});
  root.querySelector('[data-action="map-world-object"]')?.addEventListener('click',mapWorldObject);
  root.querySelector('[data-action="start-ar-session"]')?.addEventListener('click',()=>void startARSession());
  root.querySelector('[data-action="place-ar"]')?.addEventListener('click',()=>{try{if(!xr)throw new Error('Mulai sesi AR terlebih dahulu.');xr.place();arPlaced=true;updateAROverlay()}catch(e){showError(e)}});
  root.querySelector('[data-action="reset-ar"]')?.addEventListener('click',()=>{xr?.reset();arPlaced=false;if(match?.match.status==='waiting'&&user){const me=match.players.find(p=>p.playerId===user!.id);if(me?.ready)void matches.setReady(match.match.id,false).then(()=>refreshMatch(false)).catch(()=>{})}updateAROverlay()});
  root.querySelector('[data-action="rotate-ar-left"]')?.addEventListener('click',()=>{try{xr?.rotate(-15)}catch(e){showError(e)}});
  root.querySelector('[data-action="rotate-ar-right"]')?.addEventListener('click',()=>{try{xr?.rotate(15)}catch(e){showError(e)}});
  root.querySelector('[data-action="toggle-ar-ready"]')?.addEventListener('click',()=>void toggleReady());
  root.querySelector('[data-action="start-ar-match"]')?.addEventListener('click',()=>void startMatch());
  root.querySelector('[data-action="end-ar-session"]')?.addEventListener('click',()=>{xr?.end();arSessionActive=false;arPlaced=false;updateAROverlay()});
  root.querySelectorAll<HTMLElement>('[data-speak]').forEach(el=>el.onclick=e=>{e.stopPropagation();speak(el.dataset.speak!)});
}

async function loginAccount(){await run(async()=>{const username=qv('login-username'),password=qv('login-password');user=await auth.login(username,password);accountsLoaded=false;if(pendingJoinCode&&user.role!=='admin')go('room',false);else go(user.role==='admin'?'admin-dashboard':'home',false)})}
function togglePassword(id:string){const el=root.querySelector<HTMLInputElement>(`#${id}`);if(el)el.type=el.type==='password'?'text':'password'}
function saveSettings(){settings={quality:(qv('setting-quality') as any)||'auto',sound:!!root.querySelector<HTMLInputElement>('#setting-sound')?.checked,translation:!!root.querySelector<HTMLInputElement>('#setting-translation')?.checked,debug:!!root.querySelector<HTMLInputElement>('#setting-debug')?.checked};localStorage.setItem('ahb.settings',JSON.stringify(settings));toast('Settings saved');render()}
async function ensureUser(){if(user)return user;throw new Error('Silakan login memakai username dan password yang diberikan admin.')}
async function loadAccounts(force=false){if(user?.role!=='admin'||!cloudEnabled||accountsLoading||(!force&&accountsLoaded))return;accountsLoading=true;render();try{adminAccounts=await adminUsers.list();accountsLoaded=true}catch(e){showError(e)}finally{accountsLoading=false;render()}}
async function createAdminUser(){await run(async()=>{if(user?.role!=='admin')throw new Error('Admin only');const username=qv('account-username'),displayName=qv('account-display-name'),password=qv('account-password'),role=(qv('account-role')||'player') as 'admin'|'player';if(!displayName.trim())throw new Error('Nama tampilan wajib diisi.');if(password.length<8)throw new Error('Password minimal 8 karakter.');await adminUsers.create({username,displayName,password,role});accountsLoaded=false;await loadAccounts(true);toast(`Akun @${username} dibuat`)})}
async function resetUserPassword(id:string,name:string){const password=prompt(`Password baru untuk @${name} (minimal 8 karakter):`);if(password===null)return;await run(async()=>{if(password.length<8)throw new Error('Password minimal 8 karakter.');await adminUsers.resetPassword(id,password);toast('Password direset')})}
async function toggleUserActive(id:string,active:boolean){await run(async()=>{await adminUsers.setActive(id,active);accountsLoaded=false;await loadAccounts(true)})}
async function loadAdminClasses(){if(user?.role!=='admin'||adminDataLoading)return;adminDataLoading=true;try{classes=await adminData.classes();classesLoaded=true}catch(e){console.warn(e);classesLoaded=true}finally{adminDataLoading=false;render()}}
async function loadHistory(){if(user?.role!=='admin'||adminDataLoading)return;adminDataLoading=true;try{historyRows=await adminData.history();historyLoaded=true}catch(e){historyLoaded=true;showError(e)}finally{adminDataLoading=false;render()}}
async function loadMastery(){if(!user||adminDataLoading)return;adminDataLoading=true;try{masteryRows=await adminData.mastery();masteryLoaded=true}catch(e){console.warn(e);masteryLoaded=true}finally{adminDataLoading=false;render()}}
async function loadLeaderboard(){if(!user||adminDataLoading)return;adminDataLoading=true;try{[leaderboardRows,arLeaderboardRows]=await Promise.all([adminData.leaderboard('3d',20),adminData.leaderboard('ar',20)]);leaderboardLoaded=true}catch(e){console.warn(e);leaderboardLoaded=true}finally{adminDataLoading=false;render()}}
async function loadVocabularyRows(){if(user?.role!=='admin'||adminDataLoading)return;adminDataLoading=true;try{vocabularyRows=await adminData.vocabulary();vocabularyLoaded=true}catch(e){console.warn(e);vocabularyLoaded=true}finally{adminDataLoading=false;render()}}
async function createClass(){await run(async()=>{await adminData.createClass(qv('class-name'));classes=[];classesLoaded=false;await loadAdminClasses()})}
async function assignClass(){await run(async()=>{const classId=qv('assign-class'),userId=qv('assign-user');if(!classId||!userId)throw new Error('Pilih class dan user.');await adminData.assignClass(classId,userId,true);classes=[];classesLoaded=false;await loadAdminClasses();toast('Student assigned')})}
async function saveVocabulary(){await run(async()=>{await adminData.upsertVocabulary({slug:qv('vocab-slug'),arabic:qv('vocab-arabic'),transliteration:qv('vocab-translit'),meaningId:qv('vocab-idn'),meaningEn:qv('vocab-en'),category:qv('vocab-category'),difficulty:qv('vocab-difficulty'),points:Number(qv('vocab-points')||50)});vocabularyLoaded=false;await loadVocabularyRows();toast('Vocabulary saved to Supabase')})}
async function mapWorldObject(){await run(async()=>{await adminData.mapWorldObject(selectedWorld,qv('map-object'),qv('map-vocab'),true);toast('World mapping saved')})}

async function createRoom(admin:boolean){await run(async()=>{await ensureUser();localMode=null;if(admin&&user?.role!=='admin')throw new Error('Hanya admin yang dapat membuat match.');if(!cloudEnabled){if(admin)throw new Error('Admin realtime membutuhkan Supabase.');startLocal('practice');return}const prefix=admin?'admin-':'create-';const categories=admin?[...root.querySelectorAll<HTMLInputElement>('input[name="admin-category"]:checked')].map(x=>x.value):[];const worldSlug=admin?(qv('admin-world')||'student-room'):selectedWorld;const chosenMode=(admin?(qv('admin-mode')||'3d'):battleMode) as '3d'|'ar';if(chosenMode==='ar'&&!admin&&(!arCapability.secure||!arCapability.webxr||!arCapability.immersiveAr))throw new Error('AR belum siap pada perangkat ini. Jalankan AR Device Check terlebih dahulu.');const opt={gameMode:chosenMode,maxPlayers:Number(qv(`${prefix}players`)||4),targetCount:Number(qv(`${prefix}targets`)||12),durationSeconds:Number(qv(`${prefix}duration`)||180),difficulty:(qv(`${prefix}difficulty`)||'medium') as 'easy'|'medium'|'hard',worldSlug,spectatorHost:admin,categories,classId:admin?(qv('admin-class')||null):null};match=await matches.create(opt);battleMode=chosenMode;localStorage.setItem('ahb.battleMode',battleMode);selectedWorld=worldSlug;saveMatch();useRealtimeHunt();await connectRealtime();if(!admin)void preload3D();go(admin?'admin-lobby':chosenMode==='ar'?'hunt-ar':'lobby')})}
async function joinRoom(){await run(async()=>{await ensureUser();localMode=null;const code=(qv('join-code')||pendingJoinCode).trim();if(!code)throw new Error('Masukkan room code.');match=await matches.join(code);pendingJoinCode='';window.history.replaceState({},'',location.pathname+location.hash);saveMatch();useRealtimeHunt();selectedWorld=match.match.worldSlug;battleMode=match.match.gameMode;localStorage.setItem('ahb.battleMode',battleMode);await connectRealtime();void preload3D();if(match.match.gameMode==='ar'){await checkARSupport(false);if(!arCapability.secure||!arCapability.immersiveAr)throw new Error('Room ini adalah AR Battle, tetapi perangkat tidak mendukung immersive AR/HTTPS.');go('hunt-ar')}else go('lobby')})}
async function toggleReady(){if(!match||!user)return;const me=match.players.find(p=>p.playerId===user!.id);await run(async()=>{if(match!.match.gameMode==='ar'&&!me?.ready&&!arPlaced)throw new Error('Place dan kunci arena AR terlebih dahulu sebelum Ready.');if(!me?.ready)await preload3D();await matches.setReady(match!.match.id,!me?.ready);await refreshMatch(route!=='hunt-ar');if(route==='hunt-ar')updateAROverlay()})}
async function startMatch(){if(!match)return;await run(async()=>{match=await matches.start(match!.match.id);useRealtimeHunt();if(route.startsWith('admin-'))go('admin-live');else if(match!.match.gameMode==='ar'){if(route!=='hunt-ar')go('hunt-ar');else{updateLiveUI();updateAROverlay();startClock()}}else go('hunt3d')})}
async function pauseMatch(paused:boolean){if(!match)return;await run(async()=>{await matches.pause(match!.match.id,paused);await refreshMatch(false);syncSceneState();if(route==='admin-live')render()})}
async function endMatch(){if(!match||!confirm('Akhiri pertandingan sekarang?'))return;await run(async()=>{await matches.end(match!.match.id);await refreshMatch(false);playSfx('end');if(route==='admin-live')render()})}
async function rematch(){if(!match)return;await run(async()=>{const old=match!;match=await matches.create({gameMode:old.match.gameMode,maxPlayers:old.match.maxPlayers,targetCount:old.match.targetCount,durationSeconds:old.match.durationSeconds,difficulty:old.match.difficulty as any,worldSlug:old.match.worldSlug,spectatorHost:user?.role==='admin',categories:old.match.targetCategories||undefined,classId:old.match.classId});saveMatch();useRealtimeHunt();await connectRealtime();go(user?.role==='admin'?'admin-lobby':'lobby')})}

async function connectRealtime(){if(!match||!user||!cloudEnabled)return;clearTimeout(reconnectTimer);connectionStatus='connecting';renderSoft();await realtime.join(match.match.id,{id:user.id,name:user.name},{status:s=>{connectionStatus=s.toLowerCase();renderSoft();syncSceneState();if(connectionStatus==='subscribed'){reconnectAttempts=0;clearTimeout(reconnectTimer)}else if(/error|timed|closed/.test(connectionStatus))scheduleRealtimeReconnect()},presence:state=>{presence=state;applyPresence();if(['lobby','admin-lobby','admin-players'].includes(route))scheduleRefresh(true)},event:(event,payload)=>handleRoomEvent(event,payload)})}

function scheduleRealtimeReconnect(){
  if(!match||!user||!cloudEnabled||!navigator.onLine)return;
  clearTimeout(reconnectTimer);
  const delay=Math.min(8000,1000*Math.pow(2,Math.min(reconnectAttempts,3)));
  reconnectTimer=window.setTimeout(()=>{
    if(!match||!user||!navigator.onLine)return;
    reconnectAttempts++;
    void connectRealtime().then(()=>{reconnectAttempts=0;void refreshMatch(false)}).catch(()=>scheduleRealtimeReconnect());
  },delay);
}
function applyPresence(){if(!match)return;const online=new Set(Object.keys(presence));match.players.forEach(p=>p.connected=online.has(p.playerId))}
function handleRoomEvent(event:RoomEvent,payload:any){
  if(event==='PLAYER_POSE'){if(payload?.player_id){poses.set(payload.player_id,payload);updateAdminPoses();updateAdminSpectator()};return}
  if(event==='MATCH_START'){void refreshMatch(false).then(()=>{if(!match||!['countdown','running'].includes(match.match.status))return;if(route==='admin-lobby')go('admin-live');else if(match.match.gameMode==='ar'){if(route!=='hunt-ar')go('hunt-ar');else updateAROverlay()}else if(route==='lobby')go('hunt3d')});return}
  if(event==='MATCH_PAUSE'||event==='MATCH_RESUME'){void refreshMatch(false).then(()=>{syncSceneState();if(route==='admin-live')render();else updateLiveUI()});return}
  if(event==='MATCH_END'){void refreshMatch(false).then(()=>{playSfx('end');if(!route.startsWith('admin-'))go('result');else render()});return}
  if(['TARGET_CLAIMED','CLAIM_REJECTED','SCORE_UPDATE'].includes(event)){scheduleRefresh(false);return}
  scheduleRefresh(!['hunt3d','hunt-ar','admin-live','admin-projector'].includes(route));
}
function scheduleRefresh(rerender:boolean){clearTimeout(refreshTimer);refreshTimer=window.setTimeout(()=>refreshMatch(rerender),120)}
async function refreshMatch(rerender=false){if(!match)return;try{match=await matches.snapshot(match.match.id);applyPresence();useRealtimeHunt();if(rerender&&!['hunt3d','hunt-ar','admin-live','admin-projector'].includes(route))render();else updateLiveUI();syncSceneState()}catch(e){console.warn('snapshot refresh failed',e)}}
function renderSoft(){const bad=/offline|error|timed|closed|connecting/.test(connectionStatus);const badge=root.querySelector('.cloud-badge');if(badge)badge.innerHTML=`<i class="bi bi-${bad?'wifi-off':'broadcast-pin'}"></i> ${cloudEnabled?'Realtime Cloud':'Demo Lokal'} · ${escapeHtml(connectionStatus)}`;const overlay=root.querySelector<HTMLElement>('#connection-overlay');if(overlay)overlay.style.display=bad?'flex':'none'}

async function mountScene(ar:boolean){
  const token=++sceneLoadToken,canvas=root.querySelector<HTMLCanvasElement>('#pc-canvas');
  if(!canvas)return;
  try{
    const mod=await preload3D();
    if(token!==sceneLoadToken||!document.body.contains(canvas))return;
    scene=new mod.PlayCanvasScene(canvas,{quality:(ar?'low':settings.quality) as SceneQuality});
    const world=getWorld(match?.match.worldSlug||selectedWorld);
    scene.loadWorld(world,(pct,label)=>updateLoading(pct,label));
    if(ar){
      scene.setWorldScale(.1);
      scene.setARMode(true);
      const xrMod=await preloadXR();
      if(token!==sceneLoadToken||!scene)return;
      xr=new xrMod.XRManager(scene);
      xr.onStatus=()=>{const wasActive=arSessionActive;arSessionActive=!!xr?.isActive?.();arPlaced=!!xr?.isPlaced?.();if(wasActive&&!arSessionActive&&match?.match.status==='waiting'&&user){const me=match.players.find(p=>p.playerId===user!.id);if(me?.ready)void matches.setReady(match.match.id,false).then(()=>refreshMatch(false)).catch(()=>{})}updateAROverlay()};
      xr.onPose=pose=>{if(match&&user&&match.match.status==='running')void realtime.sendPose({match_id:match.match.id,player_id:user.id,...pose},true)};
    }
    scene.onPose=pose=>{
      if(match&&user&&route==='hunt3d'&&match.match.status==='running')void realtime.sendPose({match_id:match.match.id,player_id:user.id,...pose},true)
    };
    if(match&&user&&!ar)void realtime.sendPose({match_id:match.match.id,player_id:user.id,...scene.getPose()},false);
    scene.onPick=async p=>{
      if(claimBusy||match?.match.status==='paused'){if(match?.match.status==='paused')showGameFeedback('Game sedang di-pause admin.',false);return}
      if(ar&&(!arSessionActive||!arPlaced)){showGameFeedback('Aktifkan AR dan Place arena terlebih dahulu.',false);return}
      if(!match){
        const r=localHunt.claim(p.objectId);scene?.highlight(p.objectId,r.ok);playSfx(r.ok?'correct':'wrong');showGameFeedback(r.ok?'✓ Benar! Target ditemukan.':'Bukan target. -15 poin.',r.ok);updateLiveUI();claimBusy=true;window.setTimeout(()=>claimBusy=false,r.ok?250:800);if(localHunt.ended)setTimeout(()=>go('result'),450);return
      }
      if(!['running','countdown'].includes(match.match.status)){showGameFeedback(match.match.status==='waiting'?'Tunggu semua pemain Ready dan admin memulai match.':'Pertandingan belum berjalan.',false);return}
      claimBusy=true;
      try{
        const result=await matches.claim(match.match.id,p.objectId);
        scene?.highlight(p.objectId,result.ok);playSfx(result.ok?'correct':'wrong');showGameFeedback(claimMessage(result.reason,result.pointsAwarded),result.ok);
        const pose=ar?scene!.getVirtualPose():scene!.getPose();
        await realtime.sendPose({match_id:match.match.id,player_id:user?.id,...pose,lookingAt:p.objectId},true);
        await refreshMatch(false);
        if(result.matchEnded)setTimeout(()=>go('result'),350);
        window.setTimeout(()=>claimBusy=false,result.ok?250:800)
      }catch(e){claimBusy=false;showError(e)}
    };
    syncSceneState();updateLiveUI();startClock();if(ar)updateAROverlay()
  }catch(e){showGameFeedback(ar?'AR world gagal dimuat. Coba refresh dan pastikan HTTPS/WebXR tersedia.':'Dunia 3D gagal dimuat. Coba refresh.',false);showError(e)}
}
async function mountAdminSpectator(){const token=++sceneLoadToken,canvas=root.querySelector<HTMLCanvasElement>('#admin-pc-canvas');if(!canvas||!match)return;try{const mod=await preload3D();if(token!==sceneLoadToken)return;scene=new mod.PlayCanvasScene(canvas,{quality:'low',spectator:true});scene.loadWorld(getWorld(match.match.worldSlug),(pct)=>{const el=root.querySelector<HTMLElement>('#admin-scene-loading');if(el){el.textContent=`Loading spectator ${pct}%`;if(pct>=100)el.style.display='none'}});scene.overview();updateAdminSpectator()}catch(e){showError(e)}}
function syncSceneState(){const paused=match?.match.status==='paused',connectionBad=/offline|error|timed|closed|connecting/.test(connectionStatus);scene?.setInputEnabled(!(paused||connectionBad));const po=root.querySelector<HTMLElement>('#pause-overlay');if(po)po.style.display=paused?'flex':'none';renderSoft();if(route==='hunt-ar')updateAROverlay()}
function updateLoading(pct:number,label:string){const b=root.querySelector<HTMLElement>('#scene-loading-bar'),l=root.querySelector<HTMLElement>('#scene-loading-label'),wrap=root.querySelector<HTMLElement>('#scene-loading');if(b)b.style.width=`${pct}%`;if(l)l.textContent=`${label} · ${pct}%`;if(wrap&&pct>=100)window.setTimeout(()=>wrap.classList.add('hidden'),120)}
function claimMessage(reason:string,points:number){if(reason==='accepted')return `✓ Benar! +${points} poin`;if(reason==='already_claimed')return 'Target sudah diklaim pemain lain.';if(reason==='wrong')return 'Bukan target yang tersedia. -15 poin';if(reason==='not_running')return 'Pertandingan belum berjalan.';if(reason==='ended')return 'Pertandingan sudah selesai.';return reason||'Pilihan diproses.'}
function showGameFeedback(message:string,good:boolean){const el=root.querySelector<HTMLElement>('#claim-feedback');if(!el)return;el.textContent=message;el.className=`claim-feedback show ${good?'good':'bad'}`;window.setTimeout(()=>el.classList.remove('show'),1400)}
function startClock(){clearInterval(timerHandle);updateTime();timerHandle=window.setInterval(updateTime,250)}
function updateTime(){const ms=hunt.timeLeft(),txt=fmt(ms);root.querySelectorAll('#time-left,#admin-time').forEach(el=>el.textContent=txt);const overlay=root.querySelector<HTMLElement>('#countdown-overlay');if(match&&overlay&&match.match.startedAt){const now=Date.now()+realtimeHunt.serverOffsetMs,left=Date.parse(match.match.startedAt)-now;if(left>0){overlay.style.display='flex';overlay.textContent=String(Math.ceil(left/1000))}else overlay.style.display='none'}if(match&&ms<=0&&!finishing&&match.match.status!=='ended'&&match.match.status!=='paused'){finishing=true;matches.finishIfDue(match.match.id).catch(()=>{}).finally(()=>setTimeout(()=>finishing=false,1200))}const perf=root.querySelector<HTMLElement>('#perf-indicator');if(perf&&scene){const s=scene.getStats();perf.textContent=`FPS ${s.fps} · ${s.objects} obj · ${s.quality} · ${connectionStatus}`;}updateAdminSpectatorLabels()}
function updateLiveUI(){const score=root.querySelector('#score-value');if(score)score.textContent=String(hunt.score.score);const mini=root.querySelector('#mini-score');if(mini)mini.textContent=String(hunt.score.score);const claimed=hunt.targets.filter(t=>!!t.claimedBy).length,pr=root.querySelector('#target-progress');if(pr)pr.textContent=`${claimed}/${hunt.targets.length} selesai`;hunt.targets.forEach(t=>{const chip=root.querySelector<HTMLElement>(`.target-chip[data-object="${cssEscape(t.objectId)}"]`);if(chip){chip.classList.toggle('claimed',!!t.claimedBy);const i=chip.querySelector('i');if(i)i.textContent=t.claimedBy?'✓':'○'}});updateHuntCommand();const strip=root.querySelector('.score-strip');if(strip&&match)strip.innerHTML=[...match.players].filter(p=>p.role!=='spectator').sort((a,b)=>b.score-a.score).slice(0,4).map((p,i)=>`<span>${i===0?'👑':i+1} ${escapeHtml(p.displayName)} <b>${p.score}</b></span>`).join('');if(match){const scores=root.querySelector('#admin-live-scores');if(scores)scores.innerHTML=[...match.players].filter(p=>p.role!=='spectator').sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="score-row"><span>${i===0?'👑':i+1} ${escapeHtml(p.displayName)} <small>${p.connected?'● online':'○ offline'}</small></span><b>${p.score}</b></div>`).join('');const feed=root.querySelector('#admin-live-feed');if(feed)feed.innerHTML=match.activity.slice(0,10).map(a=>`<div class="feed-row ${a.correct?'good':'bad'}"><i class="bi bi-${a.correct?'check-circle-fill':'x-circle-fill'}"></i> <b>${escapeHtml(a.displayName)}</b> ${a.correct?`found <span dir="rtl">${escapeHtml(a.arabic||a.objectId)}</span>`:`wrong tap · ${escapeHtml(a.objectId)}`} <strong>${a.points>0?'+':''}${a.points}</strong></div>`).join('')||'No activity yet';}if(route==='hunt-ar')updateAROverlay();if(match?.match.status==='ended'&&!route.startsWith('admin-')&&(route==='hunt3d'||route==='hunt-ar'))go('result')}
function updateHuntCommand(){const el=root.querySelector<HTMLElement>('#hunt-command');if(!el)return;const open=hunt.targets.filter(t=>!t.claimedBy);if(!open.length){el.innerHTML='<div class="command-done">✓ Semua target sudah ditemukan</div>';return}const difficulty=match?.match.difficulty||'easy';el.innerHTML=`<div class="command-label"><i class="bi bi-search"></i> CARI SALAH SATU TARGET</div><div class="command-targets">${open.slice(0,3).map((t:any,i:number)=>{const v=VOCAB[t.vocabId],mt=match?.targets.find(x=>x.objectId===t.objectId);const ar=v?.arabic||mt?.arabic||t.vocabId,meaning=v?.idn||mt?.meaningId||'';return `<div class="command-target ${i===0?'focus':''}"><b dir="rtl">${escapeHtml(ar)}</b>${difficulty==='easy'&&settings.translation?`<span>${escapeHtml(meaning)}</span>`:''}${difficulty==='medium'&&v?`<button class="mini-speak" data-speak="${escapeHtml(t.vocabId)}"><i class="bi bi-volume-up"></i></button>`:''}</div>`}).join('')}</div><small>${open.length} target tersedia · boleh pilih bebas</small>`;root.querySelectorAll<HTMLElement>('[data-speak]').forEach(x=>x.onclick=e=>{e.stopPropagation();speak(x.dataset.speak!)})}
function updateAdminPoses(){const layer=root.querySelector<HTMLElement>('#admin-pose-layer');if(!layer||!match)return;layer.innerHTML='';match.players.filter(p=>p.role!=='spectator').forEach((p,i)=>{const pose=poses.get(p.playerId);if(!pose)return;const x=clamp(50+(pose.position?.[0]||0)*5,5,95),y=clamp(50+(pose.position?.[2]||0)*5,5,95),n=document.createElement('i');n.className='p live-pose';n.style.left=`${x}%`;n.style.top=`${y}%`;n.style.background=palette[i%palette.length];n.textContent=initial(p.displayName);n.title=`${p.displayName}${pose.lookingAt?' → '+pose.lookingAt:''}`;layer.appendChild(n)})}
function updateAdminSpectator(){if(!scene||!match||route!=='admin-live'||adminView!=='3d')return;match.players.filter(p=>p.role!=='spectator').forEach((p,i)=>{const pose=poses.get(p.playerId);if(pose?.position)scene!.setRemotePlayer(p.playerId,pose.position,palette[i%palette.length])});updateAdminSpectatorLabels()}
function updateAdminSpectatorLabels(){const layer=root.querySelector<HTMLElement>('#admin-3d-labels');if(!layer||!scene||!match)return;layer.innerHTML='';match.players.filter(p=>p.role!=='spectator').forEach((p,i)=>{const pose=poses.get(p.playerId);if(!pose?.position)return;const xy=scene!.projectWorld(pose.position);if(!xy||!xy.visible)return;const d=document.createElement('div');d.className='spectator-label';d.style.left=`${xy.x}px`;d.style.top=`${xy.y}px`;d.style.borderColor=palette[i%palette.length];d.innerHTML=`<b>${escapeHtml(p.displayName)}</b><small>${pose.lookingAt?`→ ${escapeHtml(pose.lookingAt)}`:'viewing room'}</small>`;layer.appendChild(d)})}

async function renderRoomQR(){if(!match)return;const img=root.querySelector<HTMLImageElement>('#room-qr');if(!img)return;const url=`${location.origin}${location.pathname}?join=${encodeURIComponent(match.match.roomCode)}`;img.src=`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=6&data=${encodeURIComponent(url)}`;img.onerror=()=>{img.style.display='none';console.warn('QR service unavailable; room code remains available.')}}
async function checkARSupport(showToast=false){
  const nav:any=navigator;
  const secure=window.isSecureContext;
  const webxr=!!nav.xr;
  let immersiveAr=false;
  try{if(webxr&&nav.xr.isSessionSupported)immersiveAr=!!(await nav.xr.isSessionSupported('immersive-ar'))}catch{immersiveAr=false}
  arCapability={...arCapability,checked:true,secure,webxr,immersiveAr};
  if(route==='ar-check'){
    const secureEl=root.querySelector<HTMLElement>('[data-ar-check="secure"]'),webxrEl=root.querySelector<HTMLElement>('[data-ar-check="webxr"]'),arEl=root.querySelector<HTMLElement>('[data-ar-check="ar"]');
    setCheckRow(secureEl,secure);setCheckRow(webxrEl,webxr);setCheckRow(arEl,immersiveAr);
    const btn=root.querySelector<HTMLButtonElement>('[data-action="continue-ar-worlds"]');if(btn)btn.disabled=!(secure&&webxr&&immersiveAr);
    const note=root.querySelector<HTMLElement>('#ar-check-note');if(note)note.textContent=secure&&immersiveAr?'Perangkat siap. Hit Test akan diverifikasi ketika sesi AR dimulai.':'AR membutuhkan HTTPS dan perangkat/browser yang mendukung immersive-ar.';
  }
  if(showToast)toast(secure&&immersiveAr?'AR device check: ready':'AR device check: unavailable');
}
function setCheckRow(el:HTMLElement|null,ok:boolean){if(!el)return;el.classList.toggle('ok',ok);el.classList.toggle('bad',!ok);const s=el.querySelector('span');if(s)s.textContent=ok?'✓':'×';const em=el.querySelector('em');if(em)em.textContent=ok?'Ready':'Unavailable'}
async function startARSession(){
  if(route!=='hunt-ar')return;
  try{
    if(!scene||!xr)throw new Error('AR world belum siap. Tunggu loading selesai lalu coba lagi.');
    await xr.enterAR(()=>{arSessionActive=true;const m=root.querySelector('#ar-message');if(m)m.textContent='Gerakkan HP perlahan hingga reticle muncul di meja/lantai.';updateAROverlay()});
    const st=xr.status();arCapability={checked:true,secure:window.isSecureContext,webxr:st.webxr,immersiveAr:st.ar,hitTest:st.hitTest,anchors:st.anchors,domOverlay:st.domOverlay};
    arSessionActive=true;updateAROverlay()
  }catch(e){arSessionActive=false;showError(e);updateAROverlay()}
}
function updateAROverlay(){
  if(route!=='hunt-ar')return;
  const overlay=root.querySelector<HTMLElement>('#ar-setup-overlay');if(!overlay)return;
  const status=xr?.status?.();arSessionActive=!!status?.active;arPlaced=!!status?.placed;
  const me=match?.players.find(p=>p.playerId===user?.id),players=(match?.players||[]).filter(p=>p.role!=='spectator'),allReady=players.length>=2&&players.every(p=>p.ready),isHost=me?.role==='host';
  const waiting=match?.match.status==='waiting';
  const showSetup=!arSessionActive||!arPlaced||waiting;
  overlay.style.display=showSetup?'flex':'none';
  const stepSession=root.querySelector<HTMLElement>('#ar-step-session'),stepPlace=root.querySelector<HTMLElement>('#ar-step-place'),stepReady=root.querySelector<HTMLElement>('#ar-step-ready');
  stepSession?.classList.toggle('done',arSessionActive);stepPlace?.classList.toggle('done',arPlaced);stepReady?.classList.toggle('done',!!me?.ready);
  const startBtn=root.querySelector<HTMLButtonElement>('[data-action="start-ar-session"]');if(startBtn){startBtn.style.display=arSessionActive?'none':'inline-flex'}
  root.querySelectorAll<HTMLElement>('[data-ar-placement-control]').forEach(el=>el.style.display=arSessionActive?'inline-flex':'none');
  const readyBtn=root.querySelector<HTMLButtonElement>('[data-action="toggle-ar-ready"]');if(readyBtn){readyBtn.style.display=waiting&&arPlaced?'inline-flex':'none';readyBtn.disabled=!arPlaced;readyBtn.innerHTML=me?.ready?'<i class="bi bi-x-circle"></i> Not Ready':'<i class="bi bi-check-circle"></i> Ready'}
  const startMatchBtn=root.querySelector<HTMLButtonElement>('[data-action="start-ar-match"]');if(startMatchBtn){startMatchBtn.style.display=waiting&&isHost?'inline-flex':'none';startMatchBtn.disabled=!allReady}
  const wait=root.querySelector<HTMLElement>('#ar-waiting-text');if(wait){wait.textContent=waiting?(me?.ready?'Ready. Menunggu admin/host memulai pertandingan.':'Place arena lalu tekan Ready.'):(match?.match.status==='countdown'?'Pertandingan segera dimulai…':'')}
  const msg=root.querySelector<HTMLElement>('#ar-message');if(msg){if(!arSessionActive)msg.textContent='Tekan Start AR untuk membuka kamera.';else if(!arPlaced)msg.textContent='Arahkan ke meja/lantai sampai reticle muncul, lalu Place.';else if(waiting)msg.textContent='Arena terkunci. Anda dapat memutar arena, lalu Ready.';else msg.textContent='AR Battle aktif — cari target pada miniatur world.'}
  const anchor=root.querySelector<HTMLElement>('#ar-anchor-state');if(anchor)anchor.textContent=status?.anchorActive?'Anchored':'Hit-test placement';
}
function speak(id:string){const v=VOCAB[id];if(!v||!('speechSynthesis'in window))return;const u=new SpeechSynthesisUtterance(v.arabic);u.lang='ar-SA';speechSynthesis.cancel();speechSynthesis.speak(u)}
function playSfx(type:'correct'|'wrong'|'end'){if(!settings.sound)return;try{const Ctx=(window.AudioContext||(window as any).webkitAudioContext),ctx=new Ctx(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=type==='correct'?740:type==='wrong'?180:520;gain.gain.setValueAtTime(.08,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+(type==='end'?.45:.16));osc.start();osc.stop(ctx.currentTime+(type==='end'?.45:.16))}catch{}}
async function leaveMatch(){destroyScene();clearTimeout(reconnectTimer);reconnectAttempts=0;match=null;saveMatch();poses.clear();hunt=localHunt;await realtime.leave()}
async function run(fn:()=>Promise<void>){try{await fn()}catch(e){showError(e)}}
function showError(e:any){let msg=(e?.message||String(e)).replace(/^.*?: /,'');console.error(e);const map:Record<string,string>={ROOM_NOT_FOUND:'Room tidak ditemukan.',ROOM_FULL:'Room sudah penuh.',MATCH_ALREADY_STARTED:'Match sudah dimulai.',NOT_IN_MATCH_CLASS:'Akun ini belum terdaftar pada kelas yang dipilih admin.',ALL_PLAYERS_MUST_BE_READY:'Semua pemain harus Ready.',NEED_AT_LEAST_2_PLAYERS:'Minimal 2 pemain diperlukan.',NO_TARGETS_FOR_FILTER:'Tidak ada target yang cocok dengan kategori dan difficulty tersebut.',INVALID_STATUS:'Aksi tidak tersedia pada status match saat ini.',HOST_ONLY:'Aksi ini hanya dapat dilakukan host/admin.'};for(const [k,v] of Object.entries(map))if(msg.includes(k)){msg=v;break}alert(msg)}
function toast(msg:string){const t=document.createElement('div');t.className='app-toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.classList.add('show'),10);setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),200)},1700)}
function qv(id:string){return root.querySelector<HTMLInputElement|HTMLSelectElement>(`#${id}`)?.value||''}
function fmt(ms:number){const m=Math.max(0,Math.floor(ms/60000)),s=Math.max(0,Math.floor((ms%60000)/1000));return `${m}:${String(s).padStart(2,'0')}`}
function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}
function cssEscape(s:string){return CSS.escape(s)}
function escapeHtml(s:string){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!))}
function initial(s:string){return (s.trim()[0]||'P').toUpperCase()}

window.addEventListener('hashchange',()=>{const h=location.hash.slice(1) as Route;if(h&&h!==route){route=h;render()}});
window.addEventListener('online',()=>{connectionStatus='network-online';if(match&&user)connectRealtime().catch(()=>{});renderSoft()});
window.addEventListener('offline',()=>{connectionStatus='offline';renderSoft();syncSceneState()});
window.addEventListener('beforeunload',destroyScene);
if(import.meta.env.PROD&&'serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));

async function bootstrap(){
  if(cloudEnabled){try{user=await auth.restore();if(user){if(route.startsWith('admin-')&&user.role!=='admin')route='home';const id=localStorage.getItem('ahb.activeMatchId');if(id){match=await matches.snapshot(id);useRealtimeHunt();selectedWorld=match.match.worldSlug;await connectRealtime();void preload3D();if(['running','countdown','paused','ended'].includes(match.match.status)){if(user.role==='admin'&&route.startsWith('admin-'))route=route==='admin-projector'?'admin-projector':'admin-live';else route=match.match.status==='ended'?'result':match.match.gameMode==='ar'?'hunt-ar':'hunt3d'}else if(match.match.status==='waiting')route=user.role==='admin'&&route.startsWith('admin-')?'admin-lobby':match.match.gameMode==='ar'?'hunt-ar':'lobby'}else if(route==='splash')route=pendingJoinCode&&user.role!=='admin'?'room':user.role==='admin'?'admin-dashboard':'home'}else route='splash'}catch(e){console.warn('restore failed',e);localStorage.removeItem('ahb.activeMatchId');user=null;route='splash'}}else route='splash';render()}
bootstrap();
