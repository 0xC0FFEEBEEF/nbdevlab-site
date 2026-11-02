import { STORY } from './score.js';
export function cameraAnglesAt(time){
 if(time<=STORY.hit)return [0,0,0];
 const age=time-STORY.hit,brake=STORY.second-STORY.hit;
 const drift=Math.min(age,brake);
 let pitch=.12+drift*6,roll=.08+drift*1.7,yaw=.27*Math.sin(drift*3)+.08*Math.sin(drift*11);
 if(age>=brake){
  // Counter-torque changes the angular velocity at the second contact.
  // The camera then coasts at that velocity; it is never eased into a target.
  const coast=age-brake;
  pitch+=coast*1.02;roll+=coast*.67;yaw-=coast*.087;
 }
 return [pitch,roll,yaw];
}
function multiply(a,b){const result=new Float32Array(9);for(let c=0;c<3;c++)for(let r=0;r<3;r++)for(let k=0;k<3;k++)result[c*3+r]+=a[k*3+r]*b[c*3+k];return result;}
export function cameraBasisAt(time,motion=1){
 const [pitch,roll,yaw]=motion?cameraAnglesAt(time):[0,0,0];
 const cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll),cy=Math.cos(yaw),sy=Math.sin(yaw);
 return multiply([cy,0,-sy,0,1,0,sy,0,cy],multiply([1,0,0,0,cp,sp,0,-sp,cp],[cr,-sr,0,sr,cr,0,0,0,1]));
}
