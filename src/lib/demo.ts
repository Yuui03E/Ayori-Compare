import type { ComparisonMatrix, Frame } from './types';

export const demoMatrix: ComparisonMatrix = {
  sources: [
    { label: 'Reference', origin: 'demo:0', kind: 'file' },
    { label: 'Fine grain', origin: 'demo:1', kind: 'file' },
    { label: 'Quantized', origin: 'demo:2', kind: 'file' },
    { label: '16-bit gradient', origin: 'demo:3', kind: 'file' },
  ],
  scenes: [0,1,2].map(i=>({id:`demo:${i}`,label:['Dusk / gradients','Edges / detail','Shadows / banding'][i],frames:[0,1,2,3].map(s=>`demo:${i}:${s}`)})),
  warnings: [],
};

export function demoFrame(scene: number, slot: number): Frame {
  const width=1280,height=720,depth=slot===3?16:8;
  const pixels=depth===16?new Uint16Array(width*height*4):new Uint8Array(width*height*4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const u=x/width,v=y/height;
    const mountain=.56+Math.sin(u*7)*.06+Math.sin(u*23)*.025;
    let r=.11+.48*v,g=.17+.27*v,b=.29+.16*v;
    const sun=Math.hypot((u-.72)*width,(v-.30)*height)<61;
    if(sun){r=.94;g=.80;b=.66;}
    if(v>mountain){r=.075;g=.115;b=.155;}
    if(v>.71+Math.sin(u*13)*.035){r=.043;g=.071;b=.09;}
    if(x>180&&x<480&&y>435&&y<595){r=.12;g=.16;b=.18;if((x-190)%53<22&&(y-442)%65<35){r=.73;g=.63;b=.40;}}
    if(scene===1){const line=(Math.abs(x-y*1.1)%48)<2;r=line?.85:.08;g=line?.85:.12;b=line?.82:.17;}
    if(scene===2){r=.004+.045*u;g=.006+.05*u;b=.013+.058*u;if(v>.64){r*=.35;g*=.35;b*=.35;}}
    const noise=((Math.sin(x*127.1+y*311.7)*43758.5453)%1)*.006;
    if(slot===1){r+=noise;g+=noise;b+=noise;}
    if(slot===2){r=Math.round(r*31)/31;g=Math.round(g*31)/31;b=Math.round(b*31)/31;}
    const m=depth===16?65535:255,i=(y*width+x)*4;
    pixels[i]=Math.max(0,Math.min(m,Math.round(r*m)));pixels[i+1]=Math.max(0,Math.min(m,Math.round(g*m)));pixels[i+2]=Math.max(0,Math.min(m,Math.round(b*m)));pixels[i+3]=m;
  }
  return {width,height,depth,originalDepth:depth,fileSize:0,pixels};
}
