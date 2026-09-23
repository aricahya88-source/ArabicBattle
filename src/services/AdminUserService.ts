import { supabase } from './supabase';

export type AccountRole='admin'|'player';
export interface AdminAccount{
  id:string;
  username:string;
  displayName:string;
  role:AccountRole;
  active:boolean;
  level:number;
  xp:number;
  createdAt?:string|null;
}

export interface CreateAccountInput{
  username:string;
  displayName:string;
  password:string;
  role:AccountRole;
}

export class AdminUserService{
  private needClient(){if(!supabase)throw new Error('Supabase belum dikonfigurasi.');return supabase;}

  async list():Promise<AdminAccount[]>{
    const s=this.needClient();
    const {data,error}=await s.from('profiles')
      .select('id,username,display_name,role,active,level,xp,created_at')
      .order('created_at',{ascending:true});
    if(error)throw error;
    return (data||[]).map((x:any)=>({
      id:x.id,
      username:x.username||'',
      displayName:x.display_name||x.username||'Player',
      role:(x.role||'player') as AccountRole,
      active:x.active!==false,
      level:Number(x.level||1),
      xp:Number(x.xp||0),
      createdAt:x.created_at
    }));
  }

  async create(input:CreateAccountInput){return this.invoke({action:'create',...input});}
  async resetPassword(userId:string,password:string){return this.invoke({action:'reset_password',userId,password});}
  async setActive(userId:string,active:boolean){return this.invoke({action:'set_active',userId,active});}

  private async invoke(body:Record<string,unknown>){
    const s=this.needClient();
    const {data,error}=await s.functions.invoke('admin-users',{body});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    return data;
  }
}
