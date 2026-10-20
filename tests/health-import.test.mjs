import test from 'node:test';
import assert from 'node:assert/strict';
import {createHealthParser,buildHealthSummaries,mergeHealthImport,healthAnalysisPayload} from '../app/health-data.js';
import {parseHealthFile} from '../app/health-zip.js';
import {zipSync,strToU8} from '../app/fflate.js';
import {normalizeHealth,validateBackup} from '../app/core.js';
const opts={from:'2026-10-18',to:'2026-10-20'};
const rec=(type,value,start='2026-10-19 12:00:00 +0800',end=start,source='Mi Fitness',unit='count/min')=>`<Record type="${type.startsWith('HK')?type:'HKQuantityTypeIdentifier'+type}" sourceName="${source}" startDate="${start}" endDate="${end}" value="${value}" unit="${unit}"/>`;
const xml=body=>`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE HealthData [<!ELEMENT HealthData ANY>]><HealthData locale="zh_CN"><ExportDate value="2026-10-20 14:21:23 +0800"/>${body}</HealthData>`;
const parse=body=>{const p=createHealthParser(opts);const text=xml(body);for(let i=0;i<text.length;i+=17)p.push(text.slice(i,i+17),i+17>=text.length);return p.finish();};
test('分块XML、实体解码、精确去重和每小时心率摘要可保存往返',()=>{
 const a=rec('HeartRate',60),b=rec('HeartRate',100,'2026-10-19 13:00:00 +0800');const p=parse(a+a+b);assert.equal(p.duplicatesRemoved,1);const [h]=buildHealthSummaries(p);assert.equal(h.metrics.averageHeartRate,80);assert.equal(h.heartRate.count,2);assert.deepEqual(h.heartRate.hourly.map(x=>x.hour),[12,13]);assert.equal(h.heartRate.min,60);assert.equal(h.metrics.restingHeartRate,undefined);assert.deepEqual(normalizeHealth(h),h);assert.deepEqual(validateBackup({schemaVersion:1,app:'lizi-life',days:{},health:{[h.date]:h}}).health[h.date],h);
 const entity=parse(rec('HeartRate',70,undefined,undefined,'Band &amp; Watch'));assert.deepEqual(entity.sources.heartRate,['Band & Watch']);
});
test('小米卧床按已确认口径计为睡眠，跨午夜归属醒来日，午睡保留',()=>{
 const type='HKCategoryTypeIdentifierSleepAnalysis';const body=rec(type,'HKCategoryValueSleepAnalysisInBed','2026-10-18 23:00:00 +0800','2026-10-19 07:00:00 +0800','Mi Fitness','')+rec(type,'HKCategoryValueSleepAnalysisInBed','2026-10-19 13:00:00 +0800','2026-10-19 13:20:00 +0800','Mi Fitness','');const [h]=buildHealthSummaries(parse(body));assert.equal(h.date,'2026-10-19');assert.equal(h.metrics.sleepMinutes,500);assert.equal(h.sleep.mainMinutes,480);assert.equal(h.sleep.napMinutes,20);assert.equal(h.sleep.basis,'mi-fitness-duration');assert.equal(h.sleep.segments.length,2);
 const [generic]=buildHealthSummaries(parse(rec(type,'HKCategoryValueSleepAnalysisInBed','2026-10-18 23:00:00 +0800','2026-10-19 07:00:00 +0800','iPhone','')));assert.equal(generic.metrics.sleepMinutes,undefined);assert.equal(generic.metrics.inBedMinutes,480);
});
test('真实睡眠阶段合并重叠，不叠加卧床，夜间清醒不误算午睡',()=>{
 const type='HKCategoryTypeIdentifierSleepAnalysis';const rows=[['InBed','23:00','08:00'],['AsleepCore','23:00','03:00'],['AsleepDeep','02:00','03:00'],['Awake','03:00','03:20'],['AsleepREM','03:20','07:00']].map(([stage,a,b])=>rec(type,'HKCategoryValueSleepAnalysis'+stage,`${a==='23:00'?'2026-10-18':'2026-10-19'} ${a}:00 +0800`,`2026-10-19 ${b}:00 +0800`,'Watch',''));const [h]=buildHealthSummaries(parse(rows.join('')));assert.equal(h.metrics.sleepMinutes,460);assert.equal(h.sleep.basis,'asleep');assert.equal(h.sleep.napMinutes,0);assert.equal(h.sleep.mainMinutes,460);
});
test('不同设备步数不相加，来源选择严格，缺失保持未知；跨日区间按比例拆分',()=>{
 const body=rec('StepCount',100,'2026-10-19 10:00:00 +0800','2026-10-19 11:00:00 +0800','iPhone','count')+rec('StepCount',120,'2026-10-19 10:00:00 +0800','2026-10-19 11:00:00 +0800','Mi Fitness','count');const p=parse(body);assert.equal(buildHealthSummaries(p)[0].metrics.steps,120);assert.equal(buildHealthSummaries(p,{steps:'iPhone'})[0].metrics.steps,100);assert.equal(buildHealthSummaries(p,{steps:'Other'}).length,0);assert.equal(buildHealthSummaries(p)[0].metrics.sleepMinutes,undefined);
 const cross=parse(rec('StepCount',100,'2026-10-19 23:30:00 +0800','2026-10-20 00:30:00 +0800','iPhone','count'));assert.deepEqual(buildHealthSummaries(cross).map(h=>h.metrics.steps),[50,50]);assert.equal(buildHealthSummaries(cross)[1].quality.partialDay,true);
});
test('设备运动记录去重、单位换算，运动时长不来自手动勾选',()=>{
 const w='<Workout workoutActivityType="HKWorkoutActivityTypeCycling" sourceName="Bike" startDate="2026-10-19 18:00:00 +0800" endDate="2026-10-19 19:00:00 +0800" duration="50" durationUnit="min"><WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" sum="418.4" unit="kJ"/><WorkoutStatistics type="HKQuantityTypeIdentifierDistanceCycling" sum="20000" unit="m"/></Workout>';const [h]=buildHealthSummaries(parse(w+w));assert.equal(h.metrics.workoutMinutes,50);assert.equal(h.workouts.length,1);assert.equal(h.workouts[0].energyKcal,100);assert.equal(h.workouts[0].distanceKm,20);
 const payload=healthAnalysisPayload({'2026-10-19':{records:{a:{type:'exercise',body:{name:'训练',done:true}},b:{type:'task',body:{title:'私事'}}}}},{'2026-10-19':h},'2026-10-19',2);assert.equal(payload.days[0].health,null);assert.equal(payload.days[1].training.length,1);assert.equal(JSON.stringify(payload).includes('私事'),false);
});
test('重复导入幂等；较旧导出不能覆盖新摘要，手动指标可保留',()=>{
 const [h]=buildHealthSummaries(parse(rec('HeartRate',75)));assert.deepEqual(mergeHealthImport(h,structuredClone(h)),h);const older={...h,generatedAt:'2026-10-19T00:00:00Z',metrics:{averageHeartRate:60}};assert.equal(mergeHealthImport(h,older),h);const manual={...h,source:'手动补记',metrics:{weightKg:70}};assert.equal(mergeHealthImport(manual,h).metrics.weightKg,70);
});
test('ZIP只解析主XML，跳过CDA及轨迹；支持XML并拒绝缺失或截断文件',async()=>{
 const content=xml(rec('HeartRate',75));const zip=zipSync({'apple_health_export/export.xml':strToU8(content),'apple_health_export/export_cda.xml':strToU8('<xml>ignore</xml>'),'routes/1.gpx':strToU8('ignore')});const result=await parseHealthFile(new Blob([zip]),opts);assert.equal(buildHealthSummaries(result)[0].heartRate.count,1);assert.equal((await parseHealthFile(new Blob([content]),opts)).recordsScanned,1);await assert.rejects(parseHealthFile(new Blob([zipSync({'other.xml':strToU8(content)})]),opts),/没有/);await assert.rejects(parseHealthFile(new Blob([content.slice(0,-20)]),opts),/不完整|未导出完成/);await assert.rejects(parseHealthFile(new Blob([]),opts),/为空/);
});
test('日期范围与无效健康数值受限制，不展开外部实体',()=>{
 assert.throws(()=>createHealthParser({from:'2021-01-01',to:'2026-01-01'}),/366/);assert.equal(buildHealthSummaries(parse(rec('HeartRate','NaN'))).length,0);const [h]=buildHealthSummaries(parse(rec('HeartRate',75)));assert.throws(()=>normalizeHealth({...h,heartRate:{...h.heartRate,count:-1}}),/无效/);assert.throws(()=>normalizeHealth({...h,sleep:{basis:'fake'}}),/无效/);
});
