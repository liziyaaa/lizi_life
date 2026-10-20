import test from 'node:test';
import assert from 'node:assert/strict';
import {findWaitingUpdate} from '../app/updates.js';
test('漏掉提示后仍可重新获取已下载的等待版本，离线也不强制重新下载',async()=>{
 const waiting={postMessage(){}};let checks=0;
 assert.equal(await findWaitingUpdate({waiting,update:async()=>{checks++;}}),waiting);assert.equal(checks,0);
});
test('下载完成前不误报为最新，等待安装完成后返回可更新版本',async()=>{
 const worker=new EventTarget();worker.state='installing';
 const waiting={},reg={waiting:null,installing:worker,update:async()=>{}};
 const result=findWaitingUpdate(reg);await new Promise(r=>setImmediate(r));
 reg.waiting=waiting;worker.state='installed';worker.dispatchEvent(new Event('statechange'));
 assert.equal(await result,waiting);
});
test('没有新worker时确认已完成检查，网络错误和安装失败则明确失败',async()=>{
 assert.equal(await findWaitingUpdate({update:async()=>{}}),null);
 await assert.rejects(findWaitingUpdate({update:async()=>{throw new Error('network');}}),/network/);
 const worker=new EventTarget();worker.state='installing';
 const pending=findWaitingUpdate({installing:worker,update:async()=>{}});
 await new Promise(r=>setImmediate(r));worker.state='redundant';worker.dispatchEvent(new Event('statechange'));
 await assert.rejects(pending,/下载失败/);
});
test('慢速下载检查有时间上限，不虚报最新或永久卡在检查中',async()=>{
 const worker=new EventTarget();worker.state='installing';
 await assert.rejects(findWaitingUpdate({installing:worker,update:async()=>{}},{timeoutMs:10}),/仍在下载/);
});
