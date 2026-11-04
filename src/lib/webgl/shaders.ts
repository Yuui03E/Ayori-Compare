export const vertexShader = `#version 300 es
precision highp float;
const vec2 positions[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
void main() { gl_Position = vec4(positions[gl_VertexID],0.,1.); }
`;

export const fragmentShader = `#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
uniform sampler2D u_tex0, u_tex1, u_tex2, u_tex3, u_tex4, u_tex5, u_tex6, u_tex7;
uniform vec2 u_canvas, u_base, u_pan, u_mouse;
uniform float u_zoom, u_gain, u_bands;
uniform int u_mode, u_sub, u_a, u_b;
uniform bool u_loupe, u_grid;
uniform int u_present[8];
uniform vec2 u_size[8];

vec4 sampleSlot(int slot, vec2 uv, bool exact) {
  if (slot < 0 || slot > 7 || u_present[slot] == 0) {
    float v = mod(floor(gl_FragCoord.x / 12.) + floor(gl_FragCoord.y / 12.), 2.);
    return vec4(mix(vec3(.075,.08,.09),vec3(.115,.12,.13),v),1.);
  }
  ivec2 p = clamp(ivec2(floor(uv * u_size[slot])),ivec2(0),ivec2(u_size[slot])-1);
  switch(slot) {
    case 0: return exact ? texelFetch(u_tex0,p,0) : texture(u_tex0,uv);
    case 1: return exact ? texelFetch(u_tex1,p,0) : texture(u_tex1,uv);
    case 2: return exact ? texelFetch(u_tex2,p,0) : texture(u_tex2,uv);
    case 3: return exact ? texelFetch(u_tex3,p,0) : texture(u_tex3,uv);
    case 4: return exact ? texelFetch(u_tex4,p,0) : texture(u_tex4,uv);
    case 5: return exact ? texelFetch(u_tex5,p,0) : texture(u_tex5,uv);
    case 6: return exact ? texelFetch(u_tex6,p,0) : texture(u_tex6,uv);
    case 7: return exact ? texelFetch(u_tex7,p,0) : texture(u_tex7,uv);
  }
  return vec4(0.);
}
vec2 panel(vec2 p) { if (u_mode == 2 && p.x >= u_canvas.x*.5) p.x -= u_canvas.x*.5; return p; }
bool outside(vec2 uv) { return any(lessThan(uv,vec2(0.))) || any(greaterThanEqual(uv,vec2(1.))); }
vec3 background(vec2 p) { return vec3(mod(floor(p.x/16.)+floor(p.y/16.),2.) == 0. ? .045 : .058); }
vec3 overBackground(vec4 color, vec2 p) { return mix(background(p),color.rgb,color.a); }
vec3 ramp(float t) {
  t=clamp(t,0.,1.);
  if(t<.25) return mix(vec3(0.),vec3(.08,.14,.70),t*4.);
  if(t<.5) return mix(vec3(.08,.14,.70),vec3(.72,.08,.65),(t-.25)*4.);
  if(t<.75) return mix(vec3(.72,.08,.65),vec3(1.,.8,.12),(t-.5)*4.);
  return mix(vec3(1.,.8,.12),vec3(1.),(t-.75)*4.);
}
void main() {
  vec2 screen=vec2(gl_FragCoord.x,u_canvas.y-gl_FragCoord.y);
  vec2 uv=(panel(screen)-u_pan)/(u_zoom*u_base);
  if(u_loupe && distance(screen,u_mouse)<=140.) {
    if(distance(screen,u_mouse)>138.) { fragColor=vec4(.8,.9,.9,1.); return; }
    if(abs(screen.x-u_mouse.x)<.5) { fragColor=vec4(.5,.9,.85,1.); return; }
    vec2 center=(panel(u_mouse)-u_pan)/(u_zoom*u_base);
    vec2 lens=center+(screen-u_mouse)/(u_zoom*8.*u_base);
    int slot=screen.x<u_mouse.x?u_a:u_b;
    fragColor=vec4(outside(lens)?background(screen):overBackground(sampleSlot(slot,lens,true),screen),1.); return;
  }
  if(u_mode==2 && abs(screen.x-u_canvas.x*.5)<1.) { fragColor=vec4(.3,.32,.35,1.); return; }
  if(outside(uv)) { fragColor=vec4(0.,0.,0.,1.); return; }
  int slot=u_a;
  if(u_mode==1) {
    if(u_sub==0) { if(abs(screen.x-u_mouse.x)<.75) { fragColor=vec4(.8,.9,.9,1.);return; } slot=screen.x<u_mouse.x?u_a:u_b; }
    else if(u_sub==1) { if(abs(screen.y-u_mouse.y)<.75) { fragColor=vec4(.8,.9,.9,1.);return; } slot=screen.y<u_mouse.y?u_a:u_b; }
    else { if(abs(screen.x-u_mouse.x)<.75||abs(screen.y-u_mouse.y)<.75) { fragColor=vec4(.8,.9,.9,1.);return; } slot=(screen.y<u_mouse.y?0:2)+(screen.x<u_mouse.x?0:1); }
  }
  if(u_mode==2) slot=screen.x<u_canvas.x*.5?u_a:u_b;
  vec4 source=sampleSlot(slot,uv,false);
  vec3 color=overBackground(source,screen);
  if(u_mode==3) {
    if(u_present[u_a]==0||u_present[u_b]==0) { fragColor=vec4(background(screen),1.); return; }
    vec3 a=sampleSlot(u_a,uv,false).rgb, b=sampleSlot(u_b,uv,false).rgb;
    color=u_sub==0?clamp(abs(a-b)*u_gain,0.,1.):ramp(abs(dot(a-b,vec3(.2126,.7152,.0722)))*u_gain);
  } else if(u_mode==4 && u_present[u_a]!=0) {
    vec3 c=source.rgb;
    float y=dot(c,vec3(.2126,.7152,.0722));
    if(u_sub==0) color=vec3(fract(y*u_bands));
    else if(u_sub==1) color=clamp(pow(max(c,vec3(0.)),vec3(1./3.))*2.5,0.,1.);
    else if(u_sub==2) color=vec3(y);
    else color=clamp(vec3((c.r-y)/1.5748+.5,.5,(c.b-y)/1.8556+.5),0.,1.);
  }
  if(u_grid && u_zoom>=8. && u_present[slot]!=0) {
    vec2 p=uv*u_size[slot];
    vec2 edge=min(fract(p),1.-fract(p))/max(fwidth(p),vec2(.00001));
    float line=1.-smoothstep(.25,1.25,min(edge.x,edge.y));
    color=mix(color,vec3(.5,.6,.62),line*.5);
  }
  fragColor=vec4(color,1.);
}
`;
