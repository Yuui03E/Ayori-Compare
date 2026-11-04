# Ayori

A Windows-first desktop image comparison tool for anime encoders. Built with Tauri 2, Rust, Svelte 5, and WebGL2.

Open individual images to compare alternatives of one frame, or one folder per release/encoding group to match scenes by filename or frame number. Collections can contain 100+ images or sources; selected and nearby images load as you browse. Click either source name or **Search** (`Ctrl+K`) to assign A/B, and **+ → Add sources** to extend a comparison.

A pure-black top bar keeps A/B, inspection modes, scenes and zoom close at hand. Hover or focus a control for compact details and its current shortcut. **View options** contains zoom presets, filtering, effect strength and offline HTML export. Source metadata and scores appear on hover instead of covering the image. Adjust the height from **16–44px** in **Help → Interface**; the default is 32px. The black canvas surround retains explicit missing-frame and transparency patterns.

**Help & shortcuts** (`F1` or `Ctrl+,`) starts with 12 essential actions, led by flicker, fit/100%, loupe and comparison modes. Search any action or choose **Show more shortcuts** for optional bindings. Every assignment is editable with conflict checking and automatic local saving; existing custom assignments are preserved. **Using & comparing** covers imports, navigation, sharing, frame alignment, detail, banding and interpreting scores. A compact App row links to the editable window commands: **Q** quits, **Ctrl+M** minimizes, **F10** maximizes/restores, and **Alt+Home** opens Home. These shortcuts do not run while typing or using a dialog. Home keeps the comparison ready to resume with the same scene, sources, mode, pan and zoom. Existing custom assignments are preserved when new defaults are added.

- [Current implementation status and resume point](docs/PROGRESS.md)
- [Approved requirements and execution plan](docs/requirements_review_and_execution_plan.md)
- [Original product requirements](docs/product_requirements_document_prd.md)
- [Release checks, benchmarks, and remaining qualification](docs/RELEASE_VALIDATION.md)

Double right click the image to jump to **200%** at the pointer; repeat to restore your previous zoom and pan. Choose any target from **1–12800%**, or disable the gesture, in **Help → Interface**. Right hold or drag still opens the dual loupe. Offline exports include the same gesture with a session-specific target.

Mixed resolutions fill a shared area using the largest scene width and height: 720p and 1080p both occupy a 1920×1080 area at 100%. Auto uses nearest sampling at 100% and above, and smooth filtering below; Bilinear is available in View options. Originals and exact source readout stay unchanged. Different aspect ratios stretch to fit, so match framing/crop before judging quality. Display scaling is not bicubic; SSIMULACRA2 separately resizes source 1 to each candidate using Catmull–Rom.

## Development

Requires Node.js 22.12+ (or a compatible newer release), Rust 1.98+, NASM 2.14+, Windows C++ Build Tools and WebView2. On Linux, install NASM and Tauri's WebKitGTK 4.1 development prerequisites. Rust 1.98 is required by the native AVIF decoder; the application uses edition 2024.

```sh
npm ci
npm run desktop
```

```sh
npm run check
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run desktop:build
```

The portable Windows executable is built under `src-tauri/target/release/`. WebView2 is a runtime prerequisite. Build a Linux AppImage on a Linux host using `npm run tauri -- build --bundles appimage`.

Progress and measured limitations are recorded after each step in `docs/PROGRESS.md`.
