# Implementation progress

This is the current handoff record. Read it before making changes and update it after every completed step.

## Current position

- Updated: 2026-11-04 (Asia/Dhaka).
- Branch: `feat/desktop-app`.
- Requirements review approved by the user. Windows implementation and all validation available on this machine are complete, including the final packaged executable. Linux validation is deferred at the user's request; external hardware/clean-machine qualification remains open.
- Baseline commits: `65a3f49` (original specifications), `ae8aa12` (requirements review).
- Confirmed: sparse scenes shared by at least two folders; labeled 8-bit fallback with exact source readout.

## Milestones

| Step | Status | Evidence / next work |
| --- | --- | --- |
| 0. Requirements and Git | Complete | Both source documents reviewed, decisions recorded, repository initialized. |
| 1. Foundation | Development and packaged launch verified | Packaged app launches on its own; native file picker imports the user's WEBP pair. Clean-machine prerequisites remain untested. |
| 2. Renderer and precision proof | Correctness, synthetic decode and Windows transfer median/p95 targets verified | Exact samples and fallback pass. Four-frame PNG batch: 18.39 ms median / 19.17 ms p95. Windows shared transfer: 4.20 ms median / 4.50 ms p95; 5.30 ms maximum. Real 240 Hz evidence pending. |
| 3. Comparison workspace | Implemented and smoke-verified | Real folder/file decoding, sparse matching, ambiguity tests and rapid scene changes pass. |
| 4. Inspection tools | Implemented and smoke-verified | Modes, flicker, readout, eight mixed-depth 4K textures, and emulated 100/125/150/200% scaling pass. Physical mixed-DPI hardware coverage remains. |
| 5. UI and live analysis | Implemented and smoke-verified | UI visually inspected; real SSIMULACRA2 scores and atomic file hot reload preserve view state. |
| 6. Sharing and release | Final Windows artifact verified; external qualification deferred | Clipboard matches every captured pixel; offline HTML passes. Final executable is 8,336,384 bytes, with packaged shared-buffer workflows verified. Linux, clean-machine, physical mixed-DPI and 240 Hz testing need other environments. |

## Completed steps

### 2026-11-04 — Start implementation record

- Added this persistent progress record and repository instructions requiring updates after each step.
- Verified a clean baseline and created the implementation branch.
- No application build has been verified yet.

## Resume here

Windows now uses read-only WebView2 shared frame buffers with an unchanged raw AYRI fallback on other/older runtimes. Transfer median/p95 are below 5 ms; a 5.30 ms maximum remains an observed tail stall. Full source-byte equality, cancellation, release/detachment, bounded idle retention, reload cleanup, and existing native workflows pass. See `docs/RELEASE_VALIDATION.md` for evidence and reproducible commands.

No remaining implementation task is identified for this Windows session. The final normal executable has been rebuilt and verified with the user's WEBP matrix and high-depth/subsampled AVIF inputs. Broader AVIF and representative PNG corpus checks are complete. Linux/AppImage is explicitly deferred until the user is on Linux. Clean-machine prerequisites, physical mixed-DPI and 240 Hz checks still require suitable environments. The low-severity development-only upstream advisory remains documented, with no published fix.

Current executable: `src-tauri/target/release/ayori-compare.exe` — **8,336,384 bytes**, SHA-256 `802cc8a0bb0cad98892dc358d8d6b970ba70c357d829e706a18d892a6fbe09c6`. Development command: `npm run desktop`. The test app was closed through its custom close control; no Ayori process remained. An existing Vite server may still be running; inspect before starting another.

### 2026-11-04 — Foundation verified

- Added Tauri 2 / Svelte 5 / TypeScript / Tailwind 4 project, frameless titlebar, local permissions, CSP, app icon, npm/Cargo lockfiles, and development instructions.
- `npm run build`: passed; Svelte reports zero errors/warnings.
- `cargo build --manifest-path src-tauri/Cargo.toml`: passed.
- Launched the actual Windows WebView2 application and verified the displayed shell, maximize toggle, and close button using desktop automation.
- Production npm dependencies audit: zero reported vulnerabilities. Development dependency audit reports two low-severity items; investigate before release.
- Added initial source-packet and DPI/coordinate checks: 7 passing tests. Real GPU/pipeline proof is still pending.
- AVIF finding: the roadmap's `image/avif` feature only encodes. A separate decoder is needed; dependency selection is in progress.

### 2026-11-04 — Decoder and matrix backend checks pass

- Added PNG / WebP / JPEG / AVIF decoding, explicit RGBA expansion, exact 16-bit packet output, input limits, sparse matching, append validation, and deterministic ambiguity handling.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib`: 8 tests passed, including actual encoded PNG round trips and temporary directory fixtures.
- Selected BSD-licensed `avif-decode` 3 with the rav1d decoder. It requires Rust 1.98 and NASM for x64 assembly. A portable NASM 3.02 was downloaded from nasm.us into ignored `.tools/`; no system settings changed. Use `NASM=<workspace>/.tools/nasm-3.02/nasm.exe` when running Cargo locally unless NASM is already on PATH.
- Added bounded asynchronous frame commands (four concurrent decodes), one metric job at a time, and active-scene watcher plumbing. These are implemented but not yet verified through the UI.
- Source samples remain unchanged in the AYRI payload and the frontend's active-scene typed arrays; a reduced-precision GPU upload does not overwrite them.

### 2026-11-04 — Native GPU and interface proof

- Connected the eight-slot renderer to a Svelte workspace, added all five inspection modes and submodes, source/scene controls, a synthetic sample, HUD auto-hide/lock, exact pixel readout, and split loupe.
- `npm run build`: passes with zero Svelte errors/warnings; frontend bundle approximately 125 kB before gzip. Standalone shared-renderer viewer is approximately 17 kB before gzip.
- Native WebView2 automated checks: source pixel `[39,49,78,255]` equals the rendered pixel at 100%; identical RGB difference and luma heatmap both produce `[0,0,0,255]`; all mode/submode/loupe/grid combinations execute without GL errors; four sources include native 16-bit data; source flicker shortcut and HUD lock pass.
- This machine reports `EXT_texture_norm16` support. Forced-fallback validation is still pending.
- Visually inspected the running full comparison UI. Screenshot is under ignored `local-fixtures/native-demo.png`.
- Per-switch timer readings were below the WebView2 clock resolution; these are not sufficient evidence for the 0.5 ms or 240 Hz targets. A representative benchmark remains needed.
- Added a reusable native smoke script (`scripts/smoke-native.mjs`) and documented current behavior in `docs/IMPLEMENTATION_DECISIONS.md`.

### 2026-11-04 — Real-file workflow and failure checks

- Imported four 2560×1440 sources across three generated scenes, including a sparse scene and an exact 16-bit PNG. Rapid asynchronous scene changes ended on the correct scene with all expected sources.
- Background SSIMULACRA2 produced real scores (approximately 90.53, 50.07, and 100 for the generated candidates).
- Forced the 8-bit GPU fallback: the preview label appears and the original 16-bit first sample remains exactly 772.
- Replaced an active PNG atomically on disk: its source sample changed from 9 to 3 while mode 3, zoom 2, and pan (-23,31) remained unchanged. Restored the fixture afterward.
- Exported all scenes to a standalone HTML file. Initial offline browser check loaded it with no script errors; extended offline verification is pending the clipboard fix.
- Found and fixed a missing Tauri PNG image capability in the clipboard path; re-verification is pending.
- Added AVIF worker isolation after confirming the decoder's upstream malformed-input abort. Native subprocess tests pass for both a valid 16×16 AVIF and a corrupt payload without terminating the test host.
- Resolved Tauri JS/Rust version mismatch uncovered by the release builder; lockfile now matches the installed 2.12 / dialog 2.8 / clipboard 2.5 packages.
- Initial release built successfully at 10,087,936 bytes (slightly above the decimal 10 MB target). Size tuning is underway while keeping image/metric libraries optimized for speed.
- Initial optimized warm 4×1440p PNG read+decode benchmark: median 38.72 ms, max 42.64 ms across 12 samples. This does not yet meet the 35 ms target and is not an isolated-hardware benchmark.

### 2026-11-04 — Clipboard and offline sharing verified

- Repeated native integration checks against aligned Tauri versions. Clipboard PNG copying now succeeds.
- Opened the exported HTML with browser networking disabled: all three scenes and four sources are present, sparse cells remain visible, mode controls work, and there are zero HTTP requests or uncaught script errors.
- Tests now cover PNG RGB/RGBA16/grayscale-alpha, lossless WebP, JPEG, valid AVIF, malformed AVIF worker isolation, matching ambiguity, packet validation, and physical coordinate invariants: 13 Rust tests plus 7 frontend tests.
- Rust Clippy's strict check identified style improvements; applied its fixes and formatted Rust/TypeScript/Svelte for maintainability. Final check results will be recorded after the last build.
- Added Windows and Linux CI definitions. They have not run remotely because this repository has no configured remote.

### 2026-11-04 — Optimized executable and final checkpoint

- `npm run desktop:build` succeeded after optimizing general code for size while retaining speed optimizations for image/metric libraries. Final executable: **8,340,480 bytes (8.34 MB decimal)**, satisfying the executable-size target.
- Latest frontend build: zero Svelte errors/warnings; all 7 frontend tests pass. Rust tests: 11 unit tests plus 2 AVIF subprocess tests pass. Strict Clippy completed after applying its suggested fixes.
- Repeated scene changes under native WebView2: started with 4 active textures, created 33 and deleted 33 over nine changes, ended with 4. This verifies resource ownership for that scenario, not a numeric process/VRAM ceiling.
- Imported a real 16×16 AVIF alongside a 2560×1440 PNG through the native app. Both decoded without errors; SSIMULACRA2 returned a finite score with `resampled: true`, confirming the mixed-resolution reference path.
- Earlier native and offline integration scripts pass, including exact pixels, all shader modes, real scores, sparse scenes, rapid transitions, forced 8-bit preview retaining 16-bit samples, atomic hot reload preserving view state, clipboard copying, and network-free HTML viewing.
- The optimized executable's final GUI launch is **not verified**. It was attempted concurrently with a development instance using different WebView2 debug options, and no persistent release process was observed. Do not infer the cause without checking it.
- User stopped Computer Use with physical Escape during the final window check. Desktop automation stopped immediately. Remaining checks are recorded above.

## Outstanding acceptance work

- Packaged Windows launch, file dialog/import, window controls and lossless clipboard checks pass. Test WebView2 prerequisites on a clean machine.
- PNG batch target passes on generated patterns, four PNGs derived from the user's frames, and deterministic noise. Warm-cache/environment limitations are recorded.
- Windows shared transfer now measures 4.20 ms median / 4.50 ms p95 (5.30 ms max). Legacy raw IPC remains 65.90 ms median / 68.40 ms p95 and is retained for other/older runtimes. 60 Hz pacing passes; real 240 Hz presentation remains unverified. CPU/GPU sampled peaks are recorded; no numeric total ceiling has been approved.
- Physical mixed-monitor scaling remains. AVIF 8/10/12-bit 420/422/444 full/limited-range SDR coverage, identity-matrix exact samples, palette/low-depth PNG, emulated device scaling, forced GPU fallback and eight mixed-depth/aspect 4K textures pass.
- Linux AppImage build/runtime validation is deferred by the user until they are on Linux. CI configuration exists but has not run.
- npm reports two low-severity development-only findings from the Svelte Vite plugin's `deepmerge` dependency, with no published fix in the queried audit. Production dependency audit reports none.

### 2026-11-04 — Packaged import and faster lossless PNG decoding

- Verified standalone packaged launch with no development app running; opened the native image picker and imported the user's `1.webp` / `2.webp` pair (1920×1080). Visually verified the displayed WEB-DL frame. Window close exits the process. Clipboard confirmation and remaining controls still need instrumented verification.
- User supplied eight WEBP images, odd numbers WEB-DL and even numbers encodes. Created ignored local copies as two source folders and four matching scenes; originals remain untouched and outside Git.
- Added a reproducible four-thread, 5-warmup / 50-sample benchmark separating warm read+decode+RGBA, resident-input decode, file reads, and one-frame AYRI packing.
- Baseline zune-png: 38.31 ms median / 39.83 ms p95 read+decode. Replaced it with the existing `image` / `png` decoder, optimized `png` and `fdeflate`, and used consuming RGBA conversion to avoid an extra copy. Updated Cargo.lock and removed unused zune-png.
- Updated result: **18.39 ms median, 19.17 ms p95, 22.03 ms max** for 4×2560×1440 RGBA8 PNGs; resident decode 16.86 ms median; one-frame packet packing 1.70 ms median. Ryzen 9 9950X / Windows, warm generated corpus, ordinary background applications running. This is not a cold-cache or all-corpus guarantee.
- All 15 Rust library tests pass. New correctness coverage verifies 1/2/4-bit grayscale, palette transparency, RGB16 and grayscale-alpha16 low bits, IDAT CRC rejection, and truncated PNGs. Dimensions are checked before full decoded-image allocation.
- Hardware discovery: current display mode is 2560×1440 at 60 Hz on RTX 5070. WSL/Linux is not installed; genuine 240 Hz and Linux runtime evidence require an appropriate environment.
- Next: instrument IPC and responsiveness, verify final packaged build/sharing, expand high-depth AVIF and mixed-DPI coverage.

### 2026-11-04 — Broader precision, stale-work, and native workflow checks

- Generated tiny original 10-bit and 12-bit identity-matrix AVIF ramps using libavif 1.4.2. Worker tests check all encoded RGB samples survive conversion/AYRI and preserve actual source depth; alpha is opaque. The decoder expands RGB by reversible bit replication. No user images or downloaded tools are tracked.
- Added asynchronous workspace tests for out-of-order scene packets, overlapping source reloads, sparse slots, and disposal. Found and fixed metrics being accepted after disposal; disposal now invalidates metric revisions, and late watcher/metric events are ignored.
- All 18 Rust tests (15 unit + 3 worker tests) and all 10 frontend tests pass. Svelte check reports zero errors/warnings; strict Clippy passes for all features and targets.
- Native integration and offline workflow scripts pass after the decoder change: exact pixels, all shader modes, sparse scenes, rapid scene transitions, 16-bit GPU fallback, atomic hot reload preserving view state, clipboard success, and network-free HTML.
- All four user-supplied WEB-DL/encode pairs loaded at 1920×1080 and produced finite scores. At 100%, sampled GPU pixels equal exact source pixels in each scene. Across 24 additional scene changes, 48 textures were created and 48 deleted, ending with two active sources and no GL error.
- Device scaling emulation inside actual WebView2 passes at 100%, 125%, 150%, and 200%, including exact nearest pixels, cursor transforms, mixed-aspect dimensions, and matching split-panel samples. This does not replace physical mixed-monitor testing.
- Packaged frontend checks confirm clipboard success and maximize/restore with the user's two-source, four-scene matrix. Custom close control exits successfully. Final rebuilt executable and clipboard byte-for-byte verification remain next.

### 2026-11-04 — Final Windows artifact and measured release limits

- `npm run desktop:build` passes with zero Svelte errors/warnings. Final executable is **8,285,184 bytes**; SHA-256 is recorded in `RELEASE_VALIDATION.md`. Normal build rejects opt-in measurement commands and exposes no development workspace hook.
- Final packaged workflows pass for the user's two-source/four-scene WEBP matrix and for real 10/12-bit AVIF worker imports. Verified maximize/restore, minimize, custom close, and the actual displayed comparison UI.
- Native clipboard reader matched all **1,296,000 RGBA pixels** from a captured 1440×900 comparison. Offline viewer smoke remains green.
- Added opt-in fixed-buffer native IPC measurements, batched source-switch/draw/frame-pacing measurements, detached-debugger transfer probe, device-scale checks, eight-slot 4K allocation/clearing checks, and process-tree memory sampling. CI now enforces the Windows <10 MB executable target.
- IPC target is **not met**: optimized native backend 74.60 ms median with debugger attached and 65.90 ms detached for 14,745,632 bytes. This excludes disk/decode/upload and includes the native response copy and dispatch. It must not be described as zero-copy or <5 ms.
- Source-selection batch averages measure 0.0004 ms per operation; draw submission p95 0.10 ms. 290 frame intervals at the current 60 Hz mode showed zero stalls over 1.5× median. These do not establish individual-input latency or 240 Hz behavior.
- Fresh release import/scoring/copy/window-resize workload: sampled peak private memory 600,997,888 bytes, aggregate working sets 692,740,096 bytes, dedicated GPU 218,591,232 bytes, shared GPU 77,869,056 bytes. These are sampled observations, not hard ceilings.
- Current remaining work: IPC transport improvement; external Linux, clean-machine, physical mixed-DPI and 240 Hz qualification; unresolved low-severity development dependency advisory. All other completed checks and limitations are in the release-validation document.

### 2026-11-04 — Windows shared frame transfer verified

- Replaced the Windows frame data path with WebView2 read-only shared mappings. Original AYRI bytes/typed arrays remain exact; non-Windows and older WebView2 use the existing binary response. Windows dependencies are target-specific and Cargo.lock is tracked.
- COM work stays on the window thread; a duplicated OS mapping handle moves to a worker for pixel copying. Native mappings are never reused until JavaScript has detached its view and acknowledged release. Four in-flight frame jobs remain bounded; one idle mapping of at most 32 MiB may be retained. Navigation clears mappings and invalidates old work.
- Detached-debugger benchmark, 14,745,632-byte frame, 5 warmups/50 samples: **4.20 ms median, 4.50 ms p95, 5.30 ms max**. Each payload byte was verified outside the timing interval. The first non-pooled implementation measured 4.90 ms median / 5.50 ms p95. This is a measured median/p95 pass, not a guarantee that every transfer is below 5 ms or an end-to-end zero-copy claim.
- 15 frontend tests pass, including out-of-order delivery, cancellation/timeout/error release, exact low bits, unsupported-runtime fallback, and renderer cleanup. Native packet comparison matches every byte for 8/16-bit PNG and 10/12-bit AVIF. Native ownership probe received/released 12 mappings, retained zero active/pending mappings after disposal, and retained zero bytes after navigation.
- Repeated native smoke, real-file workflow, user WEBP pairs, fallback precision, metrics, file hot reload, clipboard, offline HTML, scaling emulation, and eight-slot 4K checks all pass. Final normal packaged artifact still needs rebuilding and verification after this step.
- Linux validation is deferred per user instruction. The two low-severity development dependency advisories were rechecked: upstream still publishes no fix; production audit remains clean.

### 2026-11-04 — Broader decoder qualification completed

- Added 18 original 32×16 AVIF fixtures covering 8/10/12-bit, 4:2:0 / 4:2:2 / 4:4:4 and full/limited range (9,707 bytes total). A reproducible generator constructs known YUV planes and encodes with libavif/AOM. Tests compare against Rec.709 equations at constant-chroma stripe interiors, allowing two encoded-depth steps for converter rounding. Exact source-bit tests remain separate and strict.
- All four AVIF worker tests pass, including the new test across all 18 combinations; total Rust coverage is now 19 tests. No user images or downloaded tools are tracked.
- Added an ignored benchmark corpus generator. Four user WEB-DL frames were copied, resized to 2560×1440 and saved as RGBA8 PNGs solely for the benchmark. Originals are unchanged. Warm four-thread read+decode: **30.44 ms median / 31.38 ms p95 / 31.89 ms max**, passing <35 ms in this run. Compressed sizes range from 3.82 to 4.48 MB.
- Four high-entropy RGBA8 PNGs (14,748,233 bytes each) measured **8.96 ms median / 10.18 ms p95 / 10.34 ms max**. Incompressible data uses inexpensive stored deflate blocks, so file size alone does not predict decode cost. Resident real-image decode separately measured 29.20 ms median / 41.10 ms p95, showing background timing variation; no universal/cold-cache performance claim is made.
- Next: final normal Windows build, packaged workflow/clipboard verification, visual inspection, and final release record.

### 2026-11-04 — Final Windows delivery checkpoint

- `npm run desktop:build` passes; normal executable is **8,336,384 bytes (8.34 MB decimal)**. SHA-256: `802cc8a0bb0cad98892dc358d8d6b970ba70c357d829e706a18d892a6fbe09c6`. Diagnostics commands and development workspace access are absent.
- Packaged two-source/four-scene user WEBP matrix passes import, scene switching, source selection, copying, maximize/restore, and shared-buffer use/release (6 received, 4 released, 2 resident). A second packaged import of identity AVIF10/12 plus subsampled full/limited YUV AVIF10/12 passes with four shared source buffers and no frontend errors.
- Native clipboard reader verifies all **1,296,000 RGBA pixels** match the captured 1440×900 canvas. Visually inspected the actual final Windows comparison, split view and high-depth ramp. Custom minimize succeeds, restore succeeds, and custom close exits the process.
- Final checks: **19 Rust tests, 15 frontend tests**, zero Svelte errors/warnings, strict all-feature/all-target Clippy, Rust formatting, and production npm audit (zero vulnerabilities). CI now checks all features too. Existing native/offline workflows remain green.
- Updated 20-second fresh-release workload memory observation: peak private 573,001,728 bytes, aggregate working sets 665,268,224 bytes, dedicated GPU 227,856,384 bytes, shared GPU 75,370,496 bytes. These are sampled observations, with shared pages potentially counted twice, not guaranteed ceilings.
- Windows work available on this host is complete. Linux validation is deferred per user request. Remaining external checks are clean-machine WebView2 prerequisites, physical mixed-DPI monitors and 240 Hz presentation. The 5.30 ms observed transfer maximum and two low-severity development-only upstream advisories remain explicitly recorded; no universal latency guarantee or full cross-platform qualification is claimed.
