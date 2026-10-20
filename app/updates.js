// A successful update() may still be downloading the new application shell.
export async function findWaitingUpdate(registration,{timeoutMs=15000}={}){
  if(registration.waiting)return registration.waiting;
  await registration.update();
  if(registration.waiting)return registration.waiting;
  const worker=registration.installing;
  if(!worker)return null;
  await new Promise((resolve,reject)=>{
    let timer;
    const finish=error=>{clearTimeout(timer);worker.removeEventListener('statechange',changed);error?reject(error):resolve();};
    const changed=()=>{
      if(worker.state==='redundant')finish(new Error('更新下载失败，请重试'));
      else if(['installed','activating','activated'].includes(worker.state))finish();
    };
    timer=setTimeout(()=>finish(new Error('更新仍在下载，请稍后再试')),timeoutMs);
    worker.addEventListener('statechange',changed);changed();
  });
  return registration.waiting||null;
}
