type Handler<T=unknown>=(data:T)=>void;
export class EventBus {
  private h=new Map<string,Set<Handler>>();
  on<T>(name:string, fn:Handler<T>){ if(!this.h.has(name)) this.h.set(name,new Set()); this.h.get(name)!.add(fn as Handler); return ()=>this.off(name,fn); }
  off<T>(name:string, fn:Handler<T>){ this.h.get(name)?.delete(fn as Handler); }
  emit<T>(name:string,data:T){ this.h.get(name)?.forEach(fn=>fn(data)); }
}
export const events=new EventBus();
