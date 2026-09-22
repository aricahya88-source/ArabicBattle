import * as pc from 'playcanvas';
import type { PlayCanvasScene } from '../scene/PlayCanvasScene';
export interface ARStatus { webxr:boolean; ar:boolean; hitTest:boolean; anchors:boolean; }
export class XRManager {
  private reticle:any=null; private hitSource:any=null; private lastPos:any=null; private lastRot:any=null; private locked=false;
  constructor(private scene:PlayCanvasScene){}
  status():ARStatus { const xr=this.scene.app.xr; return {webxr:!!xr?.supported, ar:!!xr?.isAvailable?.(pc.XRTYPE_AR), hitTest:!!xr?.hitTest?.supported, anchors:!!xr?.anchors?.supported}; }
  async enterAR(onReady?:()=>void){ const app=this.scene.app, camera=this.scene.camera.camera; if(!app.xr.supported||!app.xr.isAvailable(pc.XRTYPE_AR)) throw new Error('AR tidak tersedia pada perangkat/browser ini.'); this.scene.setARVisual(true); app.xr.domOverlay.root=document.getElementById('app'); app.xr.start(camera,pc.XRTYPE_AR,pc.XRSPACE_LOCALFLOOR,{anchors:true,planeDetection:true,callback:(err:any)=>{if(err)throw err;}}); app.xr.once('start',()=>{this.createReticle();this.startHitTest();onReady?.()}); app.xr.once('end',()=>{this.cleanup();this.scene.setARVisual(false);this.scene.setWorldScale(1)}); }
  private createReticle(){this.reticle=new pc.Entity('ARReticle');this.reticle.addComponent('render',{type:'cylinder'});this.reticle.setLocalScale(.22,.006,.22);const m=new pc.StandardMaterial();m.diffuse=new pc.Color(.1,.85,1);m.emissive=new pc.Color(.05,.5,.75);m.opacity=.55;m.blendType=pc.BLEND_NORMAL;m.update();this.reticle.render.material=m;this.scene.app.root.addChild(this.reticle);this.reticle.enabled=false;}
  private startHitTest(){const xr=this.scene.app.xr;if(!xr.hitTest.supported)return;xr.hitTest.start({spaceType:pc.XRSPACE_VIEWER,callback:(err:any,source:any)=>{if(err)return;this.hitSource=source;source.on('result',(position:any,rotation:any,_input:any,result:any)=>{this.lastPos=position.clone();this.lastRot=rotation.clone();if(!this.locked&&this.reticle){this.reticle.enabled=true;this.reticle.setPosition(position);this.reticle.setRotation(rotation)};(this as any)._lastResult=result;});}})}
  place(){if(!this.lastPos||!this.lastRot)throw new Error('Belum menemukan permukaan. Gerakkan HP perlahan.');this.locked=true;this.scene.setWorldScale(.1);this.scene.setWorldPose(this.lastPos,this.lastRot);if(this.reticle)this.reticle.enabled=false;}
  reset(){this.locked=false;this.scene.setWorldScale(.1);if(this.reticle)this.reticle.enabled=true;}
  end(){this.scene.app.xr?.end?.()}
  private cleanup(){this.hitSource?.remove?.();this.hitSource=null;this.reticle?.destroy?.();this.reticle=null;this.locked=false;}
}
