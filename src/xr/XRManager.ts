import * as pc from 'playcanvas';
import type { PlayCanvasScene } from '../scene/PlayCanvasScene';

export interface ARStatus {
  webxr:boolean;
  ar:boolean;
  hitTest:boolean;
  anchors:boolean;
  domOverlay:boolean;
  active:boolean;
  placed:boolean;
  anchorActive:boolean;
}

export class XRManager {
  private reticle:any=null;
  private hitSource:any=null;
  private lastPos:any=null;
  private lastRot:any=null;
  private lastResult:any=null;
  private anchor:any=null;
  private locked=false;
  private yawOffset=0;
  private lastPoseSent=0;
  private inputSelectHandle:any=null;
  private updateHandle:any=null;
  private endHandle:any=null;
  onStatus:()=>void=()=>{};
  onPose:(pose:{position:[number,number,number];yaw:number;pitch:number;lookingAt?:string})=>void=()=>{};

  constructor(private scene:PlayCanvasScene){}

  status():ARStatus {
    const xr=this.scene.app.xr;
    return {
      webxr:!!xr?.supported,
      ar:!!xr?.isAvailable?.(pc.XRTYPE_AR),
      hitTest:!!xr?.hitTest?.supported,
      anchors:!!xr?.anchors?.supported,
      domOverlay:!!xr?.domOverlay?.supported,
      active:!!xr?.active,
      placed:this.locked,
      anchorActive:!!this.anchor
    };
  }

  isActive(){return !!this.scene.app.xr?.active}
  isPlaced(){return this.locked}

  async enterAR(onReady?:()=>void):Promise<void>{
    const app=this.scene.app;
    const xr=app.xr;
    const camera=this.scene.camera.camera;
    if(!window.isSecureContext)throw new Error('AR membutuhkan HTTPS. Gunakan deployment Vercel atau localhost.');
    if(!xr?.supported)throw new Error('WebXR tidak tersedia pada browser ini.');
    if(!xr.isAvailable(pc.XRTYPE_AR)){
      const available=await this.waitForARAvailability(xr);
      if(!available)throw new Error('Immersive AR tidak tersedia pada perangkat/browser ini. Gunakan perangkat Android WebXR yang kompatibel.');
    }
    if(xr.active){onReady?.();return}

    this.scene.setARMode(true);
    if(xr.domOverlay?.supported){xr.domOverlay.root=document.getElementById('app')}

    await new Promise<void>((resolve,reject)=>{
      const onStart=()=>{
        try{
          this.createReticle();
          this.startHitTest();
          this.bindXRInput();
          this.bindPoseUpdates();
          onReady?.();
          this.onStatus();
          resolve();
        }catch(err){try{xr.end?.()}catch{};reject(err)}
      };
      xr.once('start',onStart);
      try{
        xr.start(camera,pc.XRTYPE_AR,pc.XRSPACE_LOCALFLOOR,{
          anchors:!!xr.anchors?.supported,
          planeDetection:!!xr.planeDetection?.supported,
          optionalFeatures:['dom-overlay'],
          callback:(err:any)=>{
            if(err){
              try{xr.off('start',onStart)}catch{}
              this.scene.setARMode(false);
              reject(err);
            }
          }
        });
      }catch(err){
        try{xr.off('start',onStart)}catch{}
        this.scene.setARMode(false);
        reject(err);
      }
    });

    this.endHandle=xr.once('end',()=>{
      this.cleanup(false);
      this.scene.setARMode(false);
      this.scene.setWorldScale(1);
      this.onStatus();
    });
  }

  private waitForARAvailability(xr:any):Promise<boolean>{
    return new Promise(resolve=>{
      if(xr.isAvailable(pc.XRTYPE_AR)){resolve(true);return}
      let done=false;
      const finish=(value:boolean)=>{if(done)return;done=true;clearTimeout(timer);try{handle?.off?.()}catch{};resolve(value)};
      const handle=xr.on(`available:${pc.XRTYPE_AR}`,(available:boolean)=>{if(available)finish(true)});
      const timer=window.setTimeout(()=>finish(!!xr.isAvailable(pc.XRTYPE_AR)),1800);
    });
  }

  private createReticle(){
    if(this.reticle)return;
    this.reticle=new pc.Entity('ARReticle');
    this.reticle.addComponent('render',{type:'cylinder'});
    this.reticle.setLocalScale(.18,.004,.18);
    const m=new pc.StandardMaterial();
    m.diffuse=new pc.Color(.08,.9,1);
    m.emissive=new pc.Color(.03,.55,.78);
    m.emissiveIntensity=1.15;
    m.opacity=.62;
    m.blendType=pc.BLEND_NORMAL;
    m.depthWrite=false;
    m.update();
    this.reticle.render.material=m;
    this.scene.app.root.addChild(this.reticle);
    this.reticle.enabled=false;
  }

  private startHitTest(){
    const xr=this.scene.app.xr;
    if(!xr?.hitTest?.supported)throw new Error('Perangkat ini tidak mendukung AR Hit Test.');
    xr.hitTest.start({
      spaceType:pc.XRSPACE_VIEWER,
      entityTypes:[pc.XRTRACKABLE_PLANE],
      callback:(err:any,source:any)=>{
        if(err){console.warn('AR hit test unavailable',err);return}
        this.hitSource=source;
        source.on('result',(position:any,rotation:any,_input:any,result:any)=>{
          this.lastPos=position.clone();
          this.lastRot=rotation.clone();
          this.lastResult=result;
          if(!this.locked&&this.reticle){
            this.reticle.enabled=true;
            this.reticle.setPosition(position);
            this.reticle.setRotation(rotation);
          }
          this.onStatus();
        });
      }
    });
  }

  private bindXRInput(){
    const input=this.scene.app.xr?.input;
    if(!input)return;
    this.inputSelectHandle=input.on('select',(source:any)=>{
      if(!this.locked)return;
      const origin=source?.getOrigin?.();
      const direction=source?.getDirection?.();
      if(origin&&direction)this.scene.pickRay(origin,direction);
    });
  }

  private bindPoseUpdates(){
    const xr=this.scene.app.xr;
    if(!xr)return;
    this.updateHandle=xr.on('update',()=>{
      if(!this.locked)return;
      const now=performance.now();
      if(now-this.lastPoseSent<180)return;
      this.lastPoseSent=now;
      this.onPose(this.scene.getVirtualPose());
    });
  }

  place(){
    if(!this.isActive())throw new Error('Mulai sesi AR terlebih dahulu.');
    if(!this.lastPos||!this.lastRot)throw new Error('Belum menemukan permukaan. Gerakkan HP perlahan ke meja atau lantai yang cukup terang.');
    this.locked=true;
    this.yawOffset=0;
    this.scene.setWorldScale(.1);
    this.applyPlacement(this.lastPos,this.lastRot);
    if(this.reticle)this.reticle.enabled=false;
    this.tryCreateAnchor();
    this.onStatus();
  }

  private tryCreateAnchor(){
    const anchors=this.scene.app.xr?.anchors;
    if(!anchors?.available||!this.lastResult)return;
    try{
      anchors.create(this.lastResult,(err:any,anchor:any)=>{
        if(err||!anchor)return;
        this.anchor=anchor;
        const sync=()=>this.applyPlacement(anchor.getPosition(),anchor.getRotation());
        anchor.on('change',sync);
        anchor.once('destroy',()=>{if(this.anchor===anchor)this.anchor=null;this.onStatus()});
        sync();
        this.onStatus();
      });
    }catch(err){console.warn('AR anchor create skipped',err)}
  }

  private applyPlacement(position:any,rotation:any){
    this.scene.setWorldPose(position,rotation);
    if(this.yawOffset)this.scene.rotateWorldYaw(this.yawOffset);
  }

  rotate(deltaDegrees:number){
    if(!this.locked)throw new Error('Place arena terlebih dahulu.');
    this.yawOffset=((this.yawOffset+deltaDegrees)%360+360)%360;
    const p=this.anchor?.getPosition?.()||this.lastPos;
    const r=this.anchor?.getRotation?.()||this.lastRot;
    if(p&&r)this.applyPlacement(p,r);
  }

  reset(){
    try{this.anchor?.destroy?.()}catch{}
    this.anchor=null;
    this.locked=false;
    this.yawOffset=0;
    this.scene.setWorldScale(.1);
    if(this.reticle)this.reticle.enabled=!!this.lastPos;
    this.onStatus();
  }

  end(){
    try{this.scene.app.xr?.end?.()}catch{}
  }

  private cleanup(removeEnd=true){
    try{this.hitSource?.remove?.()}catch{}
    this.hitSource=null;
    try{this.inputSelectHandle?.off?.()}catch{}
    this.inputSelectHandle=null;
    try{this.updateHandle?.off?.()}catch{}
    this.updateHandle=null;
    if(removeEnd){try{this.endHandle?.off?.()}catch{}}
    this.endHandle=null;
    try{this.anchor?.destroy?.()}catch{}
    this.anchor=null;
    try{this.reticle?.destroy?.()}catch{}
    this.reticle=null;
    this.lastPos=null;
    this.lastRot=null;
    this.lastResult=null;
    this.locked=false;
    this.yawOffset=0;
  }
}
