const CACHE='lizi-life-v1.1.0';
const ASSETS=['./','./index.html','./style.css','./app.js','./core.js','./sync.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lizi-life-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;const url=new URL(e.request.url);if(!ASSETS.some(p=>new URL(p,self.registration.scope).pathname===url.pathname))return;e.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(e.request,{ignoreSearch:true}))||fetch(e.request)));});
