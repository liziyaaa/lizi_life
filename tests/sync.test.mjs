import test from 'node:test';
import assert from 'node:assert/strict';
import {GithubStore} from '../app/sync.js';
import {emptyDay,makeRecord} from '../app/core.js';
const date='2026-10-19';
const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const encoded=doc=>({sha:'SHA',encoding:'base64',content:Buffer.from(JSON.stringify(doc)).toString('base64')});
const local=()=>{const d=emptyDay(date);d.records.local=makeRecord('task',date,{title:'中文测试',done:false},'local');return d;};
const config={repo:'test/private',branch:'main',token:'TOKEN'};
test('拒绝公开仓库',async()=>{const s=new GithubStore(config,async()=>response(200,{private:false}));await assert.rejects(s.verifyPrivate(),/私有/);});
test('401不会被误认为文件不存在',async()=>{const s=new GithubStore(config,async()=>response(401,{}));await assert.rejects(s.read('data/days/x.json'),/密钥/);});
test('创建文件保留中文、使用Authorization并不把token写入body',async()=>{let put;const s=new GithubStore(config,async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer TOKEN');if(options.method==='PUT'){put=JSON.parse(options.body);return response(201,{});}return response(404,{});});const result=await s.syncDay(date,emptyDay(date),local());assert.equal(result.records.local.body.title,'中文测试');assert.equal(put.sha,undefined);assert.equal(JSON.stringify(put).includes('TOKEN'),false);assert.equal(JSON.parse(Buffer.from(put.content,'base64').toString()).records.local.body.title,'中文测试');});
test('云端未更改时重复同步不写入',async()=>{let writes=0;const d=local();const s=new GithubStore(config,async(url,o)=>{if(o.method==='PUT')writes++;return response(200,encoded(d));});await s.syncDay(date,d,d);assert.equal(writes,0);});
test('409重新读取后保留另一设备的新增记录',async()=>{let gets=0,puts=0,final;const remote=emptyDay(date);remote.records.remote=makeRecord('task',date,{title:'remote',done:false},'remote');const s=new GithubStore(config,async(url,o)=>{if(o.method==='PUT'){puts++;if(puts===1)return response(409,{});final=JSON.parse(Buffer.from(JSON.parse(o.body).content,'base64').toString());return response(200,{});}gets++;return gets===1?response(404,{}):response(200,encoded(remote));});await s.syncDay(date,emptyDay(date),local());assert.equal(gets,2);assert.deepEqual(Object.keys(final.records).sort(),['local','remote']);});
test('同条记录冲突不会发PUT并附带云端内容',async()=>{const base=local(),l=structuredClone(base),r=structuredClone(base);l.records.local.body.title='new local';r.records.local.body.title='new remote';let writes=0;const s=new GithubStore(config,async(url,o)=>{if(o.method==='PUT')writes++;return response(200,encoded(r));});await assert.rejects(s.syncDay(date,base,l),e=>e.conflicts[0]==='local'&&e.remote.records.local.body.title==='new remote');assert.equal(writes,0);});
test('403与网络失败保留调用方本机对象',async()=>{const l=local();const before=JSON.stringify(l);const s=new GithubStore(config,async()=>response(403,{}));await assert.rejects(s.syncDay(date,emptyDay(date),l),/权限/);assert.equal(JSON.stringify(l),before);});
test('409重试有上限',async()=>{let writes=0;const s=new GithubStore(config,async(url,o)=>{if(o.method==='PUT'){writes++;return response(409,{});}return response(404,{});});await assert.rejects(s.syncDay(date,emptyDay(date),local()),/云端/);assert.equal(writes,3);});

test('只填密钥时识别已配置的私有仓库',async()=>{
 const store=new GithubStore({repo:'owner/data',token:'test'},async()=>({ok:true,status:200,json:async()=>({private:true,full_name:'owner/data',default_branch:'main'})}));
 assert.equal((await store.discoverPrivate('owner/data')).full_name,'owner/data');
});
test('自动发现忽略公开代码仓库，优先使用命名数据仓库',async()=>{
 const store=new GithubStore({token:'test'},async url=>({ok:true,status:200,json:async()=>url.includes('/user/repos')?[{private:true,name:'other',full_name:'owner/other'},{private:true,name:'lizi_life_data',full_name:'owner/lizi_life_data'}]:{private:false}}));
 assert.equal((await store.discoverPrivate('owner/lizi_life')).full_name,'owner/lizi_life_data');
});
test('多个不明确的私有仓库时不猜测写入目标',async()=>{
 const store=new GithubStore({token:'test'},async()=>({ok:true,status:200,json:async()=>[{private:true,name:'a'},{private:true,name:'b'}]}));
 await assert.rejects(()=>store.discoverPrivate(),/仅授权一个/);
});

test('默认 fetch 保持浏览器全局调用上下文，保存和读写均可请求',async()=>{
 const original=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async function(url,options){
  assert.equal(this,globalThis,'Safari native fetch requires Window receiver');
  calls.push({url,options});
  if(url.includes('/user/repos'))return response(200,[{private:true,name:'lizi_life_data',full_name:'test/private'}]);
  if(url.includes('/contents/'))return options.method==='PUT'?response(201,{}):response(404,{});
  return response(200,{private:true});
 };
 try{
  const store=new GithubStore(config);
  assert.equal((await store.discoverPrivate()).full_name,'test/private');
  await store.verifyPrivate();
  await store.syncDay(date,emptyDay(date),local());
  assert.equal(calls.length,4);
  assert.equal(calls.at(-1).options.method,'PUT');
 }finally{globalThis.fetch=original;}
});
