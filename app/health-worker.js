import {parseHealthFile} from './health-zip.js';
self.onmessage=async event=>{try{const result=await parseHealthFile(event.data.file,event.data.options,progress=>self.postMessage({type:'progress',...progress}));self.postMessage({type:'result',result});}catch(error){self.postMessage({type:'error',message:error.message||'健康文件解析失败'});}};
