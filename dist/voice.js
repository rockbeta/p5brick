'use strict';
class LocalNarrator {
  constructor(){this.context=null;this.source=null;this.generation=0;this.ready=null;this.cache=new Map();}
  unlock(){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)throw new Error('Audio playback is unavailable in this browser');
    if(!this.context){this.context=new Context();this.output=this.context.createGain();this.output.connect(this.context.destination);}
    // Called synchronously by Play, before fetching or rendering anything.
    return this.context.state==='running'?Promise.resolve():this.context.resume();
  }
  stop(){
    this.generation++;
    if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}
  }
  play(text,{offset=0,onstart=()=>{},onend=()=>{}}={}){
    this.stop();const generation=this.generation;
    // Preserve browser user activation for the audio output context.
    const unlocked=this.unlock();
    if(!this.ready)this.ready=import('./pico.mjs').then(module=>module.createPicoVoice()).catch(error=>{this.ready=null;throw error;});
    return Promise.all([unlocked,this.ready]).then(([,voice])=>{
      if(generation!==this.generation)return false;
      let rendered=this.cache.get(text);
      if(!rendered){rendered=voice.synthesize(text);if(this.cache.size>=12)this.cache.delete(this.cache.keys().next().value);this.cache.set(text,rendered);}
      const {samples,sampleRate}=rendered,buffer=this.context.createBuffer(1,samples.length,sampleRate);
      buffer.copyToChannel(samples,0);
      const source=this.context.createBufferSource();source.buffer=buffer;
      source.playbackRate.value=Math.max(1,buffer.duration/9.5);
      source.connect(this.output);this.source=source;
      source.onended=()=>{if(generation===this.generation){source.disconnect();this.source=null;onend();}};
      const position=Math.max(0,Math.min(.99,offset))*buffer.duration;
      source.start(0,position);onstart();return true;
    });
  }
}
