import { STORY } from './score.js';
import { IncidentAudio } from './audio.js';
import { vertex, world, post, retention } from './visuals.js';
import { cameraBasisAt } from './camera.js';
import { viewportProfile } from './viewport.js';
import { assertRenderedFrame } from './graphics-health.js';
import { RecordedScene } from './recorded-scene.js';
const $=id=>document.getElementById(id),canvas=$('view'),ending=$('ending');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const audio=new IncidentAudio();
const epilogue=$('epilogue');
let retentionProgram,retentionUniforms,historyTextures=[],historyTargets=[],historyIndex=0,historyReset=true,renderedTime=null;
let recorded=null,graphicsFailed=false,initializing=false,animationScheduled=false;
const smooth=x=>{const u=Math.max(0,Math.min(1,x));return u*u*(3-2*u);};
let soundOn=true,started=false,paused=false,elapsed=0,last=performance.now(),phase='',dirty=true,exposure=1/60,focal=1.7,gl,worldProgram,postProgram,worldUniforms,postUniforms,framebuffer,sceneTexture;
function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
function program(fragment){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);const pos=gl.getAttribLocation(p,'a_position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);return p;}
function uniforms(p,names){return Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(p,name)]));}
function resize(){
 if(recorded){recorded.resize();dirty=true;return;}
 if(!gl||!sceneTexture)return;
 const bounds=canvas.getBoundingClientRect();
 const view=viewportProfile(bounds.width,bounds.height,devicePixelRatio,matchMedia('(pointer: coarse)').matches);
 if(canvas.width===view.width&&canvas.height===view.height&&focal===view.focal)return;
 dirty=true;historyReset=true;focal=view.focal;canvas.width=view.width;canvas.height=view.height;gl.viewport(0,0,canvas.width,canvas.height);
 if(sceneTexture){gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,sceneTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,canvas.width,canvas.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);}
 historyTextures.forEach((tex,i)=>{gl.activeTexture(gl.TEXTURE4+i);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,canvas.width,canvas.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);});
}
function texture(url,index){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{gl.activeTexture(gl.TEXTURE0+index);const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);for(const prop of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,prop,gl.LINEAR);for(const prop of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,prop,gl.CLAMP_TO_EDGE);resolve();};img.onerror=reject;img.src=url;});}
function soundUI(){$('sound').disabled=!started||!audio.loaded;$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').setAttribute('aria-label',soundOn?'Mute sound':'Enable sound');$('sound-label').textContent=soundOn?'SOUND ON':'SOUND OFF';}
function update(){
 const next=elapsed>=STORY.reveal?'ended':elapsed>=STORY.dock?'dissolving':elapsed>=STORY.line2?'quote2':elapsed>=STORY.line1?'quote':elapsed>=STORY.dead?'dead':elapsed>=STORY.final?'strike':elapsed>=STORY.steady?'approach':elapsed>=STORY.second?'brake':elapsed>=STORY.hit+.13?'tumble':elapsed>=STORY.hit?'impact':elapsed>=STORY.pass3?'storm':elapsed>=4.1?'debris':elapsed>=STORY.radio?'radio':'opening';
 if(next!==phase){
  phase=next;if(phase==='ended')document.body.dataset.transport='ended';
  document.body.dataset.phase=phase;document.body.dataset.stage=elapsed>=STORY.reveal?'ended':elapsed>=STORY.line1?'epilogue':'story';
  ending.classList.toggle('visible',elapsed>=STORY.reveal);epilogue.setAttribute('aria-hidden',String(elapsed<STORY.line1||elapsed>=STORY.reveal));ending.classList.toggle('revealed',elapsed>=STORY.reveal);ending.inert=elapsed<STORY.reveal;
  $('skip').hidden=phase==='ended';$('end-tag').hidden=phase!=='ended';$('pause').hidden=phase==='ended';$('replay').hidden=reduced.matches;
  $('phase').textContent={opening:'01 / ACQUIRING',radio:'02 / RELAY ACTIVE',debris:'03 / PROXIMITY',storm:'04 / DEBRIS FIELD',impact:'05 / CONTACT',tumble:'06 / ATTITUDE LOST',brake:'07 / SECOND CONTACT',approach:'08 / COASTING',strike:'09 / LINK FAILURE',dead:'10 / NO CARRIER',quote:'11 / SIGNAL LOST',quote2:'11 / SIGNAL LOST',dissolving:'12 / DESTINATION LOST',ended:'13 / PAGE NOT FOUND'}[phase];
  $('feed-status').textContent={opening:'EXT. FEED / LIVE',radio:'COMMS ACTIVE / CH. 004',debris:'PROXIMITY / DEBRIS',storm:'DEBRIS FIELD / MULTIPLE OBJECTS',impact:'CAMERA STRIKE',tumble:'ATTITUDE LOST / PACKET FAILURE',brake:'SECOND CONTACT / ATTITUDE CHANGE',approach:'EXT. FEED / COASTING',strike:'LINK TERMINATED',dead:'NO CARRIER',quote:'NO CARRIER',quote2:'NO CARRIER',dissolving:'NO CARRIER',ended:'LINK TERMINATED'}[phase];
 }
 const exit=smooth((elapsed-STORY.dock)/1.05);
 const first=smooth((elapsed-STORY.line1)/1.15),quiet=smooth((elapsed-STORY.line1-.35)/1.15),second=smooth((elapsed-STORY.line2)/1.2);
 epilogue.style.opacity=String(reduced.matches?0:1-exit);
 epilogue.style.visibility=elapsed>=STORY.line1&&elapsed<STORY.reveal?'visible':'hidden';
 $('line-one').style.opacity=String(first);$('quiet-line').style.opacity=String(quiet);
 $('line-one').style.transform=`translate3d(0,${(1-first)*4}px,0)`;$('line-one').style.filter=`blur(${(1-first)*1.4}px)`;
 $('line-two').style.opacity=String(second);$('line-two').style.transform=`translate3d(0,${(1-second)*3}px,0)`;
 $('time').textContent='00:'+String(Math.floor(elapsed)).padStart(2,'0')+' / 00:'+String(Math.ceil(STORY.end)).padStart(2,'0');$('fill').style.width=elapsed/STORY.end*100+'%';
}
function paint(){
 if(recorded){recorded.sync(elapsed,started&&!paused&&!document.hidden);return;}
 if(!gl||!worldProgram)return;
 const motion=reduced.matches?0:1,attitude=cameraBasisAt(elapsed,motion),previousAttitude=cameraBasisAt(elapsed-Math.min(exposure*.25,.006),motion);
 const delta=renderedTime===null?1/60:elapsed-renderedTime;if(delta<0||delta>.5)historyReset=true;
 gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.useProgram(worldProgram);gl.uniform2f(worldUniforms.resolution,canvas.width,canvas.height);gl.uniform1f(worldUniforms.focal,focal);gl.uniform1f(worldUniforms.time,elapsed);gl.uniform1f(worldUniforms.motion,motion);gl.uniform1f(worldUniforms.shutter,exposure);gl.uniformMatrix3fv(worldUniforms.attitude,false,attitude);gl.drawArrays(gl.TRIANGLES,0,6);
 const write=1-historyIndex;gl.bindFramebuffer(gl.FRAMEBUFFER,historyTargets[write]);gl.useProgram(retentionProgram);gl.uniform2f(retentionUniforms.resolution,canvas.width,canvas.height);gl.uniform1f(retentionUniforms.time,elapsed);gl.uniform1f(retentionUniforms.delta,Math.max(0,Math.min(.1,delta)));gl.uniform1f(retentionUniforms.reset,historyReset?1:0);gl.uniform1i(retentionUniforms.liveScene,2);gl.uniform1i(retentionUniforms.previous,4+historyIndex);gl.drawArrays(gl.TRIANGLES,0,6);
 historyIndex=write;historyReset=false;renderedTime=elapsed;
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(postProgram);gl.uniform2f(postUniforms.resolution,canvas.width,canvas.height);gl.uniform1f(postUniforms.focal,focal);gl.uniform1f(postUniforms.time,elapsed);gl.uniform1f(postUniforms.motion,motion);gl.uniform1f(postUniforms.shutter,exposure);gl.uniformMatrix3fv(postUniforms.attitude,false,attitude);gl.uniformMatrix3fv(postUniforms.previousAttitude,false,previousAttitude);gl.uniform1i(postUniforms.memory,4+historyIndex);gl.drawArrays(gl.TRIANGLES,0,6);
}
function frame(now){requestAnimationFrame(frame);if(document.hidden){last=now;return;}const dt=Math.max(0,(now-last)/1000);last=now;const moving=started&&!paused&&elapsed<STORY.end;if(!moving&&!dirty)return;if(moving){const previous=elapsed;elapsed=soundOn&&audio.running?Math.min(STORY.end,audio.time()):Math.min(STORY.end,elapsed+dt);exposure=Math.max(1/120,Math.min(.14,elapsed-previous));}dirty=false;update();paint();}
async function start(withSound=true){
 recorded?.pause();
 audio.stop();soundOn=withSound&&!reduced.matches?await audio.start(0):false;
 started=true;paused=false;historyReset=true;renderedTime=null;document.body.dataset.transport='playing';elapsed=reduced.matches?STORY.end:0;last=performance.now();phase='';dirty=true;$('pause').disabled=false;$('pause').textContent='PAUSE Ⅱ';$('pause').setAttribute('aria-label','Pause transmission');soundUI();update();if(document.hidden)audio.pause();
}
async function resumeAudio(){if(soundOn&&!await audio.resume()){soundOn=false;soundUI();}}
$('replay').addEventListener('click',()=>{if(graphicsFailed&&!recorded)void init(soundOn);else void start(soundOn);});
$('sound').addEventListener('click',async()=>{
 if(!started)return;
 if(soundOn){soundOn=false;audio.pause();soundUI();return;}
 const wasPaused=paused;paused=true;$('sound').disabled=true;
 try{soundOn=await audio.start(elapsed);if(wasPaused)audio.pause();}
 finally{paused=wasPaused;last=performance.now();dirty=true;$('sound').disabled=false;soundUI();}
});
$('pause').addEventListener('click',()=>{paused=!paused;document.body.dataset.transport=paused?'paused':'playing';last=performance.now();dirty=true;if(soundOn){if(paused)audio.pause();else void resumeAudio();}$('pause').textContent=paused?'RESUME ▷':'PAUSE Ⅱ';$('pause').setAttribute('aria-label',paused?'Resume transmission':'Pause transmission');});
$('skip').addEventListener('click',()=>{audio.stop();audio.pause();elapsed=STORY.end;started=true;paused=true;dirty=true;update();});
window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);new ResizeObserver(resize).observe(canvas);document.addEventListener('visibilitychange',()=>{last=performance.now();dirty=true;if(document.hidden)recorded?.pause();if(soundOn&&started){if(document.hidden||paused)audio.pause();else void resumeAudio();}});
reduced.addEventListener('change',()=>{$('replay').hidden=reduced.matches;if(reduced.matches){audio.stop();soundOn=false;started=true;paused=true;elapsed=STORY.end;document.body.dataset.transport='ended';dirty=true;soundUI();update();}});
canvas.addEventListener('webglcontextlost',async event=>{
 event.preventDefault();if(graphicsFailed||initializing)return;
 const wasPaused=paused;paused=true;audio.pause();
 if(!await useRecording()){showUnavailable();return;}
 paused=wasPaused;last=performance.now();dirty=true;
 if(soundOn&&!paused&&!document.hidden)void resumeAudio();
});
window.addEventListener('pagehide',event=>{recorded?.pause();if(event.persisted)audio.pause();else{audio.close();recorded?.close();}});
window.addEventListener('pageshow',event=>{if(event.persisted){last=performance.now();dirty=true;historyReset=true;resize();if(soundOn&&started&&!paused&&!document.hidden)void resumeAudio();}});
audio.ready.then(soundUI);
async function useRecording(){
 graphicsFailed=true;const failedContext=gl;gl=null;canvas.hidden=true;
 try{if(failedContext&&!failedContext.isContextLost())failedContext.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
 if(!recorded)recorded=new RecordedScene(canvas);
 const available=await recorded.ready;
 if(!available){recorded.close();recorded=null;return false;}
 document.body.dataset.renderer='recorded';return true;
}
function showUnavailable(){
 soundOn=false;audio.stop();started=true;paused=true;elapsed=STORY.end;
 document.body.dataset.renderer='unavailable';document.body.classList.add('ready');
 $('fallback').hidden=false;dirty=true;soundUI();update();
}
async function begin(withSound){
 document.body.classList.add('ready');$('fallback').hidden=true;update();paint();
 if(!recorded)assertRenderedFrame(gl,canvas.width,canvas.height);
 if(!animationScheduled){animationScheduled=true;requestAnimationFrame(frame);}
 if(reduced.matches){soundOn=false;started=true;paused=true;elapsed=STORY.end;dirty=true;soundUI();update();return;}
 await start(withSound);
}
async function init(withSound=true){
 if(initializing)return;initializing=true;
 try{
  if(graphicsFailed){if(!await useRecording())throw Error('Recording unavailable');await begin(withSound);return;}
  gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,powerPreference:'default'});if(!gl)throw Error('WebGL unavailable');
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  worldProgram=program(world);worldUniforms=uniforms(worldProgram,['resolution','focal','time','motion','shutter','attitude','surfaceMap','nightMap','rockMap']);postProgram=program(post);postUniforms=uniforms(postProgram,['resolution','focal','time','motion','shutter','attitude','previousAttitude','scene','memory']);
  retentionProgram=program(retention);retentionUniforms=uniforms(retentionProgram,['resolution','time','delta','reset','liveScene','previous']);
  sceneTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,sceneTexture);for(const prop of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,prop,gl.LINEAR);for(const prop of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,prop,gl.CLAMP_TO_EDGE);
  framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sceneTexture,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  for(let i=0;i<2;i++){
   const tex=gl.createTexture();historyTextures.push(tex);gl.activeTexture(gl.TEXTURE4+i);gl.bindTexture(gl.TEXTURE_2D,tex);
   for(const prop of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,prop,gl.LINEAR);for(const prop of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,prop,gl.CLAMP_TO_EDGE);
   const target=gl.createFramebuffer();historyTargets.push(target);gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  await Promise.all([texture('/404-assets/earth-surface.jpg',0),texture('/404-assets/earth-lights.png',1),texture('/404-assets/rock-surface.jpg',3)]);gl.useProgram(worldProgram);gl.uniform1i(worldUniforms.surfaceMap,0);gl.uniform1i(worldUniforms.nightMap,1);gl.uniform1i(worldUniforms.rockMap,3);gl.useProgram(postProgram);gl.uniform1i(postUniforms.scene,2);resize();
  for(const target of [framebuffer,...historyTargets]){gl.bindFramebuffer(gl.FRAMEBUFFER,target);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete camera target');}gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  document.body.dataset.renderer='webgl';await begin(withSound);
 }catch(error){
  console.warn('External camera: using recorded playback.',error);
  if(!graphicsFailed&&await useRecording())await begin(withSound);
  else showUnavailable();
 }finally{initializing=false;}
}
document.body.dataset.transport='loading';$('pause').disabled=true;soundUI();init();
