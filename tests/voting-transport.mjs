// Integration test: simulated D1 and Notibot iframe; never touches the production database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const {default: worker}=await import(process.env.VOTING_WORKER_MODULE);
const base='https://nasledie-voting.gogina-jul.workers.dev';
const votes=new Map();
const db={prepare(sql){
  let args=[];
  return {
    bind(...values){args=values;return this},
    async run(){
      if(sql.startsWith('INSERT INTO votes'))votes.set(args[0],args[1]);
      return {success:true};
    },
    async all(){
      const totals=new Map();
      for(const n of votes.values())totals.set(n,(totals.get(n)||0)+1);
      return {results:[...totals].map(([nominee_id,count])=>({nominee_id,count}))};
    },
    async first(){
      if(sql.startsWith('SELECT COUNT'))return {n:votes.size};
      if(sql.startsWith('SELECT nominee_id FROM votes')){
        return votes.has(args[0])?{nominee_id:votes.get(args[0])}:null;
      }
      return null;
    }
  };
}};
const env={DB:db};
const req=(path,options)=>new Request(base+path,options);
const fetchWorker=(url,options)=>worker.fetch(new Request(url,options),env);
let r=await worker.fetch(req('/api/health'),env);
assert.equal(r.status,200);
assert.equal((await r.json()).version,'2026-11-15-embedded-transport');
r=await worker.fetch(req('/api/vote',{method:'POST',headers:{Origin:'null','Content-Type':'text/plain'},body:JSON.stringify({userId:'tg:12345',nomineeId:1})}),env);
assert.equal(r.status,200);
assert.equal((await r.json()).selected,1);
r=await worker.fetch(req('/api/vote',{method:'POST',headers:{Origin:'null','Content-Type':'text/plain'},body:JSON.stringify({userId:'tg:12345',nomineeId:2})}),env);
assert.equal((await r.json()).selected,2);
assert.equal(votes.size,1,'re-vote must replace the previous vote');

const cb='window.__nasledie_nv_test_1';
r=await worker.fetch(req('/api/votes.js?userId=tg%3A12345&callback='+cb),env);
assert.equal(r.status,200);
assert.ok((await r.text()).startsWith(cb+'('));
const form=new URLSearchParams({userId:'tg:12345',nomineeId:'3',requestId:'nv_test_2'});
r=await worker.fetch(req('/api/vote-form',{method:'POST',headers:{Origin:'null'},body:form}),env);
assert.equal(r.status,200);
const html=await r.text();
assert.ok(html.includes('</script>'),'form response must contain a valid closing script');
assert.ok(html.includes('"selected":3'));
assert.equal(votes.size,1);

const listeners=new Map();
let iframe=null;
const win={
  NASLEDIE_VOTES_API:base,
  fetch:()=>Promise.reject(new TypeError('Simulated Notibot cross-origin fetch failure')),
  addEventListener:(name,fn)=>{const a=listeners.get(name)||[];a.push(fn);listeners.set(name,a);},
  removeEventListener:(name,fn)=>listeners.set(name,(listeners.get(name)||[]).filter(x=>x!==fn))
};
let context;
const document={
  createElement(tag){
    const el={tag,style:{},children:[],setAttribute(){},remove(){},
      appendChild(child){this.children.push(child);},
      submit(){
        assert.equal(this.tag,'form');
        const fields=new URLSearchParams();
        for(const child of this.children)fields.set(child.name,child.value);
        fetchWorker(this.action,{method:'POST',body:fields})
          .then(r=>r.text()).then(text=>{
            const script=text.match(/<script>([\s\S]*?)<\/script>/);
            assert.ok(script,'form must return a message script');
            vm.runInNewContext(script[1],{
              parent:{postMessage:(data)=>{for(const fn of listeners.get('message')||[])fn({source:iframe.contentWindow,origin:new URL(base).origin,data});}}
            });
          }).catch(console.error);
      }
    };
    if(tag==='iframe')el.contentWindow={};
    return el;
  },
  head:{appendChild(el){
    fetchWorker(el.src).then(r=>r.text()).then(src=>vm.runInContext(src,context)).catch(console.error);
  }},
  body:{appendChild(el){if(el.tag==='iframe')iframe=el;}}
};
context=vm.createContext({window:win,document,URL,AbortController,Response,DOMException,console,setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync('votes/config.js','utf8'),context);

let resp=await win.fetch(base+'/api/votes?userId=tg%3A12345',{cache:'no-store'});
assert.equal(resp.status,200,'JSONP fallback must provide a readable API response');
assert.equal((await resp.json()).selected,3);
resp=await win.fetch(base+'/api/vote',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({userId:'tg:12345',nomineeId:4})});
assert.equal(resp.status,200,'iframe POST fallback must confirm database write');
assert.equal((await resp.json()).selected,4);
assert.equal(votes.size,1);
assert.equal(votes.get('tg:12345'),4);
console.log('PASS: normal POST, Origin null, revote, JSONP read and iframe form write with verified D1 response.');
