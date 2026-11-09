'use strict';
class LocalNarrator {
  constructor(){this.context=null;this.source=null;this.generation=0;this.downloads=new Map();this.cache=new Map();}
  unlock(){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)throw new Error('Audio playback is unavailable in this browser');
    if(!this.context){this.context=new Context();this.output=this.context.createGain();this.output.connect(this.context.destination);}
    // Keep audio activation inside the Play click, before any asynchronous work.
    return this.context.state==='running'?Promise.resolve():this.context.resume();
  }
  stop(){
    this.generation++;
    if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}
  }
  load(clip){
    const key=clip.src;let pending=this.downloads.get(key);
    if(pending){this.downloads.delete(key);this.downloads.set(key,pending);return pending;}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
    pending=Promise.resolve().then(()=>fetch(key,{signal:controller.signal})).then(response=>{
      if(!response.ok)throw new Error('The lesson audio could not load');
      return response.arrayBuffer();
    }).catch(error=>{if(this.downloads.get(key)===pending)this.downloads.delete(key);throw error;}).finally(()=>clearTimeout(timer));
    if(this.downloads.size>=18)this.downloads.delete(this.downloads.keys().next().value);
    this.downloads.set(key,pending);return pending;
  }
  // Fetch the current lesson while the learner reads. This neither starts audio
  // nor creates an AudioContext before the learner presses Play.
  preload(clips){return Promise.all(clips.map(clip=>this.load(clip)));}
  buffer(clip){
    const key=clip.src;let pending=this.cache.get(key);
    if(pending){this.cache.delete(key);this.cache.set(key,pending);return pending;}
    const download=this.load(clip);
    pending=download.then(bytes=>this.context.decodeAudioData(bytes.slice(0))).catch(error=>{
      if(this.cache.get(key)===pending)this.cache.delete(key);
      if(this.downloads.get(key)===download)this.downloads.delete(key);
      throw error;
    });
    if(this.cache.size>=12)this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key,pending);return pending;
  }
  play(clip,{offset=0,prepare=[],onstart=()=>{},onend=()=>{},onprogress=()=>{}}={}){
    this.stop();const generation=this.generation;
    const unlocked=this.unlock(),parts=[...new Map([clip,...prepare].map(part=>[part.src,part])).values()];
    return Promise.resolve(unlocked).then(async()=>{
      if(generation!==this.generation)return false;
      let ready=0;
      const buffers=await Promise.all(parts.map(async part=>{
        const buffer=await this.buffer(part);ready++;
        if(generation===this.generation&&parts.length>1)onprogress(`Loading the lesson… ${ready} of ${parts.length} parts ready`);
        return buffer;
      }));
      if(generation!==this.generation)return false;
      const buffer=buffers[0],source=this.context.createBufferSource();source.buffer=buffer;
      source.playbackRate.value=1;source.connect(this.output);this.source=source;
      source.onended=()=>{if(generation===this.generation){source.disconnect();this.source=null;onend();}};
      const position=Math.max(0,Math.min(.99,offset))*buffer.duration;
      source.start(0,position);onstart({duration:buffer.duration});return true;
    });
  }
}
