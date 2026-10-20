import test from 'node:test';
import assert from 'node:assert/strict';
import {setupSwipeActions} from '../app/swipe-actions.js';
function fixture(){
 const events={};const root={addEventListener:(n,f)=>events[n]=f};setupSwipeActions({root});
 const makeRow=()=>{const classes=new Set();const actions={inert:true,setAttribute(k,v){this[k]=v;}};const row={classes,actions,style:{setProperty(k,v){this[k]=v;}},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n)},querySelector:()=>actions,setPointerCapture(){},focus(){this.focused=true;}};row.closest=s=>s==='[data-swipe-row]'?row:null;return row;};
 const row=makeRow();
 const evt=(x,y,extra={})=>({pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,cancelable:true,target:{closest:s=>s==='[data-swipe-row]'?row:null},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra});
 const drag=(from,to)=>{events.pointerdown(evt(...from));const move=evt(...to);events.pointermove(move);events.pointerup(move);return move;};
 return {events,row,makeRow,evt,drag};
}
test('左滑仅显示操作，手势后的点击不会误勾选；右滑收起',()=>{
 const f=fixture();const move=f.drag([220,100],[80,105]);assert.ok(move.prevented);assert.ok(f.row.classes.has('swipe-open'));assert.equal(f.row.actions.inert,false);
 const click=f.evt(80,105);f.events.click(click);assert.ok(click.prevented);assert.ok(click.stopped);
 f.drag([80,105],[220,108]);assert.equal(f.row.classes.has('swipe-open'),false);assert.equal(f.row.actions.inert,true);
});
test('垂直滚动、短滑动、取消和多指都不展开',()=>{
 for(const mode of ['vertical','short','cancel','multi']){const f=fixture();f.events.pointerdown(f.evt(200,100));const move=f.evt(mode==='vertical'?205:mode==='short'?195:80,mode==='vertical'?200:100);f.events.pointermove(move);
 if(mode==='cancel')f.events.pointercancel();else if(mode==='multi')f.events.pointerdown(f.evt(80,100,{isPrimary:false,pointerId:2}));
 f.events.pointerup(move);assert.equal(f.row.classes.has('swipe-open'),false,mode);if(mode==='vertical'||mode==='short')assert.equal(move.prevented,undefined);
 }
});
test('键盘可以展开操作、Escape收起，打开另一行会关闭上一行',()=>{
 const f=fixture();f.events.keydown(f.evt(0,0,{target:f.row,key:'ArrowLeft'}));assert.ok(f.row.classes.has('swipe-open'));
 f.events.keydown(f.evt(0,0,{target:f.row,key:'Escape'}));assert.equal(f.row.actions.inert,true);assert.ok(f.row.focused);
 f.events.keydown(f.evt(0,0,{target:f.row,key:'ArrowLeft'}));const other=f.makeRow();f.events.pointerdown(f.evt(100,10,{target:{closest:s=>s==='[data-swipe-row]'?other:null}}));assert.equal(f.row.actions.inert,true);
});
test('滑动后立即触按操作按钮可生效，不会吞掉下一次独立点击',()=>{
 const f=fixture();f.drag([220,100],[80,100]);const target={closest:s=>s==='[data-swipe-row]'?f.row:s==='.swipe-actions'?f.row.actions:null};f.events.pointerdown(f.evt(80,100,{target}));const click=f.evt(80,100,{target});f.events.click(click);assert.equal(click.prevented,undefined);
});
