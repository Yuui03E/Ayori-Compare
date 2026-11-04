# Implementation progress

This is the current handoff record. Read it before making changes and update it after every completed step.

## Current position

- Updated: 2026-11-04 (Asia/Dhaka).
- Branch: `feat/desktop-app`.
- Requirements review approved by the user. Core implementation and development-app verification are complete; release qualification remains in progress.
- Baseline commits: `65a3f49` (original specifications), `ae8aa12` (requirements review).
- Confirmed: sparse scenes shared by at least two folders; labeled 8-bit fallback with exact source readout.

## Milestones

| Step | Status | Evidence / next work |
| --- | --- | --- |
| 0. Requirements and Git | Complete | Both source documents reviewed, decisions recorded, repository initialized. |
| 1. Foundation | Development and packaged launch verified | Packaged app launches on its own; native file picker imports the user's WEBP pair. Clean-machine prerequisites remain untested. |
| 2. Renderer and precision proof | Correctness and synthetic decode target verified; IPC target unmet | Exact samples and fallback pass. Four-frame PNG batch: 18.39 ms median / 19.17 ms p95. Raw IPC: 65.90 ms median with debugger detached. Real 240 Hz evidence pending. |
| 3. Comparison workspace | Implemented and smoke-verified | Real folder/file decoding, sparse matching, ambiguity tests and rapid scene changes pass. |
| 4. Inspection tools | Implemented and smoke-verified | Modes, flicker, readout, eight mixed-depth 4K textures, and emulated 100/125/150/200% scaling pass. Physical mixed-DPI hardware coverage remains. |
| 5. UI and live analysis | Implemented and smoke-verified | UI visually inspected; real SSIMULACRA2 scores and atomic file hot reload preserve view state. |
| 6. Sharing and release | Sharing and final Windows executable verified; full qualification incomplete | Clipboard matches every captured pixel; offline HTML passes. Final executable is 8,285,184 bytes and packaged workflows pass. Linux/clean-machine/high-refresh testing and IPC improvement remain. |

## Completed steps

### 2026-11-04 — Start implementation record

- Added this persistent progress record and repository instructions requiring updates after each step.
- Verified a clean baseline and created the implementation branch.
- No application build has been verified yet.

## Resume here

The final normal Windows executable has been rebuilt and verified. Core features, sharing, exact source samples, generated 10/12-bit AVIF, expanded PNG formats, stale-work guards, and the synthetic PNG decode target pass. See `docs/RELEASE_VALIDATION.md` for the full evidence and reproducible test commands.

Next engineering work is the raw binary IPC performance shortfall: 65.90 ms median with the debugger detached versus the <5 ms target, measured without decoding or GPU upload. A faster transfer mechanism needs precision, ownership and cross-platform checks. Linux/AppImage, clean-machine prerequisites, physical mixed-DPI and 240 Hz validation need suitable environments. Do not rebuild completed features.

Current executable: `src-tauri/target/release/ayori-compare.exe`. Development command: `npm run desktop`. Development verification tools used a WebView2 debugging port of 9223. A development app and Vite server may still be running; inspect before starting duplicate instances.

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
- PNG batch target now passes on the generated corpus; broaden representative corpus coverage and record hardware/environment limits.
- Improve raw IPC: isolated transfer remains 65.90 ms median / 68.40 ms p95, with no debugger attached. 60 Hz pacing passes, but real 240 Hz presentation remains unverified. CPU/GPU sampled peaks are recorded; no numeric total ceiling has been approved.
- Physical mixed-monitor scaling and broader AVIF YUV/subsampling coverage remain. Generated identity-matrix 10/12-bit AVIF, palette/low-depth PNG, emulated device scaling, forced GPU fallback and eight mixed-depth/aspect 4K textures now pass.
- Run the Linux AppImage build and runtime checks on Linux. CI configuration exists but has not run.
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
