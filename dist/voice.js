'use strict';
class LocalNarrator {
  constructor(){this.context=null;this.source=null;this.generation=0;this.ready=null;this.cache=new Map();this.progress=null;}
  unlock(){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)throw new Error('Audio playback is unavailable in this browser');
    if(!this.context){this.context=new Context();this.output=this.context.createGain();this.output.connect(this.context.destination);}
    // Called synchronously by Play, before fetching or rendering anything.
    return this.context.state==='running'?Promise.resolve():this.context.resume();
  }
  stop(){
    this.generation++;this.progress=null;
    if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}
  }
  render(voice,text){
    let rendered=this.cache.get(text);
    if(rendered){
      // Keep the active lesson's parts together when older lessons are evicted.
      this.cache.delete(text);this.cache.set(text,rendered);
    }else{
      const ready=this.ready;
      rendered=Promise.resolve().then(()=>voice.synthesize(text)).catch(error=>{
        if(this.cache.get(text)===rendered)this.cache.delete(text);
        voice.dispose?.();
        if(this.ready===ready){this.ready=null;this.cache.clear();}
        throw error;
      });
      if(this.cache.size>=12)this.cache.delete(this.cache.keys().next().value);
      this.cache.set(text,rendered);
    }
    return rendered;
  }
  play(text,{offset=0,prepare=[],onstart=()=>{},onend=()=>{},onprogress=()=>{}}={}){
    this.stop();const generation=this.generation;
    const parts=[...new Set([text,...prepare])];let prepared=0;
    this.progress=(message,stage)=>onprogress(stage==='generating'&&parts.length>1?`Preparing the course… ${prepared} of ${parts.length} parts ready`:message);
    // Preserve browser user activation for the audio output context.
    const unlocked=this.unlock();
    if(!this.ready)this.ready=import('./kokoro.mjs?v=20261109-2').then(module=>module.createKokoroVoice({onprogress:(message,stage)=>this.progress?.(message,stage)})).catch(error=>{this.ready=null;throw error;});
    return Promise.all([unlocked,this.ready]).then(async([,voice])=>{
      if(generation!==this.generation)return false;
      // Generate the remaining lesson before starting its animation. A device
      // that synthesizes slower than real time then waits once, rather than at
      // every part boundary. Sequential requests stop after cancellation.
      let rendered;
      for(let i=0;i<parts.length;i++){
        if(generation!==this.generation)return false;
        const audio=await this.render(voice,parts[i]);
        if(generation!==this.generation)return false;
        if(parts[i]===text)rendered=audio;
        prepared=i+1;
        if(parts.length>1)onprogress(`Preparing the course… ${prepared} of ${parts.length} parts ready`);
      }
      if(generation!==this.generation)return false;
      const {samples,sampleRate}=rendered,buffer=this.context.createBuffer(1,samples.length,sampleRate);
      buffer.copyToChannel(samples,0);
      const source=this.context.createBufferSource();source.buffer=buffer;
      // Keep Kokoro's natural pitch and pacing; never speed up a finished wave.
      source.playbackRate.value=1;
      source.connect(this.output);this.source=source;
      source.onended=()=>{if(generation===this.generation){source.disconnect();this.source=null;onend();}};
      const position=Math.max(0,Math.min(.99,offset))*buffer.duration;
      source.start(0,position);onstart({duration:buffer.duration});return true;
    });
  }
}
