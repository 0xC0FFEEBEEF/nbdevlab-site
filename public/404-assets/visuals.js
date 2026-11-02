import { STORY } from './score.js';
import { FLYBYS, GLINTS } from './debris.js';
const precision=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
export const vertex=`attribute vec2 a_position;varying mediump vec2 uv;void main(){uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;
export const world=`${precision}
varying mediump vec2 uv;uniform vec2 resolution;uniform float focal;uniform float time;uniform float motion;uniform float shutter;uniform mat3 attitude;uniform sampler2D surfaceMap;uniform sampler2D nightMap;uniform sampler2D rockMap;
const float PI=3.14159265359;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float stars(vec2 p,float scale,float threshold){p*=scale;vec2 cell=floor(p);vec2 f=fract(p)-.5;vec2 off=vec2(hash(cell),hash(cell+32.3))*.68-.34;return (1.-smoothstep(.0,.042,length(f-off)))*step(threshold,hash(cell+11.5));}
mat2 turn(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
vec3 sky(vec3 ray){
 // Fixed star directions cover all six sides of the camera's surroundings.
 vec3 a=abs(ray);vec2 tile;float face;
 if(a.z>=a.x&&a.z>=a.y){tile=ray.xy/a.z;face=ray.z>0.?0.:1.;}
 else if(a.y>=a.x){tile=ray.xz/a.y;face=ray.y>0.?2.:3.;}
 else{tile=ray.zy/a.x;face=ray.x>0.?4.:5.;}
 tile=tile*1.7+vec2(face*19.73,face*7.17);
 return vec3(.0005,.0012,.003)+vec3(.60,.72,.87)*(stars(tile,54.,.978)*.32+stars(tile+vec2(17.,4.),89.,.989)*.23);
}
float segmentDistance(vec2 p,vec2 a,vec2 b,out float along){vec2 v=b-a;along=clamp(dot(p-a,v)/max(dot(v,v),.000001),0.,1.);return length(p-a-v*along);}
void fragmentPass(vec2 p,float t,float at,float depth,float speed,float size,vec2 lane,float slope,float seed,inout vec3 color){
 // Exposure integrates a physical sideways path. No timed spawning or forward motion.
 vec2 velocity=vec2(-speed,-speed*slope);
 vec2 origin=lane*depth/1.7;
 vec2 a=(origin+velocity*(t-max(shutter,.009)-at))*1.7/depth;
 vec2 b=(origin+velocity*(t-at))*1.7/depth;
 float radius=max(clamp(size*1.7/depth,.0015,.027),2.*(1.7/focal)/resolution.y*.8);
 float along;float distance=segmentDistance(p,a,b,along);
 float silhouette=1.-smoothstep(radius*.12,radius,distance);
 float width=radius*.32;
 float glint=exp(-distance*distance/max(width*width,.0000001));
 float sampleTime=t-max(shutter,.009)*(1.-along);
 float reflectivity=.10+.82*pow(abs(cos(sampleTime*180.+seed)),14.);
 float exposureWeight=mix(.14,.70,along);
 // A dark sliver and a brief sun catch, not an emissive projectile trail.
 color=mix(color,vec3(.002,.003,.004),silhouette*.34*exposureWeight);
 color+=vec3(.65,.64,.58)*glint*reflectivity*exposureWeight;
 vec2 local=turn(t*39.+seed)*(p-b);
 float edge=length(local/vec2(radius*2.2,radius*.65));
 float sliver=1.-smoothstep(.70,1.,edge+sin(atan(local.y,local.x)*5.+seed)*.08);
 color=mix(color,vec3(.034,.036,.034),sliver*.72);
 color+=vec3(.11,.11,.10)*sliver*pow(abs(sin(t*87.+seed)),12.);
}
vec3 distantGlint(vec2 p,float t,vec2 sun,float at,vec2 offset,float brightness){
 float age=t-at;
 // pow with a negative base is undefined in GLSL, even for an even exponent.
 float pulse=age/.23;float glimpse=exp(-pulse*pulse);
 vec2 point=sun+offset+vec2(.30,.08)*age;
 float halfWidth=resolution.x/resolution.y*(1.7/focal);
 point.x=clamp(point.x,-halfWidth+.08,halfWidth-.08);
 float distance=length(p-point);
 float pixel=2.*(1.7/focal)/resolution.y;
 float core=max(sqrt(.000012),pixel*1.15),halo=max(.01,pixel*3.2);
 return vec3(.70,.74,.72)*brightness*glimpse*(exp(-distance*distance/(core*core))*1.2+exp(-distance*distance/(halo*halo))*.075);
}
vec3 rockTurn(vec3 p,float t){p.xz=turn(t*1.7)*p.xz;p.xy=turn(t*.9)*p.xy;return p;}
float rockShape(vec3 p){
 float coarse=sin(p.x*5.7+p.z*3.)*sin(p.y*6.3-p.z*4.1);
 float pits=sin(p.x*19.)*sin(p.y*21.)*sin(p.z*17.);
 return (length(p/vec3(.86,.72,.97))-1.+coarse*.06+pits*.018)*.72;
}
void incomingRock(vec3 ray,float t,inout vec3 color,out float rockMask){
 rockMask=0.;
 if(t<${(STORY.final-1.0).toFixed(2)})return;
 if(t>=${STORY.final.toFixed(2)}){color=vec3(0.);return;}
 // The same upper-right to lower-left stream reaches the camera obliquely.
 float remaining=${STORY.final.toFixed(2)}-t;
 vec3 center=vec3(remaining*26.,remaining*7.,remaining*30.+.06);
 vec3 ro=rockTurn(-center,t)/.75,rd=rockTurn(ray,t);
 float b=dot(ro,rd),disc=b*b-dot(ro,ro)+1.96;
 if(disc<0.)return;
 float distance=max(0.,-b-sqrt(disc)),far=-b+sqrt(disc);vec3 p;bool contact=false;
 for(int i=0;i<24;i++){p=ro+rd*distance;float stepSize=rockShape(p);if(stepSize<.003){contact=true;break;}distance+=stepSize;if(distance>far)break;}
 if(!contact)return;
 rockMask=1.;
 vec2 e=vec2(.004,0.);
 vec3 n=normalize(vec3(rockShape(p+e.xyy)-rockShape(p-e.xyy),rockShape(p+e.yxy)-rockShape(p-e.yxy),rockShape(p+e.yyx)-rockShape(p-e.yyx)));
 vec3 light=rockTurn(normalize(vec3(.55,.8,-.5)),t);
 float diffuse=max(dot(n,light),0.),rim=pow(clamp(1.-dot(n,-rd),0.,1.),4.);
 vec3 surface=normalize(p);vec2 map=vec2(atan(surface.x,surface.z)/(2.*PI)+.5,asin(clamp(surface.y,-1.,1.))/PI+.5);
 float detail=.35+texture2D(rockMap,map).r*.9;
 color=vec3(.11,.10,.085)*detail*(.14+diffuse*.86)+vec3(.009,.013,.018)+vec3(.28,.25,.19)*rim*.25;
}
vec3 cameraView(float sampleTime,out float rockMask){
 float t=min(sampleTime,${STORY.dead.toFixed(2)});
 float age=max(0.,t-${STORY.hit.toFixed(2)})*motion;
 // Three complete end-over-end turns about the camera's horizontal axis.
 // The camera position stays fixed; only its sightline changes after contact.
 vec2 screen=(uv*2.-1.)*vec2(resolution.x/resolution.y,1.);
 // A damped housing jolt settles quickly; the free tumble continues.
 screen+=vec2(.018*sin(age*63.)*exp(-age*13.),.012*sin(age*91.)*exp(-age*15.));
 float secondAge=max(0.,t-${STORY.second.toFixed(2)})*motion;
 screen+=vec2(-.026*sin(secondAge*71.),.018*sin(secondAge*89.))*exp(-secondAge*15.);
 screen.y+=(uv.y-.5)*min(shutter,.025)*.8*step(${STORY.hit.toFixed(2)},t)*(1.-smoothstep(${STORY.second.toFixed(2)},${STORY.steady.toFixed(2)},t))*motion;
 vec3 ray=attitude*normalize(vec3(screen,focal));
 vec3 col=sky(ray);
 // Reproject the approved Earth view from fixed world directions. Once the
 // camera faces away, Earth is behind it and only the surrounding sky is seen.
 if(ray.z>.005){
 vec2 p=ray.xy*(1.7/ray.z);
 vec2 center=vec2(-.65,-1.65);float radius=1.95;
 vec2 q=(p-center)/radius;float d=length(q);
 vec2 lightDir=normalize(vec2(.49,.88));float arc=pow(max(dot(normalize(q+vec2(.0001)),lightDir),0.),7.);
 float halo=exp(-max(d-1.,0.)*42.)*step(1.,d);col+=vec3(.018,.16,.35)*halo*(.07+arc*1.3);
 col.r+=exp(-abs(d-1.009)*320.)*arc*1.12;col.g+=exp(-abs(d-1.004)*340.)*arc*1.05;col.b+=exp(-abs(d-1.000)*370.)*arc*1.6;
 vec2 sun=center+lightDir*radius*1.01;float sd=length(p-sun);
 col+=vec3(.86,.70,.54)*exp(-sd*12.)*.65;
 col+=vec3(.17,.29,.38)*exp(-abs(p.y-sun.y)*210.)*exp(-abs(p.x-sun.x)*1.4)*.19;
 if(d<1.){
  vec3 n=vec3(q,sqrt(max(0.,1.-d*d)));float tilt=.21;vec3 wn=vec3(n.x,n.y*cos(tilt)+n.z*sin(tilt),-n.y*sin(tilt)+n.z*cos(tilt));
  vec2 map=vec2(fract(.5+atan(wn.x,wn.z)/(2.*PI)+.44+t*.0005),asin(clamp(wn.y,-1.,1.))/PI+.5);
  vec3 ground=texture2D(surfaceMap,map).rgb,night=texture2D(nightMap,map).rgb;
  float lights=pow(max(night.r-night.b*.72-.009,0.),.67);
  float limb=pow(1.-n.z,4.);
  vec3 earth=ground*vec3(.014,.034,.052)+vec3(.0008,.002,.005);
  earth+=vec3(.017,.13,.26)*limb*(.06+arc*.9);
  earth+=vec3(1.,.72,.35)*lights*.9*pow(n.z,.3);
  col=mix(col,earth,1.-smoothstep(.998,1.,d));
 }
 col+=vec3(1.,.88,.69)*exp(-sd*80.)*.7*step(.999,d);
 ${GLINTS.map(d=>`col+=distantGlint(p,t,sun,${d.at.toFixed(2)},vec2(${d.offset[0].toFixed(3)},${d.offset[1].toFixed(3)}),${d.brightness.toFixed(2)});`).join('\n')}
 ${FLYBYS.map(d=>`if(abs(t-${d.at.toFixed(3)})<.28)fragmentPass(p,t,${d.at.toFixed(3)},${d.depth.toFixed(2)},${d.speed.toFixed(1)},${d.size.toFixed(3)},vec2(${d.lane[0].toFixed(3)},${d.lane[1].toFixed(3)}),${d.slope.toFixed(3)},${d.seed.toFixed(2)},col);`).join('\n')}
 // The last sliver crosses immediately in front of the housing at the moment of the strike.
 if(t<${(STORY.hit+.12).toFixed(2)})fragmentPass(p,t,${STORY.hit.toFixed(2)},.12,120.,.045,vec2(.42,-.21),.18,8.3,col);
 }
 if(abs(t-${STORY.second.toFixed(2)})<.15)fragmentPass(screen,t,${STORY.second.toFixed(2)},.12,120.,.045,vec2(-.72,.30),-.2,14.1,col);
 incomingRock(ray,t,col,rockMask);
 // A completely unlit, very close body briefly eclipses about half the frame.
 if(abs(t-${STORY.occlusion.toFixed(2)})<.16){
  float age=t-${STORY.occlusion.toFixed(2)};
  vec2 center=vec2(-38.*age,.12-10.2*age)*(focal/1.7);
  float radius=sqrt(2.*resolution.x/resolution.y/PI);
  float cover=1.-smoothstep(radius-.004,radius+.004,length(screen-center));
  col=mix(col,vec3(0.),cover);
 }
 return col;
}
void main(){
 float rockMask;vec3 col=cameraView(time,rockMask);gl_FragColor=vec4(col,rockMask);
}`;
export const retention=`${precision}varying mediump vec2 uv;uniform sampler2D liveScene;uniform sampler2D previous;uniform vec2 resolution;uniform float time;uniform float delta;uniform float reset;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*73.651);}
void main(){
 vec4 current=texture2D(liveScene,uv);
 if(reset>.5||time<${STORY.hit.toFixed(2)}){gl_FragColor=current;return;}
 if(delta<=.000001){gl_FragColor=texture2D(previous,uv);return;}
 float afterSecond=smoothstep(${STORY.second.toFixed(2)},${(STORY.second+.18).toFixed(2)},time);
 float late=smoothstep(${(STORY.final-1.35).toFixed(2)},${STORY.final.toFixed(2)},time);
 float tick=floor(time*9.);
 float region=smoothstep(.55,.94,uv.x);
 vec2 cell=floor(uv*resolution/vec2(8.,14.));
 float patch=smoothstep(.65,.95,hash(floor(uv*resolution/vec2(48.,36.))+17.3));
 float refresh=step(.04+region*.25,hash(cell+vec2(tick*3.17,tick*.71)));
 float row=hash(vec2(floor(uv.y*resolution.y/22.),tick));
 vec2 heldUV=uv+vec2((row-.5)*1.3*afterSecond*(.25+.75*region),0.)/resolution;
 vec4 held=texture2D(previous,heldUV);
 // A little retained charge bleeds into neighbouring rows of the old image.
 vec4 bleed=(texture2D(previous,heldUV+vec2(0.,1.5)/resolution)+texture2D(previous,heldUV-vec2(0.,1.5)/resolution))*.5;
 held=mix(held,bleed,(.08+.06*region)*afterSecond);
 float persistence=.018+.012*afterSecond+.010*late+region*(.035+.070*afterSecond+.035*late)+patch*.025*afterSecond;
 float update=(1.-exp(-max(delta,0.)/persistence))*refresh;
 gl_FragColor=mix(held,current,update);
}`;
export const post=`${precision}varying mediump vec2 uv;uniform sampler2D scene;uniform sampler2D memory;uniform vec2 resolution;uniform float focal;uniform float time;uniform float motion;uniform float shutter;uniform mat3 attitude;uniform mat3 previousAttitude;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
// A smaller multiplier preserves fractional precision for sparse photosite faults.
float pixelHash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*73.651);}
float softSensorNoise(vec2 p){
 vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(pixelHash(cell),pixelHash(cell+vec2(1.,0.)),f.x),mix(pixelHash(cell+vec2(0.,1.)),pixelHash(cell+vec2(1.)),f.x),f.y);
}
vec3 colorSample(vec2 p,vec2 separation){
 vec2 edge=.5/resolution;
 return vec3(texture2D(scene,clamp(p+separation,edge,1.-edge)).r,texture2D(scene,clamp(p,edge,1.-edge)).g,texture2D(scene,clamp(p-separation,edge,1.-edge)).b);
}
void main(){
 float age=max(0.,time-${STORY.hit.toFixed(2)})*motion;
 float damaged=smoothstep(0.,.16,age);
 float failure=smoothstep(${(STORY.hit+.7).toFixed(2)},${STORY.dead.toFixed(2)},time)*damaged;
 float secondAge=max(0.,time-${STORY.second.toFixed(2)})*motion;
 float contact=exp(-age*18.)*smoothstep(0.,.008,age)+.7*exp(-secondAge*18.)*smoothstep(0.,.008,secondAge);
 float sensorFailure=smoothstep(${(STORY.final-1.35).toFixed(2)},${(STORY.final-.08).toFixed(2)},time)*damaged;
 // Sparse damage starts at the first hit, accumulates through the tumble,
 // then steps up after the second contact before the last sensor failure.
 float pixelFailure=clamp(damaged*(.16+.20*smoothstep(${STORY.hit.toFixed(2)},${STORY.second.toFixed(2)},time))+.24*smoothstep(${STORY.second.toFixed(2)},${(STORY.second+.12).toFixed(2)},time)*damaged+.40*sensorFailure,0.,1.);
 // The displaced sensor produces two brief whole-image registration slips.
 float slipA=(time-${(STORY.final-.83).toFixed(2)})/.085,slipB=(time-${(STORY.final-.34).toFixed(2)})/.055;
 float slip=exp(-slipA*slipA)-.65*exp(-slipB*slipB);
 vec2 imageUV=uv+vec2(6.,-3.)*sensorFailure*slip/resolution;
 // A small, drifting RGB registration error is most visible on bright edges.
 float drift=.5+.5*sin(age*5.3+sin(age*2.));
 float pixels=damaged*(.6+1.1*drift+failure*.8)+contact*1.5+sensorFailure*1.4;
 vec2 separation=((uv-.5)*pixels+damaged*vec2(.22*sin(age*7.),.15*sin(age*4.)))/resolution;
 vec3 col=colorSample(imageUV,separation);
 if(damaged>.001&&time<${STORY.final.toFixed(2)}){
  // Derive the blur direction from the actual camera rotation, then use a
  // closely spaced exposure kernel so the limb smears rather than duplicating.
  vec2 aspect=vec2(resolution.x/resolution.y,1.);
  vec3 ray=attitude*vec3((uv*2.-1.)*aspect,focal);
  vec3 before=vec3(dot(previousAttitude[0],ray),dot(previousAttitude[1],ray),dot(previousAttitude[2],ray));
  vec2 beforeUV=(before.xy*(focal/max(before.z,.2))/aspect)*.5+.5;
  vec2 displacement=(beforeUV-uv)*resolution;
  displacement*=min(1.,12./max(length(displacement),.001));
  vec2 smear=displacement/resolution;
  if(length(displacement)>.35){col=vec3(0.);for(int i=0;i<9;i++)col+=colorSample(imageUV-smear*(float(i)/8.),separation)/9.;}
 }
 // Focus hunts briefly as the damaged optics drift, without obscuring the hit.
 if(sensorFailure>.001){
  float hunt=.5+.5*sin((time-${(STORY.final-1.35).toFixed(2)})*9.);
  vec2 radius=vec2(sensorFailure*(.45+1.7*hunt*hunt))/resolution;
  col=col*.5+(colorSample(imageUV+radius,separation)+colorSample(imageUV-radius,separation)+colorSample(imageUV+vec2(radius.x,-radius.y),separation)+colorSample(imageUV+vec2(-radius.x,radius.y),separation))*.125;
 }
 // Most of the picture stays fresh. Small regions retain a faint old exposure,
 // with longer-lived ghosts toward the damaged right-hand readout bank.
 float lagRegion=smoothstep(.55,.94,uv.x);
 float afterSecond=smoothstep(${STORY.second.toFixed(2)},${(STORY.second+.18).toFixed(2)},time);
 if(damaged>.001&&time<${STORY.final.toFixed(2)}){
  vec4 held=texture2D(memory,imageUV);
  float stubborn=smoothstep(.65,.95,pixelHash(floor(gl_FragCoord.xy/vec2(48.,36.))+17.3));
  float ghost=damaged*(.08+.30*lagRegion+.08*stubborn+.04*afterSecond);
  col=mix(col,held.rgb,ghost);
  float oldEdge=max(held.a-texture2D(scene,imageUV).a,0.);
  col+=vec3(.012,.017,.019)*oldEdge*(.2+.8*lagRegion)*damaged;
 }
 // Exposure and white balance struggle to settle after the contact.
 float balance=sin(age*4.2)*damaged;
 col*=vec3(1.+balance*.08,1.-balance*.045,1.-balance*.07);
 col*=1.-contact*.38+damaged*(.045*sin(age*3.9)+.02*sin(age*10.1));
 float luminance=dot(col,vec3(.2126,.7152,.0722));
 col=mix(col,vec3(luminance),failure*.16);
 float grainTick=floor(time*24.);
 float noise=(pixelHash(gl_FragCoord.xy+vec2(grainTick*13.1,grainTick*7.7))-.5)*damaged*(.0025+failure*.006+sensorFailure*.004);
 col+=noise;
 // Small black-level and colour errors blend through the same readout region.
 // The scene keeps its natural palette instead of becoming a separate panel.
 if(damaged>.001&&time<${STORY.final.toFixed(2)}){
  float veil=softSensorNoise(gl_FragCoord.xy/8.+vec2(time*.19,-time*.13))-.5;
  float wash=lagRegion*damaged*(.055+.070*afterSecond);
  float monochrome=dot(col,vec3(.2126,.7152,.0722));
  col=mix(col,vec3(monochrome),wash);
  col+=(vec3(.003,.0038,.0044)*( .3+.7*afterSecond)+vec3(veil*.002))*lagRegion*damaged;
 }
 // Fixed photosites fail progressively, in scattered pixels and small clusters.
 // These defects stay attached to the sensor while Earth moves behind them.
 vec2 cell=floor(gl_FragCoord.xy/2.);
 float cluster=step(.988,pixelHash(floor(gl_FragCoord.xy/vec2(44.,36.))+23.1));
 float death=pixelFailure*pixelFailure*(.002+cluster*.24);
 float deadPixel=step(1.-death,pixelHash(cell+vec2(61.7,18.2)))*step(.001,pixelFailure);
 float hotPixel=step(.9988,pixelHash(cell+vec2(9.7,44.1)))*pixelFailure*(1.-deadPixel);
 float warm=step(.5,pixelHash(cell+13.));
 col+=mix(vec3(.015,.10,.13),vec3(.18,.035,.008),warm)*hotPixel;
 col=mix(col,vec3(0.),deadPixel);
 col*=1.-step(${STORY.final.toFixed(2)},time);
 col=pow(max(col,0.),vec3(.90));gl_FragColor=vec4(col,1.);
}`;
