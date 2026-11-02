// Keep the same horizontal action in portrait without changing the camera pose.
export function viewportProfile(width,height,dpr=1,coarse=false){
 const w=Math.max(1,width),h=Math.max(1,height),aspect=w/h;
 const compact=w<=700||(coarse&&Math.min(w,h)<=1024);
 const focal=1.7*(compact?Math.min(1,aspect/1.6):1);
 const budget=compact?(w>=600&&h>=600?650000:400000):Infinity;
 const scale=Math.min(Math.max(1,dpr),compact?1:1.25,(compact?1200:1500)/Math.max(w,h),Math.sqrt(budget/(w*h)));
 return {width:Math.max(1,Math.floor(w*scale)),height:Math.max(1,Math.floor(h*scale)),focal,compact};
}
