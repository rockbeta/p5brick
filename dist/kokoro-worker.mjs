import {KokoroTTS,env} from './vendor/kokoro/kokoro.web.mjs';
import {KOKORO} from './kokoro-config.mjs';

// Latest official stable English model; v1.1 is the Chinese-specific release.
env.wasmPaths=new URL('./vendor/kokoro/ort-tf3.5.1/',import.meta.url).href;
// Serve the official, pinned model and voice on the site's own origin. The
// upstream loader still handles browser caching, without a third-party request.
const modelPrefix=`https://huggingface.co/${KOKORO.modelId}/resolve/main/`;
const fetchModel=globalThis.fetch.bind(globalThis);
globalThis.fetch=(input,options)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  return fetchModel(url.startsWith(modelPrefix)?new URL('./models/kokoro/'+url.slice(modelPrefix.length),import.meta.url):input,options);
};
let ready,queue=Promise.resolve();
const progress=message=>self.postMessage({type:'progress',message});
function load(){
  if(!ready){
    let lastPercent=-1;
    progress('Loading Kokoro voice… First download is about 120 MB, then cached.');
    ready=KokoroTTS.from_pretrained(KOKORO.modelId,{dtype:KOKORO.dtype,device:'wasm',progress_callback:event=>{
      if(event.status==='progress'&&event.file?.endsWith('.onnx')){
        const percent=Math.round(event.progress||0);
        if(percent!==lastPercent){lastPercent=percent;progress(`Downloading Kokoro voice… ${percent}%`);}
      }
      else if(event.status==='done'&&event.file?.endsWith('.onnx'))progress('Preparing Kokoro voice…');
    }}).catch(error=>{ready=null;throw error;});
  }
  return ready;
}
self.onmessage=event=>{
  const {id,text}=event.data;
  queue=queue.catch(()=>{}).then(async()=>{
    try{
      const model=await load();progress('Generating Kokoro narration…');
      const audio=await model.generate(text,{voice:KOKORO.voice,speed:KOKORO.speed});
      const samples=new Float32Array(audio.audio);
      if(!samples.some(value=>Number.isFinite(value)&&Math.abs(value)>.001))throw new Error('Kokoro generated no sound');
      self.postMessage({type:'audio',id,samples,sampleRate:audio.sampling_rate},[samples.buffer]);
    }catch(error){self.postMessage({type:'error',id,message:error.message||'Kokoro could not generate speech'});}
  });
};
