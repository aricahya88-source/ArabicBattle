import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const normalizeUsername=(v:string)=>v.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')
const loginEmail=(username:string)=>`${normalizeUsername(username)}@login.arabichuntbattle.app`

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)

  const url=Deno.env.get('SUPABASE_URL')
  const secret=Deno.env.get('SUPABASE_SECRET_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!secret)return json({error:'SERVER_SECRET_NOT_CONFIGURED'},500)

  const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}})
  const authHeader=req.headers.get('Authorization')||''
  const token=authHeader.replace(/^Bearer\s+/i,'')
  if(!token)return json({error:'AUTH_REQUIRED'},401)

  const {data:userData,error:userError}=await admin.auth.getUser(token)
  const caller=userData?.user
  if(userError||!caller)return json({error:'INVALID_SESSION'},401)

  const {data:callerProfile,error:profileError}=await admin.from('profiles').select('role,active').eq('id',caller.id).single()
  if(profileError||!callerProfile?.active||callerProfile.role!=='admin')return json({error:'ADMIN_ONLY'},403)

  let body:any
  try{body=await req.json()}catch{return json({error:'INVALID_JSON'},400)}
  const action=String(body?.action||'')

  if(action==='create'){
    const username=normalizeUsername(String(body.username||''))
    const displayName=String(body.displayName||'').trim()
    const password=String(body.password||'')
    const role=body.role==='admin'?'admin':'player'
    if(username.length<3||username.length>32)return json({error:'USERNAME_3_TO_32'},400)
    if(!/^[a-z0-9._-]+$/.test(username))return json({error:'INVALID_USERNAME'},400)
    if(displayName.length<1||displayName.length>80)return json({error:'DISPLAY_NAME_REQUIRED'},400)
    if(password.length<8)return json({error:'PASSWORD_MIN_8'},400)

    const {data:existing}=await admin.from('profiles').select('id').ilike('username',username).maybeSingle()
    if(existing)return json({error:'USERNAME_ALREADY_USED'},409)

    const {data:created,error:createError}=await admin.auth.admin.createUser({
      email:loginEmail(username),password,email_confirm:true,
      user_metadata:{username,display_name:displayName}
    })
    if(createError||!created.user)return json({error:createError?.message||'CREATE_USER_FAILED'},400)

    const {error:upsertError}=await admin.from('profiles').upsert({
      id:created.user.id,username,display_name:displayName,role,active:true,created_by:caller.id
    },{onConflict:'id'})
    if(upsertError){await admin.auth.admin.deleteUser(created.user.id);return json({error:upsertError.message},400)}
    return json({ok:true,user:{id:created.user.id,username,displayName,role,active:true}})
  }

  if(action==='reset_password'){
    const userId=String(body.userId||'')
    const password=String(body.password||'')
    if(!userId)return json({error:'USER_ID_REQUIRED'},400)
    if(password.length<8)return json({error:'PASSWORD_MIN_8'},400)
    const {error}=await admin.auth.admin.updateUserById(userId,{password})
    if(error)return json({error:error.message},400)
    return json({ok:true})
  }

  if(action==='set_active'){
    const userId=String(body.userId||'')
    const active=!!body.active
    if(!userId)return json({error:'USER_ID_REQUIRED'},400)
    if(userId===caller.id&&!active)return json({error:'CANNOT_DISABLE_SELF'},400)
    const {error}=await admin.from('profiles').update({active}).eq('id',userId)
    if(error)return json({error:error.message},400)
    return json({ok:true,active})
  }

  return json({error:'UNKNOWN_ACTION'},400)
})
