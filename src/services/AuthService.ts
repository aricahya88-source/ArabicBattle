import { supabase } from './supabase';

export type AppRole='admin'|'player';
export interface AppUser{
  id:string;
  name:string;
  username:string;
  role:AppRole;
  active:boolean;
  email?:string|null;
  anonymous:false;
}

const LOGIN_DOMAIN='login.arabichuntbattle.app';
export function normalizeUsername(value:string){
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
}
export function loginEmail(username:string){
  const clean=normalizeUsername(username);
  if(clean.length<3)throw new Error('Username minimal 3 karakter.');
  return `${clean}@${LOGIN_DOMAIN}`;
}

export class AuthService{
  private current:AppUser|null=null;

  async restore():Promise<AppUser|null>{
    if(!supabase)return null;
    const {data,error}=await supabase.auth.getSession();
    if(error)throw error;
    const u=data?.session?.user;
    if(!u)return null;
    this.current=await this.mapWithProfile(u);
    if(!this.current.active){await supabase.auth.signOut();this.current=null;return null;}
    return this.current;
  }

  async login(username:string,password:string):Promise<AppUser>{
    if(!supabase)throw new Error('Supabase belum dikonfigurasi. Login akun membutuhkan backend Supabase.');
    const clean=normalizeUsername(username);
    if(!clean)throw new Error('Masukkan username.');
    if(!password)throw new Error('Masukkan password.');
    const {data,error}=await supabase.auth.signInWithPassword({email:loginEmail(clean),password});
    if(error){
      const message=String(error.message||'');
      if(/invalid login credentials/i.test(message))throw new Error('Username atau password salah.');
      if(/email.*not confirmed/i.test(message))throw new Error('Akun belum dikonfirmasi di Supabase Auth.');
      throw new Error(`Login gagal: ${message||'kesalahan autentikasi'}`);
    }
    if(!data.user)throw new Error('Login gagal.');
    const mapped=await this.mapWithProfile(data.user,clean);
    if(!mapped.active){await supabase.auth.signOut();throw new Error('Akun dinonaktifkan oleh admin.');}
    this.current=mapped;
    return mapped;
  }

  get user(){return this.current;}
  async signOut(){if(supabase)await supabase.auth.signOut();this.current=null;}

  private async mapWithProfile(u:any,fallback='player'):Promise<AppUser>{
    if(!supabase)throw new Error('Supabase belum dikonfigurasi.');
    const {data,error}=await supabase.from('profiles')
      .select('username,display_name,role,active')
      .eq('id',u.id)
      .maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Profil akun belum dibuat. Hubungi admin.');
    return {
      id:u.id,
      username:data.username||fallback,
      name:data.display_name||data.username||fallback,
      role:(data.role||'player') as AppRole,
      active:data.active!==false,
      email:u.email,
      anonymous:false
    };
  }
}
