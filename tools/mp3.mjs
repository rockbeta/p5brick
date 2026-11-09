// Read the mono MPEG-2 Layer III files produced by our offline narration task.
export function inspectMp3(bytes){
  let offset=0,frames=0,sampleRate;
  while(offset<bytes.length){
    if(offset+4>bytes.length||bytes[offset]!==255||(bytes[offset+1]&254)!==242)throw new Error(`Invalid MPEG-2 Layer III frame at ${offset}`);
    const bitrate=[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160][bytes[offset+2]>>4];
    const rate=[22050,24000,16000][(bytes[offset+2]>>2)&3];
    if(!bitrate||!rate||(bytes[offset+3]>>6)!==3)throw new Error('Expected mono MPEG-2 narration');
    if(sampleRate&&sampleRate!==rate)throw new Error('Inconsistent sample rate');
    sampleRate=rate;
    const length=Math.floor(72000*bitrate/rate)+((bytes[offset+2]>>1)&1);
    if(offset+length>bytes.length)throw new Error('Truncated narration frame');
    offset+=length;frames++;
  }
  if(!frames)throw new Error('Empty narration');
  return {duration:frames*576/sampleRate,sampleRate,frames};
}
