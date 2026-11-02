// The approved score, rendered once so sound can join at the current picture time.
export class IncidentAudio {
 constructor(){
  this.element=new Audio();this.element.preload='auto';this.generation=0;
  this.abort=new AbortController();this.closed=false;this.objectURL=null;this.loaded=false;
  // A local blob stays seekable even when an asset server ignores byte ranges.
  this.ready=fetch(new URL('./soundtrack.mp3',import.meta.url),{signal:this.abort.signal}).then(async response=>{
   if(!response.ok)throw Error('Sound unavailable');
   const blob=await response.blob();if(this.closed)return false;
   this.objectURL=URL.createObjectURL(blob);
   return new Promise(resolve=>{
    const done=value=>{this.loaded=value;this.element.removeEventListener('loadedmetadata',loaded);this.element.removeEventListener('error',failed);resolve(value);};
    const loaded=()=>done(true),failed=()=>done(false);
    this.element.addEventListener('loadedmetadata',loaded,{once:true});this.element.addEventListener('error',failed,{once:true});
    this.element.src=this.objectURL;this.element.load();if(this.element.readyState>=1)done(true);
   });
  }).catch(()=>false);
 }
 get running(){return !this.element.paused&&!this.element.ended;}
 time(){return this.element.currentTime;}
 async start(offset=0){
  const generation=++this.generation;
  let timer;
  try{
   const playNow=()=>{
    if(generation!==this.generation||this.closed)return Promise.resolve(false);
    this.element.currentTime=Math.max(0,offset);this.element.muted=false;
    // Call play in the tap handler's turn to preserve mobile user activation.
    return Promise.resolve(this.element.play()).then(()=>true);
   };
   const playing=(this.loaded?playNow():this.ready.then(ready=>ready?playNow():false)).catch(()=>false);
   const allowed=await Promise.race([playing,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),1500);})]);
   if(generation!==this.generation)return false;
   if(!allowed)this.pause();
   return allowed;
  }catch{return false;}
  finally{clearTimeout(timer);}
 }
 pause(){this.generation++;this.element.pause();}
 resume(){return this.start(this.time());}
 stop(){this.pause();try{this.element.currentTime=0;}catch{}}
 close(){this.closed=true;this.abort.abort();this.stop();this.element.removeAttribute('src');this.element.load();if(this.objectURL)URL.revokeObjectURL(this.objectURL);}
}
