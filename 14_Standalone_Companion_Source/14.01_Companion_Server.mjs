import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const PORT=20129, HOST='127.0.0.1', BASE='http://127.0.0.1:20128', ROOT=dirname(fileURLToPath(import.meta.url));
const routes={'/api/catalog':'/api/models/catalog','/api/connections':'/api/providers','/api/static':'/api/models','/api/custom':'/api/provider-models'};
let busy=false;
function reply(res,status,body,type='application/json; charset=utf-8'){
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});
  res.end(typeof body==='string'?body:JSON.stringify(body));
}
async function relay(req,target,body){
  const headers={Accept:'application/json',Origin:BASE};
  if(req.headers.cookie) headers.Cookie=req.headers.cookie;
  const key=req.headers['x-inventory-api-key'];
  if(typeof key==='string'&&key.length>0&&key.length<4096) headers.Authorization='Bearer '+key.trim();
  if(body) headers['Content-Type']='application/json';
  const control=new AbortController(),timer=setTimeout(()=>control.abort(),45000);
  try{
    const r=await fetch(BASE+target,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:control.signal});
    const raw=await r.text();let data;
    try{data=JSON.parse(raw)}catch{throw Error('OmniRoute returned non-JSON; sign in to its dashboard first')}
    if(!r.ok){let message=data?.error?.message||data?.error||data?.message||'Upstream error';data={error:String(message).slice(0,300)}}
    return {code:r.status,data};
  }finally{clearTimeout(timer)}
}
function jsonBody(req){
 return new Promise((resolve,reject)=>{let s='';req.on('data',b=>{s+=b;if(s.length>8192){reject(Error('Request too large'));req.destroy()}});req.on('end',()=>{try{resolve(JSON.parse(s))}catch{reject(Error('Invalid JSON'))}});req.on('error',reject)});
}
http.createServer(async(req,res)=>{
 if(req.headers.host!==HOST+':'+PORT)return reply(res,403,{error:'Invalid host'});
 const p=new URL(req.url||'/', 'http://'+HOST+':'+PORT).pathname;
 if(req.method==='GET'&&['/','/models','/app.js'].includes(p)){
   try{return reply(res,200,await readFile(join(ROOT,p==='/app.js'?'14.03_Inventory_Client.js':'14.02_Inventory_UI.html'),'utf8'),p==='/app.js'?'application/javascript; charset=utf-8':'text/html; charset=utf-8')}
   catch{return reply(res,500,{error:'UI file missing'})}
 }
 if(req.method==='GET'&&routes[p]){
   try{
     const out=await relay(req,routes[p]);
     if(p==='/api/connections'&&out.code===200)out.data={total:out.data.total,connections:(out.data.connections||[]).map(x=>({id:x.id,provider:x.provider,name:x.name,isActive:x.isActive,testStatus:x.testStatus,priority:x.priority,defaultModel:x.defaultModel}))};
     return reply(res,out.code,out.data);
   }catch(e){return reply(res,502,{error:String(e.message||'Upstream unavailable')})}
 }
 if(req.method==='POST'&&p==='/api/test'){
   if(req.headers.origin!=='http://'+HOST+':'+PORT)return reply(res,403,{error:'Origin denied'});
   if(busy)return reply(res,429,{error:'Another model test is in progress'});
   try{
     const x=await jsonBody(req);
     if(!x||![x.providerId,x.modelId].every(v=>typeof v==='string'&&v.length>0&&v.length<=256&&/^[\w.\/:+@-]+$/.test(v)))return reply(res,400,{error:'Invalid provider/model ID'});
     busy=true;const out=await relay(req,'/api/models/test',{providerId:x.providerId,modelId:x.modelId});
     const z=out.data;return reply(res,out.code,{status:z.status,latencyMs:z.latencyMs,statusCode:z.statusCode,rateLimited:z.rateLimited,retryAfter:z.retryAfter,error:z.error});
   }catch(e){return reply(res,502,{error:String(e.message||'Request failed')})}
   finally{busy=false}
 }
 if(req.method==='POST'&&p==='/api/sync'){
  if(req.headers.origin!=='http://'+HOST+':'+PORT)return reply(res,403,{error:'Origin denied'});
  if(busy)return reply(res,429,{error:'A test or sync is already running'});
  try{
   const x=await jsonBody(req);
   if(!x||typeof x.connectionId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(x.connectionId))return reply(res,400,{error:'Invalid connection ID'});
   busy=true;
   const out=await relay(req,'/api/providers/'+encodeURIComponent(x.connectionId)+'/sync-models?mode=import',{});
   const z=out.data;
   return reply(res,out.code,{ok:out.code>=200&&out.code<300,added:z.added,syncedModels:z.syncedModels,removed:z.removed,error:z.error});
  }catch(e){return reply(res,502,{error:String(e.message||'Sync failed')})}
  finally{busy=false}
 }
 reply(res,404,{error:'Not found'});
}).listen(PORT,HOST,()=>console.log('OmniRoute Model Inventory: http://'+HOST+':'+PORT+'/models'));
