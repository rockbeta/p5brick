export function createKokoroVoice({onprogress=()=>{}}={}){
  const worker=new Worker(new URL('./kokoro-worker.mjs?v=20261109-2',import.meta.url),{type:'module'});
  const pending=new Map();let serial=0,failed=null,timer;
  const fail=error=>{
    if(failed)return;
    failed=error;clearTimeout(timer);worker.terminate();
    const requests=[...pending.values()];pending.clear();
    for(const request of requests)request.reject(error);
  };
  // This timer runs on the page, so it can terminate a worker stuck in WASM.
  const watch=stage=>{
    clearTimeout(timer);
    timer=setTimeout(()=>fail(Object.assign(new Error('Kokoro narration timed out'),{code:'VOICE_TIMEOUT'})),stage==='generating'?60000:180000);
  };
  worker.onmessage=({data})=>{
    if(failed)return;
    if(data.type==='progress'){if(pending.size)watch(data.stage);onprogress(data.message);return;}
    const request=pending.get(data.id);if(!request)return;pending.delete(data.id);
    clearTimeout(timer);if(pending.size)watch('loading');
    if(data.type==='audio')request.resolve({samples:data.samples,sampleRate:data.sampleRate});
    else request.reject(new Error(data.message));
  };
  worker.onerror=event=>fail(new Error(event.message||'The Kokoro worker could not load'));
  worker.onmessageerror=()=>fail(new Error('The Kokoro worker could not return audio'));
  return {dispose(){fail(new Error('The voice worker was reset'));},synthesize(text){return new Promise((resolve,reject)=>{
    if(failed){reject(failed);return;}
    const id=++serial;pending.set(id,{resolve,reject});
    if(pending.size===1)watch('loading');
    try{worker.postMessage({id,text});}catch(error){fail(error);}
  });}};
}
