const {bcrypt,db,ensureSchema,json,body,getCookie,cookie,csrfCookie,requireAuth,requireCsrf,login,destroySession}=require('./_lib/auth');
module.exports=async function(req,res){
  try{
    const action=req.query.action||'';
    if(action==='login'){
      if(req.method!=='POST')return json(res,405,{ok:false,error:'Method not allowed'});
      const b=await body(req); const username=String(b.username||'').trim(); const password=String(b.password||'');
      if(!username||!password)return json(res,400,{ok:false,error:'Enter username and password.'});
      await login(username,password,req,res); return;
    }
    if(action==='logout'){
      if(req.method!=='POST')return json(res,405,{ok:false,error:'Method not allowed'});
      await destroySession(req);
      return json(res,200,{ok:true},{'Set-Cookie':[cookie('pragathi_session','',0),csrfCookie('',0)]});
    }
    if(action==='me'){
      const u=await requireAuth(req,res); if(!u)return;
      const csrf=getCookie(req,'pragathi_csrf')||require('./_lib/auth').randomToken(24);
      if(!getCookie(req,'pragathi_csrf'))res.setHeader('Set-Cookie',csrfCookie(csrf));
      return json(res,200,{ok:true,authenticated:true,username:u.username,csrf});
    }
    if(action==='change_password'){
      if(req.method!=='POST')return json(res,405,{ok:false,error:'Method not allowed'});
      const u=await requireAuth(req,res); if(!u)return; if(!requireCsrf(req,res))return;
      const b=await body(req),cur=String(b.current_password||''),np=String(b.new_password||''),cp=String(b.confirm_password||'');
      if(np.length<12)return json(res,400,{ok:false,error:'New password must be at least 12 characters.'});
      if(np===cur)return json(res,400,{ok:false,error:'New password must be different from the current password.'});
      if(!/[A-Z]/.test(np)||!/[a-z]/.test(np)||!/[0-9]/.test(np)||!/[^A-Za-z0-9]/.test(np))return json(res,400,{ok:false,error:'Use uppercase, lowercase, number and special character.'});
      if(np!==cp)return json(res,400,{ok:false,error:'New passwords do not match.'});
      const sql=db(); const rows=await sql`SELECT password_hash FROM admin_users WHERE id=${u.id}`;
      if(!rows.length||!(await bcrypt.compare(cur,rows[0].password_hash)))return json(res,400,{ok:false,error:'Current password is incorrect.'});
      const hash=await bcrypt.hash(np,12);
      await sql`UPDATE admin_users SET password_hash=${hash},password_changed_at=NOW() WHERE id=${u.id}`;
      await sql`DELETE FROM admin_sessions WHERE admin_id=${u.id}`;
      return json(res,200,{ok:true,message:'Password changed successfully. Please log in again.'},{'Set-Cookie':[cookie('pragathi_session','',0),csrfCookie('',0)]});
    }
    return json(res,404,{ok:false,error:'Unknown auth action'});
  }catch(e){console.error(e);return json(res,500,{ok:false,error:'Server error'});}
};
