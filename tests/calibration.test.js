import { assert, assertClose, bbox, isClosed, buildTopology, analyze, fins, rotX } from './_util.js';
import { calibrationPart, CALIBRATIONS } from '../web/calibration.js';
import { DOWELL } from '../web/print-profile.js';
for(const {id} of CALIBRATIONS)Deno.test(`calibration ${id}: closed part, correct scale, useful printable supports`,()=>{
  const c=calibrationPart(id),b=bbox(c.vertices);
  assert(isClosed(c.vertices),'test model must be watertight');
  let volume=0;
  for(let i=0;i<c.vertices.length;i+=3){const [a,b,c0]=c.vertices.slice(i,i+3);volume+=a[0]*(b[1]*c0[2]-b[2]*c0[1])+a[1]*(b[2]*c0[0]-b[0]*c0[2])+a[2]*(b[0]*c0[1]-b[1]*c0[0]);}
  assert(volume>0,'outward winding required');
  const dims=id==='grip45'?[60,40,6.4]:id==='overhang'?[60,32,40.1]:[24,24,100.1];
  dims.forEach((v,i)=>assertClose(b.hi[i]-b.lo[i],v,1e-6));
  const pos=new Float32Array(c.vertices.flat()), topo=buildTopology({getAttribute:()=>({array:pos})});
  const rot=rotX(c.rotationX*180/Math.PI),res=analyze(topo,45,rot);
  const built=fins.buildFins(topo,res,rot,{printerProfile:DOWELL.id,mode:'auto',tines:true,bedPad:true,
    layerHeight:.6,firstLayerHeight:.5,tineDensity:0,coverage:.5,
    tunables:{propGap:.6,finGap:.6,tineBite:1.2,propBite:1.2,padH:.5,padGrab:.05,padStyle:'auto'},
    sway:c.sway?{on:true,gap:.6,bite:1.2}:undefined});
  assert(built.triangles.length>0,'test must generate supports');
  assert(isClosed(built.triangles),'support solids must be closed');
  for(const v of built.triangles)assert(v.every(Number.isFinite),'nonfinite support vertex');
});
