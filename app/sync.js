import { emptyDay,validateDay,mergeDays } from './core.js';
export class GithubStore {
  constructor({repo,branch,token}, fetcher=fetch) {this.repo=repo;this.branch=branch||'main';this.token=token;this.fetcher=fetcher;}
  async api(path,options={}) {
    const response=await this.fetcher('https://api.github.com'+path,{...options,cache:'no-store',signal:AbortSignal.timeout(25000),headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+this.token,'X-GitHub-Api-Version':'2022-11-28',...options.headers}});
    if (response.status===404) return null;
    if (!response.ok) {const messages={401:'GitHub 密钥无效或已过期',403:'GitHub 拒绝访问：检查权限、额度和仓库套餐',409:'云端已变化，请重新同步',422:'GitHub 未接受请求，请检查文件和分支'};throw new Error(messages[response.status]||'GitHub 请求失败：'+response.status);}
    return response.status===204?{}:response.json();
  }
  async verifyPrivate() {const r=await this.api('/repos/'+this.repo);if(!r)throw new Error('找不到仓库，请检查名称和密钥访问范围');if(!r.private)throw new Error('个人数据只允许同步到私有仓库');return r;}
  async read(path) {const r=await this.api('/repos/'+this.repo+'/contents/'+path+'?ref='+encodeURIComponent(this.branch));if(!r)return null;if(r.encoding!=='base64'||typeof r.content!=='string')throw new Error('文件过大或格式不支持');const bytes=Uint8Array.from(atob(r.content.replace(/\s/g,'')),c=>c.charCodeAt(0));return {doc:JSON.parse(new TextDecoder().decode(bytes)),sha:r.sha};}
  async write(path,doc,sha) {const bytes=new TextEncoder().encode(JSON.stringify(doc,null,2)+'\n');let str='';for(const byte of bytes)str+=String.fromCharCode(byte);return this.api('/repos/'+this.repo+'/contents/'+path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'life: update '+path,branch:this.branch,content:btoa(str),...(sha?{sha}:{})})});}
  async syncDay(date,base,local) {
    const path='data/days/'+date+'.json';
    for(let attempt=0;attempt<3;attempt++) {
      const found=await this.read(path);const remote=found?validateDay(found.doc,date):emptyDay(date);
      const merged=mergeDays(base,local,remote);
      if(merged.conflicts.length) {const e=new Error('同一条记录在另一设备被修改，已保留本机内容。请导出备份后在设置处理冲突');e.conflicts=merged.conflicts;e.remote=remote;throw e;}
      if(JSON.stringify(merged.doc)===JSON.stringify(remote))return merged.doc;
      try {await this.write(path,merged.doc,found?.sha);return merged.doc;}catch(e){if(!/云端已变化|未接受/.test(e.message)||attempt===2)throw e;}
    }
  }
}
