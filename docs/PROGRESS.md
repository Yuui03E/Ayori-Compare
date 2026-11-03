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
| 2. Renderer and precision proof | In progress | Decoder and AYRI source-precision tests pass. Renderer implemented; actual WebView2 rendering and measurements pending. |
| 3. Comparison workspace | In progress | Matching and ambiguity tests pass; frontend integration pending. |
| 4. Inspection tools | Pending | Modes, loupe, grid, exact readout, complete shortcuts. |
| 5. UI and live analysis | Pending | HUD, metadata, metrics, watcher, stale-result protection. |
| 6. Sharing and release | Pending | Clipboard, offline HTML, builds, correctness and performance checks. |

## Completed steps

### 2026-11-04 — Start implementation record

- Added this persistent progress record and repository instructions requiring updates after each step.
- Verified a clean baseline and created the implementation branch.
- No application build has been verified yet.

## Resume here

Implement and verify real decoding and the WebGL pipeline. See the approved review for acceptance criteria and unresolved engineering details. Do not infer completed work from the presence of a file alone.

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
