// Reveal controls only after a horizontal gesture; vertical scrolling stays native.
export function setupSwipeActions({root}) {
 if(!root?.addEventListener)return;
 const width=168;
 let active=null,gesture=null,suppressUntil=0;
 const set=(row,x)=>row.style.setProperty('--swipe-x',x+'px');
 const settle=(row,open)=>{
  if(!row)return;
  row.classList.remove('swipe-dragging');row.classList.toggle('swipe-open',open);set(row,open?-width:0);
  const actions=row.querySelector('.swipe-actions');
  if(actions){actions.inert=!open;actions.setAttribute('aria-hidden',String(!open));}
  if(open)active=row;else if(active===row)active=null;
 };
 const cancel=()=>{if(gesture)settle(gesture.row,gesture.wasOpen);gesture=null;};
 root.addEventListener('pointerdown',e=>{
  if(e.isPrimary===false){cancel();return;}
  if(e.button!==0)return;
  suppressUntil=0;
  const row=e.target.closest('[data-swipe-row]');
  if(active&&active!==row)settle(active,false);
  if(!row||e.target.closest('.swipe-actions'))return;
  gesture={row,id:e.pointerId,x:e.clientX,y:e.clientY,wasOpen:row===active,locked:false,offset:row===active?-width:0};
 });
 root.addEventListener('pointermove',e=>{
  const g=gesture;if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.locked){
   if(Math.max(Math.abs(dx),Math.abs(dy))<10)return;
   if(Math.abs(dy)>=Math.abs(dx)){cancel();return;}
   g.locked=true;g.row.classList.add('swipe-dragging');g.row.setPointerCapture?.(e.pointerId);
  }
  if(e.cancelable)e.preventDefault();
  g.offset=Math.max(-width,Math.min(0,(g.wasOpen?-width:0)+dx));set(g.row,g.offset);
 });
 root.addEventListener('pointerup',e=>{
  const g=gesture;if(!g||g.id!==e.pointerId)return;
  if(g.locked){settle(g.row,g.offset<-width*.35);suppressUntil=Date.now()+400;}
  gesture=null;
 });
 root.addEventListener('pointercancel',cancel);
 root.addEventListener('click',e=>{
  if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return;}
  if(active&&!e.target.closest('.swipe-actions')){
   const row=e.target.closest('[data-swipe-row]');settle(active,false);
   if(row){e.preventDefault();e.stopImmediatePropagation();}
  }
 },true);
 root.addEventListener('keydown',e=>{
  const row=e.target.closest('[data-swipe-row]');if(!row)return;
  if(e.key==='ArrowLeft'&&e.target===row){if(active!==row)settle(active,false);settle(row,true);e.preventDefault();}
  if(e.key==='Escape'||(e.key==='ArrowRight'&&e.target===row)){settle(row,false);e.preventDefault();row.focus?.();}
 });
}
