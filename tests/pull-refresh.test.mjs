import test from 'node:test';
import assert from 'node:assert/strict';
import {setupPullRefresh} from '../app/pull-refresh.js';
function fixture(){
 const events={},indicator={hidden:true,style:{setProperty(){},removeProperty(){}}},viewport={scrollY:0};let calls=0,allowed=true;
 const root={addEventListener:(event,handler)=>events[event]=handler};
 setupPullRefresh({indicator,root,viewport,canRefresh:()=>allowed,onRefresh:async()=>{calls++;}});
 const target={closest:()=>null};
 const gesture=(x,y,extra={})=>({touches:[{clientX:x,clientY:y}],target,cancelable:true,preventDefault(){this.prevented=true;},...extra});
 return {events,indicator,viewport,gesture,get calls(){return calls;},block(){allowed=false;}};
}
test('顶部足够距离下拉后松手只同步一次，并收回提示',async()=>{
 const f=fixture();f.events.touchstart(f.gesture(0,0));const move=f.gesture(0,140);f.events.touchmove(move);
 assert.equal(move.prevented,true);assert.equal(f.indicator.textContent,'松开同步');
 f.events.touchend();f.events.touchend();await new Promise(r=>setImmediate(r));
 assert.equal(f.calls,1);assert.equal(f.indicator.hidden,true);
});
test('短距离、横滑、离开顶部、交互控件、多指、取消和编辑中均不触发',async()=>{
 for(const mode of ['short','horizontal','scrolled','control','multi','cancel','blocked']){
  const f=fixture();if(mode==='scrolled')f.viewport.scrollY=40;if(mode==='blocked')f.block();
  f.events.touchstart(f.gesture(0,0,mode==='control'?{target:{closest:()=>({})}}:{}));
  f.events.touchmove(f.gesture(mode==='horizontal'?180:0,mode==='short'?30:140,mode==='multi'?{touches:[{},{}]}:{}));
  if(mode==='cancel')f.events.touchcancel();f.events.touchend();await new Promise(r=>setImmediate(r));assert.equal(f.calls,0,mode);
 }
});
