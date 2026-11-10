// UI only: keep LiZi Life's state, storage, dates and sync outside Framework7.
export function createIosUi() {
  const Framework7 = globalThis.Framework7;
  if (!Framework7) return null;
  const app = new Framework7({el:'#app', theme:'ios', name:'LiZi Life', clicks:{externalLinks:'.external'}});
  const modal = document.querySelector('#modal');
  const shell = document.querySelector('#app-shell');
  const content = document.querySelector('#page-scroll');
  let previousFocus, activeToast;
  const popup = app.popup.create({el:modal, closeByBackdropClick:false, closeOnEscape:false, animate:false,
    on:{open(){
      modal.open = true;
      previousFocus = document.activeElement;
      document.querySelector('#modal-title').focus();
      shell.inert = true;
    }, closed(){
      modal.open = false;
      shell.inert = false;
      previousFocus?.isConnected && previousFocus.focus({preventScroll:true});
      modal.dispatchEvent(new Event('close'));
    }}
  });
  modal.addEventListener('keydown', event=>{
    if(event.key==='Escape'){event.preventDefault();popup.close(false);return;}
    if(event.key!=='Tab')return;
    const elements=[...modal.querySelectorAll('button, input, select, textarea, a[href]')].filter(el=>!el.disabled && el.getClientRects().length);
    if(!elements.length)return;
    const first=elements[0],last=elements.at(-1);
    if(event.shiftKey && (document.activeElement===first || document.activeElement===document.querySelector('#modal-title'))){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  });

  // Framework7 owns swipes; the ellipsis and keyboard expose the same actions.
  const list = document.querySelector('#main');
  const updateRow=(row,open)=>{
    if(!row?.matches('.swipeout'))return;
    const actions=row.querySelector('.swipeout-actions-right');
    actions.inert=!open;
    actions.setAttribute('aria-hidden',String(!open));
    row.querySelector('.row-more').setAttribute('aria-expanded',String(open));
  };
  app.on('swipeoutOpen',row=>updateRow(row,true));
  app.on('swipeoutClose',row=>updateRow(row,false));
  const openRow=row=>{
    const old=list.querySelector('.swipeout-opened');
    if(old && old!==row)app.swipeout.close(old);
    app.swipeout.open(row,'right');
  };
  list.addEventListener('click',event=>{
    const more=event.target.closest('.row-more');
    if(!more)return;
    event.preventDefault();
    const row=more.closest('.swipeout');
    if(row.classList.contains('swipeout-opened'))app.swipeout.close(row);
    else openRow(row);
  });
  list.addEventListener('keydown',event=>{
    const row=event.target.closest('.swipeout');
    if(event.key===' ' && event.target.matches('.swipeout-actions-right [role=button]')){event.preventDefault();event.target.click();return;}
    if(!row||!event.target.matches('[data-swipe-row], .row-more'))return;
    if(event.key==='ArrowLeft'){event.preventDefault();openRow(row);}
    if(['Escape','ArrowRight'].includes(event.key)){event.preventDefault();app.swipeout.close(row);}
  });

  return {
    popup,
    beforeRender(){
      // Clear the component's reference before replacing its row DOM.
      const row=list.querySelector('.swipeout-opened');
      if(row)app.swipeout.close(row);
    },
    scrollTop(){content.scrollTop=0;},
    bindRefresh(onRefresh){
      const ptr=app.ptr.get(content)||app.ptr.create(content);
      content.addEventListener('ptr:refresh',async()=>{
        try{await onRefresh();}finally{ptr.done();}
      });
    },
    toast(text,timeout){
      activeToast?.close(false);
      const safe=document.createElement('span');safe.textContent=text;
      activeToast=app.toast.create({text:safe.innerHTML,closeTimeout:timeout,destroyOnClose:true,position:'bottom',on:{closed(item){if(activeToast===item)activeToast=null;}}});
      activeToast.open();
    }
  };
}
