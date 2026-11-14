// Cloudflare Worker: GitHub-backed votes for НАСЛЕДИЕ XXI века.
// Required Worker secret: GITHUB_TOKEN (contents:write permission on julskazka/legacy).
// Optional vars: REPO_OWNER, REPO_NAME, ALLOWED_ORIGIN.
// WARNING: Notibot user IDs supplied by the browser are not cryptographically verified.
// Add provider-side session verification before treating these votes as verified.
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
const GH="https://api.github.com";
export default {
 async fetch(request,env){
  const origin=request.headers.get("origin")||"";
  const allowed=env.ALLOWED_ORIGIN||"https://julskazka.github.io";
  const headers={"access-control-allow-origin":allowed,"access-control-allow-methods":"GET, POST, OPTIONS","access-control-allow-headers":"content-type","vary":"Origin"};
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(origin && origin!==allowed)return json({error:"Недопустимый источник"},403,headers);
  const url=new URL(request.url);
  if(!["/vote","/results"].includes(url.pathname))return json({error:"Not found"},404,headers);
  if(url.pathname==="/results" && request.method==="GET"){
   try{const r=await ghGet(env,"votes/votes.json");return json(aggregate(r.data||{}),200,headers)}
   catch(err){return json({error:"Не удалось прочитать результаты"},503,headers)}
  }
  if(url.pathname!=="/vote"||request.method!=="POST")return json({error:"Method not allowed"},405,headers);
  if(!env.GITHUB_TOKEN)return json({error:"Хранилище голосов не настроено"},503,headers);
  let body;try{body=await request.json()}catch{return json({error:"Некорректные данные"},400,headers)}
  const userId=String(body?.userId??"").trim();
  const nomineeId=Number(body?.nomineeId);
  if(!/^[a-zA-Z0-9:_-]{1,100}$/.test(userId)||!Number.isInteger(nomineeId)||nomineeId<1||nomineeId>1000)return json({error:"Не указан корректный ID участника или номинанта"},400,headers);
  // Atomic-like compare-and-swap update: retry when GitHub contents API rejects stale SHA.
  for(let attempt=0;attempt<8;attempt++){
   try{
    const current=await ghGet(env,"votes/votes.json");
    const votes=current.data||{};
    votes[userId]={nominee_id:nomineeId,updated_at:new Date().toISOString()};
    await ghPut(env,"votes/votes.json",votes,current.sha);
    return json({ok:true,selected:nomineeId,...aggregate(votes)},200,headers);
   }catch(err){
    if(err.status===409||err.status===422){await new Promise(r=>setTimeout(r,100*(attempt+1)));continue}
    return json({error:"Не удалось сохранить голос"},503,headers);
   }
  }
  return json({error:"Сервис перегружен, повторите голосование"},503,headers);
 }
};
function aggregate(votes){
 const nominees={};for(const entry of Object.values(votes)){const id=String(entry?.nominee_id??"");if(/^\d+$/.test(id))nominees[id]=(nominees[id]||0)+1}
 return {updated_at:new Date().toISOString(),total_votes:Object.values(nominees).reduce((a,b)=>a+b,0),nominees};
}
function ghUrl(env,path){return `${GH}/repos/${env.REPO_OWNER||"julskazka"}/${env.REPO_NAME||"legacy"}/contents/${path}`;}
async function ghGet(env,path){
 const res=await fetch(ghUrl(env,path),{headers:{"authorization":`Bearer ${env.GITHUB_TOKEN}`,"accept":"application/vnd.github+json","x-github-api-version":"2022-11-28","user-agent":"nasledie-voting"}});
 if(res.status===404)return {data:{},sha:null};
 if(!res.ok)throw Object.assign(new Error("GitHub read failed"),{status:res.status});
 const j=await res.json();const bin=atob(j.content.replace(/\s/g,""));const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return {data:JSON.parse(new TextDecoder().decode(bytes)),sha:j.sha};
}
async function ghPut(env,path,content,sha){
 const bytes=new TextEncoder().encode(JSON.stringify(content,null,2)+"\n");
 let binary="";for(const b of bytes)binary+=String.fromCharCode(b);
 const payload={message:"Update award votes",content:btoa(binary),branch:"main"};if(sha)payload.sha=sha;
 const res=await fetch(ghUrl(env,path),{method:"PUT",headers:{"authorization":`Bearer ${env.GITHUB_TOKEN}`,"accept":"application/vnd.github+json","x-github-api-version":"2022-11-28","content-type":"application/json","user-agent":"nasledie-voting"},body:JSON.stringify(payload)});
 if(!res.ok)throw Object.assign(new Error("GitHub write failed"),{status:res.status});
}
