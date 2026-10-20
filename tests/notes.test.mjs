import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDay,makeRecord,validateDay,mergeDays,noteText,validateBackup} from '../app/core.js';
import {healthAnalysisPayload} from '../app/health-data.js';
const date='2026-02-02';
test('Note通过日记录、备份和跨设备合并，分析摘要保留分区文字',()=>{
 const base=emptyDay(date),local=emptyDay(date),remote=emptyDay(date);
 local.records['note-work']=makeRecord('note',date,{section:'work',text:'模拟工作笔记'},'note-work');
 remote.records['note-training']=makeRecord('note',date,{section:'training',text:'模拟训练笔记'},'note-training');
 validateDay(local,date);const merged=mergeDays(base,local,remote);assert.equal(merged.conflicts.length,0);assert.equal(noteText(merged.doc,'work'),'模拟工作笔记');assert.equal(noteText(merged.doc,'training'),'模拟训练笔记');
 validateBackup({schemaVersion:1,app:'lizi-life',days:{[date]:merged.doc}});
 const payload=healthAnalysisPayload({[date]:merged.doc},{},date,1);assert.deepEqual(payload.days[0].notes,[{section:'work',text:'模拟工作笔记'},{section:'training',text:'模拟训练笔记'}]);
 const rival=structuredClone(local);rival.records['note-work'].body.text='不同设备编辑';assert.deepEqual(mergeDays(base,local,rival).conflicts,['note-work']);
});
test('旧问题和复盘可作为Note继续编辑；清空Note不复活旧文',()=>{
 const d=emptyDay(date);d.records.q=makeRecord('question',date,{text:'旧模拟问题'},'q');d.records.r=makeRecord('reflection',date,{text:'旧模拟复盘'},'r');
 assert.equal(noteText(d,'work'),'旧模拟问题');assert.equal(noteText(d,'review'),'旧模拟复盘');
 d.records.n=makeRecord('note',date,{section:'work',text:''},'n');assert.equal(noteText(d,'work'),'');
 d.records.n.body.section='invalid';assert.throws(()=>validateDay(d,date),/Note/);
});
