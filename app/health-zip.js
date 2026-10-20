import {Unzip,UnzipInflate} from './fflate.js';
import {createHealthParser} from './health-data.js';
// Never materialize the archive or export.xml. Only the chosen XML entry is inflated.
export async function parseHealthFile(file,options={},onProgress=()=>{}){
 if(!file||file.size===0)throw new Error('文件为空');
 if(file.size>250*1024*1024)throw new Error('压缩包超过250MB，请先在电脑上整理');
 const parser=createHealthParser(options),decoder=new TextDecoder('utf-8',{fatal:true});
 let expanded=0,found=false,xmlComplete=false;
 const feed=(bytes,final)=>{expanded+=bytes.length;if(expanded>2*1024*1024*1024)throw new Error('XML超过2GB，请缩小导出范围或在电脑上整理');parser.push(decoder.decode(bytes,{stream:!final}),final);if(final)xmlComplete=true;};
 const signature=new Uint8Array(await file.slice(0,4).arrayBuffer()),isZip=signature[0]===80&&signature[1]===75;
 let unzip;
 if(isZip){unzip=new Unzip(entry=>{if(!/(^|\/)export\.xml$/i.test(entry.name))return;if(found)throw new Error('压缩包包含多个export.xml，无法确定数据来源');found=true;if(entry.originalSize>2*1024*1024*1024)throw new Error('XML超过2GB');entry.ondata=(error,chunk,final)=>{if(error)throw new Error('ZIP解压失败：'+error.message);feed(chunk,final);};entry.start();});unzip.register(UnzipInflate);}
 const chunkSize=32768;
 for(let offset=0;offset<file.size;offset+=chunkSize){const end=Math.min(file.size,offset+chunkSize),bytes=new Uint8Array(await file.slice(offset,end).arrayBuffer());if(isZip)unzip.push(bytes,end===file.size);else feed(bytes,end===file.size);onProgress({percent:Math.round(end/file.size*100),expandedBytes:expanded});}
 if(isZip&&!found)throw new Error('ZIP中没有Apple健康的export.xml');if(!xmlComplete)throw new Error('XML解压未完成，文件可能损坏');return parser.finish();
}
