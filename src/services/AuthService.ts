import { supabase } from './supabase';

export interface AppUser { id:string; name:string; email?:string|null; anonymous:boolean; }

export class AuthService {
  private current:AppUser|null=null;
  async restore():Promise<AppUser|null>{
    if(!supabase)return null;
    const {data}=await supabase.auth.getSession();
    const u=data?.session?.user;
    if(!u)return null;
    this.current=this.map(u);
    await this.ensureProfile(this.current);
    return this.current;
  }
  async guest(name='Player'):Promise<AppUser>{
    if(!supabase){this.current={id:'local-player',name,anonymous:true};return this.current;}
    let {data}=await supabase.auth.getSession();
    if(!data?.session){
      const res=await supabase.auth.signInAnonymously({options:{data:{display_name:name}}});
      if(res.error)throw res.error;
      data={session:res.data.session};
    }
    const u=data.session!.user;
    this.current=this.map(u,name);
    await this.ensureProfile(this.current);
    return this.current;
  }
  async google():Promise<void>{
    if(!supabase)throw new Error('Supabase belum dikonfigurasi.');
    const redirectTo=location.origin+location.pathname;
    const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
    if(error)throw error;
  }
  get user(){return this.current;}
  async signOut(){if(supabase)await supabase.auth.signOut();this.current=null;}
  private map(u:any,fallback='Player'):AppUser{
    return {id:u.id,name:u.user_metadata?.display_name||u.user_metadata?.full_name||u.email?.split('@')[0]||fallback,email:u.email,anonymous:!!u.is_anonymous};
  }
  private async ensureProfile(user:AppUser){
    if(!supabase||user.id==='local-player')return;
    const {error}=await supabase.from('profiles').upsert({id:user.id,display_name:user.name},{onConflict:'id'});
    if(error)throw error;
  }
}
