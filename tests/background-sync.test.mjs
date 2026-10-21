import test from 'node:test';
import assert from 'node:assert/strict';
import {dayKey,emptyDay,exerciseId} from '../app/core.js';

// A slow server must not lock editing or acknowledge newer edits as uploaded.
test('后台上传期间反复勾选和写Note立即保存，下一批上传最终状态',async()=>{
 const date=dayKey(),id=exerciseId({id:'synthetic-background-action'}),key='lizi-life:data:liziyaaa/lizi_workout_data:main';
 const day=emptyDay(date);day.records[id]={id,type:'exercise',date,updatedAt:'2026-01-01T00:00:00Z',body:{name:'合成动作',done:false,detail:'2组'}};
 const memory=new Map([[key,JSON.stringify({schemaVersion:1,days:{[date]:day},base:{},dirty:[date],health:{},healthDirty:[],plans:{}})],['lizi-life:token','synthetic-token']]);
 const listeners={},timers=new Map(),intervals=[];let seq=0;
 class Element{
  constructor(){this.innerHTML='';this.textContent='';this.value='';this.open=false;this.dataset={};this.classList={add(){},remove(){},toggle(){}};}
  remove(){} append(){} addEventListener(){} querySelector(){return null;} querySelectorAll(){return [];} insertAdjacentHTML(){}
 }
 const nodes=new Map();const node=s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);};
 const old={document:globalThis.document,window:globalThis.window,location:globalThis.location,localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage,fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,setInterval:globalThis.setInterval};
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const add=(name,f)=>{(listeners[name]??=[]).push(f);};
 const emit=(name,event)=>{for(const f of listeners[name]||[])f(event);};
 globalThis.document={body:new Element(),hidden:false,querySelector:node,querySelectorAll:()=>[],addEventListener:(n,f)=>add('document:'+n,f)};
 globalThis.window={addEventListener:add,scrollTo(){}};globalThis.location={hash:'#training',search:'',reload(){}};
 globalThis.localStorage=globalThis.sessionStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 globalThis.setTimeout=(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
 globalThis.setInterval=(fn,ms)=>{intervals.push({fn,ms});return ++seq;};
 let release,started,puts=0,verify=0,active=0,maxActive=0;
 const gate=new Promise(r=>release=r),firstPut=new Promise(r=>started=r),remote=new Map();
 const response=(status,doc)=>({status,ok:status<400,json:async()=>doc});
 globalThis.fetch=async(url,o)=>{
  if(!url.includes('/contents/')){verify++;return response(200,{private:true});}
  const path=url.split('/contents/')[1].split('?')[0];
  active++;maxActive=Math.max(maxActive,active);
  try{
   if(o.method==='PUT'){
    puts++;if(puts===1){started();await gate;}
    remote.set(path,JSON.parse(Buffer.from(JSON.parse(o.body).content,'base64').toString('utf8')));return response(200,{});
   }
   const doc=remote.get(path);return doc?response(200,{sha:'synthetic-sha',encoding:'base64',content:Buffer.from(JSON.stringify(doc)).toString('base64')}):response(404,{});
  }finally{active--;}
 };
 const settle=async()=>{for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));};
 try{
  await import('../app/app.js?background-sync-test');await firstPut;
  assert.equal(node('#save-state').textContent,'同步中');
  for(const checked of [true,false,true])emit('document:change',{target:{dataset:{exerciseToggle:id},checked}});
  emit('document:input',{target:{dataset:{noteSection:'training'},value:'合成测试：网络请求尚未结束时填写。'}});
  let saved=JSON.parse(memory.get(key));assert.equal(saved.days[date].records[id].body.done,true);assert.equal(saved.days[date].records['note-training'].body.text,'合成测试：网络请求尚未结束时填写。');
  assert.ok([...timers.values()].some(t=>t.ms===1500));assert.equal(intervals[0].ms,45000);
  // Let the debounce fire while the original request is still pending.
  const [timerId,timer]=[...timers].find(([,t])=>t.ms===1500);timers.delete(timerId);timer.fn();
  release();await settle();
  saved=JSON.parse(memory.get(key));assert.equal(saved.days[date].records[id].body.done,true);assert.ok(saved.dirty.includes(date));
  const [queuedId,queued]=[...timers].find(([,t])=>t.ms===0);timers.delete(queuedId);await queued.fn();await settle();
  const uploaded=remote.get('data/days/'+date+'.json');assert.equal(uploaded.records[id].body.done,true);assert.equal(uploaded.records['note-training'].body.text,'合成测试：网络请求尚未结束时填写。');
  assert.equal(JSON.parse(memory.get(key)).dirty.length,0);assert.equal(puts,2);assert.equal(verify,2);assert.equal(maxActive,1);assert.match(node('#save-state').textContent,/已同步/);
 }finally{release();Object.assign(globalThis,old);if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;}
});
