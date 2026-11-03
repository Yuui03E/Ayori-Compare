import { invoke, isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeImage } from '@tauri-apps/plugin-clipboard-manager';
import { Image } from '@tauri-apps/api/image';
import type { ComparisonMatrix, Frame, Metric, Mode, Pixel, Point } from '../types';
import { Renderer } from '../webgl/renderer';
import { parseFrame, readPixel } from '../webgl/packet';
import { demoFrame, demoMatrix } from '../demo';

export class AyoriWorkspace {
  matrix = $state.raw<ComparisonMatrix | null>(null);
  sceneIndex = $state(0);
  frames = $state.raw<(Frame | null)[]>(Array(8).fill(null));
  errors = $state.raw<Record<number,string>>({});
  scores = $state.raw<Record<number,Metric>>({});
  loading = $state(false);
  importing = $state(false);
  mode = $state<Mode>(0);
  subMode = $state(0);
  slotA = $state(0);
  slotB = $state(1);
  previousSlot = 1;
  zoom = $state(1);
  filter = $state<'auto'|'nearest'|'linear'>('auto');
  gain = $state(8);
  bands = $state(32);
  grid = $state(false);
  pixels = $state.raw<(Pixel | null)[]>([null,null]);
  pointer = $state.raw<Point>({x:0,y:0});
  hudHidden = $state(false);
  hudLocked = $state(false);
  drawer = $state(false);
  help = $state(false);
  draggingFiles = $state(false);
  message = $state('');
  warnings = $state.raw<string[]>([]);
  fallback = $state(false);
  loadMs = $state(0);
  demo = $state(false);
  metricStatus = $state('');
  renderer: Renderer | null = null;
  epoch = 0;
  private generation = 0;
  private revisions = Array(8).fill(0);
  private metricRevision = 0;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshTimers = new Map<number,ReturnType<typeof setTimeout>>();
  private scoreTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  attach(canvas: HTMLCanvasElement) {
    this.disposed=false;this.renderer=new Renderer(canvas);
    this.renderer.onChange=()=>{this.zoom=this.renderer!.view.zoom;};
    this.renderer.onError=message=>this.notify(message);
  }
  notify(message: string) {this.message=message;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>{this.message='';},9000);}
  async choose(folders=false,append=false) {
    if(!isTauri()){this.notify('Open the desktop app to load files. You can explore the sample here.');return;}
    try {const paths=await open({multiple:true,directory:folders,title:append?'Add comparison sources':'Choose comparison sources',filters:folders?undefined:[{name:'Images',extensions:['png','webp','avif','jpg','jpeg']}]});if(paths)await this.importPaths(Array.isArray(paths)?paths:[paths],append);}catch(error){this.notify(String(error));}
  }
  async importPaths(paths: string[],append=false) {
    if(this.importing)return;
    if(append&&this.demo){this.notify('Start a new comparison to load your own files.');return;}
    this.importing=true;
    try{const matrix=await invoke<ComparisonMatrix>('import_sources',{paths,append});this.demo=false;this.matrix=matrix;this.warnings=matrix.warnings;this.slotA=0;this.slotB=1;this.previousSlot=1;await this.loadScene(0,true);if(matrix.warnings.length)this.notify(matrix.warnings.join(' '));}
    catch(error){this.notify(String(error));}finally{this.importing=false;}
  }
  async showDemo(){this.demo=true;this.matrix=demoMatrix;this.warnings=[];this.slotA=0;this.slotB=1;await this.loadScene(0,true);}
  async loadScene(index: number,fit=false){
    if(!this.matrix||!this.renderer||index<0||index>=this.matrix.scenes.length)return;
    const token=++this.generation;const start=performance.now();this.sceneIndex=index;this.loading=true;this.errors={};this.scores={};this.frames=Array(8).fill(null);this.fallback=false;this.pixels=[null,null];this.metricStatus='';this.metricRevision++;
    this.refreshTimers.forEach(clearTimeout);this.refreshTimers.clear();clearTimeout(this.scoreTimer);
    this.renderer.clear();this.renderer.view.slotA=this.slotA;this.renderer.view.slotB=this.slotB;
    const scene=this.matrix.scenes[index];
    try{
      if(this.demo){for(let slot=0;slot<4;slot++){const frame=demoFrame(index,slot);this.renderer.upload(slot,frame);}this.updateFrames();}
      else {
        const active=await invoke<{epoch:number;warning:string|null}>('activate_scene',{index});if(token!==this.generation)return;this.epoch=active.epoch;if(active.warning)this.notify(`Live reload unavailable: ${active.warning}`);
        await Promise.all(scene.frames.map(async(path,slot)=>{if(path)await this.loadSlot(slot,path,token,active.epoch);}));
      }
      if(token!==this.generation)return;
      const valid=this.frames.map((f,i)=>f?i:-1).filter(i=>i>=0);
      if(!this.frames[this.slotA]&&valid.length)this.select(valid[0]);
      if(!this.frames[this.slotB]&&valid.length)this.select(valid.find(i=>i!==this.slotA)??valid[0],true);
      if(fit)this.renderer.fit();
      this.renderer.invalidate();this.loadMs=performance.now()-start;this.queueMetrics();
    }catch(error){if(token===this.generation)this.notify(String(error));}finally{if(token===this.generation)this.loading=false;}
  }
  private async loadSlot(slot: number,path: string,token: number,epoch: number,retry=0){
    const revision=++this.revisions[slot];
    try{const bytes=await invoke<ArrayBuffer>('load_frame_binary',{path,epoch});if(token!==this.generation||revision!==this.revisions[slot]||this.disposed)return;
      this.renderer!.upload(slot,parseFrame(bytes));const next={...this.errors};delete next[slot];this.errors=next;this.updateFrames();
    }catch(error){if(token!==this.generation||revision!==this.revisions[slot]||this.disposed)return;
      if(retry<3){await new Promise(resolve=>setTimeout(resolve,150*(retry+1)));if(token===this.generation&&revision===this.revisions[slot])await this.loadSlot(slot,path,token,epoch,retry+1);return;}
      this.renderer!.remove(slot);this.errors={...this.errors,[slot]:String(error)};this.updateFrames();this.notify(`Source ${slot+1}: ${error}`);
    }
  }
  private updateFrames(){this.frames=[...this.renderer!.frames];this.fallback=this.renderer!.fallback.some(Boolean);}
  onFileChanged(event:{epoch:number;path:string}) {
    if(this.demo||event.epoch!==this.epoch||!this.matrix)return;
    const slot=this.matrix.scenes[this.sceneIndex].frames.indexOf(event.path);if(slot<0)return;
    this.metricRevision++;this.scores={};clearTimeout(this.refreshTimers.get(slot));
    const token=this.generation;
    this.refreshTimers.set(slot,setTimeout(async()=>{this.refreshTimers.delete(slot);await this.loadSlot(slot,event.path,token,event.epoch);if(token===this.generation)this.queueMetrics();},150));
  }
  private queueMetrics(){
    if(this.demo||!this.frames[0])return;clearTimeout(this.scoreTimer);
    const epoch=this.epoch,revision=++this.metricRevision;this.metricStatus='Measuring…';
    this.scoreTimer=setTimeout(()=>{void invoke('compute_metrics',{epoch,revision}).then(()=>{if(revision===this.metricRevision)this.metricStatus='';}).catch(error=>{if(revision===this.metricRevision)this.metricStatus=`Scores unavailable: ${error}`;});},350);
  }
  onMetric(metric:Metric&{epoch:number;revision:number}){if(metric.epoch===this.epoch&&metric.revision===this.metricRevision)this.scores={...this.scores,[metric.slot]:metric};}
  select(slot: number,secondary=false){if(!this.matrix||slot<0||slot>=this.matrix.sources.length)return;if(secondary){this.slotB=slot;if(this.renderer)this.renderer.view.slotB=slot;}else{if(slot!==this.slotA)this.previousSlot=this.slotA;this.slotA=slot;if(this.renderer)this.renderer.view.slotA=slot;}this.renderer?.invalidate();this.updatePixel();}
  swap(){const previous=this.previousSlot;this.select(previous);}
  cycleSource(step:number){if(this.matrix)this.select((this.slotA+step+this.matrix.sources.length)%this.matrix.sources.length);}
  scene(step:number){if(this.matrix)void this.loadScene((this.sceneIndex+step+this.matrix.scenes.length)%this.matrix.scenes.length);}
  setMode(mode:Mode){this.subMode=this.mode===mode?(this.subMode+1)%([1,3,1,2,4][mode]):0;this.mode=mode;this.renderer?.setMode(mode,this.subMode);}
  setGain(value:number){this.gain=value;if(this.renderer){this.renderer.view.gain=value;this.renderer.invalidate();}}
  setBands(value:number){this.bands=value;if(this.renderer){this.renderer.view.bandFrequency=value;this.renderer.invalidate();}}
  setFilter(){this.filter=this.filter==='auto'?'nearest':this.filter==='nearest'?'linear':'auto';if(this.renderer){this.renderer.view.filter=this.filter;this.renderer.invalidate();}}
  toggleGrid(){this.grid=!this.grid;if(this.renderer){this.renderer.view.grid=this.grid;this.renderer.invalidate();}this.updatePixel();}
  fit(){this.renderer?.fit();}
  setZoom(value:number){this.renderer?.zoomTo(value);}
  toggleZoom(){if(Math.abs(this.zoom-1)<.001)this.fit();else this.setZoom(1);}
  toggleHud(){this.hudLocked=!this.hudLocked;this.hudHidden=this.hudLocked;}
  move(event:PointerEvent){if(!this.renderer)return;this.renderer.view.mouse=this.renderer.point(event);this.pointer={x:event.clientX,y:event.clientY};if(this.renderer.view.loupe||this.mode===1)this.renderer.invalidate();this.updatePixel();}
  updatePixel(){if(!this.grid||!this.renderer){this.pixels=[null,null];return;}const uv=this.renderer.uv();this.pixels=[this.frames[this.slotA]?readPixel(this.frames[this.slotA]!,uv):null,this.frames[this.slotB]?readPixel(this.frames[this.slotB]!,uv):null];}
  loupe(active:boolean){if(this.renderer){this.renderer.view.loupe=active;this.renderer.invalidate();}}
  async copy(){if(!this.renderer||!this.matrix)return;try{const blob=await this.renderer.capture();if(isTauri()){const bitmap=await Image.fromBytes(await blob.arrayBuffer());try{await writeImage(bitmap);}finally{await bitmap.close();}}else await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);this.notify('Comparison image copied.');}catch(error){this.notify(`Could not copy the image: ${error}`);}}
  async exportHtml(){if(!this.matrix)return;if(this.demo){this.notify('Load your own images to export a comparison.');return;}try{const path=await save({defaultPath:'ayori-comparison.html',filters:[{name:'Offline comparison',extensions:['html']}]});if(!path)return;this.notify('Preparing offline comparison…');await invoke('export_html',{path});this.notify('Offline comparison saved.');}catch(error){this.notify(`Export failed: ${error}`);}}
  dispose(){this.disposed=true;this.generation++;this.refreshTimers.forEach(clearTimeout);clearTimeout(this.scoreTimer);clearTimeout(this.toastTimer);this.renderer?.dispose();this.renderer=null;this.frames=Array(8).fill(null);}
}
export const workspace = new AyoriWorkspace();
if (import.meta.env.DEV) Reflect.set(window, '__AYORI_WORKSPACE__', workspace);
