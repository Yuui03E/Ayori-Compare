# Release validation — 2026-11-04

These measurements describe this machine and these workloads. Unmet targets remain release qualification work.

## Current Windows delivery — configurable double-right-click zoom

- Normal executable: **8,494,592 bytes** (8.49 MB decimal), SHA-256 `789522cc0e8173501f48ad47ff552aa9c2d232155e0052de4cdbff632b6071db`. `npm run desktop:build` passes with zero Svelte errors/warnings; diagnostics commands and development workspace hooks are absent.
- **37 frontend tests pass**. The gesture tests cover click timing/distance, four clicks producing two toggles, no transient loupe, hold/drag, cancellation/button chords, disabled behavior and target validation. Coordinate tests cover exact anchored zoom/pan restoration at four DPI scales and invalidation after scene/layout/manual-view changes. Rust decoding, metrics and transport logic and both lockfiles are unchanged.
- `verify-quick-zoom.mjs` passes in development and the final packaged WebView2 app: default 200%, custom 375% persistence, identical screenshot crops after zoom/pan/return at 100/125/150/200% emulated display scaling, right split anchoring, source switching, loupe release coordination, single/slow/distant click rejection, disabled gesture, Fit/resize/blur invalidation and Home/resume. The direct OS automation tool does not support right-button double clicks; native WebView2 pointer input supplies the gesture checks. Actual Windows workspace and settings were visually inspected.
- `verify-offline-zoom.mjs` passes against an HTML comparison freshly exported by this executable: 2 sources / 4 scenes, session target 375%, exact zoom/pan and screenshot restoration after panning, anchored original pixel readout, right/Shift loupe coordination, scene reset, zero network requests and zero frontend errors. Editing the target returns keyboard focus to the canvas on interaction. The test waits for the viewer's final exact-sample status rather than its transient loading count.
- Final packaged 100-image UI checks, arbitrary A/B, saved shortcuts, tooltip/help/popovers and minimum-window layout pass. Real user WEBP import (2 sources / 4 scenes), scene/source navigation, shared-buffer receipt/release, maximize/restore and copying pass. Clipboard verification matches all **1,296,000 RGBA pixels**. Q exits the final Windows process.
- Earlier native precision/fallback, hot reload, sparse-scene, metrics and 100-image/100-folder checks also pass with the new desktop frontend. Display/metric resampling algorithms and original samples are unchanged; the guide and README now explain the normalization, filtering and aspect-ratio caveat. Prior backend/performance evidence and outstanding external qualifications below remain applicable; no new performance benchmark is claimed.

## Previous Windows delivery — adjustable Ayori bar and application controls

- Normal executable: **8,488,960 bytes** (8.49 MB decimal), SHA-256 `287626674e5c777797c44ebb182c656e0b39093e335788a7c90a2c8fd8a76106`. Built with `npm run desktop:build`; diagnostic commands and development workspace access are absent.
- **26 frontend correctness tests pass**, with zero Svelte diagnostics. This update changes the frontend, application branding/configuration, scripts and documentation; Rust source and both lockfiles are unchanged, so the prior 21 Rust tests, strict Clippy, formatting and dependency-audit evidence remains applicable.
- Native integration covers 100 individual images and 100 release folders with two matched scenes and a missing selected source. An arbitrary pair (sources 100 and 50) retains exact source/GPU pixels, a stable base size and at most eight resident frames. Four-quadrant switching, stale selection/metadata rejection and shared mapping release pass.
- The final packaged UI independently passes a 100-image import, arbitrary A/B selection, split view, saved shortcut changes, source-metadata/current-key tooltips, 12-essential/optional shortcut views and both guides. Native popovers pass trigger-to-close, outside/Escape dismissal, reopening and focus return. At emulated 960×600, all 22 visible controls fit without overlap at 16/24/32/44px bar heights; the help dialog stays within (100,20)–(860,580) without horizontal overflow. The actual final Windows workspace and help were visually inspected.
- Final packaged user WEBP matrix (two sources/four scenes), source/scene switching and copying pass; all 1,296,000 captured clipboard pixels match. Native F10 maximize/restore, Ctrl+M minimize, OS restore and Q quitting from Home are verified. The native window title is Ayori. Development regressions retain exact 16-bit fallback readout, shader pixels, hot reload, sparse scenes, metrics and network-free offline export; earlier scaling and eight mixed-depth 4K evidence is unchanged.
- `verify-appearance.mjs` verifies the pure-black bar, 32px default, saved 16px height across reload, arbitrary 17px keyboard selection, four preset layouts/menu positions, current-key tooltips and the A=B cue. Home/resume preserves identical screenshot crops plus scene, mode and zoom; comparison keys are inactive on Home. Customized quit keys persist and suppress the old Q binding, while typing Q in search leaves the app open. Migration and pending-import/Home ordering have correctness tests. Add `--dev` for development or `--minimize` for a final real minimize check; restore through the OS before testing Q quit.
- Updated self-contained HTML supports searchable A/B selection across 100 images, keeps a bounded decoded working set, and loads without network requests or frontend errors. Desktop shortcut preferences remain local and are not embedded in exports.
- Reproduce additions with `scripts/verify-collections.mjs` against a diagnostics development app and `scripts/verify-release-ui.mjs` against the normal packaged app, both on local WebView2 debugging port 9223. The latter also supports `--dev` for development UI checks. The first script creates original, ignored test images; run it before the packaged test. Existing release and clipboard checks remain applicable.

The timing and memory tables below describe the earlier eight-source baseline. They were not remeasured for this UI release. Newly selected, nonresident images require loading; large collections do not extend the instant-switch claim to cold images. The resident set is capped at eight, and individual image limits still apply.

## Environment

- Windows x64, AMD Ryzen 9 9950X (16 cores / 32 logical processors), 32 GiB installed RAM.
- NVIDIA RTX 5070; WebView2 156.0.4314.58 / ANGLE D3D11; current display mode 2560×1440 at 60 Hz.
- Rust 1.99.1, checked-in npm and Cargo lockfiles. PNG benchmark uses the release profile and four workers.
- Background desktop applications were running. No cold-cache or isolated-machine claim is made.

## Measured performance

| Measurement | Result | Interpretation |
| --- | --- | --- |
| Four 2560×1440 RGBA8 PNGs, warm read + decode + RGBA expansion | Median 18.39 ms; p95 19.17 ms; max 22.03 ms; 50 samples after 5 warmups | Passes the <35 ms target on this generated corpus. Previous decoder measured 38.31 ms median. |
| Four 1440p PNG copies derived from user WEB-DL frames, warm read + decode | Median 30.44 ms; p95 31.38 ms; max 31.89 ms | Passes <35 ms on representative picture content. Originals unchanged; benchmark copies resized with Catmull-Rom. |
| Four 1440p deterministic-noise PNGs, warm read + decode | Median 8.96 ms; p95 10.18 ms; max 10.34 ms | Each is 14,748,233 bytes. Stored deflate blocks decode cheaply despite larger files. |
| Same files, compressed inputs already resident | Median 16.86 ms; p95 17.75 ms | Excludes disk reads and AYRI packing. |
| One 14,745,632-byte AYRI packet construction | Median 1.70 ms; p95 2.31 ms | Native allocation/copy; excludes transfer and GPU upload. |
| Raw Tauri binary round trip, optimized native diagnostics build | Median 74.60 ms; p95 76.20 ms with debugger attached | Includes owned-buffer copy and worker dispatch, excludes decode/upload. **Does not meet <5 ms.** |
| Same transfer with debugger detached throughout sampling | Median 65.90 ms; p95 68.40 ms; max 69.40 ms | Confirms the transfer shortfall is not just debugger instrumentation. |
| New Windows shared-buffer transfer, debugger detached | Median 4.20 ms; p95 4.50 ms; max 5.30 ms; 50 samples after 5 warmups | Includes worker copy, mapping and delivery; excludes decode/upload. Median/p95 pass <5 ms; maximum does not. One idle mapping is reused only after explicit script release. |
| Already-loaded source selection, batches of 1000 operations | Median 0.0004 ms per operation; p95 of batch averages 0.0006 ms | CPU state-update cost only; excludes DOM flush/render. These are not individual-input latency percentiles. |
| Native draw submission | p95 0.10 ms; max 0.20 ms | GPU completion/input-to-photon latency is not measured; many samples are below the 0.1 ms clock resolution. |
| 290 measured animation frame intervals | Median 16.7 ms; p95 16.8 ms; max 17.1 ms; zero intervals over 1.5× median | Stable at approximately 60 Hz. **No 240 Hz claim.** |

The PNG corpus is generated by `src-tauri/examples/fixtures.rs`: three gradient/quantization images plus a grain variant, compressed sizes 110,431 / 5,309,153 / 80,747 / 110,431 bytes. The benchmark separates read, decode, and packing. It is not a claim that every four PNG files meet the target.

`src-tauri/examples/benchmark_corpus.rs` adds noise and optionally four real-image PNG copies. The tested real corpus has compressed sizes 4,243,809 / 4,319,205 / 3,821,334 / 4,480,280 bytes. All runs use four workers, 5 warmups and 50 samples. The separate resident-input real decode stage measured 29.20 ms median / 41.10 ms p95, illustrating ordinary-machine timing variation; the read+decode stage's maximum was 31.89 ms. Personal inputs and generated PNGs remain ignored.

The legacy raw-response probe receives a real `ArrayBuffer` over `http://ipc.localhost`; its 65.90 ms median remains relevant to fallback runtimes. Windows now uses read-only shared buffers with the identical packet format. `scripts/benchmark-shared.mjs` times the request through receipt, then verifies every payload byte and detaches/releases the mapping outside the interval. The native side retains at most one idle mapping, capped at 32 MiB. This is a warm-transfer measurement, not a cold-allocation or worst-case latency guarantee. Source switching uses resident textures and does not repeat transfer.

## Correctness and integration evidence

- Previous baseline Windows executable: **8,336,384 bytes** (8.34 MB decimal), SHA-256 `802cc8a0bb0cad98892dc358d8d6b970ba70c357d829e706a18d892a6fbe09c6`. Built by `npm run desktop:build`, with measurement commands and development workspace hook verified absent. The current delivery is recorded above.
- Final packaged launch, real WEBP folder matrix (two sources/four scenes), identity and subsampled 10/12-bit AVIF worker imports, clipboard, maximize/restore, minimize and custom close all verified. The actual final comparison, split view and high-depth ramp were visually inspected. Production scene switching receives/releases shared mappings (6 received, 4 released, 2 resident); high-depth AVIF import receives four mappings without frontend errors.
- OS clipboard image matched **all 1,296,000 RGBA pixels** of the captured 1440×900 canvas, using a native clipboard reader and byte-for-byte comparison.

- 19 Rust tests: 15 library tests plus 4 subprocess AVIF tests. Includes palette/1/2/4-bit PNG, transparency, RGB/RGBA/grayscale-alpha16, CRC/truncation rejection, file matching, malformed AVIF isolation, every encoded sample in generated 10/12-bit AVIF ramps, and 18 Rec.709 YUV depth/subsampling/range combinations checked against known planes.
- 15 frontend tests, including asynchronous scene/reload ordering, missing slots, disposal, packet validation, coordinate invariants, shared-buffer lifetime/cancellation/errors, and old-runtime fallback.
- Actual native WebView2 smoke: source/GPU pixel equality, all shader modes, sparse and rapid scene changes, forced 8-bit GPU preview with exact 16-bit source retention, real scores, and atomic hot reload retaining mode/zoom/pan.
- Offline HTML: three scenes/four sources, explicit missing cell, mode interactions, zero HTTP requests with networking disabled.
- All four user-supplied odd/even WEBP pairs: 1920×1080, finite scores, correct source pixels. Over 24 scene changes, 48 textures created and 48 deleted, with two remaining active textures and no GL errors.
- Eight simultaneous 4K textures with mixed landscape/portrait dimensions and 8/16-bit depth: 398,131,200 source bytes, all slots render without GL error, low bits remain intact, then all frame and texture slots clear.
- Emulated 100/125/150/200% scaling inside WebView2: physical canvas size, cursor transforms, nearest pixels and synchronized split samples match. Physical mixed-DPI monitors still need testing.

## Memory observations

A fresh normal release launch importing the two-source 1080p user matrix, calculating its score, copying the comparison and maximizing/restoring the window was sampled for 20 seconds across Ayori and its six WebView2 descendants:

| Sampled peak | Bytes |
| --- | ---: |
| Aggregate private process memory | 573,001,728 |
| Aggregate working sets | 665,268,224 |
| Dedicated GPU memory | 227,856,384 |
| Shared GPU memory | 75,370,496 |

The last sample was 446,074,880 private bytes and 132,587,520 dedicated GPU bytes. This latest workload also navigates to another scene and back. Working sets can count shared pages more than once, including shared frame mappings; GPU counters include driver allocations. Sampling does not capture every transient peak. This includes background scoring and window-size changes and must not be equated to image-buffer sizes alone. Resource ownership is also tested independently by scene-change texture/mapping counts and full clearing of the eight-slot 4K workload.

## Reproduction tools

Generate the test corpus from the repository root, then run `cargo run --manifest-path src-tauri/Cargo.toml --release --example benchmark`. Set `NASM` to the ignored portable assembler location when it is not already on PATH.

The native scripts use the local WebView2 debugging port 9223. Close other Ayori instances first; set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223` only on the test process. `scripts/smoke-native.mjs --fixtures`, `scripts/verify-workflow.mjs`, `scripts/verify-scaling.mjs`, and `scripts/verify-large.mjs` use the development frontend. `scripts/verify-release.mjs` uses the bundled production frontend and verifies that development/measurement hooks are absent. `scripts/measure-memory.ps1` samples only Ayori and its descendant processes.

`cargo build --manifest-path src-tauri/Cargo.toml --release --features diagnostics` enables a fixed synthetic transfer buffer for the two benchmark scripts. Plain Cargo builds use the Vite frontend; start `npm run dev` separately. The feature is disabled in the normal `npm run desktop:build` output. The transfer scripts store measurement results only in ignored `local-fixtures/`.

The diagnostics build also supports `scripts/benchmark-shared.mjs` and `scripts/verify-transport.mjs`. The latter compares every byte against raw packets for PNG8/PNG16/AVIF10/AVIF12, checks re-upload and stale scene ownership, verifies script buffers detach on release, and checks native counts after disposal/navigation. Native smoke, workflows, the user WEBP pairs, scaling emulation, and eight-slot 4K checks also pass through the new transport. The final normal artifact was rebuilt and packaged checks passed afterward.

Final local checks: 19 Rust tests, 15 frontend tests, zero Svelte errors/warnings, strict all-feature/all-target Clippy, Rust formatting, and a clean production dependency audit. Windows implementation and available local validation are complete. External qualification below remains explicitly open.

## Remaining qualification

- Windows shared 14.7 MB transfer meets <5 ms at median/p95; the observed 5.30 ms maximum exceeds it. Legacy raw fallback remains slower. Linux transport performance is unverified.
- Real 240 Hz presentation, physical mixed-DPI monitors, and clean-machine WebView2 prerequisite checks need appropriate test hardware/environments.
- Linux AppImage build and runtime are deferred at the user's request until they are on Linux. This machine has no WSL/Linux installation, and the repository has no remote to run its existing Windows/Linux CI workflow.
- npm audit reports two low-severity development-only findings through deepmerge, with no published fix available in the current audit. Production audit reports zero findings.
- No numeric total CPU/GPU memory ceiling has been approved. Sampled memory and resource ownership evidence must not be presented as a guaranteed allocation ceiling.
