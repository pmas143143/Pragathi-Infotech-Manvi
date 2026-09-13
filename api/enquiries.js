const {db,ensureSchema,json,body,requireAuth,requireCsrf}=require('./_lib/auth');
module.exports=async function(req,res){try{const sql=db();await ensureSchema(sql);
 if(req.method==='POST'){const b=await body(req),service=String(b.service||'').trim(),name=String(b.name||'').trim(),mobile=String(b.mobile||'').trim(),message=String(b.message||'').trim();if(!service||!name||!/^\+?[0-9 ()-]{7,20}$/.test(mobile))return json(res,400,{ok:false,error:'Please enter a valid name, service and mobile number.'});const ip=(req.headers['x-forwarded-for']||'').split(',')[0].trim()||null;await sql`INSERT INTO enquiries(service,name,mobile,message,ip_address) VALUES(${service},${name},${mobile},${message},${ip})`;return json(res,200,{ok:true});}
 const u=await requireAuth(req,res);if(!u)return;if(!requireCsrf(req,res))return;
 if(req.method==='GET'){const rows=await sql`SELECT id,service,name,mobile,message,status,created_at FROM enquiries ORDER BY created_at DESC LIMIT 500`;return json(res,200,{ok:true,enquiries:rows});}
 if(req.method==='PATCH'){const id=Number(req.query.id),b=await body(req),status=String(b.status||'');if(!id||!['new','contacted','closed'].includes(status))return json(res,400,{ok:false,error:'Invalid enquiry update.'});await sql`UPDATE enquiries SET status=${status} WHERE id=${id}`;return json(res,200,{ok:true});}
 return json(res,405,{ok:false,error:'Method not allowed'});
}catch(e){console.error(e);return json(res,500,{ok:false,error:e.message||'Server error'});}};
