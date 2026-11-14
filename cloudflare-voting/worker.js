// NASLEDIE XXI voting: one current vote per Notibot user, saved in Cloudflare D1.
// Version 2026-11-15-embedded-transport. HTML form / JSONP transport is used only
// if fetch is blocked or stalls inside an embedded Notibot browser.
const END_AT='2026-11-21T20:59:00.000Z'; // 21 Nov 2026, 23:59 Moscow
const VERSION='2026-11-15-embedded-transport';
const CORS={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
function reply(payload,status=200){
 return new Response(JSON.stringify(payload),{status,headers:{...CORS,'Content-Type':'application/json; charset=utf-8'}});
}
function voterIdOk(v){return typeof v==='string'&&/^(tg|max|nb):[A-Za-z0-9_.:-]{1,100}$/.test(v);}
let initPromise;
function initialize(db){
 if(!initPromise){
  initPromise=db.prepare('CREATE TABLE IF NOT EXISTS votes (voter_id TEXT PRIMARY KEY NOT NULL, nominee_id INTEGER NOT NULL, updated_at TEXT NOT NULL)').run().catch(e=>{initPromise=null;throw e;});
 }
 return initPromise;
}
async function data(db,userId){
 const {results=[]}=await db.prepare('SELECT nominee_id, COUNT(*) AS count FROM votes GROUP BY nominee_id').all();
 const counts={};
 for(const row of results)counts[String(row.nominee_id)]=Number(row.count);
 let selected=null;
 if(voterIdOk(userId)){
  const row=await db.prepare('SELECT nominee_id FROM votes WHERE voter_id=?').bind(userId).first();
  selected=row?Number(row.nominee_id):null;
 }
 return {ok:true,counts,selected,endAt:END_AT};
}
async function vote(db,id,n){
 if(Date.now()>=Date.parse(END_AT))return {ok:false,error:'Голосование завершено'};
 if(!voterIdOk(id)||!Number.isInteger(n)||n<1||n>100)return {ok:false,error:'Неверный ID пользователя или номинанта'};
 await db.prepare('INSERT INTO votes (voter_id,nominee_id,updated_at) VALUES (?,?,?) ON CONFLICT(voter_id) DO UPDATE SET nominee_id=excluded.nominee_id,updated_at=excluded.updated_at').bind(id,n,new Date().toISOString()).run();
 return await data(db,id);
}
function jsonp(payload,callback){
 const output=callback+'('+JSON.stringify(payload).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+');';
 return new Response(output,{status:200,headers:{...CORS,'Content-Type':'application/javascript; charset=utf-8','Cross-Origin-Resource-Policy':'cross-origin','X-Content-Type-Options':'nosniff'}});
}
function formReply(requestId,payload){
 // Only emit a fixed script and JSON-escaped data, not HTML derived from users.
 const message=JSON.stringify({source:'nasledie-voting',requestId,payload})
   .replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return new Response('<!doctype html><meta charset="utf-8"><script>parent.postMessage('+message+', "*")</script>',{
  status:200,headers:{...CORS,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; frame-ancestors *",'Cross-Origin-Resource-Policy':'cross-origin'}
 });
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...CORS,
   'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Accept','Access-Control-Max-Age':'86400'
  }});
  if(!env.DB)return reply({ok:false,error:'Не подключена база D1: привязка DB'},503);
  try{
   await initialize(env.DB);
   if(request.method==='GET'&&path==='/api/health'){
    await env.DB.prepare('SELECT COUNT(*) AS n FROM votes').first();
    return reply({ok:true,database:'connected',endAt:END_AT,version:VERSION});
   }
   if(request.method==='GET'&&path==='/api/votes')return reply(await data(env.DB,url.searchParams.get('userId')));
   if(request.method==='GET'&&path==='/api/votes.js'){
    const cb=url.searchParams.get('callback')||'';
    if(!/^window\.__nasledie_nv_[a-zA-Z0-9_]{1,100}$/.test(cb))return reply({ok:false,error:'Неверный callback'},400);
    return jsonp(await data(env.DB,url.searchParams.get('userId')),cb);
   }
   if(request.method==='POST'&&path==='/api/vote'){
    const raw=await request.text();
    if(raw.length>1200)return reply({ok:false,error:'Слишком большой запрос'},413);
    let body;try{body=JSON.parse(raw);}catch{return reply({ok:false,error:'Неверный формат запроса'},400);}
    const result=await vote(env.DB,body?.userId,body?.nomineeId);
    return reply(result,result.ok?200:(Date.now()>=Date.parse(END_AT)?403:400));
   }
   if(request.method==='POST'&&path==='/api/vote-form'){
    const form=await request.formData();
    const id=String(form.get('userId')||''), n=Number(form.get('nomineeId'));
    const requestId=String(form.get('requestId')||'');
    if(!/^nv_[a-zA-Z0-9_]{1,100}$/.test(requestId))return formReply(requestId,{ok:false,error:'Неверный идентификатор запроса'});
    const result=await vote(env.DB,id,n);
    return formReply(requestId,result);
   }
   return reply({ok:false,error:'Маршрут не найден'},404);
  }catch(err){
   console.error('Voting Worker error',err?.stack||err);
   if(request.method==='POST'&&path==='/api/vote-form')return formReply('',{ok:false,error:'Ошибка базы данных или сервера'});
   return reply({ok:false,error:'Ошибка базы данных или сервера'},500);
  }
 }
};