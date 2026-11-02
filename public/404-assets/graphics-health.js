// Some mobile drivers accept a program but fail its first draw without throwing.
export function assertRenderedFrame(gl,width,height){
 if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR)throw Error('Camera draw failed');
 const pixels=new Uint8Array(width*height*4);
 gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 if(gl.getError()!==gl.NO_ERROR)throw Error('Camera readback failed');
 for(let i=0;i<pixels.length;i+=4){
  if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>8)return;
 }
 throw Error('Camera produced an empty picture');
}
