// Cloudflare Worker + D1: Nasledie XXI voting. One vote per Notibot user.
const SITE_ORIGIN='https://julskazka.github.io';
const END_AT='2026-11-21T20:59:00.000Z'; // 21 Nov 2026, 23:59 Moscow
function reply(payload,status=200,origin=''){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
 if(origin===SITE_ORIGIN){headers['Access-Control-Allow-Origin']=SITE_ORIGIN;headers['Vary']='Origin';}
 return new Response(JSON.stringify(payload),{status,headers});
}
function voterIdOk(v){return typeof v==='string'&&/^(tg|max|nb):[A-Za-z0-9_.:-]{1,100}$/.test(v);}
async function initialize(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS votes (voter_id TEXT PRIMARY KEY NOT NULL, nominee_id INTEGER NOT NULL, updated_at TEXT NOT NULL)').run();
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
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'';
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
  if(request.method==='OPTIONS'){
   if(origin!==SITE_ORIGIN)return new Response(null,{status:403});
   return new Response(null,{status:204,headers:{
    'Access-Control-Allow-Origin':SITE_ORIGIN,
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Max-Age':'86400',Vary:'Origin'
   }});
  }
  if(!env.DB)return reply({ok:false,error:'Не подключена база D1: привязка DB'},503,origin);
  try{
   await initialize(env.DB);
   if(request.method==='GET'&&path==='/api/health'){
    await env.DB.prepare('SELECT COUNT(*) AS n FROM votes').first();
    return reply({ok:true,database:'connected',endAt:END_AT},200,origin);
   }
   if(request.method==='GET'&&path==='/api/votes'){
    return reply(await data(env.DB,url.searchParams.get('userId')),200,origin);
   }
   if(request.method==='POST'&&path==='/api/vote'){
    if(origin!==SITE_ORIGIN)return reply({ok:false,error:'Недопустимый источник запроса'},403,origin);
    if(Date.now()>=Date.parse(END_AT))return reply({ok:false,error:'Голосование завершено'},403,origin);
    const raw=await request.text();
    if(raw.length>1200)return reply({ok:false,error:'Слишком большой запрос'},413,origin);
    let body;try{body=JSON.parse(raw);}catch{return reply({ok:false,error:'Неверный формат запроса'},400,origin);}
    const id=body?.userId,n=body?.nomineeId;
    if(!voterIdOk(id)||!Number.isInteger(n)||n<1||n>100)return reply({ok:false,error:'Неверный ID пользователя или номинанта'},400,origin);
    await env.DB.prepare('INSERT INTO votes (voter_id,nominee_id,updated_at) VALUES (?,?,?) ON CONFLICT(voter_id) DO UPDATE SET nominee_id=excluded.nominee_id,updated_at=excluded.updated_at')
      .bind(id,n,new Date().toISOString()).run();
    return reply(await data(env.DB,id),200,origin);
   }
   return reply({ok:false,error:'Маршрут не найден'},404,origin);
  }catch(err){
   console.error('Voting Worker error',err?.stack||err);
   return reply({ok:false,error:'Ошибка базы данных или сервера'},500,origin);
  }
 }
};