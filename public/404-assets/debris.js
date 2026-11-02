import { STORY } from './score.js';
// A lone fragment, a pair, then five increasingly close groups. Distances are metres.
export const WAVES=Object.freeze([
 {at:STORY.pass1,count:1,depth:60.96,speed:1450,size:.30,lane:[.20,.20]},
 {at:STORY.pass2,count:2,depth:45.72,speed:1800,size:.36,lane:[-.16,-.05]},
 {at:STORY.pass3,count:4,depth:39.0,speed:1900,size:.31,lane:[.12,.16]},
 {at:6.84,count:5,depth:35.0,speed:2050,size:.32,lane:[-.22,-.15]},
 {at:7.23,count:6,depth:31.0,speed:2200,size:.34,lane:[.21,.10]},
 {at:7.58,count:7,depth:27.0,speed:2350,size:.35,lane:[-.15,-.19]},
 {at:7.89,count:5,depth:23.0,speed:2500,size:.36,lane:[.10,.09]}
]);
export const FLYBYS=Object.freeze(WAVES.flatMap((wave,group)=>Array.from({length:wave.count},(_,i)=>({
 at:wave.at+(i-(wave.count-1)/2)*(group===1?.018:.006),
 depth:wave.depth+(i%3-1)*2.1,
 speed:wave.speed*(1+(i%3-1)*.045),size:wave.size*(.76+(i%4)*.15),
 lane:[wave.lane[0]+(i-(wave.count-1)/2)*.16,wave.lane[1]+Math.sin(i*2.17+group)*.25],
 slope:.22+(i%3)*.035,seed:group*7.13+i*2.81+.7
}))));
export const GLINTS=Object.freeze([
 {at:2.65,offset:[-.18,.18],brightness:.85},
 {at:3.16,offset:[-.04,.32],brightness:.75},
 {at:3.67,offset:[.08,.20],brightness:.90},
 {at:4.18,offset:[-.27,.40],brightness:.80}
]);
