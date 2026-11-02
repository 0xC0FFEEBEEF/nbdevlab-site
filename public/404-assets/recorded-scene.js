import { STORY } from './score.js';

// A recording of the same shader, camera and debris paths. Loaded only if live
// graphics fail, so a driver problem cannot leave Replay with an empty canvas.
export class RecordedScene {
 constructor(canvas){
  this.element=document.createElement('video');
  this.element.className='recorded-view';this.element.setAttribute('aria-hidden','true');
  this.element.muted=true;this.element.defaultMuted=true;this.element.playsInline=true;
  this.element.setAttribute('playsinline','');this.element.preload='auto';
  this.playWanted=false;this.pendingPlay=false;this.available=false;this.closed=false;
  canvas.insertAdjacentElement('afterend',this.element);
  this.resize();
 }
 resize(){
  const mode=innerWidth/innerHeight>=1.6?'landscape':'portrait';
  if(mode===this.mode||this.closed)return;
  this.mode=mode;this.pause();this.available=false;
  if(this.cancelLoad)this.cancelLoad();
  this.element.poster=`/404-assets/orbit-${mode}.jpg`;
  this.ready=new Promise(resolve=>{
   let timer;
   const done=ready=>{clearTimeout(timer);this.element.removeEventListener('loadedmetadata',loaded);this.element.removeEventListener('error',failed);this.available=ready;this.cancelLoad=null;resolve(ready);};
   const loaded=()=>done(true),failed=()=>done(false);
   this.cancelLoad=failed;
   this.element.addEventListener('loadedmetadata',loaded,{once:true});
   this.element.addEventListener('error',failed,{once:true});
   timer=setTimeout(failed,8000);
   this.element.src=`/404-assets/orbit-${mode}.mp4`;this.element.load();
   if(this.element.readyState>=1)loaded();
  });
 }
 sync(time,playing){
  if(this.closed)return;
  this.element.hidden=time>=STORY.final;
  if(this.element.hidden||!playing){this.pause();}
  if(!this.available||this.element.hidden)return;
  if(Math.abs(this.element.currentTime-time)>.18){try{this.element.currentTime=time;}catch{}}
  if(playing&&!this.playWanted&&!this.pendingPlay){
   this.playWanted=true;this.pendingPlay=true;
   try{Promise.resolve(this.element.play()).catch(()=>{}).finally(()=>{this.pendingPlay=false;if(!this.playWanted)this.element.pause();});}
   catch{this.pendingPlay=false;}
  }
 }
 pause(){this.playWanted=false;this.element.pause();}
 close(){this.closed=true;this.pause();if(this.cancelLoad)this.cancelLoad();this.element.removeAttribute('src');this.element.load();this.element.remove();}
}
