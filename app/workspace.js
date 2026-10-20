import {isDay} from './core.js';
export const DEFAULT_DATA_REPO='liziyaaa/lizi_workout_data';
export function dataWorkspace(testRunId=null){
 if(testRunId!==null&&(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(testRunId)||['constructor','prototype'].includes(testRunId)))throw new Error('测试目录参数无效');
 const root=testRunId?'data/test-runs/'+testRunId:'data';
 return {testRunId,root,path(kind,date){if(!['days','health','plans'].includes(kind)||!isDay(date))throw new Error('数据路径无效');return root+'/'+kind+'/'+date+'.json';}};
}
export function cacheKey(repo,branch,testRunId=null){const workspace=dataWorkspace(testRunId);return 'lizi-life:data:'+repo+':'+branch+(workspace.testRunId?':test:'+workspace.testRunId:'');}
export function cleanKnownPreview(state){
 const result=structuredClone(state);let removed=0;
 for(const container of [result.days||{},result.base||{}])for(const doc of Object.values(container))for(const [id,r]of Object.entries(doc.records||{}))if(r.body?.planId==='preview-20261020'){delete doc.records[id];removed++;}
 for(const [date,p]of Object.entries(result.plans||{}))if(p?.id==='preview-20261020'){delete result.plans[date];removed++;}
 return {state:removed?result:state,removed};
}
// Test runs may read a real plan/health summary as their baseline, but never get its write SHA.
export async function readWorkspace(store,kind,date){const found=await store.read(store.path(kind,date));if(found||!store.testRunId||kind==='days')return found;const baseline=await store.read('data/'+kind+'/'+date+'.json');return baseline?{doc:baseline.doc,sha:undefined,baseline:true}:null;}
