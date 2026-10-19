/**
 * Small vanilla DOM lens, inspired by samasante/liquid-glass (MIT).
 * Uses rounded-rectangle SDF normals and a meniscus displacement map.
 * Safari path: filter a clipped, inert visual copy, never backdrop-filter:url().
 * See THIRD_PARTY_NOTICES.txt for technique credit and upstream license.
 */
export function lensPixels(width,height,radius=30){
  const data=new Uint8ClampedArray(width*height*4),halfW=width/2,halfH=height/2;
  const r=Math.min(radius,halfW,halfH),band=Math.min(14,halfH*.4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const px=x+.5-halfW,py=y+.5-halfH;
    const qx=Math.abs(px)-(halfW-r),qy=Math.abs(py)-(halfH-r);
    const ox=Math.max(qx,0),oy=Math.max(qy,0),len=Math.hypot(ox,oy);
    const distance=len+Math.min(Math.max(qx,qy),0)-r;
    let nx=0,ny=0;
    if(len>0){nx=Math.sign(px)*ox/len;ny=Math.sign(py)*oy/len;}
    else if(qx>qy)nx=Math.sign(px);else ny=Math.sign(py);
    // Smooth lens edge, flat center; avoid stretching a spherical dome over a wide dock.
    const t=Math.max(0,Math.min(1,1+distance/band));
    const bend=distance<=0?Math.sin(t*Math.PI)*.44:0;
    const i=(y*width+x)*4;
    data[i]=Math.round(127.5+nx*bend*255);data[i+1]=Math.round(127.5+ny*bend*255);
    data[i+2]=128;data[i+3]=255;
  }
  return data;
}
let requested=false,dirty=true,dock,refraction,filterSvg,lastShape='',generation=0,clones=new Map();
const canRun=()=>typeof window!=='undefined'&&typeof window.matchMedia==='function'&&typeof document.createElement==='function';
export function refreshGlass(){dirty=true;schedule();}
function schedule(){if(!canRun()||requested)return;requested=true;requestAnimationFrame(()=>{requested=false;try{paint();}catch{if(dock)dock.hidden=true;}});}
function create(){
  dock=document.createElement('div');dock.id='glass-dock';dock.setAttribute('aria-hidden','true');dock.inert=true;
  filterSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');filterSvg.setAttribute('width','0');filterSvg.setAttribute('height','0');
  refraction=document.createElement('div');refraction.className='glass-refraction';dock.append(filterSvg,refraction);document.body.append(dock);
}
function sanitize(copy){
  // Credential-bearing containers never enter this function (excluded before cloning).
  copy.querySelectorAll('script,style,iframe,video,canvas,svg defs').forEach(el=>el.remove());
  for(const el of [copy,...copy.querySelectorAll('*')]){
    for(const a of [...el.attributes])if(a.name==='id'||a.name==='name'||a.name==='for'||a.name==='href'||a.name.startsWith('on')||a.name.startsWith('data-'))el.removeAttribute(a.name);
    if(el.matches('input,textarea,select')){const span=document.createElement('span');span.className=el.type==='checkbox'?'glass-check':'glass-field';span.textContent=el.type==='checkbox'&&el.checked?'✓':'';el.replaceWith(span);}
    else if(el.matches('a,button,[tabindex]')){el.setAttribute('tabindex','-1');el.removeAttribute('autofocus');}
  }
  return copy;
}
function paint(){
  const nav=document.querySelector('#mobile-nav'),main=document.querySelector('#main');
  if(!nav||!main)return;
  const reduced=window.matchMedia('(prefers-reduced-transparency: reduce)').matches||window.matchMedia('(prefers-contrast: more)').matches;
  const rect=nav.getBoundingClientRect();
  if(!rect.width||!rect.height||reduced||window.innerWidth>760){if(dock)dock.hidden=true;return;}
  if(!dock)create();dock.hidden=false;
  Object.assign(dock.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
  const w=Math.round(rect.width),h=Math.round(rect.height),shape=w+'x'+h;
  if(shape!==lastShape){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx){dock.hidden=true;return;}
    const image=ctx.createImageData(w,h);image.data.set(lensPixels(w,h));ctx.putImageData(image,0,0);
    const id='dock-lens-'+(++generation),uri=canvas.toDataURL();
    filterSvg.innerHTML=`<defs><filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="${uri}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="lens"/><feDisplacementMap in="SourceGraphic" in2="lens" scale="18" xChannelSelector="R" yChannelSelector="G" result="bend"/><feGaussianBlur in="bend" stdDeviation="1.2"/></filter></defs>`;
    refraction.style.filter=`url(#${id})`;lastShape=shape;dirty=true;
  }
  if(dirty){clones.clear();refraction.replaceChildren();dirty=false;}
  const active=new Set();
  for(const original of main.children){
    if(original.querySelector('input[type="password"]'))continue;
    const r=original.getBoundingClientRect();if(r.bottom<rect.top-24||r.top>rect.bottom+24)continue;
    active.add(original);let copy=clones.get(original);
    if(!copy){copy=sanitize(original.cloneNode(true));copy.classList.add('glass-copy');refraction.append(copy);clones.set(original,copy);}
    Object.assign(copy.style,{position:'absolute',left:(r.left-rect.left)+'px',top:(r.top-rect.top)+'px',width:r.width+'px',margin:'0',pointerEvents:'none'});
  }
  for(const [original,copy]of clones)if(!active.has(original)){copy.remove();clones.delete(original);}
}
if(canRun()){
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',refreshGlass,{passive:true});
  window.visualViewport?.addEventListener('resize',refreshGlass,{passive:true});
  window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshGlass();});
}
