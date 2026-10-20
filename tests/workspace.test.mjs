import test from 'node:test';
import assert from 'node:assert/strict';
import {cacheKey,dataWorkspace,cleanKnownPreview,readWorkspace} from '../app/workspace.js';
import {GithubStore} from '../app/sync.js';
import {emptyDay,makeRecord} from '../app/core.js';
const date='2026-02-02';
test('测试目录与本机缓存独立，路径参数不能穿越或静默回落到真实目录',()=>{
 assert.equal(dataWorkspace().path('days',date),'data/days/'+date+'.json');assert.equal(dataWorkspace('loop-fixture').path('days',date),'data/test-runs/loop-fixture/days/'+date+'.json');assert.notEqual(cacheKey('owner/data','main'),cacheKey('owner/data','main','loop-fixture'));
 for(const value of ['../x','a/b','','__proto__','a?token=x'])assert.throws(()=>dataWorkspace(value));
 assert.throws(()=>dataWorkspace('loop').path('unknown',date));assert.throws(()=>dataWorkspace().path('days','wrong'));
});
test('仅清理已知演示标记，不删真实健康、计划、Note或完成记录',()=>{
 const state={days:{[date]:{records:{demo:{body:{planId:'preview-20261020'}},real:{body:{planId:'real-plan',done:true}},note:{body:{section:'work',text:'模拟真实笔记'}}}}},base:{},health:{[date]:{metrics:{steps:1234}}},plans:{old:{id:'preview-20261020'},real:{id:'real-plan'}},dirty:[date]};
 const cleaned=cleanKnownPreview(state);assert.equal(cleaned.removed,2);assert.ok(state.days[date].records.demo);assert.equal(cleaned.state.days[date].records.demo,undefined);assert.equal(cleaned.state.days[date].records.real.body.done,true);assert.deepEqual(cleaned.state.health,state.health);assert.ok(cleaned.state.plans.real);
});
test('测试写入只落隔离目录，不修改真实日文件；带测试标记不能写真实目录',async()=>{
 const requests=[];const fetcher=async(url,o)=>{requests.push({url,o});return new Response(JSON.stringify(o.method==='PUT'?{}:{}),{status:o.method==='PUT'?201:404});};
 const store=new GithubStore({repo:'owner/private',token:'not-a-real-token',testRunId:'loop-fixture'},fetcher),day=emptyDay(date);day.records.a=makeRecord('task',date,{title:'合成测试任务',done:true},'a');day.records.a.testRunId='loop-fixture';
 await store.syncDay(date,emptyDay(date),day);assert.ok(requests.every(r=>r.url.includes('/contents/data/test-runs/loop-fixture/')));await assert.rejects(()=>store.write('data/days/'+date+'.json',day),/真实目录/);
 const live=new GithubStore({repo:'owner/private',token:'not-a-real-token'},fetcher);await assert.rejects(()=>live.write('data/days/'+date+'.json',day),/测试记录/);
});
test('测试可以只读真实计划，读取基线不能携带真实文件的写入SHA',async()=>{
 const calls=[],store={testRunId:'fixture',path:(kind,d)=>'data/test-runs/fixture/'+kind+'/'+d+'.json',read:async path=>{calls.push(path);return path.startsWith('data/test-runs/')?null:{doc:{id:'baseline'},sha:'REAL_SHA'};}};
 const plan=await readWorkspace(store,'plans',date);assert.equal(plan.doc.id,'baseline');assert.equal(plan.sha,undefined);assert.equal(plan.baseline,true);assert.equal(await readWorkspace(store,'days',date),null);assert.equal(calls.at(-1),'data/test-runs/fixture/days/'+date+'.json');
});
