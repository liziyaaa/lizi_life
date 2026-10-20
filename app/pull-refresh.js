// Intercept only a deliberate, single-finger downward gesture at the page top.
export function setupPullRefresh({indicator,canRefresh,onRefresh,root=globalThis.document,viewport=globalThis.window}) {
  if(!indicator||!root?.addEventListener||!viewport)return;
  root.documentElement?.classList.add('pull-sync-enabled');
  let start=null,distance=0,refreshing=false;
  const reset=()=>{start=null;distance=0;if(!refreshing){indicator.hidden=true;indicator.style?.removeProperty('--pull-offset');}};
  root.addEventListener('touchstart',event=>{
    reset();
    if(refreshing||!canRefresh()||event.touches.length!==1||(viewport.scrollY||0)>0||event.target.closest('button,input,textarea,select,a,label,dialog,nav,[data-swipe-row],[contenteditable="true"]'))return;
    // Nested scroll regions retain their own scrolling gestures.
    for(let el=event.target;el&&el!==root.body;el=el.parentElement){if(el.scrollHeight>el.clientHeight+1&&/auto|scroll/.test(viewport.getComputedStyle?.(el).overflowY||''))return;}
    start={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  root.addEventListener('touchmove',event=>{
    if(!start)return;
    if(event.touches.length!==1||!canRefresh()||(viewport.scrollY||0)>0){reset();return;}
    const dx=event.touches[0].clientX-start.x,dy=event.touches[0].clientY-start.y;
    if(dy<0||Math.abs(dx)>Math.max(12,dy)){reset();return;}
    if(dy<8)return;
    if(!event.cancelable){reset();return;}
    event.preventDefault();distance=Math.min(90,dy*.5);
    indicator.hidden=false;indicator.textContent=distance>=64?'松开同步':'下拉同步';
    indicator.style?.setProperty('--pull-offset',distance+'px');
  },{passive:false});
  root.addEventListener('touchend',()=>{
    const ready=start&&distance>=64&&canRefresh();reset();if(!ready)return;
    refreshing=true;indicator.hidden=false;indicator.textContent='正在同步';
    Promise.resolve().then(onRefresh).catch(()=>{/* Sync owner reports failures. */}).finally(()=>{refreshing=false;reset();});
  },{passive:true});
  root.addEventListener('touchcancel',reset,{passive:true});
}
