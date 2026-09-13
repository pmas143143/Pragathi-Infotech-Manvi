const {db,ensureSchema,json,body,requireAuth,requireCsrf}=require('./_lib/auth');
module.exports=async function(req,res){try{const sql=db();await ensureSchema(sql);
 const u=await requireAuth(req,res);if(!u)return;if(!requireCsrf(req,res))return;
 if(req.method==='GET'){const rows=await sql`SELECT setting_key,setting_value FROM settings`;const settings={};rows.forEach(x=>settings[x.setting_key]=x.setting_value);return json(res,200,{ok:true,settings});}
 if(req.method==='POST'){const b=await body(req);for(const k of ['business_name','address','phones','working_hours']){await sql`INSERT INTO settings(setting_key,setting_value) VALUES(${k},${String(b[k]||'')}) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value`;}return json(res,200,{ok:true});}
 return json(res,405,{ok:false,error:'Method not allowed'});
}catch(e){console.error(e);return json(res,500,{ok:false,error:e.message||'Server error'});}};
