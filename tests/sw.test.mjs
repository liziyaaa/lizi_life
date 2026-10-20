import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('升级预缓存绕过旧HTTP资源，脚本和样式一起更新',async()=>{
 const events={},cached=new Map();let installed;
 class BrowserRequest extends Request{constructor(path,options){super(new URL(path,'https://example.test/lizi_life/'),options);}}
 const self={addEventListener:(name,callback)=>events[name]=callback};
 const caches={open:async()=>({addAll:async requests=>{for(const request of requests){const fresh=request.cache==='reload';cached.set(new URL(request.url).pathname,fresh?'new release':'old HTTP cache');}}})};
 vm.runInNewContext(await readFile('app/sw.js','utf8'),{self,caches,Request:BrowserRequest,URL});
 events.install({waitUntil:promise=>installed=promise});await installed;
 for(const resource of ['index.html','app.js','core.js','style.css','updates.js'])assert.equal(cached.get('/lizi_life/'+resource),'new release',resource);
});
