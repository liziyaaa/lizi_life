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
const nodes=Object.fromEntries(['nav','mobile-nav','selected-date','save-state','sync-button','settings-button','main','toast','modal','modal-title','modal-body','json-file','close-modal'].map(k=>['#'+k,new Element()]));
globalThis.document={body:new Element(),hidden:false,querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],addEventListener:(e,f)=>{listeners['document:'+e]=f;}};
globalThis.localStorage=globalThis.sessionStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
globalThis.location={hash:''};
globalThis.window={addEventListener:(e,f)=>{listeners[e]=f;},scrollTo(){}};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
const realInterval=globalThis.setInterval;
globalThis.setInterval=()=>0;
await import('../app/app.js');
globalThis.setInterval=realInterval;
test('空数据首次打开渲染今日页、不伪造健康数值',()=>{assert.match(nodes['#main'].innerHTML,/今天的你，感觉怎么样/);assert.match(nodes['#main'].innerHTML,/等待健康数据/);assert.match(nodes['#main'].innerHTML,/0 \/ 0/);assert.equal(nodes['#save-state'].textContent,'仅本机保存');});
test('五个页面与设置在空记录下都能渲染',()=>{for(const [hash,text]of [['health','先了解自己的状态'],['training','每一次训练'],['work','把重要的事向前推进'],['review','把经历'],['settings','连接你的状态站']]){location.hash='#'+hash;listeners.hashchange();assert.ok(nodes['#main'].innerHTML.includes(text),hash);}});
test('选中历史日期后日期控件与视图保持一致',()=>{nodes['#selected-date'].onchange({target:{value:'2026-01-01'}});assert.equal(nodes['#selected-date'].value,'2026-01-01');location.hash='#today';listeners.hashchange();assert.match(nodes['#main'].innerHTML,/历史记录/);});
test('HTML插入的用户文本被转义',async()=>{memory.set('lizi-life:data:liziyaaa/lizi_life:main',JSON.stringify({schemaVersion:1,days:{'2026-01-01':{schemaVersion:1,date:'2026-01-01',records:{a:{id:'a',type:'task',date:'2026-01-01',updatedAt:'2026-01-01T00:00:00Z',body:{title:'<img src=x onerror=alert(1)>',done:false}}}}},base:{},dirty:[],health:{},healthDirty:[],plans:{}}));listeners.storage({key:'lizi-life:data:liziyaaa/lizi_life:main',newValue:'changed'});assert.match(nodes['#main'].innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.equal(nodes['#main'].innerHTML.includes('<img src=x'),false);});
