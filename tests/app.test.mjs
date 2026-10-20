import test from 'node:test';
import assert from 'node:assert/strict';
const memory=new Map(),listeners={};
class Element {
 constructor(){this.innerHTML='';this.textContent='';this.value='';this.disabled=false;this.open=false;this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.handlers={};}
 remove(){}
 append(child){this.child=child;}
 addEventListener(event,handler){this.handlers[event]=handler;}
 querySelector(){return null;}
 querySelectorAll(){return [];}
 insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML;}
}
const nodes=Object.fromEntries(['nav','mobile-nav','selected-date','date-control','date-slot','save-state','date-label','pull-refresh','sync-button','settings-button','import-health-button','main','toast','modal','modal-title','modal-save','app-version','version-status','check-update','install-update','modal-body','json-file','close-modal','update-banner','apply-update'].map(k=>['#'+k,new Element()]));
globalThis.document={body:new Element(),hidden:false,querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],addEventListener:(e,f)=>{listeners['document:'+e]=f;}};
globalThis.localStorage=globalThis.sessionStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
let reloads=0;globalThis.location={hash:'',reload(){reloads++;}};
globalThis.window={addEventListener:(e,f)=>{listeners[e]=f;},scrollTo(){}};
const swEvents={},messages=[];let checks=0;
const registration={waiting:{postMessage:m=>messages.push(m)},installing:null,addEventListener(){},async update(){checks++;}};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true,serviceWorker:{controller:{},async register(){return registration;},addEventListener:(event,handler)=>{swEvents[event]=handler;}}},configurable:true});
const realInterval=globalThis.setInterval;
globalThis.setInterval=()=>0;
await import('../app/app.js');
globalThis.setInterval=realInterval;
await new Promise(resolve=>setImmediate(resolve));
test('默认展示今天，空账户不展示演示计划或创建记录',()=>{assert.match(nodes['#main'].innerHTML,/今天/);assert.match(nodes['#main'].innerHTML,/To Do List/);assert.doesNotMatch(nodes['#main'].innerHTML,/class="metrics"|重要事项/);assert.equal(memory.size,0);assert.equal(nodes['#save-state'].textContent,'仅本机');});
test('五个页面与设置在空记录下都能渲染',()=>{for(const [hash,text]of [['health','<h1>健康'],['training','<h1>训练'],['work','<h1>工作'],['review','<h1>复盘'],['settings','<h1>设置']]){location.hash='#'+hash;listeners.hashchange();assert.ok(nodes['#main'].innerHTML.includes(text),hash);}const html=nodes['#main'].innerHTML;assert.equal((html.match(/<input /g)||[]).length,1);assert.match(html,/name="token"/);assert.doesNotMatch(html,/name="repo"|name="branch"|备份|Apple/);});
test('选中历史日期后日期控件与视图保持一致',()=>{nodes['#selected-date'].onchange({target:{value:'2026-01-01'}});assert.equal(nodes['#selected-date'].value,'2026-01-01');location.hash='#today';listeners.hashchange();assert.match(nodes['#main'].innerHTML,/历史记录/);assert.doesNotMatch(nodes['#main'].innerHTML,/明日预览/);});
test('HTML插入的用户文本被转义',async()=>{memory.set('lizi-life:data:liziyaaa/lizi_workout_data:main',JSON.stringify({schemaVersion:1,days:{'2026-01-01':{schemaVersion:1,date:'2026-01-01',records:{a:{id:'a',type:'task',date:'2026-01-01',updatedAt:'2026-01-01T00:00:00Z',body:{title:'<img src=x onerror=alert(1)>',done:false}}}}},base:{},dirty:[],health:{},healthDirty:[],plans:{}}));listeners.storage({key:'lizi-life:data:liziyaaa/lizi_workout_data:main',newValue:'changed'});assert.match(nodes['#main'].innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.equal(nodes['#main'].innerHTML.includes('<img src=x'),false);});

test('发现等待版本显示更新提示，并阻止编辑中更新',()=>{assert.equal(nodes['#update-banner'].hidden,false);assert.equal(checks,0);nodes['#modal'].open=true;nodes['#apply-update'].onclick();assert.equal(messages.length,0);nodes['#modal'].open=false;nodes['#apply-update'].onclick();assert.deepEqual(messages,[{type:'SKIP_WAITING'}]);swEvents.controllerchange();swEvents.controllerchange();assert.equal(reloads,1);});

 test('首页和训练页只有勾选清单，没有状态横幅或采纳流程',()=>{const key='lizi-life:data:liziyaaa/lizi_workout_data:main',fixture=JSON.parse(memory.get(key));fixture.plans={'2026-10-20':{schemaVersion:1,id:'synthetic-ui-fixture',date:'2026-10-20',summary:'合成测试夹具',tasks:['模拟事项A','模拟事项B','模拟事项C'],exercises:[{id:'fixture-a',name:'模拟动作A',sets:2,reps:'8次'},{id:'fixture-b',name:'模拟动作B',sets:2,reps:'8次'}]}};memory.set(key,JSON.stringify(fixture));listeners.storage({key,newValue:'changed'});nodes['#selected-date'].onchange({target:{value:'2026-10-20'}});for(const hash of ['today','training']){location.hash='#'+hash;listeners.hashchange();const html=nodes['#main'].innerHTML;assert.match(html,/data-exercise-toggle/);assert.doesNotMatch(html,/记录训练|逐组|余力|已记录状态|记录状态|采纳计划|调整后采纳|plan-response/);}});

test('直接勾选、取消与删除都持久保存，重开视图不丢失',()=>{location.hash='#training';listeners.hashchange();const html=nodes['#main'].innerHTML;const id=html.match(/data-exercise-toggle="([^"]+)"/)[1];listeners['document:change']({target:{dataset:{exerciseToggle:id},checked:true}});let data=JSON.parse(memory.get('lizi-life:data:liziyaaa/lizi_workout_data:main'));assert.equal(data.days['2026-10-20'].records[id].body.done,true);assert.ok(data.dirty.includes('2026-10-20'));listeners.hashchange();assert.match(nodes['#main'].innerHTML,new RegExp('data-exercise-toggle="'+id+'" checked'));listeners['document:change']({target:{dataset:{exerciseToggle:id},checked:false}});data=JSON.parse(memory.get('lizi-life:data:liziyaaa/lizi_workout_data:main'));assert.equal(data.days['2026-10-20'].records[id].body.done,false);const el={dataset:{action:'remove-exercise',id}};listeners['document:click']({target:{closest:s=>s==='[data-action]'?el:null}});data=JSON.parse(memory.get('lizi-life:data:liziyaaa/lizi_workout_data:main'));assert.equal(data.days['2026-10-20'].records[id].deleted,true);listeners.hashchange();assert.ok(!nodes['#main'].innerHTML.includes('data-exercise-toggle="'+id+'"'));});


test('设置提供当前版本和手动更新入口，手动检查绕过自动检查间隔',async()=>{
 location.hash='#settings';listeners.hashchange();
 assert.match(nodes['#main'].innerHTML,/当前版本/);assert.match(nodes['#main'].innerHTML,/data-action="check-update"/);assert.match(nodes['#main'].innerHTML,/data-action="apply-update"/);
 const waiting=registration.waiting;registration.waiting=null;
 const click=()=>listeners['document:click']({target:{closest:s=>s==='[data-action]'?{dataset:{action:'check-update'}}:null}});
 click();await new Promise(r=>setImmediate(r));const before=checks;
 assert.equal(nodes['#version-status'].textContent,'已是最新版本');
 click();await new Promise(r=>setImmediate(r));assert.equal(checks,before+1);
 const original=registration.update;registration.update=async()=>{throw new Error('offline');};navigator.onLine=false;
 click();await new Promise(r=>setImmediate(r));assert.equal(nodes['#version-status'].textContent,'离线，联网后重试');assert.equal(nodes['#check-update'].disabled,false);
 registration.update=original;registration.waiting=waiting;navigator.onLine=true;
});


test('AI待办在首页可勾选并持久化，工作页共享状态，删除后不复活',()=>{
 nodes['#selected-date'].onchange({target:{value:'2026-10-20'}});location.hash='#today';listeners.hashchange();
 let html=nodes['#main'].innerHTML;assert.match(html,/To Do List/);assert.doesNotMatch(html,/class="metrics"|重要事项/);
 const id=html.match(/data-task-toggle="([^"]+)"/)[1];
 listeners['document:change']({target:{dataset:{taskToggle:id},checked:true}});
 let stored=JSON.parse(memory.get('lizi-life:data:liziyaaa/lizi_workout_data:main'));assert.equal(stored.days['2026-10-20'].records[id].body.done,true);
 location.hash='#work';listeners.hashchange();assert.match(nodes['#main'].innerHTML,new RegExp('data-task-toggle="'+id+'" checked'));
 const el={dataset:{action:'remove-task',id}};listeners['document:click']({target:{closest:s=>s==='[data-action]'?el:null}});
 listeners.hashchange();assert.ok(!nodes['#main'].innerHTML.includes('data-task-toggle="'+id+'"'));
 stored=JSON.parse(memory.get('lizi-life:data:liziyaaa/lizi_workout_data:main'));assert.equal(stored.days['2026-10-20'].records[id].deleted,true);
});

test('健康页仅保留四项指标和七天趋势，导入移到页头',()=>{
 const health={'2026-10-19':{schemaVersion:1,date:'2026-10-19',generatedAt:'2026-10-20T06:21:23Z',source:'Apple Health ZIP',metrics:{sleepMinutes:420,averageHeartRate:72},provenance:{sleep:{source:'Mi Fitness',lastRecordAt:'2026-10-19T05:19:00Z'},heartRate:{source:'Mi Fitness',lastRecordAt:'2026-10-19T14:00:00Z'}},heartRate:{count:48,average:72,min:55,max:110,hourly:[]}},'2026-10-20':{schemaVersion:1,date:'2026-10-20',generatedAt:'2026-10-20T06:21:23Z',source:'Apple Health ZIP',metrics:{steps:5000},quality:{partialDay:true,notes:[]}}};
 memory.set('lizi-life:data:liziyaaa/lizi_workout_data:main',JSON.stringify({schemaVersion:1,days:{},health,dirty:[],healthDirty:[],plans:{}}));listeners.storage({key:'lizi-life:data:liziyaaa/lizi_workout_data:main',newValue:'changed'});
 nodes['#selected-date'].onchange({target:{value:'2026-10-20'}});location.hash='#health';listeners.hashchange();const html=nodes['#main'].innerHTML;assert.match(html,/7.0/);assert.match(html,/10\/19/);assert.match(html,/平均心率/);assert.match(html,/体重/);assert.match(html,/七天睡眠/);assert.match(html,/七天活动/);assert.doesNotMatch(html,/主观感受|交给 ChatGPT|data-action="import-health"|copy-health-summary|manual-health|health-help|class="notice/);assert.equal(nodes['#import-health-button'].hidden,false);assert.equal(nodes['#settings-button'].hidden,true);
 const el={dataset:{action:'import-health'}};listeners['document:click']({target:{closest:s=>s==='[data-action]'?el:null}});assert.match(nodes['#modal-body'].innerHTML,/name="archive"/);assert.match(nodes['#modal-body'].innerHTML,/name="from"/);assert.match(nodes['#modal-body'].innerHTML,/accept=".zip,application\/zip,application\/x-zip-compressed"/);assert.doesNotMatch(nodes['#modal-body'].innerHTML,/\.json|\.xml/);
});

test('手动补记体重不丢失导入心率与睡眠细节；改睡眠时移除旧区间',async()=>{
 const key='lizi-life:data:liziyaaa/lizi_workout_data:main',data=JSON.parse(memory.get(key));const h=data.health['2026-10-19'];h.sleep={source:'Mi Fitness',basis:'mi-fitness-duration',totalMinutes:420,mainMinutes:400,napMinutes:20,segments:[]};memory.set(key,JSON.stringify(data));listeners.storage({key,newValue:'changed'});nodes['#selected-date'].onchange({target:{value:'2026-10-19'}});
 const originalQuery=nodes['#modal-body'].querySelector,originalData=globalThis.FormData;let submit;
 const form={values:new Map([['sleepMinutes','420'],['steps',''],['restingHeartRate',''],['weightKg','70']]),querySelector:()=>({textContent:'保存补记'}),addEventListener:(name,f)=>{if(name==='submit')submit=f;}};
 nodes['#modal-body'].querySelector=s=>s==='form'?form:null;nodes['#modal'].showModal=()=>{nodes['#modal'].open=true;};nodes['#modal'].close=()=>{nodes['#modal'].open=false;};globalThis.FormData=function(f){return f.values;};
 try{
  const open=()=>listeners['document:click']({target:{closest:s=>s==='[data-action]'?{dataset:{action:'manual-health'}}:null}});open();await submit({preventDefault(){}});
  let saved=JSON.parse(memory.get(key)).health['2026-10-19'];assert.equal(saved.metrics.weightKg,70);assert.equal(saved.heartRate.count,48);assert.equal(saved.sleep.totalMinutes,420);assert.equal(saved.provenance.heartRate.source,'Mi Fitness');
  form.values.set('sleepMinutes','400');open();await submit({preventDefault(){}});saved=JSON.parse(memory.get(key)).health['2026-10-19'];assert.equal(saved.metrics.sleepMinutes,400);assert.equal(saved.sleep,undefined);assert.equal(saved.heartRate.count,48);
 }finally{nodes['#modal-body'].querySelector=originalQuery;globalThis.FormData=originalData;nodes['#modal'].open=false;}
});


test('各页只在指定位置显示设置或导入，工作训练下方为无提示的Note',()=>{
 for(const page of ['today','health','training','work','review','settings']){location.hash='#'+page;listeners.hashchange();assert.equal(nodes['#settings-button'].hidden,page!=='review',page);assert.equal(nodes['#import-health-button'].hidden,page!=='health',page);if(['work','training'].includes(page)){assert.match(nodes['#main'].innerHTML,/data-note-section="/);assert.doesNotMatch(nodes['#main'].innerHTML,/留给下一次对话|问题先记下来|placeholder=/);}}
 location.hash='#review';listeners.hashchange();assert.match(nodes['#main'].innerHTML,/近七天/);assert.match(nodes['#main'].innerHTML,/data-note-section="review"/);assert.doesNotMatch(nodes['#main'].innerHTML,/To Do List|训练计划|尚无晚间复盘|留下足迹|写晚间复盘/);
});

test('Note输入即保存，工作与训练分开，日期隔离且重绘后保留并转义',()=>{
 nodes['#selected-date'].onchange({target:{value:'2026-02-02'}});location.hash='#work';listeners.hashchange();
 listeners['document:input']({target:{dataset:{noteSection:'work'},value:'测试记录\n<textarea>安全文本</textarea>'}});
 let data=JSON.parse(memory.get('lizi-life:data:liziyaaa/lizi_workout_data:main'));assert.equal(data.days['2026-02-02'].records['note-work'].body.text,'测试记录\n<textarea>安全文本</textarea>');assert.ok(data.dirty.includes('2026-02-02'));listeners.hashchange();assert.match(nodes['#main'].innerHTML,/&lt;textarea&gt;安全文本&lt;\/textarea&gt;/);
 location.hash='#training';listeners.hashchange();assert.doesNotMatch(nodes['#main'].innerHTML,/安全文本/);listeners['document:input']({target:{dataset:{noteSection:'training'},value:'另一份模拟记录'}});
 nodes['#selected-date'].onchange({target:{value:'2026-02-03'}});assert.doesNotMatch(nodes['#main'].innerHTML,/另一份模拟记录/);nodes['#selected-date'].onchange({target:{value:'2026-02-02'}});assert.match(nodes['#main'].innerHTML,/另一份模拟记录/);
 listeners['document:input']({target:{dataset:{noteSection:'training'},value:''}});data=JSON.parse(memory.get('lizi-life:data:liziyaaa/lizi_workout_data:main'));assert.equal(data.days['2026-02-02'].records['note-training'].body.text,'');
});
