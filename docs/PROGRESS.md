# Implementation progress

This is the current handoff record. Read it before making changes and update it after every completed step.

## Current position

- Updated: 2026-11-04 (Asia/Dhaka).
- Branch: `codex/shortcuts-large-comparisons`.
- The requested large collections, 53 editable keyboard actions, descriptive hover help and richer UI are complete and verified in the final packaged Windows app. The original eight-source product limit is superseded; only the resident working set remains bounded at eight. Linux validation remains deferred.
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
| 6. Sharing and release | Final Windows artifact verified; external qualification deferred | Clipboard matches every captured pixel; offline HTML passes. Current executable is 8,486,912 bytes. Linux, clean-machine, physical mixed-DPI and 240 Hz testing need other environments. |
| 7. Large collections and configurable UI | Complete; final Windows package verified | 100-image and 100-folder comparisons, bounded residency, searchable A/B selection, 53 editable actions, saved preferences, live hover help and richer UI pass. 22 frontend + 21 Rust tests. |

## Completed steps

### 2026-11-04 — Start implementation record

- Added this persistent progress record and repository instructions requiring updates after each step.
- Verified a clean baseline and created the implementation branch.
- No application build has been verified yet.

## Resume here

The latest requested features are complete. Images are alternatives of one scene; folders represent releases/encoding groups with matching frame rows. Browse all searches arbitrary A/B sources. Settings contains 53 editable actions and interface preferences, saved locally. Large comparisons prepare selected/nearby images on demand while keeping at most eight resident; cold selection is not an instant-switch guarantee. Exact source samples, sparse cells and stale-work safeguards remain intact.

Current normal executable: `src-tauri/target/release/ayori-compare.exe` — **8,486,912 bytes**, SHA-256 `a1388e87be74aafed3780def0160a290984d5f2e38cafe08aec22339dd00d41a`. The corrected final package passes 100-image UI workflows, saved shortcuts, tooltip updates, minimum-window layout and the user's WEBP matrix; every clipboard pixel matches. The custom close control exits, and no Ayori process remains. An existing Vite server on port 1420 may still be running; inspect before starting another.

No further implementation task from the current request remains. Linux/AppImage remains deferred until the user is on Linux. Clean-machine prerequisites, physical mixed-DPI and 240 Hz checks need suitable environments. Earlier timing/memory measurements in `RELEASE_VALIDATION.md` describe the preceding baseline; they were not rerun as performance claims for the new UI. The upstream development-only advisory remains documented.

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

### 2026-11-04 — Resume verification and remaining-work review

- Reviewed the approved execution plan, original PRD, implementation decisions, and final release evidence. No unfinished Windows implementation step is identified; the remaining acceptance work still needs external hardware/environments or an upstream dependency fix.
- Re-ran all **19 Rust tests** with all features and the locked dependencies, all **15 frontend tests**, Svelte checks (zero errors/warnings), and Rust formatting. All passed. Production npm audit again reports zero vulnerabilities; the full audit still reports the same two low-severity development-only findings with `fixAvailable: false`.
- Verified that the existing Windows executable remains **8,336,384 bytes** and matches the final delivery SHA-256 `802cc8a0bb0cad98892dc358d8d6b970ba70c357d829e706a18d892a6fbe09c6`. Both lockfiles are tracked and the working tree was clean before this record. No application source or release binary changed, so the prior packaged GUI and clipboard evidence remains applicable; those checks were not repeated during this pass.
- Next: clean-machine WebView2 testing, physical mixed-DPI/240 Hz checks when the appropriate environments are available, and Linux validation when the user resumes it on Linux. These checks remain open, and the measured transfer tail and memory limitations remain documented in `RELEASE_VALIDATION.md`.

### 2026-11-04 — Large collections implemented and development-verified

- Removed the eight-source import/append limit for image files and source folders. Files remain alternatives within one scene; folders represent releases/encoding groups with filename/frame-number matching across scenes. The user delegated the import choice and clarified these workflows; no arbitrary loose-file pairing is inferred.
- Decoupled logical source numbers from the eight shader samplers. Up to eight selected/nearby sources retain exact decoded samples and GPU textures; four frontend decode jobs are scheduled at a time. A/B, previous-source flicker and four-quadrant sources remain in the working set. Superseded results are discarded and native mappings released.
- Background dimension inspection establishes the entire scene's normalization size before final fit, so evicting the largest image cannot change alignment. Watch setup now runs on a worker. Large collections calculate scores for selected A/B sources against source 1, with obsolete metric jobs invalidated; cached preprocessing remains bounded.
- Offline export includes every source, scene and exact packet, plus dimension metadata. The offline viewer loads a bounded working set and provides searchable A/B selectors. Encoded HTML size still grows with the collection; this does not make arbitrary collections cost-free or guarantee instant first loading.
- Verification: **21 Rust tests** (17 unit + 4 AVIF worker), **21 frontend tests**, clean Svelte build and strict all-target/all-feature Clippy. New tests cover 100 files, append, 100 sparse source folders, shortcut correctness and large-collection stale work. Native generated 100-image comparison selects source 100 against source 50, checks an exact rendered pixel, keeps eight resident images, retains a stable 640×360 base and correctly reloads four quadrants. Initial 100-image offline export passes with no network requests/errors. The existing native precision, sparse-scene, hot reload, clipboard, scaling and eight mixed-depth 4K tests also pass.
- Next: finish UI/editor verification and rebuild the normal Windows executable. The current release executable still belongs to the previous milestone.

### 2026-11-04 — Editable controls and richer UI verified in development

- Added 53 editable actions, automatic local persistence, search, conflict/reserved-key rejection, clear/reset controls, and a configurable held loupe. New commands cover imports, source browsing, A/B exchange, secondary-source stepping, first/last source, zoom/filtering and effect adjustments. Hover/focus tooltips use the saved assignments. Interface settings control tooltips and automatic HUD fading; Escape provides a way to recover hidden controls.
- Preserved typography and the dark palette while adding paired A/B metadata cards, visible mode labels, source/image totals, an import menu with clear workflow descriptions, searchable source/scene browsing and centered settings/source dialogs. Short-window styling avoids overlap.
- `scripts/verify-collections.mjs` passes in native WebView2: editing, conflicting assignments, Tab reservation, Escape cancelling recording, saved settings/shortcuts across reload, old-key removal, held-loupe release, current shortcut tooltip, 100-file A/B comparison and **100 source folders / 2 scenes**, including an explicitly missing selected frame. The updated offline viewer's searchable A/B selector also passes for 100 images without network requests or page errors.
- Visually inspected the actual Windows workspace and settings, plus captured source-browser/tooltip layouts. Native regression scripts pass for shader pixels/modes, original 16-bit readout under forced fallback, atomic hot reload, clipboard, sparse scenes, scaling and eight mixed-depth 4K frames. Shared-transport checks again match four complete PNG/AVIF packets and release all mappings after disposal/navigation.
- Final development checks: 21 frontend tests, 21 Rust tests, zero Svelte diagnostics, strict Clippy. Final normal Windows packaging and packaged UI checks are next; do not treat the older recorded executable as this feature build.

### 2026-11-04 — Final stale-work audit

- The first packaged feature build passed the real two-source/four-scene WEBP workflow, a 100-image source-100/source-50 comparison, saved shortcut changes and live tooltip text. Clipboard verification matched all 1,296,000 pixels, and production-only checks found no diagnostic commands or development workspace hook.
- A final review found that a failed dimension request could show an obsolete error after scene navigation. Dimension errors now use the same generation/revision/disposal checks as successful results. A new asynchronous regression test covers this case.
- Also made scene activation's active-path/epoch update atomic under its existing lock and checked watcher freshness while holding the installation lock, so a late watcher cannot replace a newer scene's watcher. Old-epoch metric requests return before changing the current revision.
- All **22 frontend tests**, **21 Rust tests** and strict Clippy pass. The corrected normal executable is rebuilding; final delivery evidence will follow.

### 2026-11-04 — Large-collection Windows release delivered

- Rebuilt the corrected normal executable with `npm run desktop:build`: **8,486,912 bytes (8.49 MB decimal)**, SHA-256 `a1388e87be74aafed3780def0160a290984d5f2e38cafe08aec22339dd00d41a`. The build has zero Svelte errors/warnings and remains below the 10 MB target.
- `scripts/verify-release-ui.mjs` passes against the bundled production frontend: imports 100 images, selects sources 100 and 50, exercises split comparison, edits and reloads a saved shortcut, and verifies updated tooltip text. The 960×600 emulated viewport contains the settings dialog at (40,32)–(920,568) with no horizontal overflow; final native workspace and dialog layouts were visually inspected.
- `scripts/verify-release.mjs` passes again with the user's two-source/four-scene WEBP matrix, production-only hook checks, shared-buffer receipt/release, copying and maximize/restore. The clipboard reader matches all **1,296,000 RGBA pixels**. The custom close button exits the final process.
- Final source checks remain **22 frontend + 21 Rust tests**, strict all-feature/all-target Clippy, Rust formatting and zero production npm audit findings. Both lockfiles remain tracked; generated test images, exports and executable are ignored. No performance rebenchmark is claimed for this UI release. External hardware/Linux qualification remains as previously documented.

### 2026-11-04 — Compact workspace and focused help verified in development

- Replaced the large A/B metadata cards and floating mode/bottom docks with a single **44px top bar**, including window controls. Metadata/scores moved into compact hover/focus help; scene search, import and view options use small native popovers. Zoom presets, filtering, difference gain, contour frequency and export remain available. Original typography and color styling are retained.
- Help opens on **12 essential shortcuts**, led by flicker, zoom/loupe and comparison modes. Optional actions remain searchable/expandable; all saved assignments and editing/conflict behavior are preserved. Added separate app-use and image-comparison guides with release-folder workflows, alignment, detail/ringing/grain, gradients/shadows/chroma and score/precision interpretation.
- All **22 frontend correctness tests** pass with zero Svelte diagnostics. Native 100-image/100-folder checks pass again: arbitrary A/B, source/GPU sample equality, bounded residency, sparse cells, saved shortcut conflicts/persistence and offline HTML without network access. Native shader/precision/scene-race/metric smoke, forced 8-bit preview with exact 16-bit readout, atomic hot reload, clipboard and sparse offline export also pass. Backend code and lockfiles are unchanged.
- Extended the packaged UI script (also runnable with `--dev`) to verify source metadata tooltips, 12-essential/optional search behavior, both guides, zoom menus, keyboard scene search, Escape/outside dismissal, reopening and focus restoration. At emulated 960×600 all visible controls fit without overlap in the 44px bar; help bounds are (100,20)–(860,580), with no horizontal overflow. Reviewed actual WebView2 screenshots of the compact bar and guides.
- Next: build the normal Windows executable, repeat packaged workflows and visually inspect the final app. The previously recorded binary is still the older layout until packaging completes. External platform/hardware qualification remains unchanged.

### 2026-11-04 — Native menu toggle corrected

- A final interaction audit found that an open popover treated its own manually wired trigger as an outside click, closing and immediately reopening. Linked each trigger with the native `popovertarget` relationship and synchronized state after the native toggle completes, avoiding reentrant show calls.
- The expanded native UI workflow now passes trigger-to-close, Escape, outside click, reopen and focus-return checks, along with the existing 100-image, saved-key, guide and 960×600 layout checks. Zero frontend errors were recorded.
- The first compact release build succeeded but predates this correction. Rebuilding the final executable and packaged verification are next.

### 2026-11-04 — Compact Windows release delivered

- Built the corrected normal executable with `npm run desktop:build`: **8,486,912 bytes (8.49 MB decimal)**, SHA-256 `434718e32a5b892eaca3cecbb3ebb95fe251833e15deb3391a88f84329d15cd8`. Zero Svelte errors/warnings; production diagnostic commands and the development workspace hook remain absent.
- The bundled production frontend passes `verify-release-ui.mjs`: 100 images, sources 100/50, metadata and edited-key tooltips, split, saved shortcuts, 12 essentials with optional search, both help guides, all menu dismissal/reopen/focus cases, and no overlapping controls in the 44px bar at 960×600. Help fits (100,20)–(860,580). No frontend errors were recorded.
- Packaged user WEBP comparison (two sources/four scenes), scene/source stepping, shared-buffer release, copying and maximize/restore pass. The clipboard reader matches all **1,296,000 RGBA pixels**. Native minimize, OS restore and the custom Close button are verified. Actual final Windows workspace and essential-shortcut layouts were visually inspected.
- Source checks: 22 frontend tests pass. Rust, renderer algorithms and both lockfiles are unchanged. Prior Rust/Clippy, scaling, decoder and performance evidence remains applicable; no new performance or memory benchmark is claimed. The requested compact UI and focused help are complete. External Linux, clean-machine, physical mixed-DPI/240 Hz qualification and the existing development dependency advisory remain as previously recorded.

### 2026-11-04 — Adjustable Ayori chrome and Home verified in development

- Added a saved **16–44px** bar-height slider and presets, default **32px**, under Help → Interface. Pure-black top bar, panels and canvas surround now match the requested theme; A/B colors and missing/transparent checker patterns retain their diagnostic meaning. Visible branding and native product/window title use **Ayori**. At smaller heights secondary labels compact while all core controls remain accessible.
- Added editable **Q quit**, **Ctrl+M minimize**, **F10 maximize/restore** and **Alt+Home Home**, with a compact App-key row in help. Shortcut payload v2 migrates the 53 older actions without erasing edits or taking a customized key. New conflicting defaults stay unassigned. Keys do not run during text entry, recording, dialogs or popovers.
- Home retains the matrix, resident frames, current scene and view; Resume comparison returns without re-importing. An older import cannot override later Home navigation. Added an equals cue when A and B select the same source. Kept the existing five inspection modes, useful readout/precision cues and guide rather than introducing extra analysis modes.
- **26 frontend tests** pass; zero Svelte diagnostics. New tests cover migration/key conflicts, cleared app bindings, Home during pending scene work and Home during pending import. Native appearance checks verify 16/24/32/44px and arbitrary 17px selection, persistence, all 22 visible buttons within 960px without overlap, pure-black bar CSS, menu placement, tooltip keys, editable quit, native F10 and byte-identical displayed comparison crops after Home/resume.
- Native smoke, exact pixels, original-depth fallback readout, atomic hot reload, metrics, sparse scenes, 100 images/100 folders, saved shortcuts and network-free offline export pass. Screenshots at 16px and 32px were visually reviewed. Rust source and both lockfiles are unchanged.
- Next: build the normal executable with the final branding, verify packaged appearance/Home/keys and real frames, confirm native Ctrl+M and Q, then record final hash and release evidence. Prior executable still has the earlier fixed-height layout until this packaging step finishes.

### 2026-11-04 — Adjustable Ayori Windows build delivered

- Final normal Windows executable is **8,488,960 bytes (8.49 MB decimal)**, SHA-256 `287626674e5c777797c44ebb182c656e0b39093e335788a7c90a2c8fd8a76106`. Built with `npm run desktop:build`, zero Svelte diagnostics. Native product/window title is **Ayori**; diagnostic commands and workspace hooks remain absent.
- Packaged 100-image comparison, arbitrary A/B, essential/app shortcut UI, saved bindings, live tooltips, both guides and popover workflows pass. Packaged appearance checks pass for pure-black background, persistent 16px setting, 17px keyboard adjustment and 16/24/32/44px layouts: all 22 visible controls remain within 960×600 without overlap. Minimum-size Home and bar layouts were visually reviewed, along with the actual final native comparison window.
- Packaged Home/resume returns the identical comparison image crop, scene, mode, pan and zoom. Home ignores comparison stepping; custom quit assignment persists and suppresses the old Q; Q in text entry does not exit. **F10 maximize/restore, Ctrl+M minimize, OS restore and Q closing from Home** all work in the final executable.
- Packaged user two-source/four-scene WEBP workflow and shared-buffer release pass. Clipboard reader matched all **1,296,000 RGBA pixels**. The latest frontend suite has **26 passing tests**; Rust source/lockfiles are unchanged, and earlier native decoder/performance qualification remains as documented.
- Requested appearance, app controls and Home work is complete. Existing external Linux/clean-machine/mixed-monitor/240 Hz qualification and development dependency advisory remain unchanged. Home retains the active comparison only within the current session; quitting does not save/reopen a session automatically.

### 2026-11-04 — Reversible right-click zoom verified in development

- Added enabled-by-default double-right-click zoom, saved 1–12800% target (default 200%), presets, help and live zoom tooltip. Two quick clicks anchor the chosen zoom to the clicked source position; repeating restores previous zoom, pan and fit behavior, even after panning or same-scene source switching. Home/resume retains the return view. Fit/manual zoom, scene/base-size changes, resizing and entering/leaving split start a new toggle.
- A shared gesture helper distinguishes click pairs from right-held/dragged loupe without flashing the lens. Pending clicks/timers cancel on blur, capture loss, dialogs or navigation. Disabling the gesture restores immediate right hold. Keyboard/right-button loupe release independently.
- Added the same gesture and configurable session target to offline exports, including canvas focus after settings and updated pixel readout after zoom without pointer movement. Its newly embedded release bundle still requires final offline verification.
- Clarified mixed-resolution behavior in help and README: maximum scene width/height, normalized stretching (including aspect mismatch), Auto nearest at ≥100%, bilinear/mipmap smoothing below 100%, exact original readout, and separate Catmull–Rom reference resizing for scores. Resampling algorithms are unchanged.
- All **37 frontend tests pass**, zero Svelte diagnostics. Native `verify-quick-zoom.mjs --dev` passes custom target persistence, pixel-identical restoration after panning at 100/125/150/200% emulated DPI, split anchoring, held-loupe coordination, disabled gesture, Fit/resize/blur invalidation and Home/resume. Actual settings screenshot reviewed at 1000×600. Native shader/precision, sparse scenes, metrics, hot reload, clipboard and 100-image/100-folder workflows pass; existing offline workflows still use the older embedded viewer in the development executable.
- Next: finish normal Windows build, verify packaged gestures and the newly exported offline viewer, repeat packaged real-frame/clipboard checks and record final artifact. Rust logic and lockfiles are unchanged.

### 2026-11-04 — Reversible zoom Windows release delivered

- Built the normal executable with `npm run desktop:build`: **8,494,592 bytes (8.49 MB)**, SHA-256 `789522cc0e8173501f48ad47ff552aa9c2d232155e0052de4cdbff632b6071db`. Zero Svelte diagnostics; production-only checks confirm diagnostics/workspace hooks are absent.
- Packaged quick-zoom workflow passes default/custom target persistence, exact restored screenshot crops at four emulated DPI scales, panning, source switching, held-loupe handling, disable, Fit/resize/blur invalidation and Home/resume. Final Windows workspace and settings were visually reviewed. Gesture input was exercised through native WebView2; direct OS automation does not support double right clicks. Native Q closes the final process.
- Newly exported offline HTML passes configurable 375% zoom, exact pan/zoom/crop restoration, anchored pixel readout, right/Shift loupe coordination and scene-reset behavior with zero network requests/errors. Corrected its verification script to wait for the final exact-sample status instead of the transient ready count.
- Packaged 100-image UI workflow and real two-source/four-scene WEBP workflow pass, including saved keys, tooltips, guides, popovers, shared buffers and maximize/restore. Clipboard reader matches all **1,296,000 RGBA pixels**. Latest source coverage is **37 passing frontend tests**; Rust decoder/metric/transport logic and both lockfiles are unchanged.
- Requested gesture, settings and resolution explanation are complete. Existing Linux, clean-machine, physical mixed-monitor and 240 Hz qualifications remain external; prior performance limits and dependency advisory remain documented. Source samples and resampling algorithms are unchanged.

### 2026-11-04 — Logo concepts prepared for user selection

- Created three original, editable vector logo directions in `design/logo-concepts`: A / Facet (asymmetric A), B / Twinlight (split lens), and C / Parallax (offset comparison frames). Prepared a combined PNG sheet, individual preview cards and a reproducible HTML presentation.
- Visually reviewed the rendered sheet, including 16/24/32px sizes, a 48px app icon treatment, single-color silhouettes and compact title-bar mockups. These are design previews; app components, native icons and the delivered executable are unchanged.
- Next: the user chooses a direction, as explicitly requested. Then refine/apply that mark, regenerate native icons and verify the final packaged app. No logo integration milestone is complete yet.

### 2026-11-04 — Selected Facet logo integrated; packaging verification pending

- The user selected A / Facet. Added the approved SVG as the shared master for the title bar, existing Home preview badge and favicon. Offline comparisons inline the same mark and favicon without network dependencies. Existing typography and compact bar behavior are preserved, including hiding the decorative mark below 24px.
- Added `scripts/generate-icons.mjs` to derive a black rounded app tile from the master and regenerate the existing native icon set through Tauri. ICO/PNG/ICNS and platform variants are tracked assets. Visually inspected the generated 128px icon; approved shapes and colors are retained.
- All **37 frontend tests pass**; production frontend and offline builds pass with zero Svelte diagnostics. Native packaging is underway. The source changes are implemented, but final executable resources, actual packaged UI and offline branding still require verification.
- Next: verify packaged title bar/Home, all compact heights, embedded Windows icon resources and offline export; record final executable and release evidence.

### 2026-11-04 — Facet identity Windows release delivered

- Final normal Windows executable: **8,501,248 bytes (8.50 MB)**, SHA-256 `45392c68b09081d1173347e85aa956c041256ef612bce378398c23b414432490`. Build passes with zero Svelte diagnostics; all **37 frontend tests** pass. All six approved ICO image payloads (16/24/32/48/64/256px) are present byte-for-byte in the executable resources.
- Visually reviewed actual packaged Home and real comparison screenshots: the selected Facet mark appears in the title bar and existing Home preview badge. Native 128px icon also reviewed. The app font and compact layout are preserved; the pre-existing minimal mode hides the decorative logo below 24px.
- Packaged appearance checks pass all four bar heights at 960×600, with 22 controls and no overflow; saved settings, Home/resume and app shortcuts pass. Packaged real two-source/four-scene WEBP import, shared buffers, maximize/restore, copying and production-only checks pass with zero frontend errors.
- Fresh offline export displays the embedded Facet mark and SVG favicon without HTTP requests or frontend errors. Source artwork and deterministic native-icon generation are documented in `design/BRANDING.md`; no new dependency or lockfile change was needed.
- The selected logo is applied and Windows delivery is complete. Comparison behavior and existing external Linux/clean-machine/mixed-monitor/240 Hz qualifications are unchanged.

### 2026-11-04 — Explorer stale preview diagnosed; clean portable delivery prepared

- Reproduced the user's mismatch: file-list icon showed Facet, while Explorer's large Details preview retained the previous logo. Enumerated the PE resource directory: exactly one icon group (32512), six icon image resources, all byte-identical to the approved ICO; executable hash remains `45392c68b09081d1173347e85aa956c041256ef612bce378398c23b414432490`.
- Tried ordinary refresh, item-update notifications, Windows icon refresh, association-change notification, specific system-image refresh and reopening the Details pane. The small details icon updated, but the large preview remained stale at the last UI observation. Forced thumbnail extraction is unsupported for this executable (0x8004B200). No global caches were deleted and Explorer was not restarted. UI navigation stopped after repeated user-input detection.
- Created a separate portable copy at `releases/Ayori.exe`. Added a Windows-only preparation step to `desktop:build`, verified copied bytes by SHA-256, and ignored generated release output. Windows IShellItemImageFactory extracted correct 96px Facet images from both original and portable paths; both were visually inspected. No application code or binary changed, so no rebuild or duplicate correctness run was needed.
- Delivery uses the clean portable path, avoiding the old Explorer entry. The original open pane's cache was not confirmed cleared; reopening its Explorer window is a suggested local remedy, not a verified result. Prior application verification remains applicable.
