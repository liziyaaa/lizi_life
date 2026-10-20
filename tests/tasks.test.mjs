import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDay,taskItems,taskId,makeRecord,mergeDays,summarize} from '../app/core.js';
const date='2026-10-20',plan={id:'p1',date,tasks:['核对采购清单','确认仿真载荷']};
test('AI待办直接成为可勾选项，展示不制造完成记录',()=>{
 const d=emptyDay(date);assert.deepEqual(taskItems(d,plan).map(r=>r.done),[false,false]);assert.equal(Object.keys(d.records).length,0);
});
test('改计划编号和排序不重置已保存状态；编辑标题保持原id',()=>{
 const d=emptyDay(date),id=taskId(plan.tasks[0]);d.records[id]=makeRecord('task',date,{title:'采购清单已拆分',done:true},id);
 const rows=taskItems(d,{...plan,id:'p2',tasks:[...plan.tasks].reverse()});
 assert.equal(rows.find(r=>r.id===id).done,true);assert.equal(rows.find(r=>r.id===id).title,'采购清单已拆分');
});
test('删除AI待办后同步不复活；用户待办与其他设备新增可共存',()=>{
 const base=emptyDay(date),local=emptyDay(date),remote=emptyDay(date),id=taskId(plan.tasks[0]);
 local.records[id]={...makeRecord('task',date,{title:plan.tasks[0],done:false},id),deleted:true};
 remote.records.manual=makeRecord('task',date,{title:'用户新增',done:false},'manual');
 const merged=mergeDays(base,local,remote);assert.equal(merged.conflicts.length,0);
 assert.deepEqual(taskItems(merged.doc,plan).map(r=>r.title),['确认仿真载荷','用户新增']);
});
test('复盘统计包含AI计划待办，但只有实际勾选才算完成',()=>{
 const d=emptyDay(date),id=taskId(plan.tasks[0]);d.records[id]=makeRecord('task',date,{title:plan.tasks[0],done:true},id);
 assert.deepEqual(summarize({[date]:d},{[date]:plan}),{tasks:2,done:1,workouts:0});
});
