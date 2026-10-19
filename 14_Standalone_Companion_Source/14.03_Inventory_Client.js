'use strict';
const $ = id => document.getElementById(id);
const state = { models:[], providers:[], connections:[], tests:new Map(), plan:[], visible:150, loading:false };
const ALIASES = { github:'gh',claude:'cc',codex:'cx',qoder:'if',qwen:'qw',kiro:'kr',gemini:'gemini',openrouter:'openrouter',groq:'groq' };
const CHANNELS = [
 ['auto/coding','Coding quality','Suggested for code generation'],
 ['auto','Balanced','Adaptive last-known-good routing'],
 ['auto/fast','Fast response','Favor low latency'],
 ['auto/cheap','Cost-aware','Favor lower cost (not strictly free)'],
 ['auto/offline','Quota headroom','Favor available capacity'],
 ['auto/lkgp','Sticky','Last-known-good provider'],
];
function elt(tag,text,cls){
 const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;
}
function inform(message,isError=false){
 const e=$('message');e.textContent=message;e.className='message '+(isError?'error':'info');
}
function toList(v){return Array.isArray(v)?v:[]}
function clean(s){return String(s??'').toLowerCase()}
async function request(p,body) {
 const h={};const k=$('key').value.trim();if(k)h['X-Inventory-API-Key']=k;
 if(body)h['Content-Type']='application/json';
 const response=await fetch(p,{method:body?'POST':'GET',credentials:'same-origin',headers:h,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 let data;
 try{data=await response.json()}catch{throw Error('Service returned invalid JSON')}
 if(!response.ok)throw Error(data.error||'HTTP '+response.status);
 return data;
}
function connectionMatches(provider) {
 const p=clean(provider);
 return state.connections.filter(c=>{
   const key=clean(c.provider);
   return key===p||clean(ALIASES[key])===p;
 });
}
function parseCatalog(catalog) {
 const rows=[];let providers=[];
 for(const [id,group] of Object.entries(catalog||{})){
  const display=group?.provider||id;
  const connection=connectionMatches(id);
  providers.push({id,display,count:toList(group?.models).length});
  for(const m of toList(group?.models)){
   if(!m||typeof m.id!=='string')continue;
   rows.push({
     id:m.id, provider:id,providerName:display, name:m.name||m.id,
     free:m.free===true, context:Number.isFinite(m.context_length)?m.context_length:null,
     output:Number.isFinite(m.max_output_tokens)?m.max_output_tokens:null,
     vision:toList(m.input_modalities).some(x=>/image/i.test(String(x))) || m.capabilities?.vision===true,
     activeConnections:connection.filter(x=>x.isActive!==false),
     connections:connection,capabilities:m.capabilities||{},type:m.type||'chat',
   });
  }
 }
 return {rows,providers};
}
function routeCards(){
 const root=$('routes');
 for(const [id,title,subtitle] of CHANNELS){
   const card=elt('div',undefined,'route'),heading=elt('b',title),code=elt('code',id),sub=elt('p',subtitle,'muted'),btn=elt('button','Copy model ID','btn');
   sub.style.margin='6px 0 9px';
   btn.addEventListener('click',()=>copy(id));
   card.append(heading,elt('div'),code,sub,btn);root.append(card);
 }
}
async function copy(s){try{await navigator.clipboard.writeText(s);inform('Copied to clipboard: '+s)}catch{inform('Clipboard permission denied; manually select text.',true)}}
async function load(){
 if(state.loading)return;
 state.loading=true;$('refresh').disabled=true;inform('Refreshing OmniRoute model catalog and provider connections…');
 try{
   // Provider secrets are stripped from responses by the local bridge.
   const [connections,catalog]=await Promise.all([request('/api/connections'),request('/api/catalog')]);
   state.connections=toList(connections.connections);
   const data=parseCatalog(catalog.catalog);
   state.models=data.rows;state.providers=data.providers;
   state.visible=150;
   $('countModels').textContent=state.models.length.toLocaleString();
   $('countProviders').textContent=state.providers.length.toLocaleString();
   $('countConnections').textContent=state.connections.filter(c=>c.isActive!==false).length.toLocaleString();
   const select=$('provider');const old=select.value;select.replaceChildren(new Option('All providers',''));
   for(const p of data.providers.sort((a,b)=>a.display.localeCompare(b.display)))select.add(new Option(p.display+' ('+p.count+')',p.id));
   select.value=old;
   redraw();
   inform('Loaded '+state.models.length+' catalog entries across '+state.providers.length+' provider groups. These are catalog records, not verified free or working completions.');
 }catch(e){
   inform('Inventory could not load: '+e.message+'. Ensure OmniRoute is running and you are signed in. If you see HTTP 401, enter a management API key in the optional field and retry.',true);
 }finally{state.loading=false;$('refresh').disabled=false}
}
function filterModels(){
 const q=clean($('search').value.trim()),provider=$('provider').value,onlyConnected=$('connectedOnly').checked,onlyFree=$('freeOnly').checked;
 let r=state.models.filter(m=>(!provider||m.provider===provider)&&(!onlyConnected||m.activeConnections.length>0)&&(!onlyFree||m.free)&&(!q||clean(m.id+' '+m.name+' '+m.providerName+' '+m.type).includes(q)));
 const sort=$('sort').value;
 r.sort((a,b)=>sort==='context'?(b.context||0)-(a.context||0)||a.id.localeCompare(b.id):sort==='free'?Number(b.free)-Number(a.free)||a.id.localeCompare(b.id):sort==='id'?a.id.localeCompare(b.id):a.providerName.localeCompare(b.providerName)||a.id.localeCompare(b.id));
 return r;
}
function addCell(tr,text,css=''){
 const td=elt('td',text,css);tr.append(td);return td;
}
function modelRow(m) {
 const tr=document.createElement('tr'),a=addCell(tr,'');
 a.append(elt('code',m.id),elt('div',m.name,'muted'));
 const p=addCell(tr,'');
 p.append(elt('div',m.providerName));
 const connected=m.activeConnections.length>0;
 p.append(elt('span',connected?m.activeConnections.length+' matching active connection(s)':m.connections.length?'No active match':'No matching connection found',connected?'small ok':'small muted'));
 addCell(tr,m.free?'Free flag present':'Not marked free',m.free?'ok':'muted');
 addCell(tr,m.context===null?'Unreported':m.context.toLocaleString());
 addCell(tr,m.output===null?'Unreported':m.output.toLocaleString());
 addCell(tr,m.vision?'Yes':'Unknown');
 const outcome=state.tests.get(m.provider+'|'+m.id),s=addCell(tr,'');
 if(outcome) s.append(elt('span',outcome.ok?'Passed · '+outcome.latency+'ms':outcome.rateLimited?'Rate limited':'Failed',outcome.ok?'ok':outcome.rateLimited?'warning':'bad'));
 else s.append(elt('span','Not tested','muted'));
 const actions=addCell(tr,'');
 const buttons=elt('div',undefined,'actions');
 const cp=elt('button','Copy','btn');cp.addEventListener('click',()=>copy(m.id));
 const queue=elt('button',state.plan.includes(m.id)?'Queued':'Queue','btn');queue.disabled=state.plan.includes(m.id);queue.addEventListener('click',()=>{state.plan.push(m.id);renderPlan();redraw()});
 const test=elt('button','Test','btn');test.title='Sends one inference request; can consume provider quota or incur charges';test.addEventListener('click',()=>testOne(m));
 buttons.append(cp,queue,test);actions.append(buttons);
 return tr;
}
function redraw(){
 const list=filterModels(),shown=list.slice(0,state.visible),root=$('rows');root.replaceChildren();
 const fragment=document.createDocumentFragment();
 for(const m of shown)fragment.append(modelRow(m));
 root.append(fragment);$('rowsCount').textContent='Showing '+shown.length+' of '+list.length+' filtered models';$('more').hidden=shown.length>=list.length;
 $('countTested').textContent=[...state.tests.values()].filter(x=>x.ok).length+'/'+state.tests.size;
}
async function testOne(m){
 if(!confirm('Test '+m.id+' with a real inference request?\n\nThis can use free quota or incur charges, depending on the connected provider.'))return;
 inform('Testing '+m.id+' (one real request)…');
 try{
  const response=await request('/api/test',{providerId:m.provider,modelId:m.id});
  state.tests.set(m.provider+'|'+m.id,{ok:response.status==='ok',latency:response.latencyMs||0,rateLimited:response.rateLimited});
  inform(response.status==='ok'?('Passed: '+m.id+', '+response.latencyMs+'ms'):('Test did not pass: '+(response.error||response.status)),response.status!=='ok');
 }catch(e){
  state.tests.set(m.provider+'|'+m.id,{ok:false,rateLimited:/429|limit/i.test(e.message)});
  inform('Test failed for '+m.id+': '+e.message,true);
 }
 redraw();
}
function renderPlan(){
 const root=$('plan');root.replaceChildren();
 if(!state.plan.length){root.append(elt('span','No models queued yet.','muted'));return}
 state.plan.forEach((id,i)=>{
  const row=elt('div',undefined,'planned'),left=elt('span');
  left.append(elt('span',(i+1)+'. '),elt('code',id));
  const buttons=elt('div',undefined,'actions');
  const up=elt('button','↑','btn');up.disabled=i===0;up.addEventListener('click',()=>{[state.plan[i-1],state.plan[i]]=[state.plan[i],state.plan[i-1]];renderPlan()});
  const down=elt('button','↓','btn');down.disabled=i===state.plan.length-1;down.addEventListener('click',()=>{[state.plan[i+1],state.plan[i]]=[state.plan[i],state.plan[i+1]];renderPlan()});
  const del=elt('button','Remove','btn');del.addEventListener('click',()=>{state.plan.splice(i,1);renderPlan();redraw()});
  buttons.append(up,down,del);row.append(left,buttons);root.append(row);
 });
}
function csv(){
 const lines=[['model_id','provider','display_name','free_marked','context_tokens','output_tokens','vision_flag','matching_active_connections','last_test']];
 for(const x of filterModels())lines.push([x.id,x.provider,x.name,x.free,x.context??'',x.output??'',x.vision,x.activeConnections.length,state.tests.get(x.provider+'|'+x.id)?.ok?'passed':'unverified']);
 const text=lines.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
 const link=document.createElement('a'),blob=new Blob([text],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
 link.href=url;link.download='OmniRoute-Model-Inventory.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
$('refresh').addEventListener('click',load);
$('retry').addEventListener('click',load);
$('sync').addEventListener('click',async ()=>{
 const provider=$('provider').value;
 const connected=connectionMatches(provider).filter(c=>c.isActive!==false);
 if(!provider||connected.length!==1){
  inform('Choose a provider with exactly one active matching connection. For providers with multiple accounts, use the original provider page to sync each account separately.',true);
  return;
 }
 if(!confirm('Synchronize the '+provider+' model catalog from its upstream provider?\n\nThis updates OmniRoute imported model records in merge mode (existing entries are kept). It may use provider discovery/rate-limit quota but does not send a chat completion.'))return;
 const button=$('sync');button.disabled=true;
 try{
  inform('Syncing models from '+provider+'…');
  const result=await request('/api/sync',{connectionId:connected[0].id});
  if(!result.ok)throw Error(result.error||'Model sync failed');
  await load();
  inform('Provider model sync completed for '+provider+'. Recheck availability by testing selected models individually.');
 }catch(e){inform('Model sync failed: '+e.message,true)}
 finally{button.disabled=!$('provider').value}
});
$('provider').addEventListener('change',()=>{$('sync').disabled=!$('provider').value});
for(const id of ['search','sort','provider','connectedOnly','freeOnly'])$(id).addEventListener(id==='search'?'input':'change',()=>{state.visible=150;redraw()});
$('more').addEventListener('click',()=>{state.visible+=150;redraw()});
$('export').addEventListener('click',csv);
$('clearPlan').addEventListener('click',()=>{state.plan=[];renderPlan();redraw()});
$('copyPlan').addEventListener('click',()=>copy(state.plan.join('\n')));
routeCards();renderPlan();load();
