export function createKokoroVoice({onprogress=()=>{}}={}){
  const worker=new Worker(new URL('./kokoro-worker.mjs',import.meta.url),{type:'module'});
  const pending=new Map();let serial=0,failed=null;
  const fail=error=>{failed=error;const requests=[...pending.values()];pending.clear();for(const request of requests)request.reject(error);};
  worker.onmessage=({data})=>{
    if(data.type==='progress'){onprogress(data.message);return;}
    const request=pending.get(data.id);if(!request)return;pending.delete(data.id);
    if(data.type==='audio')request.resolve({samples:data.samples,sampleRate:data.sampleRate});
    else request.reject(new Error(data.message));
  };
  worker.onerror=event=>fail(new Error(event.message||'The Kokoro worker could not load'));
  return {dispose(){worker.terminate();fail(new Error('The voice worker was reset'));},synthesize(text){return new Promise((resolve,reject)=>{
    if(failed){reject(failed);return;}
    const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,text});
  });}};
}
