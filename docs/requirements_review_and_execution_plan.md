# Ayori Compare: requirements review and execution plan

Reviewed: 2026-11-04 (Asia/Dhaka).

Status: requirements review complete; application implementation has not started. This document records the product understanding, confirmed clarifications, engineering gaps, and proposed delivery sequence. It supplements the original documents without rewriting them. Recommendations below are not additional user-approved requirements.

## 1. Source documents and precedence

- [Product Requirements Document, version 2.0.0](product_requirements_document_prd.md): product behavior, interactions, visual design, and performance targets.
- [Master Architecture & Execution Roadmap](master_architecture_execution_roadmap.md): intended architecture, protocol, dependencies, examples, and initial four-phase plan.
- The user's decisions in this conversation take precedence over conflicting examples or ambiguous wording in either document.

Both source documents were read in full. Their code examples need validation before implementation; the roadmap's description of them as verified is not evidence of a successful build or benchmark.

## 2. What we are building

Ayori Compare is a Windows-first desktop image comparison and pixel inspection tool for anime encoders and filter developers. It helps users see grain loss, ringing, halos, banding, line shifts, chroma bleeding, and compression artifacts across alternative encodes or processing pipelines. Linux x64 AppImage is the secondary delivery target.

The central workflow is:

1. Drop source folders containing corresponding extracted video frames, or individual images for one comparison.
2. Navigate a matrix whose rows are scenes/frames and whose columns are sources/encodes.
3. Compare sources instantly while keeping the same visual position, magnification, and comparison settings.
4. Inspect exact source samples and use specialized comparison modes to expose subtle differences.
5. Regenerate a frame externally and see it update in place.
6. Copy the current comparison image or share the complete comparison as an offline HTML file.

The product has two equally central qualities: trustworthy image inspection and immediate interaction. The dark, full-window canvas with floating glass controls supports those goals.

The specified inputs are image files. Direct video decoding, frame extraction, executing VapourSynth scripts, encoding video, cloud uploads, accounts, and hosted collaboration are not specified features. A source label containing `.vpy` does not establish script execution as a requirement. Session persistence and source renaming/reordering are also not defined in the current documents.

## 3. Requirements inventory

| Area | Required behavior | Source |
| --- | --- | --- |
| Identity and platforms | Ayori Compare; `com.ayori.compare`; Windows 10/11 x64 primary, Linux x64 AppImage secondary. | PRD opening |
| Folder ingestion | Drop 2–8 folders; scan non-recursively for PNG, WebP, AVIF, JPG/JPEG. Match lowercase stems first, then trailing integer frame numbers normalized as `u64`. | PRD 3.1 |
| Matrix | Multiple scene rows and 2–8 source columns. Exclude and report frames found in only one folder. Keep qualifying rows with missing cells, per the user clarification below. | PRD 3.1; user decision |
| Individual files | Drop 2–8 images to create one scene, naturally sorted by filename. | PRD 3.1 |
| Append | Alt-drop adds a source column to the existing workspace instead of replacing it. The eight-column limit still applies. | PRD 3.1 |
| Hot reload | Watch active-scene files; debounce writes by 150 ms; reload the changed source without resetting zoom, pan, or mode. | PRD 3.1 |
| Alignment | Base scene width and height are the independent maxima across available sources. Normalize source UV coordinates for corner-to-corner alignment. | PRD 3.2 |
| Physical zoom | At 100%, one base-canvas pixel occupies one physical display pixel, including 125%, 150%, and 200% desktop scaling. Wheel zoom uses cursor-centered 1.25× steps. | PRD 3.2, 5 |
| Filtering | Default to filtered minification below 100% and nearest-neighbor sampling at or above 100%; provide a manual nearest/bilinear override. | PRD 3.2 |
| Instant swap | Select sources with 1–8; Space alternates the current and previous primary sources. | PRD 3.3, 5 |
| Curtain | Vertical, horizontal, and four-quadrant comparison controlled by the cursor. | PRD 3.3 |
| Split | Side-by-side A/B views of the same image region with synchronized pan/zoom and a two-physical-pixel divider. | PRD 3.3 |
| Difference | Absolute RGB difference with gain 1–50; alternate luma-error heatmap. | PRD 3.3 |
| Banding/planes | Contour amplification with frequency 8–64; shadow boost; Rec.709 luma; chroma deviation view. | PRD 3.3 |
| Loupe | Hold Shift or right mouse button for a 140-physical-pixel-radius split A/B circular lens, using nearest sampling and 8× magnification. | PRD 3.4 |
| Pixel readout | G toggles grid/readout; grid appears at 800% and above. Show coordinates, RGB8, 10-bit equivalent, and HEX for both sources. Exact readout must come from source samples, including on an 8-bit-preview device. | PRD 3.4; user decision |
| Window and HUD | Frameless obsidian window, 32 px top drag region, native minimize/maximize/close, floating source bar, mode dock, scene/zoom controls, expandable scene drawer. | PRD 4 |
| HUD visibility | Fade after 2500 ms of pointer inactivity outside controls, over 250 ms; restore on movement/keypress. H locks the HUD hidden until toggled again. | PRD 4 |
| Source selection | Primary A uses cyan; secondary B uses amber. Select B using Alt+1–8 or a source-pill right click. Display dimensions, bit depth, disk size, and background SSIMULACRA2 scores. | PRD 4 |
| Metrics | Score against source slot 0; reuse reference preprocessing. For differing resolutions, the roadmap calls for Catmull-Rom resizing of the reference to the candidate size. | Architecture 6 |
| Sharing | Ctrl+C / Copy PNG copies the comparison canvas as a lossless image; Ctrl+E / Export HTML produces one self-contained offline file containing the matrix. | PRD 4–5 |

The full shortcut table in PRD section 5 remains the input specification: source arrows, scene arrows/brackets, M/S/D/F/B modes, Z/0 fit toggle, G grid, H hide, Shift/right-button loupe, pan gestures, and export shortcuts. Mode cycling must retain its defined ordering.

## 4. Confirmed clarifications

The user explicitly selected these behaviors on 2026-11-04:

1. **Keep scenes present in at least two folders.** Missing sources are visible missing slots, not grounds for discarding an otherwise useful comparison row. The data model needs an explicit missing-cell representation. Rendering must not leave the previous scene's texture visible in a missing slot.
2. **Allow a clearly labeled 8-bit preview if native 16-bit texture support is unavailable, while retaining exact source values for readout.** Display precision and source precision must be represented separately. Differences and inspection effects derived from reduced-precision preview textures must not be described as full-precision analysis.

These decisions supersede any implication that all scenes are complete or that a silent 16-to-8-bit conversion still satisfies full-precision inspection.

### Subsequent user decisions — 2026-11-04

- Remove the eight-image/source product restriction and support large collections such as 100 images or many release/encoding-group folders. The user delegated the import organization choice: individual files remain alternatives of one scene; folders preserve the existing matched-scene workflow. No automatic pairing of unrelated loose files is inferred.
- Add more keyboard actions and a user-editable shortcut interface, with saved assignments and descriptive hover help on controls.
- Preserve the current typography and dark styling while making the UI richer, more attractive and more informative. A searchable source browser, explicit A/B metadata, visible mode labels, source/image counts, import guidance and dedicated settings implement this direction.
- Eight remains an internal limit on resident comparison images, not an import limit. Large collections prepare newly selected images on demand; the original immediate-switch target applies to already-loaded sources. Physical hardware and Linux qualification remain as recorded in `PROGRESS.md`.

## 5. Architecture we will carry forward

The intended stack is Tauri v2, Rust 2024 with MSRV at least 1.89, Svelte 5 runes, TypeScript, Tailwind CSS v4, and WebGL2 / GLSL ES 3.00. Exact compatible dependency versions and APIs will be verified during the foundation stage and captured in lockfiles.

Rust owns file discovery, deterministic scene matching, parallel image decoding, source metadata, original sample data needed for readout, file watching, metrics, and HTML generation. Svelte owns workspace state and controls. The WebGL renderer owns texture resources, transforms, filtering, and inspection rendering. Heavy decoding and scoring must run away from the UI interaction path.

Metadata crosses the Tauri boundary as structured data. Frames use the roadmap's 32-byte little-endian `AYRI` header followed by tightly packed RGBA8 or RGBA16 samples:

| Byte offset | Field |
| --- | --- |
| 0 | Magic `0x49525941` (`AYRI`) |
| 4 | Width, `u32` |
| 8 | Height, `u32` |
| 12 | Payload depth, 8 or 16 |
| 16 | Channel count, always 4 |
| 20 | Compressed file size, `u32` |
| 24 | Original source bit depth |
| 28 | Reserved zero |
| 32 onward | RGBA samples; 16-bit samples are little-endian |

The header needs validation on both sides: minimum packet length, magic, dimensions, supported depth/channels, expected payload length, arithmetic overflow, and GPU limits. The offset permits aligned typed-array views; it does not establish an end-to-end zero-copy pipeline or guarantee SIMD alignment of a Rust allocation.

Only the active scene's available source textures should remain resident. Keep fixed slot ownership, clear unavailable slots, release superseded resources, and dispose resources/listeners on teardown. Any CPU cache for exact readout or metrics also needs an explicit lifetime and memory budget.

Retain the architecture's useful safeguards: optimized decoder/metric dependencies during development, Tauri v2 capabilities, a Svelte rune-state singleton class, duplicate-drop protection, and explicit shader sampling of texture units 0–7.

## 6. Conflicts and gaps to resolve during implementation

These are findings from the supplied documents, not results of compiling or running the proposed app.

| Finding | Why it matters | Proposed handling |
| --- | --- | --- |
| PRD/architecture say Rust 2024; the Cargo example says `edition = "2021"` and omits `rust-version`. | Copying the example would violate the stated stack. | Use 2024 and an explicit compatible MSRV; verify dependencies against it. |
| Dependency versions are ranges, and API examples have no accompanying build evidence. | The manifests cannot be treated as a reproducible, tested application. | Verify crate APIs/features, including AVIF decoding, and commit npm/Cargo lockfiles. |
| The fallback decoder always calls `to_rgba8()` and reports original depth as 8. | High-bit-depth AVIF could lose precision and have incorrect metadata. | Preserve actual source metadata; define supported decode precision per format before claiming high-bit-depth support. |
| PNG alpha insertion alone does not establish a four-channel result for every PNG color type. | Grayscale, grayscale-alpha, palette, and low-bit-depth PNGs need correct expansion and metadata. | Verify decoder output for each supported type and normalize explicitly to RGBA. |
| The packet casts file length to `u32`. | Files larger than the field can represent would get incorrect metadata. | Detect overflow explicitly; reject clearly or deliberately version the protocol if larger files become necessary. |
| Native 16-bit GPU sampling is not the same as a 16-bit monitor output path. | The app must distinguish original values, computation precision, and display precision. | Implement the confirmed labeled-preview behavior; validate extension support at runtime and read exact values from original data. |
| Color handling is largely unspecified despite the accuracy requirement. | ICC/gamma metadata, encoded versus linear RGB, alpha, and HDR affect display, differences, and scores. | Define a documented SDR policy, source-value readout semantics, and comparison working space before accuracy sign-off. Do not imply HDR support. |
| PRD says delete textures on scene change; roadmap says overwrite/reuse them. | Both address memory ownership, but neither specifies missing slots, pending loads, or peak allocation. | Reuse fixed slot identities where suitable; explicitly release unused resources and check stable memory over repeated changes. |
| There is no numeric CPU/VRAM ceiling. | Eight 4K RGBA8 images already use about 253 MiB of base texture data; RGBA16 uses about 506 MiB, before mipmaps, copies, and metrics. | Agree memory budgets from representative workloads; cap concurrency/cache sizes and measure transient peaks. |
| The metric prose requires resizing, but the sample returns `None` on size mismatch. | Mixed-resolution scores would be absent despite the stated requirement. | Resize the reference as specified; cache preprocessing per target resolution and label resampled scores. Verify the scoring input color/depth policy. |
| Heatmap sample does not implement its claimed palette. | At zero error it produces a blue tint, and at maximum it tends toward red rather than the stated white endpoint. | Use a defined ramp with checked endpoints; choose and document whether luma error means absolute luma difference or weighted absolute RGB error. |
| Loupe/grid math uses base dimensions for all images; loupe samples through the ordinary texture filter. | Different-sized sources have different texel centers. The loupe can blur under linear filtering. | Use per-source dimensions and explicit nearest sampling for the lens/readout. Verify grid behavior separately for each source resolution. |
| Split view and loupe use different coordinate paths in the example. | A lens in the right split panel can inspect a different location from the underlying view. | Share tested screen-to-source transforms across split, zoom, loupe, and readout. |
| Four-way PRD describes slots 0–3; shader uses selectable A/B/C/D. | Quadrant assignment and behavior with fewer than four available sources are undefined. | Recommend fixed slots 0–3 in documented order, with explicit missing markers. Keep this separate from ordinary A/B selection. |
| The ingestion subsection says append/replace, but specifies only append. | Replacement target, mixed file/folder drops, duplicate frame IDs, and Alt-file append into multiple scenes are undefined. | Define these before matrix interaction work; preserve exact-match precedence and never silently choose between ambiguous candidates. |
| Normalized corner-to-corner alignment assumes compatible framing. | Different aspect ratios or crops can distort comparison; 100% refers to base pixels, not every source's native pixels. | Make the existing normalization behavior explicit and decide how to flag aspect-ratio differences. |
| Curtain panning, source-pill right click, and canvas right-button loupe overlap. | Context and focus determine which action should run. | Define canvas/HUD event boundaries; suppress global shortcuts in editable controls and reset held keys on lost focus. |
| A global 250 ms drop timestamp guard may also reject distinct intentional drops. | Duplicate suppression needs to preserve legitimate ingestion. | Keep the documented guard initially and verify behavior with actual Windows events; refine using drop identity if necessary. |
| A 150 ms watcher delay does not ensure a rewrite has finished. | Partial writes, atomic replacement, file deletion, and late loads can produce corruption or stale images. | Retry incomplete writes within bounds, account for replacement events, and identify loads/scores by workspace, scene, and source generation. |
| HTML export is named but its viewer behavior is not specified. | Full matrix sharing, mode support, precision, size, and browser compatibility affect implementation substantially. | Recommend embedded assets plus scene/source navigation, pan/zoom, and core comparison modes; document browser/precision limits and avoid runtime network dependencies. Finalize the export contract before building it. |
| A portable executable and installer/AppImage targets are mixed together. | WebView2 is a runtime dependency; a small executable does not imply a runtime-free package. | Measure the Windows executable separately, document runtime prerequisites, and build/test Windows and Linux artifacts on appropriate hosts. |

The current `csp: null` and broad example permissions also need normal configuration review when implementing export and file commands; copying them verbatim is not a completed application configuration.

## 7. Performance targets and evidence

The PRD's numbers remain targets. They have not been measured or guaranteed by this review.

| Target | Evidence needed |
| --- | --- |
| Windows executable smaller than 10 MB | Actual optimized executable size, with runtime/installers and embedded dependencies accounted for separately. |
| Source switching below 0.5 ms; zero dropped frames at 240 Hz | Already-loaded source-switch processing measurements plus render/frame-pacing measurements on a defined machine. Input-to-photon latency is a separate quantity. |
| Four 2560×1440 8-bit PNG decodes below 35 ms | Defined frame corpus, CPU, thread count, build profile, and cold/warm filesystem conditions; distinguish read, decode, and RGBA packing time. |
| Transfer of one approximately 14.7 MB RGBA8 frame below 5 ms | Measured Tauri transfer time with warm-up and repeat samples, distinguished from decode and GPU upload. |
| Exact 8/16-bit inspection | Known-value fixtures through decode, packet, upload, and source readout; visibly labeled precision fallback where applicable. |
| Deterministic memory release | Repeated scene changes, changes in dimensions/depth, missing slots, hot reload, and teardown without accumulating textures or CPU buffers. |

Use percentiles and worst observed stalls as well as averages. Metrics, watcher work, and HUD updates must not compromise source switching. Do not optimize away required precision or silently drop formats to meet size/speed targets.

## 8. Proposed delivery sequence

This retains the roadmap's foundation → renderer → ingestion → product features structure, adds an early correctness/performance check, and separates its large final phase into reviewable milestones. All specified features remain in scope for the completed application.

| Milestone | Deliverable | Completion evidence |
| --- | --- | --- |
| 0. Requirements and version control | Original specifications preserved, this review, confirmed decisions, local Git repository. | Review available; no application code introduced. |
| 1. Foundation | Validate dependencies; scaffold Tauri/Svelte/TypeScript/Tailwind; frameless window and native controls; lockfiles and development checks. | Windows development app and production build launch; controls work; chosen versions/MSRV recorded. |
| 2. Renderer and precision proof | Eight-slot WebGL renderer, procedural fixtures, physical-pixel transforms, nearest/linear behavior, one real Rust-decoded frame through AYRI, 8/16-bit support/fallback. | Known pixels survive the pipeline; DPI and mixed-resolution transforms verified; initial decode/transfer/upload/memory measurements recorded. This gate precedes substantial HUD work. |
| 3. Usable comparison workspace | Folder/file import, deterministic two-pass matching, sparse scenes, append rules, all supported formats, scene/source navigation and A/B swapping. | Real multi-folder sets behave correctly; ambiguous and malformed input is handled clearly; rapid scene changes cannot display stale data. |
| 4. Inspection tools | Curtain/quadrants, split, RGB/heatmap differences, four banding/plane modes, split loupe, grid/readout, complete keyboard/mouse behavior. | Synthetic gradients, checkerboards, and known differences demonstrate correctness at multiple resolutions, zooms, and DPI settings. |
| 5. Product UI and live analysis | Full floating HUD, metadata, scene drawer, hide behavior, background SSIMULACRA2, file watching and replacement. | Real encoder iteration preserves view state; scoring and reload remain responsive and do not reuse stale results. |
| 6. Sharing and release | Clipboard image, offline HTML viewer, performance tuning, portable Windows artifact, Linux AppImage validation. | Clipboard image checked for lossless pixel fidelity; HTML works offline with the matrix; clean-machine runtime/build checks and benchmark results recorded. |

Each milestone should end with a runnable result, appropriate checks, and a focused Git checkpoint. Use generated or redistributable fixtures for known pixels, 8/16-bit ramps, grain, edges, alpha, aspect-ratio differences, and corrupt/truncated input. Keep personal or large anime frame collections outside tracked source.

The initial technical checks should cover the highest-cost assumptions early: dependency compatibility, real WebView2 binary transfer behavior, normalized 16-bit texture support, exact readout, release size, and decoding speed. A failure should lead to a documented adjustment rather than allowing the assumption to survive until packaging.

## 9. Git workflow and current environment

- The folder initially contained only the two Markdown specifications and was not a Git repository.
- Git is now initialized with `main`; the original documents have their own baseline commit.
- This review and a focused `.gitignore` are the next documentation checkpoint.
- Future implementation should use short-lived feature branches with focused commits and validation before integration. Use milestone tags when milestones actually pass.
- Track application source, tests, redistributable fixtures, documentation, `package-lock.json`, and `Cargo.lock`. Ignore dependency folders, build products, environment secrets, and designated personal frame/export folders.
- Check status/diffs before and after changes; preserve unrelated edits and existing history. Record behavior changes and test evidence with the corresponding milestone.
- There is no configured remote. History is currently local; remote hosting/backup can be added once its destination is chosen.

Read-only environment checks found Git 2.56.0, Node 26.13.0, npm 11.20.0, Rust 1.99.1, Cargo 1.99.1, and an installed Visual Studio Build Tools location with the C++ x64/x86 component. These are discovery results, not proof that the exact dependency set builds, that the minimum Rust version is supported, or that WebView2/GPU/Linux runtime checks pass.

## 10. Next implementation boundary

The next implementation milestone is the foundation plus an early precision/performance proof. Before decisions affect visible behavior, resolve the remaining color/alpha policy, ambiguous ingestion interactions, quadrant assignment, and offline export contract using this review. No source application, dependencies, sample assets, or runtime behavior were created during the requirements review.

## Subsequent user decision — compact controls and focused help

The user approved the typography and general styling, then requested less empty space, a single slim top row, compact hover information, essential shortcuts before optional commands, and help for both operating the app and comparing images. This supersedes the earlier large A/B cards and floating control islands. Retain editable saved assignments and large-collection import behavior while presenting only essential bindings initially. The new UI must remain usable at the 960×600 minimum window size.

## Subsequent user decision — adjustable pure-black bar, Home and window keys

The user requested a configurable 16–44px top bar, pure-black styling, the visible name **Ayori**, Q to close, shortcuts for minimizing/maximizing and a way to return Home. Implementation uses a 32px default with saved integer height and presets, preserves a resumable comparison on Home, and exposes four editable app commands without overwhelming the essential comparison list. Existing saved shortcuts must migrate without key theft or resets. Retain comparison precision and explicit missing/alpha information while simplifying secondary labels at the smallest sizes.

## Subsequent user decision — reversible right-click zoom

The user requested an explanation of mixed-resolution comparison and a double-right-click zoom gesture with a user-chosen target and a second double click restoring the previous view. Default to 200%, preserve click anchoring and prior pan, retain held/dragged loupe, expose a saved target and enable switch, and include the gesture in offline exports. Existing normalized alignment and preview/metric resampling algorithms remain unchanged; document their actual behavior.

## Subsequent user decision — Facet identity

The user chose logo concept A / Facet. Apply its approved mint/white/green asymmetric A to the title bar, Home, favicons and native app icons, with the same identity in offline exports. Preserve existing typography, pure-black styling and compact layout. The original concept studies remain a design record.
