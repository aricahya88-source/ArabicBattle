import * as pc from 'playcanvas';
import type { WorldConfig, SceneObjectDef } from '../worlds/types';

export interface ScenePick { objectId:string; vocabId?:string; name:string; }
export class PlayCanvasScene {
  app:any; canvas:HTMLCanvasElement; camera:any; cameraRig:any; worldRoot:any;
  interactive=new Map<string,{entity:any,def:SceneObjectDef}>();
  private yaw=35; private pitch=-28; private dist=8.3; private target=new pc.Vec3(0,.8,0);
  private pointerDown=false; private lastX=0; private lastY=0; private moved=0; private pinchDist=0;
  onPick:(p:ScenePick)=>void=()=>{};
  onPose:(pose:{position:[number,number,number];yaw:number;pitch:number;lookingAt?:string})=>void=()=>{};
  constructor(canvas:HTMLCanvasElement){ this.canvas=canvas; this.app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:true,powerPreference:'high-performance'}}); this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW); this.app.setCanvasResolution(pc.RESOLUTION_AUTO); this.app.scene.ambientLight=new pc.Color(.42,.46,.5); this.app.start(); this.buildBase(); this.bindInput(); }
  private buildBase(){
    this.cameraRig=new pc.Entity('CameraRig'); this.app.root.addChild(this.cameraRig);
    this.camera=new pc.Entity('Camera'); this.camera.addComponent('camera',{clearColor:new pc.Color(.035,.08,.15,1),fov:48,nearClip:.05,farClip:100}); this.cameraRig.addChild(this.camera);
    const sun=new pc.Entity('Sun'); sun.addComponent('light',{type:'directional',color:new pc.Color(1,.92,.78),intensity:1.65,castShadows:true,shadowBias:.2,normalOffsetBias:.05}); sun.setEulerAngles(42,-35,0); this.app.root.addChild(sun);
    const fill=new pc.Entity('Fill'); fill.addComponent('light',{type:'omni',color:new pc.Color(.35,.62,1),intensity:.55,range:12}); fill.setPosition(-3,4,4); this.app.root.addChild(fill);
    this.worldRoot=new pc.Entity('WorldRoot'); this.app.root.addChild(this.worldRoot); this.updateCamera();
    window.addEventListener('resize',()=>this.app.resizeCanvas());
  }
  loadWorld(world:WorldConfig){ this.worldRoot.destroy(); this.worldRoot=new pc.Entity('WorldRoot'); this.app.root.addChild(this.worldRoot); this.interactive.clear(); world.objects.forEach(def=>this.addObject(def)); }
  private addObject(def:SceneObjectDef){
    const e=new pc.Entity(def.name); e.addComponent('render',{type:def.shape}); e.setLocalPosition(...def.pos); e.setLocalScale(...def.scale); if(def.rotation)e.setLocalEulerAngles(...def.rotation);
    const m=new pc.StandardMaterial(); const c=hex(def.color); m.diffuse=new pc.Color(c[0],c[1],c[2]); if(def.emissive){const ec=hex(def.emissive);m.emissive=new pc.Color(ec[0],ec[1],ec[2]);m.emissiveIntensity=1.2;} if(def.opacity!==undefined){m.opacity=def.opacity;m.blendType=pc.BLEND_NORMAL;m.depthWrite=def.opacity>.8;} m.metalness=.03; m.gloss=.32; m.update(); e.render.material=m; this.worldRoot.addChild(e); if(def.interactive)this.interactive.set(def.id,{entity:e,def});
  }
  private bindInput(){
    const down=(x:number,y:number)=>{this.pointerDown=true;this.lastX=x;this.lastY=y;this.moved=0};
    const move=(x:number,y:number)=>{if(!this.pointerDown)return;const dx=x-this.lastX,dy=y-this.lastY;this.moved+=Math.abs(dx)+Math.abs(dy);this.yaw-=dx*.28;this.pitch=Math.max(-70,Math.min(-8,this.pitch-dy*.22));this.lastX=x;this.lastY=y;this.updateCamera()};
    this.canvas.addEventListener('pointerdown',e=>{this.canvas.setPointerCapture(e.pointerId);down(e.clientX,e.clientY)});
    this.canvas.addEventListener('pointermove',e=>move(e.clientX,e.clientY));
    this.canvas.addEventListener('pointerup',e=>{this.pointerDown=false;if(this.moved<12)this.pick(e.clientX,e.clientY)});
    this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.dist=Math.max(4.5,Math.min(12,this.dist+e.deltaY*.008));this.updateCamera()},{passive:false});
    this.canvas.addEventListener('touchmove',e=>{if(e.touches.length===2){const a=e.touches[0],b=e.touches[1];const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);if(this.pinchDist){this.dist=Math.max(4.5,Math.min(12,this.dist-(d-this.pinchDist)*.015));this.updateCamera()}this.pinchDist=d}}, {passive:true});
    this.canvas.addEventListener('touchend',()=>this.pinchDist=0);
  }
  private updateCamera(){const yr=this.yaw*Math.PI/180, pr=this.pitch*Math.PI/180; const cp=Math.cos(pr); const x=this.target.x+this.dist*cp*Math.sin(yr), y=this.target.y-this.dist*Math.sin(pr), z=this.target.z+this.dist*cp*Math.cos(yr); this.camera.setPosition(x,y,z); this.camera.lookAt(this.target); this.onPose({position:[x,y,z],yaw:this.yaw,pitch:this.pitch});}
  getPose(){const p=this.camera.getPosition();return {position:[p.x,p.y,p.z] as [number,number,number],yaw:this.yaw,pitch:this.pitch};}
  pick(clientX:number,clientY:number){
    const rect=this.canvas.getBoundingClientRect(); const x=clientX-rect.left,y=clientY-rect.top; let best:any=null,bestD=52;
    this.interactive.forEach(({entity,def})=>{const p=this.camera.camera.worldToScreen(entity.getPosition()); const sx=p.x*(rect.width/this.canvas.width), sy=p.y*(rect.height/this.canvas.height); const d=Math.hypot(sx-x,sy-y); if(p.z>0&&d<bestD){bestD=d;best={objectId:def.id,vocabId:def.vocabId,name:def.name}}});
    if(best){this.onPose({...this.getPose(),lookingAt:best.objectId});this.onPick(best);}
  }
  highlight(objectId:string,good:boolean){const item=this.interactive.get(objectId); if(!item)return; const e=item.entity; const old=e.getLocalScale().clone(); e.setLocalScale(old.x*1.1,old.y*1.1,old.z*1.1); setTimeout(()=>{if(!e.destroyed)e.setLocalScale(old)},240); const mat=e.render.material; const prev=mat.emissive.clone(); mat.emissive=good?new pc.Color(.1,.8,.25):new pc.Color(.9,.08,.05);mat.emissiveIntensity=1.8;mat.update();setTimeout(()=>{if(!e.destroyed){mat.emissive=prev;mat.emissiveIntensity=1;mat.update()}},420);}
  setARVisual(active:boolean){this.camera.camera.clearColor=active?new pc.Color(0,0,0,0):new pc.Color(.035,.08,.15,1);}
  setWorldScale(s:number){this.worldRoot.setLocalScale(s,s,s);}
  setWorldPose(pos:any,rot:any){this.worldRoot.setPosition(pos);this.worldRoot.setRotation(rot);}
}
function hex(h:string):[number,number,number]{h=h.replace('#','');if(h.length===3)h=h.split('').map(x=>x+x).join('');return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]}
