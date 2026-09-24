import * as pc from 'playcanvas';
import type { WorldConfig, SceneObjectDef } from '../worlds/types';

export interface ScenePick { objectId:string; vocabId?:string; name:string; }
export type SceneQuality='low'|'medium'|'high'|'auto';
type InteractiveEntry={entity:any;def:SceneObjectDef};
type RemoteEntry={entity:any;color:string};

export class PlayCanvasScene {
  app:any; canvas:HTMLCanvasElement; camera:any; cameraRig:any; worldRoot:any;
  interactive=new Map<string,InteractiveEntry>();
  remotePlayers=new Map<string,RemoteEntry>();
  private yaw=35; private pitch=-28; private dist=8.3; private target=new pc.Vec3(0,.8,0);
  private pointerDown=false; private lastX=0; private lastY=0; private moved=0; private pinchDist=0;
  private destroyed=false; private loadGeneration=0; private decorativeMaterials=new Map<string,any>();
  private mobile=false; private inputEnabled=true; private spectator=false; private arMode=false; private followedPlayer:string|null=null;
  private fps=60; private fpsAccum=0; private fpsFrames=0; private fpsLast=performance.now();
  private quality:Exclude<SceneQuality,'auto'>='medium';
  onPick:(p:ScenePick)=>void=()=>{};
  onPose:(pose:{position:[number,number,number];yaw:number;pitch:number;lookingAt?:string})=>void=()=>{};

  private onPointerDown=(e:PointerEvent)=>{if(!this.inputEnabled)return;try{this.canvas.setPointerCapture(e.pointerId)}catch{};this.pointerDown=true;this.lastX=e.clientX;this.lastY=e.clientY;this.moved=0};
  private onPointerMove=(e:PointerEvent)=>{if(!this.inputEnabled||!this.pointerDown)return;const dx=e.clientX-this.lastX,dy=e.clientY-this.lastY;this.moved+=Math.abs(dx)+Math.abs(dy);this.lastX=e.clientX;this.lastY=e.clientY;if(this.arMode)return;this.yaw-=dx*.28;this.pitch=Math.max(-78,Math.min(-8,this.pitch-dy*.22));this.followedPlayer=null;this.updateCamera()};
  private onPointerUp=(e:PointerEvent)=>{if(!this.inputEnabled)return;this.pointerDown=false;if(this.moved<12&&!this.spectator)this.pick(e.clientX,e.clientY)};
  private onWheel=(e:WheelEvent)=>{if(!this.inputEnabled||this.arMode)return;e.preventDefault();this.dist=Math.max(3.8,Math.min(14,this.dist+e.deltaY*.008));this.followedPlayer=null;this.updateCamera()};
  private onTouchMove=(e:TouchEvent)=>{if(!this.inputEnabled||this.arMode)return;if(e.touches.length===2){const a=e.touches[0],b=e.touches[1];const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);if(this.pinchDist){this.dist=Math.max(3.8,Math.min(14,this.dist-(d-this.pinchDist)*.015));this.updateCamera()}this.pinchDist=d}};
  private onTouchEnd=()=>{this.pinchDist=0};
  private onResize=()=>{if(!this.destroyed)this.app?.resizeCanvas?.()};

  constructor(canvas:HTMLCanvasElement,opts:{quality?:SceneQuality;spectator?:boolean}={}){
    this.canvas=canvas;this.spectator=!!opts.spectator;
    this.mobile=window.matchMedia?.('(pointer: coarse)').matches||window.innerWidth<820;
    this.quality=this.resolveQuality(opts.quality||'auto');
    const antialias=this.quality==='high'&&!this.mobile;
    this.app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias,alpha:true,powerPreference:'high-performance'}});
    if(this.app.graphicsDevice){const limit=this.quality==='low'?1:this.quality==='medium'?1.25:1.6;this.app.graphicsDevice.maxPixelRatio=Math.min(window.devicePixelRatio||1,limit)}
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.scene.ambientLight=new pc.Color(.5,.52,.55);this.app.start();this.buildBase();this.bindInput();
    this.app.on('update',(dt:number)=>this.tick(dt));
  }

  private resolveQuality(q:SceneQuality):Exclude<SceneQuality,'auto'>{if(q!=='auto')return q;if(this.mobile){const mem=(navigator as any).deviceMemory||4;return mem<=4?'low':'medium'}return 'high'}
  private buildBase(){
    this.cameraRig=new pc.Entity('CameraRig');this.app.root.addChild(this.cameraRig);
    this.camera=new pc.Entity('Camera');this.camera.addComponent('camera',{clearColor:new pc.Color(.035,.08,.15,1),fov:this.spectator?52:48,nearClip:.05,farClip:80});this.cameraRig.addChild(this.camera);
    const sun=new pc.Entity('Sun');sun.addComponent('light',{type:'directional',color:new pc.Color(1,.94,.82),intensity:this.quality==='low'?1.05:1.3,castShadows:false});sun.setEulerAngles(42,-35,0);this.app.root.addChild(sun);
    if(this.quality==='high'&&!this.mobile){const fill=new pc.Entity('Fill');fill.addComponent('light',{type:'omni',color:new pc.Color(.35,.62,1),intensity:.3,range:10,castShadows:false});fill.setPosition(-3,4,4);this.app.root.addChild(fill)}
    this.worldRoot=new pc.Entity('WorldRoot');this.app.root.addChild(this.worldRoot);this.updateCamera();
  }
  private tick(dt:number){
    this.fpsAccum+=dt;this.fpsFrames++;const now=performance.now();if(now-this.fpsLast>650){this.fps=Math.round(this.fpsFrames/Math.max(.001,this.fpsAccum));this.fpsFrames=0;this.fpsAccum=0;this.fpsLast=now}
    if(this.followedPlayer){const r=this.remotePlayers.get(this.followedPlayer);if(r&&!r.entity.destroyed){const p=r.entity.getPosition();this.target.lerp(this.target,new pc.Vec3(p.x,Math.max(.6,p.y),p.z),.12);this.updateCamera(false)}}
  }

  loadWorld(world:WorldConfig,onProgress:(percent:number,label:string)=>void=()=>{}){
    if(this.destroyed)return;const generation=++this.loadGeneration;
    try{this.worldRoot?.destroy?.()}catch{}
    this.worldRoot=new pc.Entity('WorldRoot');this.app.root.addChild(this.worldRoot);this.interactive.clear();this.remotePlayers.clear();this.decorativeMaterials.clear();
    const essential=world.objects.filter(def=>def.interactive||isStructural(def.id));const decorative=world.objects.filter(def=>!def.interactive&&!isStructural(def.id));
    const total=Math.max(1,world.objects.length);let done=0;
    onProgress(4,'Menyiapkan dunia');
    essential.forEach(def=>{this.addObject(def);done++;onProgress(Math.min(72,Math.round(done/total*100)),'Memuat objek penting')});
    const batchSize=this.quality==='low'?12:8;
    const addBatch=(offset:number)=>{if(this.destroyed||generation!==this.loadGeneration)return;decorative.slice(offset,offset+batchSize).forEach(def=>{this.addObject(def);done++});onProgress(Math.min(100,Math.round(done/total*100)),done>=total?'Siap dimainkan':'Menambahkan dekorasi');if(offset+batchSize<decorative.length)window.setTimeout(()=>addBatch(offset+batchSize),this.quality==='low'?0:12)};
    if(decorative.length)window.setTimeout(()=>addBatch(0),0);else onProgress(100,'Siap dimainkan');
  }
  private addObject(def:SceneObjectDef){if(this.destroyed||def.hidden)return;const e=new pc.Entity(def.name);e.addComponent('render',{type:def.shape});e.setLocalPosition(...def.pos);e.setLocalScale(...def.scale);if(def.rotation)e.setLocalEulerAngles(...def.rotation);const material=def.interactive?this.createMaterial(def):this.getDecorativeMaterial(def);e.render.material=material;this.worldRoot.addChild(e);if(def.interactive)this.interactive.set(def.id,{entity:e,def})}
  private createMaterial(def:SceneObjectDef){const m=new pc.StandardMaterial();const c=hex(def.color);m.diffuse=new pc.Color(c[0],c[1],c[2]);if(def.emissive&&this.quality!=='low'){const ec=hex(def.emissive);m.emissive=new pc.Color(ec[0],ec[1],ec[2]);m.emissiveIntensity=1.05}if(def.opacity!==undefined){m.opacity=def.opacity;m.blendType=pc.BLEND_NORMAL;m.depthWrite=def.opacity>.8}m.metalness=.01;m.gloss=this.quality==='low'?.15:.28;m.update();return m}
  private getDecorativeMaterial(def:SceneObjectDef){const key=[def.color,def.emissive||'',def.opacity??1].join('|');const cached=this.decorativeMaterials.get(key);if(cached)return cached;const m=this.createMaterial(def);this.decorativeMaterials.set(key,m);return m}
  private bindInput(){this.canvas.addEventListener('pointerdown',this.onPointerDown);this.canvas.addEventListener('pointermove',this.onPointerMove);this.canvas.addEventListener('pointerup',this.onPointerUp);this.canvas.addEventListener('pointercancel',this.onPointerUp);this.canvas.addEventListener('wheel',this.onWheel,{passive:false});this.canvas.addEventListener('touchmove',this.onTouchMove,{passive:true});this.canvas.addEventListener('touchend',this.onTouchEnd);window.addEventListener('resize',this.onResize)}
  private updateCamera(emit=true){if(this.destroyed||!this.camera)return;const yr=this.yaw*Math.PI/180,pr=this.pitch*Math.PI/180,cp=Math.cos(pr);const x=this.target.x+this.dist*cp*Math.sin(yr),y=this.target.y-this.dist*Math.sin(pr),z=this.target.z+this.dist*cp*Math.cos(yr);this.camera.setPosition(x,y,z);this.camera.lookAt(this.target);if(emit&&!this.spectator)this.onPose({position:[x,y,z],yaw:this.yaw,pitch:this.pitch})}
  getPose(){const p=this.camera.getPosition();return {position:[p.x,p.y,p.z] as [number,number,number],yaw:this.yaw,pitch:this.pitch}}
  getVirtualPose(){
    const p=this.camera.getPosition();
    try{
      const inv=this.worldRoot.getWorldTransform().clone().invert();
      const local=inv.transformPoint(p,new pc.Vec3());
      return {position:[local.x,local.y,local.z] as [number,number,number],yaw:this.yaw,pitch:this.pitch};
    }catch{return this.getPose()}
  }
  setARMode(active:boolean){this.arMode=active;this.setARVisual(active);if(active){this.pointerDown=false;this.pinchDist=0}}
  setInputEnabled(enabled:boolean){this.inputEnabled=enabled;if(!enabled){this.pointerDown=false;this.pinchDist=0}}
  isInputEnabled(){return this.inputEnabled}
  setSpectator(enabled:boolean){this.spectator=enabled}
  overview(){this.followedPlayer=null;this.target.set(0,.75,0);this.yaw=28;this.pitch=-42;this.dist=9.6;this.updateCamera(false)}
  topOverview(){this.followedPlayer=null;this.target.set(0,0,0);this.yaw=0;this.pitch=-76;this.dist=9.8;this.updateCamera(false)}
  followPlayer(playerId:string|null){this.followedPlayer=playerId;if(playerId)this.dist=5.6}
  setRemotePlayer(playerId:string,position:[number,number,number],color='#2676ff'){
    let r=this.remotePlayers.get(playerId);if(!r){const e=new pc.Entity(`Remote-${playerId}`);e.addComponent('render',{type:'sphere'});e.setLocalScale(.26,.26,.26);const m=new pc.StandardMaterial(),c=hex(color);m.diffuse=new pc.Color(c[0],c[1],c[2]);m.emissive=new pc.Color(c[0]*.25,c[1]*.25,c[2]*.25);m.emissiveIntensity=.8;m.update();e.render.material=m;this.app.root.addChild(e);r={entity:e,color};this.remotePlayers.set(playerId,r)}
    r.entity.setPosition(position[0],Math.max(.15,position[1]),position[2]);
  }
  removeRemotePlayer(playerId:string){const r=this.remotePlayers.get(playerId);if(r){try{r.entity.destroy()}catch{}this.remotePlayers.delete(playerId)}if(this.followedPlayer===playerId)this.followedPlayer=null}
  projectWorld(position:[number,number,number]){if(!this.camera?.camera)return null;const p=this.camera.camera.worldToScreen(new pc.Vec3(...position));if(p.z<=0)return null;const rect=this.canvas.getBoundingClientRect();return {x:p.x*(rect.width/this.canvas.width),y:p.y*(rect.height/this.canvas.height),visible:p.x>=0&&p.y>=0&&p.x<=this.canvas.width&&p.y<=this.canvas.height}}
  pick(clientX:number,clientY:number){if(this.destroyed||!this.inputEnabled||this.spectator)return;const rect=this.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;let best:any=null,bestD=this.mobile?60:48;this.interactive.forEach(({entity,def})=>{if(entity.destroyed)return;const p=this.camera.camera.worldToScreen(entity.getPosition());const sx=p.x*(rect.width/this.canvas.width),sy=p.y*(rect.height/this.canvas.height),d=Math.hypot(sx-x,sy-y);if(p.z>0&&d<bestD){bestD=d;best={objectId:def.id,vocabId:def.vocabId,name:def.name}}});if(best){this.onPose({...this.getVirtualPose(),lookingAt:best.objectId});this.onPick(best)}}
  pickRay(origin:any,direction:any){
    if(this.destroyed||!this.inputEnabled||this.spectator)return;
    const dir=new pc.Vec3(direction.x,direction.y,direction.z).normalize();
    const org=new pc.Vec3(origin.x,origin.y,origin.z);
    let best:any=null,bestT=Infinity;
    this.interactive.forEach(({entity,def})=>{
      if(entity.destroyed)return;
      const center=entity.getPosition();
      const to=new pc.Vec3().sub2(center,org);
      const t=to.dot(dir);if(t<0||t>8)return;
      const closest=new pc.Vec3().copy(dir).mulScalar(t).add(org);
      const d=center.distance(closest);
      const scale=new pc.Vec3();
      try{entity.getWorldTransform().getScale(scale)}catch{scale.set(.1,.1,.1)}
      const radius=Math.max(.07,Math.min(.32,Math.max(scale.x,scale.y,scale.z)*.65));
      if(d<=radius&&t<bestT){bestT=t;best={objectId:def.id,vocabId:def.vocabId,name:def.name}}
    });
    if(best){this.onPose({...this.getVirtualPose(),lookingAt:best.objectId});this.onPick(best)}
  }
  highlight(objectId:string,good:boolean){const item=this.interactive.get(objectId);if(!item||item.entity.destroyed)return;const e=item.entity,old=e.getLocalScale().clone();e.setLocalScale(old.x*1.07,old.y*1.07,old.z*1.07);window.setTimeout(()=>{if(!this.destroyed&&!e.destroyed)e.setLocalScale(old)},180);const mat=e.render.material,prev=mat.emissive.clone(),prevIntensity=mat.emissiveIntensity;mat.emissive=good?new pc.Color(.1,.8,.25):new pc.Color(.9,.08,.05);mat.emissiveIntensity=1.5;mat.update();window.setTimeout(()=>{if(!this.destroyed&&!e.destroyed){mat.emissive=prev;mat.emissiveIntensity=prevIntensity;mat.update()}},320)}
  setARVisual(active:boolean){if(this.camera?.camera)this.camera.camera.clearColor=active?new pc.Color(0,0,0,0):new pc.Color(.035,.08,.15,1)}
  setWorldScale(s:number){this.worldRoot?.setLocalScale?.(s,s,s)}
  setWorldPose(pos:any,rot:any){this.worldRoot?.setPosition?.(pos);this.worldRoot?.setRotation?.(rot)}
  rotateWorldYaw(degrees:number){this.worldRoot?.rotateLocal?.(0,degrees,0)}
  getStats(){return {fps:this.fps,objects:this.worldRoot?.children?.length||0,interactive:this.interactive.size,quality:this.quality}}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.loadGeneration++;this.canvas.removeEventListener('pointerdown',this.onPointerDown);this.canvas.removeEventListener('pointermove',this.onPointerMove);this.canvas.removeEventListener('pointerup',this.onPointerUp);this.canvas.removeEventListener('pointercancel',this.onPointerUp);this.canvas.removeEventListener('wheel',this.onWheel);this.canvas.removeEventListener('touchmove',this.onTouchMove);this.canvas.removeEventListener('touchend',this.onTouchEnd);window.removeEventListener('resize',this.onResize);this.interactive.clear();this.remotePlayers.clear();this.decorativeMaterials.clear();try{this.app?.destroy?.()}catch{}}
}
function isStructural(id:string){return id==='floor'||id.startsWith('wall-')||id.includes('counter')||id.includes('cabinet')||id==='mattress'||id==='blanket'||id==='side-table'||id==='shelf-gap'||id==='table-leg-a'||id==='table-leg-b'}
function hex(h:string):[number,number,number]{h=h.replace('#','');if(h.length===3)h=h.split('').map(x=>x+x).join('');return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]}
