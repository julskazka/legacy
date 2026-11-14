// The browser never receives a GitHub token; requests use the server proxy.
window.NASLEDIE_GITHUB_TOKEN = 'server-side-handler';
window.NASLEDIE_VOTES_API = 'https://nasledie-voting-api.vercel.app/api/votes';
(function(){
 const originalFetch=window.fetch.bind(window);
 const target=/^https:\/\/api\.github\.com\/repos\/julskazka\/legacy\/contents\/votes\/votes\.json(?:\?.*)?$/i;
 window.fetch=function(input,init){
  const url=typeof input==='string'?input:(input&&input.url);
  if(!url||!target.test(url))return originalFetch(input,init);
  const opts=init||{},method=String(opts.method||(input&&input.method)||'GET').toUpperCase();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),18000);
  let payload=opts.body;
  if(payload===undefined&&typeof Request!=='undefined'&&input instanceof Request)payload=input.clone().text();
  const settings={method:method==='PUT'?'POST':'GET',signal:controller.signal,cache:'no-store'};
  if(method==='PUT'){settings.body=payload;settings.headers={'Content-Type':'text/plain'};}
  return Promise.resolve(payload).then(body=>{
   if(method==='PUT')settings.body=body;
   return originalFetch(window.NASLEDIE_VOTES_API,settings);
  }).finally(()=>clearTimeout(timer));
 };
})();
window.addEventListener('notibot:update',()=>{if(typeof window.render==='function')window.render();});
