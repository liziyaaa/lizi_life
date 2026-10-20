import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readdir,readFile,rm,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
test('发布白名单不泄露数据、凭据或测试文件',async()=>{const dir=await mkdtemp(join(tmpdir(),'lizi-build-'));try{await cp('app',join(dir,'app'),{recursive:true});await mkdir(join(dir,'data'));await writeFile(join(dir,'data','health.json'),'SECRET_HEALTH');await writeFile(join(dir,'app','token.txt'),'SECRET_TOKEN');execFileSync(process.execPath,[resolve('scripts/build.mjs')],{cwd:dir});const files=await readdir(join(dir,'dist'));assert.equal(files.length,20);assert.equal(files.includes('data'),false);assert.equal(files.includes('token.txt'),false);for(const f of files)assert.equal((await readFile(join(dir,'dist',f))).includes(Buffer.from('SECRET_')),false);}finally{await rm(dir,{recursive:true,force:true});}});
test('主页面资源与PWA图标存在',async()=>{const html=await readFile('app/index.html','utf8');for(const match of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))await readFile('app/'+match[1].split('?')[0]);const manifest=JSON.parse(await readFile('app/manifest.webmanifest'));assert.equal(manifest.start_url,'./');for(const icon of manifest.icons)await readFile('app/'+icon.src.replace('./',''));});
