# Implementation progress

This is the current handoff record. Read it before making changes and update it after every completed step.

## Current position

- Updated: 2026-11-04 (Asia/Dhaka).
- Branch: `feat/desktop-app`.
- Requirements review approved by the user. Implementation is in progress.
- Baseline commits: `65a3f49` (original specifications), `ae8aa12` (requirements review).
- Confirmed: sparse scenes shared by at least two folders; labeled 8-bit fallback with exact source readout.

## Milestones

| Step | Status | Evidence / next work |
| --- | --- | --- |
| 0. Requirements and Git | Complete | Both source documents reviewed, decisions recorded, repository initialized. |
| 1. Foundation | Development shell verified | Svelte checks/build and Cargo debug build pass; native WebView2 window launches; maximize and close verified. Final production launch remains a release check. |
| 2. Renderer and precision proof | Correctness verified; performance work remains | Actual WebView2 pixels, 16-bit source data, and forced fallback pass. Decode target not yet met; isolated IPC/240 Hz evidence pending. |
| 3. Comparison workspace | Implemented and smoke-verified | Real folder/file decoding, sparse matching, ambiguity tests and rapid scene changes pass. |
| 4. Inspection tools | Implemented and smoke-verified | All modes render without GL errors; identity differences, flicker, HUD lock, and pixel readout pass. Broader mixed-DPI hardware coverage remains. |
| 5. UI and live analysis | Implemented and smoke-verified | UI visually inspected; real SSIMULACRA2 scores and atomic file hot reload preserve view state. |
| 6. Sharing and release | Sharing verified; release checks in progress | Clipboard copy and offline HTML pass. Windows size tuning/final launch underway. Linux build workflow added but not executed. |

## Completed steps

### 2026-11-04 — Start implementation record

- Added this persistent progress record and repository instructions requiring updates after each step.
- Verified a clean baseline and created the implementation branch.
- No application build has been verified yet.

## Resume here

Complete the final Windows build/launch checks and record its size. Then focus on performance targets, mixed-resolution/DPI coverage, and Linux validation. The application and all core features already exist; do not restart scaffolding or reimplement the renderer, decoder, matching, watcher, metrics, or exporter.

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
