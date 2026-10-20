import { mkdir,copyFile,rm,readdir } from 'node:fs/promises';
import path from 'node:path';
const allowed=['index.html','app.js','core.js','sync.js','pull-refresh.js','updates.js','glass.js','THIRD_PARTY_NOTICES.txt','style.css','sw.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest'];
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const name of allowed)await copyFile(path.join('app',name),path.join('dist',name));
const names=await readdir('dist');if(names.some(n=>!allowed.includes(n)))throw new Error('Unexpected published file');
console.log('Built '+names.length+' static application files. No personal records included.');
