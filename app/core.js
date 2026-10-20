export const VERSION = '1.2.4';
export function dayKey(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
export function shiftDay(day, offset) { const d = new Date(day + 'T12:00:00+08:00'); d.setUTCDate(d.getUTCDate() + offset); return dayKey(d); }
export function isDay(day) { return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day + 'T00:00:00Z').toISOString().slice(0,10) === day; }
export const emptyDay = date => ({ schemaVersion: 1, date, records: {} });
const equal = (a,b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export function validateDay(doc, date) {
  if (!doc || doc.schemaVersion !== 1 || doc.date !== date || !doc.records || Array.isArray(doc.records) || typeof doc.records !== 'object') throw new Error('云端日记录格式不正确，未覆盖本机数据');
  for (const [id,r] of Object.entries(doc.records)) if (!/^[A-Za-z0-9_-]{1,180}$/.test(id) || ['__proto__','constructor','prototype'].includes(id) || !r || r.id !== id || r.date !== date || !['checkin','task','workout','exercise','question','reflection','health','planResponse'].includes(r.type) || typeof r.body !== 'object' || !r.body || !Number.isFinite(Date.parse(r.updatedAt))) throw new Error('云端记录存在无效字段');
  for (const r of Object.values(doc.records)) {
    const b=r.body;
    if (r.type==='exercise' && (typeof b.name!=='string' || !b.name.trim() || typeof b.done!=='boolean' || (b.detail!==undefined && typeof b.detail!=='string'))) throw new Error('动作清单格式不正确');
    if (r.type==='task' && (typeof b.title!=='string' || typeof b.done!=='boolean')) throw new Error('事项记录格式不正确');
    if (r.type==='workout' && (typeof b.name!=='string' || !['完成','部分完成','未完成'].includes(b.status) || !Array.isArray(b.sets) || b.sets.length>20 || b.sets.some(s=>!s || !Number.isFinite(+s.reps) || +s.reps<1 || +s.reps>1000 || s.weight!=='' && (!Number.isFinite(+s.weight) || +s.weight<0 || +s.weight>1500)))) throw new Error('训练记录格式不正确');
    if (['reflection','question'].includes(r.type) && typeof b.text!=='string') throw new Error('文字记录格式不正确');
    if (r.type==='checkin' && ['energy','fatigue','soreness','mood'].some(k=>!Number.isInteger(b[k])||b[k]<1||b[k]>5)) throw new Error('状态记录格式不正确');
    if (r.type==='health') normalizeHealth(b);
  }
  return doc;
}
export function mergeDays(base, local, remote) {
  validateDay(base, local.date); validateDay(local, local.date); validateDay(remote, local.date);
  const result = emptyDay(local.date), conflicts = [];
  for (const id of new Set([...Object.keys(base.records),...Object.keys(local.records),...Object.keys(remote.records)])) {
    const b=base.records[id], l=local.records[id], r=remote.records[id];
    if (equal(l,r)) result.records[id] = l;
    else if (equal(l,b)) result.records[id] = r;
    else if (equal(r,b)) result.records[id] = l;
    else conflicts.push(id);
    if (!result.records[id]) delete result.records[id];
  }
  return { doc: result, conflicts };
}
export function makeRecord(type,date,body,id = crypto.randomUUID()) { if (!isDay(date)) throw new Error('日期无效'); return {id,type,date,body,updatedAt:new Date().toISOString()}; }
export function records(doc,type) { return Object.values(doc?.records || {}).filter(r=>!r.deleted && (!type || r.type===type)); }
export function normalizeHealth(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !isDay(input.date)) throw new Error('健康 JSON 需要 date（YYYY-MM-DD）');
  if (!input.metrics || typeof input.metrics !== 'object' || Array.isArray(input.metrics)) throw new Error('健康 JSON 需要 metrics 对象，请参考设置里的示例');
  const limits={sleepMinutes:[0,1440],steps:[0,200000],restingHeartRate:[15,250],averageHeartRate:[15,250],weightKg:[10,400],activeEnergyKcal:[0,20000]};
  const metrics={};
  for (const [key,[min,max]] of Object.entries(limits)) {
    const v=input.metrics[key];
    if (v===undefined || v===null || v==='') continue;
    if (typeof v!=='number' || !Number.isFinite(v) || v<min || v>max) throw new Error(key+' 数值或单位不正确');
    metrics[key]=v;
  }
  if (!Object.keys(metrics).length) throw new Error('至少需要一项有效健康指标');
  if (!input.generatedAt || !Number.isFinite(Date.parse(input.generatedAt))) throw new Error('请提供有效的 generatedAt（数据生成时间）');
  if (Date.parse(input.generatedAt)>Date.now()+300000) throw new Error('数据生成时间不能在未来');
  return {schemaVersion:1,date:input.date,generatedAt:new Date(input.generatedAt).toISOString(),source:String(input.source||'手动导入').slice(0,100),metrics,coverage:input.coverage && typeof input.coverage==='object'?{start:String(input.coverage.start||''),end:String(input.coverage.end||'')}:null};
}
export function normalizePlan(p,date) {
  if (!p || p.schemaVersion!==1 || p.date!==date || typeof p.id!=='string' || !/^[A-Za-z0-9_-]{1,150}$/.test(p.id) || typeof p.summary!=='string') throw new Error('计划 JSON 格式不正确');
  if (p.tasks!==undefined && (!Array.isArray(p.tasks) || p.tasks.length>3 || p.tasks.some(t=>typeof t!=='string'))) throw new Error('计划 tasks 最多三项文字');
  if (p.exercises!==undefined && (!Array.isArray(p.exercises) || p.exercises.length>30 || p.exercises.some(e=>!e || typeof e.name!=='string' || !e.name.trim() || (e.id!==undefined && (typeof e.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(e.id))) || (e.sets!==undefined && (!Number.isInteger(e.sets)||e.sets<1||e.sets>20)) || (e.reps!==undefined && typeof e.reps!=='string')))) throw new Error('计划 exercises 格式不正确');
  return {schemaVersion:1,id:p.id,date,focus:String(p.focus||''),summary:p.summary,basedOn:String(p.basedOn||'未注明'),generatedAt:String(p.generatedAt||''),tasks:p.tasks||[],exercises:p.exercises||[]};
}
export function backup(data) { return {schemaVersion:1,app:'lizi-life',exportedAt:new Date().toISOString(),days:data.days,health:data.health,plans:data.plans}; }
export function validateBackup(input) {
  if (input?.schemaVersion!==1 || input.app!=='lizi-life' || !input.days || typeof input.days!=='object') throw new Error('不是 LiZi Life 备份文件');
  for (const [date,doc] of Object.entries(input.days)) { if (!isDay(date)) throw new Error('备份日期无效'); validateDay(doc,date); }
  for (const [date,h] of Object.entries(input.health||{})) { if (date!==h.date) throw new Error('健康日期不匹配'); normalizeHealth(h); }
  for (const [date,p] of Object.entries(input.plans||{})) normalizePlan(p,date);
  return input;
}
export function summarize(days) { return Object.values(days).reduce((s,d)=>{s.tasks+=records(d,'task').length;s.done+=records(d,'task').filter(r=>r.body.done).length;s.workouts+=trainingItems(d,null).filter(r=>r.done).length;return s;},{tasks:0,done:0,workouts:0}); }

// Stable per-day exercise identity: AI plan refreshes never reset user checkmarks.
export function exerciseId(exercise) {
  const key=exercise.id || exercise.name.trim().normalize('NFKC').toLocaleLowerCase('zh-CN');
  let a=2166136261,b=5381;
  for(const ch of key){a=Math.imul(a^ch.codePointAt(0),16777619);b=Math.imul(b,33)^ch.codePointAt(0);}
  return 'exercise-'+(a>>>0).toString(36)+'-'+(b>>>0).toString(36);
}
export function trainingItems(doc,plan) {
  const all=doc?.records||{},out=new Map();
  for(const e of plan?.exercises||[]) {
    const id=exerciseId(e),saved=all[id];
    if(saved?.deleted)continue;
    const body=saved?.body;
    out.set(id,{id,name:e.name,detail:[e.sets?e.sets+' 组':'',e.reps||''].filter(Boolean).join(' × '),done:false,source:'ai',planId:plan.id,sourceId:e.id||'',...(body||{})});
  }
  for(const r of Object.values(all)) {
    if(r.deleted || !['exercise','workout'].includes(r.type))continue;
    if(r.type==='exercise')out.set(r.id,{id:r.id,...r.body});
    else out.set(r.id,{id:r.id,name:r.body.name,detail:'',done:r.body.status==='完成',source:'legacy',legacyBody:r.body});
  }
  return [...out.values()];
}
