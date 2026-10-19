import test from 'node:test';
import assert from 'node:assert/strict';
const memory=new Map(),listeners={};
class Element {
 constructor(){this.innerHTML='';this.textContent='';this.value='';this.disabled=false;this.open=false;this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.handlers={};}
 addEventListener(event,handler){this.handlers[event]=handler;}
 querySelector(){return null;}
 querySelectorAll(){return [];}
 insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML;}
}
const nodes=Object.fromEntries(['nav','mobile-nav','selected-date','save-state','sync-button','settings-button','main','toast','modal','modal-title','modal-body','json-file','close-modal','update-banner','apply-update'].map(k=>['#'+k,new Element()]));
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
test('默认展示明天，预览不会创建完成记录或健康数值',()=>{assert.match(nodes['#main'].innerHTML,/明日安排/);assert.match(nodes['#main'].innerHTML,/—<small>小时/);assert.match(nodes['#main'].innerHTML,/0 \/ 0/);assert.equal(memory.size,0);assert.equal(nodes['#save-state'].textContent,'仅本机保存');});
test('五个页面与设置在空记录下都能渲染',()=>{for(const [hash,text]of [['health','<h1>健康'],['training','<h1>训练'],['work','<h1>工作'],['review','<h1>复盘'],['settings','<h1>设置']]){location.hash='#'+hash;listeners.hashchange();assert.ok(nodes['#main'].innerHTML.includes(text),hash);}const html=nodes['#main'].innerHTML;assert.equal((html.match(/<input /g)||[]).length,1);assert.match(html,/name="token"/);assert.doesNotMatch(html,/name="repo"|name="branch"|备份|Apple/);});
test('选中历史日期后日期控件与视图保持一致',()=>{nodes['#selected-date'].onchange({target:{value:'2026-01-01'}});assert.equal(nodes['#selected-date'].value,'2026-01-01');location.hash='#today';listeners.hashchange();assert.match(nodes['#main'].innerHTML,/历史记录/);assert.doesNotMatch(nodes['#main'].innerHTML,/明日预览/);});
test('HTML插入的用户文本被转义',async()=>{memory.set('lizi-life:data:liziyaaa/lizi_life:main',JSON.stringify({schemaVersion:1,days:{'2026-01-01':{schemaVersion:1,date:'2026-01-01',records:{a:{id:'a',type:'task',date:'2026-01-01',updatedAt:'2026-01-01T00:00:00Z',body:{title:'<img src=x onerror=alert(1)>',done:false}}}}},base:{},dirty:[],health:{},healthDirty:[],plans:{}}));listeners.storage({key:'lizi-life:data:liziyaaa/lizi_life:main',newValue:'changed'});assert.match(nodes['#main'].innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.equal(nodes['#main'].innerHTML.includes('<img src=x'),false);});

test('发现等待版本显示更新提示，并阻止编辑中更新',()=>{assert.equal(nodes['#update-banner'].hidden,false);assert.equal(checks,1);nodes['#modal'].open=true;nodes['#apply-update'].onclick();assert.equal(messages.length,0);nodes['#modal'].open=false;nodes['#apply-update'].onclick();assert.deepEqual(messages,[{type:'SKIP_WAITING'}]);swEvents.controllerchange();swEvents.controllerchange();assert.equal(reloads,1);});
