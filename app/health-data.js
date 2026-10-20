import {dayKey,shiftDay,isDay,normalizeHealth} from './core.js';
export const HEALTH_TYPES={HKQuantityTypeIdentifierHeartRate:'heartRate',HKCategoryTypeIdentifierSleepAnalysis:'sleep',HKQuantityTypeIdentifierStepCount:'steps',HKQuantityTypeIdentifierActiveEnergyBurned:'activeEnergyKcal',HKQuantityTypeIdentifierDistanceWalkingRunning:'distanceKm',HKQuantityTypeIdentifierDistanceCycling:'cyclingKm'};
const chinaDay=t=>new Date(t+8*3600000).toISOString().slice(0,10);
const round=n=>Math.round(n*100)/100;
const xmlDecode=s=>s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v)=>v[0]==='#'?String.fromCodePoint(parseInt(v.slice(v[1].toLowerCase()==='x'?2:1),v[1].toLowerCase()==='x'?16:10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[v]||''));
function attributes(tag){const a=Object.create(null);for(const m of tag.matchAll(/([\w:]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))a[m[1]]=xmlDecode(m[2]??m[3]);return a;}
const timestamp=s=>Date.parse(String(s||'').replace(/^(\d{4}-\d{2}-\d{2}) (\d\d:\d\d:\d\d) ([+-]\d\d)(\d\d)$/,'$1T$2$3:$4'));
const iso=s=>new Date(s).toISOString();
const isMi=s=>/mi fitness|小米|xiaomi/i.test(s);
export function unionIntervals(values){const out=[];for(const [a,b]of values.slice().sort((x,y)=>x[0]-y[0])){if(out.length&&a<=out.at(-1)[1])out.at(-1)[1]=Math.max(b,out.at(-1)[1]);else out.push([a,b]);}return out;}
function eachDay(start,end,callback){if(end<=start){callback(chinaDay(start),1,start,end);return;}let a=start;while(a<end){const d=chinaDay(a),b=Math.min(end,timestamp(shiftDay(d,1)+'T00:00:00+08:00'));callback(d,(b-a)/(end-start),a,b);a=b;}}
export function createHealthParser({from=shiftDay(dayKey(),-29),to=dayKey(),maxRecords=1000000}={}){
 if(!isDay(from)||!isDay(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>365)throw new Error('请选择有效日期范围，一次最多366天');
 let buffer='',closed=false,opened=false,workout=null,exportedAt='',count=0,duplicates=0,kept=0;
 const seen=new Set(),days=new Map(),sourceSets=new Map();
 const inside=d=>d>=from&&d<=to;
 function bucket(d,key,source){let day=days.get(d);if(!day)days.set(d,day=new Map());let metric=day.get(key);if(!metric)day.set(key,metric=new Map());let b=metric.get(source);if(!b)metric.set(source,b={count:0,lastRecordAt:'',total:0,intervals:[],asleep:[],inBed:[],samples:[],workouts:[]});let ss=sourceSets.get(key);if(!ss)sourceSets.set(key,ss=new Set());ss.add(source);return b;}
 function addRecord(a){
  const key=HEALTH_TYPES[a.type];if(!key)return;
  const start=timestamp(a.startDate),end=timestamp(a.endDate),source=String(a.sourceName||'未知来源').slice(0,100);if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return;
  const d=chinaDay(key==='sleep'?end:start);if(key==='sleep'?!inside(d):chinaDay(end)<from||d>to)return;
  const fingerprint=JSON.stringify([a.type,source,a.device||'',start,end,a.value,a.unit||'']);
  if(seen.has(fingerprint)){duplicates++;return;}if(seen.size>=maxRecords)throw new Error('所选日期的记录过多，请缩小日期范围');seen.add(fingerprint);
  const value=Number(a.value);
  if(key==='heartRate'){
   if(!inside(d)||a.unit!=='count/min'||!Number.isFinite(value)||value<15||value>250)return;
   const b=bucket(d,key,source);b.samples.push([start,value]);b.count++;b.lastRecordAt=iso(Math.max(end,timestamp(b.lastRecordAt)||0));kept++;return;
  }
  if(key==='sleep'){
   const asleep=/SleepAnalysisAsleep/.test(a.value),inBed=/SleepAnalysisInBed$/.test(a.value);if(!asleep&&!inBed)return;
   const b=bucket(d,key,source);(asleep?b.asleep:b.inBed).push([start,end]);b.count++;b.lastRecordAt=iso(Math.max(end,timestamp(b.lastRecordAt)||0));kept++;return;
  }
  if(!Number.isFinite(value)||value<0)return;
  let val=value;
  if(key==='steps'&&a.unit!=='count')return;
  if(key==='activeEnergyKcal'){if(a.unit==='kJ')val/=4.184;else if(a.unit!=='kcal')return;}
  if(key==='distanceKm'||key==='cyclingKm'){if(a.unit==='m')val/=1000;else if(a.unit==='mi')val*=1.609344;else if(a.unit!=='km')return;}
  eachDay(start,end,(date,fraction,a1,b1)=>{if(!inside(date))return;const b=bucket(date,key,source);b.total+=val*fraction;b.intervals.push([a1,b1]);b.count++;b.lastRecordAt=iso(Math.max(b1,timestamp(b.lastRecordAt)||0));});kept++;
 }
 function addWorkout(a){const start=timestamp(a.startDate),end=timestamp(a.endDate),d=chinaDay(Number.isFinite(start)?start:0);if(!inside(d)||!Number.isFinite(start)||!Number.isFinite(end)||end<start)return;
  const source=String(a.sourceName||'未知来源').slice(0,100),type=String(a.workoutActivityType||'HKWorkoutActivityTypeOther').slice(0,100),key=JSON.stringify(['workout',source,type,start,end]);if(seen.has(key)){duplicates++;return;}seen.add(key);
  const b=bucket(d,'workouts',source);if(b.workouts.length>=100)return;
  const w={type,source,start:iso(start),end:iso(end),durationMinutes:round((end-start)/60000)};
  let duration=Number(a.duration);if(Number.isFinite(duration)&&duration>=0){if(a.durationUnit==='min')w.durationMinutes=round(duration);else if(a.durationUnit==='sec'||a.durationUnit==='s')w.durationMinutes=round(duration/60);else if(a.durationUnit==='hr')w.durationMinutes=round(duration*60);}
  let energy=Number(a.totalEnergyBurned);if(Number.isFinite(energy)&&energy>=0){if(a.totalEnergyBurnedUnit==='kJ')energy/=4.184;if(['kcal','kJ'].includes(a.totalEnergyBurnedUnit))w.energyKcal=round(energy);}
  let distance=Number(a.totalDistance);if(Number.isFinite(distance)&&distance>=0){if(a.totalDistanceUnit==='m')distance/=1000;else if(a.totalDistanceUnit==='mi')distance*=1.609344;if(['km','m','mi'].includes(a.totalDistanceUnit))w.distanceKm=round(distance);}
  b.workouts.push(w);b.count++;b.lastRecordAt=iso(Math.max(end,timestamp(b.lastRecordAt)||0));kept++;
 }
 function process(tag){
  if(/^<HealthData\b/.test(tag)){opened=true;return;}
  if(/^<\/HealthData/.test(tag)){closed=true;return;}
  if(/^<ExportDate\b/.test(tag)){const t=timestamp(attributes(tag).value);if(Number.isFinite(t))exportedAt=iso(t);return;}
  if(/^<Record\b/.test(tag)){count++;const type=/\btype=["']([^"']+)["']/.exec(tag)?.[1];if(Object.hasOwn(HEALTH_TYPES,type))addRecord(attributes(tag));return;}
  if(/^<Workout\b/.test(tag)){workout=attributes(tag);if(/\/\s*>$/.test(tag)){addWorkout(workout);workout=null;}return;}
  if(/^<\/Workout\s*>/.test(tag)&&workout){addWorkout(workout);workout=null;return;}
  if(/^<WorkoutStatistics\b/.test(tag)&&workout){const a=attributes(tag);if(a.type==='HKQuantityTypeIdentifierActiveEnergyBurned'){workout.totalEnergyBurned=a.sum;workout.totalEnergyBurnedUnit=a.unit;}if(a.type==='HKQuantityTypeIdentifierDistanceWalkingRunning'||a.type==='HKQuantityTypeIdentifierDistanceCycling'){workout.totalDistance=a.sum;workout.totalDistanceUnit=a.unit;}}
 }
 const pattern=/<(?:HealthData\b|\/HealthData\s*>|ExportDate\b|Record\b|Workout\b|\/Workout\s*>|WorkoutStatistics\b)/;
 return {
  push(text,final=false){buffer+=text;while(true){const m=pattern.exec(buffer);if(!m){buffer=buffer.slice(-64);break;}let end=-1,quote='';for(let i=m.index+1;i<buffer.length;i++){const c=buffer[i];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>'){end=i;break;}}if(end<0){buffer=buffer.slice(m.index);if(buffer.length>262144)throw new Error('XML记录过长');break;}process(buffer.slice(m.index,end+1));buffer=buffer.slice(end+1);}
   if(final&&(!opened||!closed||workout))throw new Error('不是完整的 Apple 健康 XML，文件可能损坏或未导出完成');
  },
  finish(){if(!opened||!closed)throw new Error('健康XML不完整');const out=[];
   for(const [date,metrics]of [...days].sort((a,b)=>a[0].localeCompare(b[0]))){const groups=Object.create(null);for(const [key,sources]of metrics){groups[key]=Object.create(null);for(const [source,b]of sources){const result={count:b.count,lastRecordAt:b.lastRecordAt};if(key==='heartRate'){const hourly=new Map();let sum=0,min=Infinity,max=-Infinity;for(const [t,v]of b.samples){const h=new Date(t+8*3600000).getUTCHours();let a=hourly.get(h);if(!a)hourly.set(h,a={hour:h,count:0,sum:0,min:v,max:v});a.count++;a.sum+=v;a.min=Math.min(a.min,v);a.max=Math.max(a.max,v);sum+=v;min=Math.min(min,v);max=Math.max(max,v);}result.heartRate={count:b.samples.length,average:round(sum/b.samples.length),min,max,hourly:[...hourly.values()].sort((a,b)=>a.hour-b.hour).map(({sum,...h})=>({...h,average:round(sum/h.count)}))};}
    else if(key==='sleep'){result.asleep=unionIntervals(b.asleep);result.inBed=unionIntervals(b.inBed);}
    else if(key==='workouts')result.workouts=b.workouts.sort((a,b)=>a.start.localeCompare(b.start));
    else{result.total=round(b.total);let previousEnd=-Infinity;result.overlap=b.intervals.slice().sort((a,b)=>a[0]-b[0]).some(([a,z])=>{const overlap=a<previousEnd;previousEnd=Math.max(previousEnd,z);return overlap;});}
    groups[key][source]=result;
   }}out.push({date,groups});}
   return {from,to,exportedAt:exportedAt||new Date().toISOString(),recordsScanned:count,recordsKept:kept,duplicatesRemoved:duplicates,sources:Object.fromEntries([...sourceSets].map(([k,v])=>[k,[...v].sort()])),days:out};
  }
 };
}
function choose(group,preferred){if(!group)return null;const sources=Object.keys(group);const source=preferred&&preferred!=='auto'?(Object.hasOwn(group,preferred)?preferred:null):sources.find(isMi)||sources.sort((a,b)=>group[b].count-group[a].count)[0];return source?{source,...group[source]}:null;}
export function buildHealthSummaries(parsed,preferences={}){
 const docs=[];
 for(const {date,groups}of parsed.days){const metrics={},provenance={},quality={partialDay:date===chinaDay(Date.parse(parsed.exportedAt)),notes:[]};let heartRate,sleep,workouts;
  for(const key of ['heartRate','sleep','steps','activeEnergyKcal','distanceKm','cyclingKm','workouts']){
   const p=choose(groups[key],preferences[key]);if(!p)continue;
   provenance[key]={source:p.source,lastRecordAt:p.lastRecordAt};
   if(key==='heartRate'){heartRate=p.heartRate;metrics.averageHeartRate=heartRate.average;quality.notes.push('心率为去重后抽样统计，不等同静息心率');}
   else if(key==='sleep'){
    const actual=p.asleep.length>0,mi=!actual&&isMi(p.source);const intervals=actual?p.asleep:p.inBed;if(!intervals.length)continue;
    const segments=intervals.map(([a,b])=>({start:iso(a),end:iso(b),minutes:round((b-a)/60000)})),totalMinutes=round(segments.reduce((s,v)=>s+v.minutes,0));
    const clusters=[];let lastEnd=-Infinity;for(const segment of segments){const start=Date.parse(segment.start),end=Date.parse(segment.end);if(start-lastEnd<=3*3600000)clusters[clusters.length-1]+=segment.minutes;else clusters.push(segment.minutes);lastEnd=end;}const mainMinutes=round(Math.max(...clusters)),napMinutes=round(totalMinutes-mainMinutes);
    sleep={source:p.source,basis:actual?'asleep':mi?'mi-fitness-duration':'inBed',totalMinutes,mainMinutes,napMinutes,segments};
    if(actual||mi)metrics.sleepMinutes=totalMinutes;else metrics.inBedMinutes=totalMinutes;
    if(mi)quality.notes.push('Mi Fitness 的 InBed 区间按用户确认口径计为睡眠时长，不推断分期');
   }else if(key==='workouts'){workouts=p.workouts;metrics.workoutMinutes=round(workouts.reduce((s,w)=>s+w.durationMinutes,0));}
   else{metrics[key]=key==='steps'?Math.round(p.total):p.total;if(p.overlap)quality.notes.push(key+' 同一来源区间存在重叠；仅移除精确重复，未估算扣减');}
  }
  if(!Object.keys(metrics).length)continue;
  docs.push(normalizeHealth({schemaVersion:1,date,generatedAt:parsed.exportedAt,source:'Apple Health ZIP',metrics,provenance,quality,heartRate,sleep,workouts,importInfo:{format:'apple-health-xml',exportedAt:parsed.exportedAt,from:parsed.from,to:parsed.to,parserVersion:1},coverage:{start:date+'T00:00:00+08:00',end:shiftDay(date,1)+'T00:00:00+08:00'}}));
 }
 return docs;
}
export function mergeHealthImport(previous,incoming){
 if(previous&&Date.parse(previous.generatedAt)>Date.parse(incoming.generatedAt))return previous;
 // Import replaces an imported day's selected observations; preserve only manually entered fields with no new value.
 if(previous?.source==='手动补记')return normalizeHealth({...previous,...incoming,metrics:{...previous.metrics,...incoming.metrics},provenance:{...previous.provenance,...incoming.provenance}});
 return incoming;
}
export function healthAnalysisPayload(days,health,end,lookback=14){
 const dates=Array.from({length:lookback},(_,i)=>shiftDay(end,i-lookback+1));
 return {schemaVersion:1,purpose:'健康与训练趋势分析',timezone:'Asia/Shanghai',from:dates[0],to:end,rules:['缺失不等于零；注意每项数据的实际日期与来源','普通心率是抽样统计，不当作静息心率或连续监测','Mi Fitness区间按用户确认计入睡眠时长，无分期','区分设备运动记录与手动勾选的训练动作'],days:dates.map(date=>({date,health:health[date]||null,checkins:Object.values(days[date]?.records||{}).filter(r=>r.type==='checkin'&&!r.deleted).map(r=>r.body),training:Object.values(days[date]?.records||{}).filter(r=>['exercise','workout'].includes(r.type)&&!r.deleted).map(r=>({type:r.type,...r.body}))}))};
}
