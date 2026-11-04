import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const concepts = [
  { letter: 'A', name: 'Facet', file: 'a-facet.svg', direction: 'Sculpted monogram', color: '#afe6d3',
    description: 'An asymmetric A, built from three precise facets. A crisp, distinctive signature for Ayori.',
    rationale: 'Brand first · Sharp · Architectural', recommendation: 'RECOMMENDED' },
  { letter: 'B', name: 'Twinlight', file: 'b-twinlight.svg', direction: 'Split optical lens', color: '#c2b7f5',
    description: 'Two lens halves around one point of focus. A softer identity for looking closer, side by side.',
    rationale: 'Optical · Calm · Expressive', recommendation: '' },
  { letter: 'C', name: 'Parallax', file: 'c-parallax.svg', direction: 'Interlocking frames', color: '#e9d5ac',
    description: 'Two offset frames surround a shared pixel. A direct connection to comparison and exact detail.',
    rationale: 'Precise · Modular · Technical', recommendation: '' },
];
for (const c of concepts) c.svg = (await readFile(new URL(c.file, import.meta.url), 'utf8')).replace(/<title>.*?<\/title>/, '');
const card = (c) => `<article style="--accent:${c.color}">
  <div class="card-top"><span class="letter">${c.letter}</span><span>${c.direction}</span><i>${c.recommendation}</i></div>
  <div class="hero"><div class="axis h"></div><div class="axis v"></div>${c.svg}</div>
  <div class="identity"><div class="wordmark">${c.svg}<span>Ayori</span></div><span class="concept-name">${c.name}</span></div>
  <p>${c.description}</p><div class="rationale">${c.rationale}</div>
  <div class="divider"></div>
  <div class="usage-label">IN THE APP</div>
  <div class="appbar">${c.svg}<b>Ayori</b><span class="sep"></span><span class="source"><em>A</em> WEB-DL</span><span class="swap">⇄</span><span class="source"><em>B</em> Encode</span><span class="window">− &nbsp; □ &nbsp; ×</span></div>
  <div class="sizes"><div class="size"><div class="sample s16">${c.svg}</div><span>16 px</span></div><div class="size"><div class="sample s24">${c.svg}</div><span>24 px</span></div><div class="size"><div class="sample s32">${c.svg}</div><span>32 px</span></div><div class="size desktop"><div class="sample s48">${c.svg}</div><span>App icon</span></div><div class="size mono"><div class="sample s32">${c.svg}</div><span>One color</span></div></div>
</article>`;
const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ayori — Logo directions</title><style>
*{box-sizing:border-box}body{margin:0;background:#000;color:#eaf2ee;font-family:'Segoe UI',system-ui,sans-serif;-webkit-font-smoothing:antialiased}.sheet{max-width:1640px;margin:auto;padding:56px 52px 35px}.topline{display:flex;justify-content:space-between;align-items:center;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#83958c}.topline strong{color:#b9d7c9;letter-spacing:.3px;font-size:18px;text-transform:none}.intro{display:flex;align-items:flex-end;justify-content:space-between;margin:34px 0 30px}.intro h1{font-size:42px;line-height:1.1;font-weight:520;letter-spacing:-1.5px;margin:0}.intro p{font-size:13px;line-height:1.65;color:#8e9d95;margin:0;max-width:360px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}article{border:1px solid #202825;border-radius:18px;padding:24px;background:#050807;overflow:hidden}.card-top{display:flex;align-items:center;gap:10px;font-size:11px;color:#8da397}.letter{width:25px;height:25px;border:1px solid #35463d;border-radius:7px;display:grid;place-items:center;color:var(--accent);font-size:13px}.card-top i{font-style:normal;font-size:8px;letter-spacing:.8px;margin-left:auto;color:var(--accent)}.hero{height:255px;display:grid;place-items:center;position:relative;background:radial-gradient(ellipse at center,#17211c55,transparent 68%)}.hero svg{width:175px;height:175px;position:relative}.axis{position:absolute;background:#ffffff04}.axis.h{height:1px;left:35px;right:35px;top:50%}.axis.v{width:1px;top:30px;bottom:30px;left:50%}.identity{display:flex;align-items:center;justify-content:space-between;gap:12px}.wordmark{display:flex;gap:12px;align-items:center}.wordmark svg{width:32px;height:32px}.wordmark span{font-size:34px;font-weight:550;letter-spacing:-1.1px}.concept-name{font-size:12px;letter-spacing:.7px;color:var(--accent)}article p{color:#a0afa6;font-size:13px;line-height:1.7;margin:18px 0 16px;min-height:67px;max-width:365px}.rationale{font-size:10px;color:#72877b;letter-spacing:.4px}.divider{height:1px;background:#202824;margin:23px 0 20px}.usage-label{font-size:9px;letter-spacing:1.6px;color:#80968a;margin-bottom:12px}.appbar{height:32px;padding:0 8px;background:#000;border:1px solid #29332d;border-radius:6px;display:flex;align-items:center;gap:7px;white-space:nowrap;font-size:8px}.appbar>svg{height:15px;width:15px}.appbar b{font-size:9px;font-weight:600;color:#c8dad1}.sep{height:13px;width:1px;background:#28332c;margin:0 1px}.source{color:#8da296;display:flex;gap:4px;align-items:center}.source em{font-size:7px;font-style:normal;background:#16221b;color:#c0d9cc;padding:1px 3px;border-radius:2px}.swap{color:#546b5d}.window{margin-left:auto;color:#6b8074;font-size:10px}.sizes{display:flex;align-items:flex-end;justify-content:space-between;margin-top:20px;padding:0 5px}.size{display:flex;flex-direction:column;align-items:center;gap:10px;min-width:43px}.sample{height:62px;display:flex;align-items:center;justify-content:center}.size span{font-size:9px;color:#6f8678}.s16 svg{width:16px;height:16px}.s24 svg{width:24px;height:24px}.s32 svg{width:32px;height:32px}.s48{width:62px;background:#070d09;border:1px solid #334138;border-radius:15px}.s48 svg{width:48px;height:48px}.mono path{fill:#eaf2ee}.foot{display:flex;align-items:center;justify-content:space-between;margin-top:27px;color:#6d8175;font-size:10px;letter-spacing:.2px}.foot b{font-weight:500;color:#a3bcae}@media(max-width:1000px){.sheet{padding:30px}main{grid-template-columns:1fr}.intro{display:block}.intro p{margin-top:20px}.hero{height:230px}article p{min-height:0}.appbar{max-width:400px}.sizes{max-width:400px}}
</style></head><body><div class="sheet"><div class="topline"><strong>Ayori</strong><span>Logo studies / 01</span></div><div class="intro"><h1>A mark for a closer look.</h1><p>Three original vector directions for Ayori.<br>Designed for a pure-black interface, from a tiny title-bar mark to a full app identity.</p></div><main>${concepts.map(card).join('')}</main><div class="foot"><span><b>Choose the silhouette first.</b> Colors and details can be refined with your selection.</span><span>Concept previews · Not applied to the app</span></div></div></body></html>`;
await writeFile(new URL('index.html', import.meta.url), html);
const browser = await chromium.launch({ channel:'msedge', headless:true });
try {
  const page = await browser.newPage({ viewport:{ width:1600, height:1040 }, deviceScaleFactor:1 });
  await page.goto(new URL('index.html', import.meta.url).href);
  await page.screenshot({ path:fileURLToPath(new URL('ayori-logo-directions.png',import.meta.url)), fullPage:true });
  for (let i=0;i<concepts.length;i++) {
    await page.locator('article').nth(i).screenshot({path:fileURLToPath(new URL(`${concepts[i].file.slice(0,-4)}-preview.png`,import.meta.url))});
  }
  console.log('Created three vector concepts, HTML preview and rendered comparison sheet.');
} finally { await browser.close(); }
