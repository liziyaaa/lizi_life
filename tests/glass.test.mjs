import test from 'node:test';
import assert from 'node:assert/strict';
import {lensPixels} from '../app/glass.js';
import {readFile} from 'node:fs/promises';
test('折射图为RGBA、中心平坦、边缘存在方向相反的位移',()=>{const w=360,h=72,data=lensPixels(w,h);assert.equal(data.length,w*h*4);const at=(x,y,c)=>data[(y*w+x)*4+c];assert.ok(Math.abs(at(180,36,0)-128)<=1);assert.ok(Math.abs(at(180,36,1)-128)<=1);assert.ok(at(180,4,1)<120);assert.ok(at(180,67,1)>135);assert.equal(at(180,36,3),255);});
test('页面容器无tabindex；触屏焦点与键盘焦点分别处理',async()=>{const html=await readFile('app/index.html','utf8'),css=await readFile('app/style.css','utf8');assert.match(html,/<main id="main">/);assert.doesNotMatch(html,/<main[^>]*tabindex/);assert.match(css,/@media\(hover:none\) and \(pointer:coarse\)/);assert.match(css,/button:focus-visible,a:focus-visible\{outline:2px/);});
test('Safari路线不依赖SVG backdrop-filter；镜像不复制密码容器',async()=>{const js=await readFile('app/glass.js','utf8');assert.match(js,/feDisplacementMap/);assert.match(js,/input\[type="password"\]/);assert.match(js,/dock.inert=true/);assert.match(js,/reduced-transparency/);});
