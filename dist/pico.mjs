import initialize from './vendor/pico/svoxpico.js';

// Pico's Apache-licensed engine renders real 16 kHz speech samples locally.
export async function createPicoVoice({wasmBinary,resources}={}){
  const m=await initialize(wasmBinary?{wasmBinary}:{});
  const alloc=n=>{const p=m._malloc(n);m.HEAPU8.fill(0,p,p+n);return p;};
  const utf8=text=>{const bytes=new TextEncoder().encode(text+'\0'),p=alloc(bytes.length);m.HEAPU8.set(bytes,p);return {p,length:bytes.length};};
  const pointer=p=>m.HEAPU32[p>>>2];
  const check=(code,stage)=>{if(code!==0)throw new Error(`Voice ${stage} failed (${code})`);};
  const memory=alloc(2500000),systemRef=alloc(4);
  check(m._pico_initialize(memory,2500000,systemRef),'initialization');
  const system=pointer(systemRef),voiceName=utf8('BrickVoice');
  check(m._pico_createVoiceDefinition(system,voiceName.p),'definition');
  for(const file of ['en-US_ta.bin','en-US_lh0_sg.bin']){
    let bytes=resources?.[file];
    if(!bytes){const response=await fetch(new URL('./vendor/pico/'+file,import.meta.url));if(!response.ok)throw new Error('Voice download failed');bytes=new Uint8Array(await response.arrayBuffer());}
    m.FS.writeFile('/'+file,bytes);
    const path=utf8('/'+file),resourceRef=alloc(4),name=alloc(64);
    check(m._pico_loadResource(system,path.p,resourceRef),'resource loading');
    check(m._pico_getResourceName(system,pointer(resourceRef),name),'resource name');
    check(m._pico_addResourceToVoiceDefinition(system,voiceName.p,name),'voice resource');
    m._free(path.p);m._free(resourceRef);m._free(name);
  }
  return {synthesize(text){
    const engineRef=alloc(4),written=alloc(4),output=alloc(16384),count=alloc(4),type=alloc(4);
    // Pico accepts speech markup; treat learner input as literal text.
    const input=utf8(String(text).replace(/[<>&]/g,' ').replace(/[’‘]/g,"'").replace(/[“”]/g,'"'));
    let engine=0;
    try{
      check(m._pico_newEngine(system,voiceName.p,engineRef),'engine creation');engine=pointer(engineRef);
      const chunks=[];let total=0;
      for(let offset=0;offset<input.length;){
        check(m._pico_putTextUtf8(engine,input.p+offset,Math.min(32767,input.length-offset),written),'text input');
        const consumed=m.HEAPU16[written>>>1];
        if(!consumed)throw new Error('Voice input stalled');
        offset+=consumed;
        for(let reads=0;reads<100000;reads++){
          const result=m._pico_getData(engine,output,16384,count,type),length=m.HEAPU16[count>>>1];
          if(result!==200&&result!==201)throw new Error(`Voice rendering failed (${result})`);
          if(length){chunks.push(m.HEAPU8.slice(output,output+length));total+=length;}
          if(result===200)break;
          if(reads===99999)throw new Error('Voice rendering stalled');
        }
      }
      const bytes=new Uint8Array(total);let cursor=0;for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.length;}
      const view=new DataView(bytes.buffer),samples=new Float32Array(total/2);
      for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;
      if(!samples.some(value=>Math.abs(value)>.001))throw new Error('Voice rendered no sound');
      return {samples,sampleRate:16000};
    }finally{
      if(engine)m._pico_disposeEngine(system,engineRef);
      for(const p of [engineRef,written,output,count,type,input.p])m._free(p);
    }
  }};
}
