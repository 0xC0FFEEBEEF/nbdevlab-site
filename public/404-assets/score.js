export const STORY=Object.freeze({radio:2.05,pass1:4.65,pass2:5.72,pass3:6.40,occlusion:7.23,hit:8.12,second:10.85,steady:12.00,final:13.25,dead:13.29,line1:14.10,line2:16.60,dock:19.40,reveal:20.85,end:23.00});
export class IncidentAudio{
 constructor(){this.context=null;this.sources=new Set();this.assets=Promise.all(['/404-assets/piano-c6.mp3','/404-assets/radio-fragments.mp3'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('Sound unavailable');return r.arrayBuffer();}));}
 async init(){
  if(this.piano)return;
  if(!this.context){
   const c=this.context=new AudioContext();this.master=c.createGain();this.master.gain.value=0;
   const limiter=c.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=18;limiter.ratio.value=3;this.master.connect(limiter);limiter.connect(c.destination);
   this.reverb=c.createConvolver();const ir=c.createBuffer(2,c.sampleRate*7.2,c.sampleRate);
   for(let ch=0;ch<2;ch++){let smooth=0;const a=ir.getChannelData(ch);for(let i=0;i<a.length;i++){const t=i/c.sampleRate;smooth=(smooth+(Math.random()*2-1)*.42)/1.42;a[i]=smooth*Math.exp(-t*.74)*Math.min(1,t/.10);}}
   this.reverb.buffer=ir;const wet=c.createGain();wet.gain.value=.66;const soft=c.createBiquadFilter();soft.type='lowpass';soft.frequency.value=4600;this.reverb.connect(soft);soft.connect(wet);this.pianoBus=c.createGain();wet.connect(this.pianoBus);this.pianoBus.connect(this.master);
   this.noise=c.createBuffer(2,c.sampleRate*3,c.sampleRate);for(let ch=0;ch<2;ch++){const a=this.noise.getChannelData(ch);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;}
  }
  const raw=await this.assets;[this.piano,this.radio]=await Promise.all(raw.map(a=>this.context.decodeAudioData(a.slice(0))));
 }
 async unlock(){await this.init();const c=this.context;if(c.state==='running')return true;return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);c.removeEventListener('statechange',check);resolve(value);};const check=()=>{if(c.state==='running')finish(true);};const timer=setTimeout(()=>finish(c.state==='running'),500);c.addEventListener('statechange',check);c.resume().then(check).catch(()=>finish(false));check();});}

 own(source,nodes=[]){this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();nodes.forEach(n=>n.disconnect());};}
 stop(){for(const s of [...this.sources]){try{s.stop();}catch{}}}
 thud(at,strength=1){
  const c=this.context,s=c.createBufferSource(),f=c.createBiquadFilter();
  const body=c.createBuffer(1,Math.ceil(c.sampleRate*.28),c.sampleRate),samples=body.getChannelData(0);
  // Audible housing modes above the sub-bass range carry on small speakers.
  for(let i=0;i<samples.length;i++){const t=i/c.sampleRate,attack=1-Math.exp(-t/.0012),tail=Math.min(1,(.28-t)/.035);samples[i]=strength*attack*tail*(.045*Math.sin(2*Math.PI*112*t)*Math.exp(-t/.055)+.100*Math.sin(2*Math.PI*210*t)*Math.exp(-t/.045)+.050*Math.sin(2*Math.PI*376*t)*Math.exp(-t/.023)+.018*Math.sin(2*Math.PI*690*t)*Math.exp(-t/.010));}
  s.buffer=body;f.type='lowpass';f.frequency.value=1050;f.Q.value=.55;s.connect(f);f.connect(this.master);this.own(s,[f]);s.start(at);
 }
 burst(at,length,level,hz,to,pan=0){const c=this.context,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),p=c.createStereoPanner();s.buffer=this.noise;s.loop=true;f.type='bandpass';f.Q.value=.7;f.frequency.setValueAtTime(hz,at);f.frequency.exponentialRampToValueAtTime(to,at+length);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(level,at+.015);g.gain.exponentialRampToValueAtTime(.00001,at+length);p.pan.setValueAtTime(pan,at);p.pan.linearRampToValueAtTime(-pan,at+length);s.connect(f);f.connect(g);g.connect(p);p.connect(this.master);this.own(s,[f,g,p]);s.start(at);s.stop(at+length+.01);}
 start(){
  this.stop();const c=this.context,e=this.epoch=c.currentTime;
  this.master.gain.cancelScheduledValues(e);this.master.gain.setValueAtTime(.68,e);this.master.gain.setValueAtTime(.68,e+STORY.dead-.025);this.master.gain.linearRampToValueAtTime(0,e+STORY.dead);this.master.gain.setValueAtTime(0,e+STORY.reveal);this.master.gain.linearRampToValueAtTime(.68,e+STORY.reveal+.02);
  this.pianoBus.gain.cancelScheduledValues(e);this.pianoBus.gain.setValueAtTime(.72,e);this.pianoBus.gain.setValueAtTime(.72,e+1.35);this.pianoBus.gain.exponentialRampToValueAtTime(.0001,e+3.7);
  const piano=c.createBufferSource(),env=c.createGain(),tone=c.createBiquadFilter();piano.buffer=this.piano;piano.playbackRate.value=Math.pow(2,4/12);const at=e+.11;env.gain.setValueAtTime(0,at);env.gain.linearRampToValueAtTime(.38,at+.009);env.gain.exponentialRampToValueAtTime(.10,at+2.5);env.gain.exponentialRampToValueAtTime(.0001,at+7.5);tone.type='lowpass';tone.frequency.value=5900;piano.connect(env);env.connect(tone);tone.connect(this.pianoBus);tone.connect(this.reverb);this.own(piano,[env,tone]);piano.start(at);
  // Environmental bass at 10% of the original level.
  for(const [hz,level] of [[55,.0045],[82.4069,.0016],[110.035,.0012]]){const o=c.createOscillator(),g=c.createGain();o.frequency.value=hz;g.gain.setValueAtTime(0,e);g.gain.linearRampToValueAtTime(level,e+1.5);g.gain.setValueAtTime(level,e+STORY.hit);g.gain.linearRampToValueAtTime(level*.2,e+STORY.dead);o.connect(g);g.connect(this.master);this.own(o,[g]);o.start(e);o.stop(e+STORY.dead);}
  const voice=c.createBufferSource(),hp=c.createBiquadFilter(),lp=c.createBiquadFilter(),clean=c.createGain(),dirty=c.createGain(),crusher=c.createWaveShaper(),pan=c.createStereoPanner();voice.buffer=this.radio;voice.loop=true;voice.loopStart=.12;voice.loopEnd=this.radio.duration-.18;
  voice.playbackRate.setValueAtTime(1,e+STORY.radio);voice.playbackRate.setValueAtTime(1,e+STORY.hit);voice.playbackRate.linearRampToValueAtTime(.81,e+STORY.hit+.4);voice.playbackRate.linearRampToValueAtTime(1.31,e+STORY.hit+1.3);voice.playbackRate.linearRampToValueAtTime(.74,e+STORY.dead);
  hp.type='highpass';hp.frequency.value=640;lp.type='lowpass';lp.frequency.setValueAtTime(1580,e);lp.frequency.setValueAtTime(1580,e+STORY.hit);lp.frequency.exponentialRampToValueAtTime(330,e+STORY.dead);
  clean.gain.setValueAtTime(0,e+STORY.radio);clean.gain.linearRampToValueAtTime(.14,e+3.0);clean.gain.setValueAtTime(.14,e+STORY.hit);clean.gain.linearRampToValueAtTime(.018,e+STORY.hit+.18);clean.gain.linearRampToValueAtTime(.0001,e+STORY.dead);
  const curve=new Float32Array(2048);for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=Math.round(Math.tanh(x*22)*7)/7;}crusher.curve=curve;
  dirty.gain.setValueAtTime(0,e);dirty.gain.linearRampToValueAtTime(.018,e+3.0);dirty.gain.setValueAtTime(.018,e+STORY.hit);dirty.gain.linearRampToValueAtTime(.065,e+STORY.hit+.08);
  for(let t=STORY.hit+.12;t<STORY.dead;t+=.075){dirty.gain.setValueAtTime(Math.random()>.50?.065:.0001,e+t);pan.pan.setValueAtTime(Math.sin((t-STORY.hit)*7)*.8,e+t);}dirty.gain.linearRampToValueAtTime(0,e+STORY.dead);
  voice.connect(hp);hp.connect(lp);lp.connect(clean);lp.connect(crusher);crusher.connect(dirty);clean.connect(pan);dirty.connect(pan);pan.connect(this.master);this.own(voice,[hp,lp,clean,dirty,crusher,pan]);voice.start(e+STORY.radio);voice.stop(e+STORY.dead);
  // Flybys and impacts are muted; only the original bed and radio remain.
  this.burst(e+STORY.radio,4.8,.023,1500,850);
  return e;
 }
 pause(){return this.context?.suspend();}resume(){return this.context?.resume();}time(){return Math.max(0,this.context.currentTime-this.epoch);}
}
