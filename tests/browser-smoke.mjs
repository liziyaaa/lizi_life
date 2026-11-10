import assert from 'node:assert/strict';
import { chromium,devices } from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {zipSync,strToU8} from '../app/fflate.js';
import {dayKey} from '../app/core.js';
const types={html:'text/html',js:'text/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const name=path==='/'?'index.html':basename(path);
 try{const body=await readFile(resolve('dist',name));res.setHeader('Content-Type',types[name.split('.').at(-1)]||'text/plain');res.end(body);}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,date=dayKey();
let browser;
try{browser=await chromium.launch();}catch(error){server.close();throw error;}
const context=await browser.newContext({...devices['iPhone 13'],serviceWorkers:'allow',permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage();page.setDefaultTimeout(12000);
const errors=[], failures=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push([r.url(),r.failure()?.errorText]));
const plan={schemaVersion:1,date,id:'ui-fixture',summary:'合成测试',focus:'力量训练 · 20:00',tasks:['核对测试数据','整理测试图纸'],exercises:[{id:'press',name:'器械推胸',sets:3,reps:'10–12 次'},{id:'warmup',name:'动态热身',sets:1,reps:'7 分钟'}]};
const files=new Map([['data/plans/'+date+'.json',plan]]), writes=[];
await context.route('https://api.github.com/**',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname.split('/contents/')[1];
 if(!path)return route.fulfill({json:{private:true,full_name:'liziyaaa/lizi_workout_data',default_branch:'main'}});
 if(req.method()==='PUT'){
  const body=req.postDataJSON(),doc=JSON.parse(Buffer.from(body.content,'base64'));
  assert.ok(path.startsWith('data/test-runs/f7-smoke/'));files.set(path,doc);writes.push(path);return route.fulfill({status:201,json:{content:{sha:'fixture'}}});
 }
 const doc=files.get(path);
 return doc?route.fulfill({json:{sha:'fixture',encoding:'base64',content:Buffer.from(JSON.stringify(doc)).toString('base64')}}):route.fulfill({status:404,json:{message:'Not Found'}});
});
try{
 await page.goto(origin+'/?testRun=f7-smoke#settings');
 await page.getByText('1.7.0',{exact:true}).waitFor();assert.ok(await page.locator('html.ios').count());
 await page.locator('input[name=token]').fill('synthetic-test-token');await page.getByRole('button',{name:'保存',exact:true}).tap();
 await page.waitForFunction(()=>document.querySelector('#sync-button').dataset.state==='synced');
 await page.getByRole('link',{name:'日程',exact:true}).tap();
 await page.getByText('器械推胸',{exact:true}).waitFor();
 await page.getByRole('checkbox',{name:'完成 核对测试数据'}).check();
 await page.getByRole('link',{name:'训练',exact:true}).tap();
 await page.getByRole('checkbox',{name:'完成 器械推胸'}).check();
 await page.getByRole('textbox',{name:'训练 Note'}).fill('合成训练备注');
 // A real touch sequence must reveal the native Framework7 swipeout actions.
 const touch=await context.newCDPSession(page);
 const gesture=async(x,y,dx,dy)=>{
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=7;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/7,y:y+dy*i/7}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 };
 const rect=await page.getByText('器械推胸',{exact:true}).boundingBox();
 await gesture(310,Math.round(rect.y+rect.height/2),-168,0);
 await page.locator('.swipeout-opened').getByRole('button',{name:'编辑 器械推胸'}).tap();
 await page.getByRole('dialog',{name:'编辑动作'}).waitFor();
 await page.getByRole('textbox',{name:'动作',exact:true}).fill('器械推胸（编辑）');
 await page.locator('#modal-save').tap();
 await page.getByText('器械推胸（编辑）',{exact:true}).waitFor();
 assert.ok(await page.getByRole('checkbox',{name:'完成 器械推胸（编辑）'}).isChecked());
 await page.getByRole('button',{name:'更多操作：动态热身'}).tap();
 await page.getByRole('button',{name:'删除 动态热身'}).tap();
 assert.equal(await page.getByText('动态热身',{exact:true}).count(),0);
 await page.getByRole('button',{name:'添加动作'}).tap();
 await page.getByRole('dialog',{name:'添加动作'}).waitFor();
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('link',{name:'工作',exact:true}).tap();
 await page.getByRole('textbox',{name:'工作 Note'}).fill('合成工作备注');
 await page.locator('#sync-button').tap();await page.waitForFunction(()=>document.querySelector('#sync-button').dataset.state==='synced');
 const day=files.get('data/test-runs/f7-smoke/days/'+date+'.json');
 assert.equal(day.records['note-work'].body.text,'合成工作备注');assert.equal(day.records['note-training'].body.text,'合成训练备注');
 assert.ok(Object.values(day.records).find(r=>r.body.name==='动态热身').deleted);
 const refresh=page.waitForRequest(req=>req.method()==='GET'&&req.url().includes('/data/test-runs/f7-smoke/plans/'));
 await gesture(180,130,0,238);await refresh;
 await page.waitForFunction(()=>document.querySelector('#sync-button').dataset.state==='synced');
 await page.getByRole('link',{name:'健康',exact:true}).tap();await page.waitForFunction(()=>document.querySelector('#sync-button').dataset.state==='synced');
 await page.getByRole('button',{name:'导入健康ZIP'}).tap();
 const stamp=`${date} 06:30:00 +0800`;
 const xml=`<?xml version="1.0"?><HealthData locale="zh_CN"><ExportDate value="${date} 13:00:00 +0800"/><Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Synthetic device" unit="count/min" startDate="${stamp}" endDate="${stamp}" value="72"/></HealthData>`;
 const zip=zipSync({'apple_health_export/export.xml':strToU8(xml)});
 await page.locator('input[name=archive]').setInputFiles({name:'synthetic.zip',mimeType:'application/zip',buffer:Buffer.from(zip)});
 await page.locator('#modal-save').tap();await page.getByRole('dialog',{name:'确认健康摘要'}).waitFor();
 await page.locator('#modal-save').tap();await page.waitForFunction(()=>document.querySelector('#sync-button').dataset.state==='synced');
 assert.equal(files.get('data/test-runs/f7-smoke/health/'+date+'.json').metrics.averageHeartRate,72);
 await page.getByRole('link',{name:'复盘',exact:true}).tap();await page.waitForFunction(()=>document.querySelector('#sync-button').dataset.state==='synced');
 await page.getByRole('textbox',{name:'复盘 Note'}).fill('合成复盘备注');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出备份'}).tap();const d=await download;assert.match(d.suggestedFilename(),/f7-smoke\.json$/);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 await page.waitForFunction(()=>document.querySelector('#sync-button').dataset.state==='synced');
 await context.setOffline(true);await page.reload({waitUntil:'load'});await page.getByRole('textbox',{name:'复盘 Note'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'复盘 Note'}).inputValue(),'合成复盘备注');
 assert.deepEqual(errors,[]);console.log('mobile passed: 5 tabs, login, completion, popup edit/delete, pull to refresh, Notes, fake cloud read/write, ZIP worker, backup and offline');
 const desktop=await browser.newPage({viewport:{width:1440,height:900}});await desktop.goto(origin+'/#today');
 await desktop.getByRole('link',{name:'工作',exact:true}).click();await desktop.getByRole('heading',{name:'工作',exact:true}).waitFor();
 assert.ok(await desktop.getByRole('button',{name:'添加待办'}).isVisible());
 console.log('desktop passed; fake writes:',writes.length);
}catch(e){console.error('browser errors',errors,'request failures',failures);console.error((await page.locator('body').innerText()).slice(0,1600));console.error('popup state',await page.locator('#modal').evaluate(el=>({title:el.getAttribute('aria-labelledby')&&el.querySelector('#modal-title').textContent,open:el.open,classes:el.className,display:getComputedStyle(el).display})));throw e;}
finally{await browser.close();server.close();}
