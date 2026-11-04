# Ayori

![Ayori Facet icon](src-tauri/icons/128x128.png)

A free, open-source desktop image comparison tool for anime encoders and anyone inspecting differences between images. Built with Tauri 2, Rust, Svelte 5 and WebGL2. Windows is the primary platform; Linux builds are supported, with runtime qualification still pending.

## Features

- Compare individual PNG, WebP, AVIF and JPEG images, or match frames across folders from different releases and encoding groups.
- Browse 100+ images or sources with searchable A/B selection and explicit missing-frame indicators. Selected and nearby images load on demand; eight images may be resident at once, rather than limiting imports to eight.
- Inspect flicker, curtains, synchronized split views, differences, banding, luma and chroma, with a dual loupe and exact source pixel readout.
- Compare high-depth PNG/AVIF sources. Reduced-precision previews are labeled, while readout retains the original decoded samples.
- See regenerated frames update in place, copy the comparison as PNG, or export a self-contained offline HTML viewer.
- Customize shortcuts, hover help and a pure-black top bar from 16–44px high.

## Using Ayori

Open individual images as alternatives of one scene, or one folder per release/encoding group to match scenes by filename or frame number. Click either source name or **Search** (`Ctrl+K`) to assign A/B. Use **+ → Add sources** to extend the comparison. Ayori accepts extracted images; it does not decode video files or discs directly.

Hover or focus controls for compact explanations, metadata and current shortcuts. **View options** contains zoom presets, filtering, effect strength and offline export. **Help & shortcuts** (`F1` or `Ctrl+,`) starts with essential actions; optional bindings are searchable and every assignment is editable. Its **Using & comparing** guide covers alignment, detail, banding and interpreting scores.

Default app shortcuts are **Q** to quit, **Ctrl+M** to minimize, **F10** to maximize/restore and **Alt+Home** to return Home. Home preserves the comparison for resuming. App shortcuts stay inactive while typing or using a dialog.

Double right click to zoom to **200%** at the pointer; repeat to restore the previous zoom and pan. Set a target from **1–12800%**, or disable the gesture, in **Help → Interface**. Right hold or drag opens the dual loupe. Offline exports support the same zoom gesture.

### Comparing different resolutions

Images fill a shared area using the largest scene width and height: 720p and 1080p images both occupy a 1920×1080 area at 100%. Auto uses nearest sampling at 100% and above, and smooth filtering below; Bilinear is also available. Originals and exact source readout stay unchanged. Different aspect ratios stretch to fit, so match framing and crop before judging quality. Display scaling is not bicubic; SSIMULACRA2 separately resizes source 1 to each candidate using Catmull–Rom.

Large collections load as you browse, and offline export size grows with the included images. See [release validation](docs/RELEASE_VALIDATION.md) for measured performance, precision caveats and remaining platform checks.

## Development

Requires Node.js 22.12+ (or a compatible newer release), Rust 1.98+, NASM 2.14+, Windows C++ Build Tools and WebView2. On Linux, install NASM and Tauri's WebKitGTK 4.1 development prerequisites. Rust 1.98 is required by the native AVIF decoder; the application uses edition 2024.

```sh
npm ci
npm run desktop
```

To verify and build a portable release:

```sh
npm run build
npm test
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run desktop:build
```

Run the frontend build before direct Cargo checks because Rust embeds the offline viewer. NASM must be on PATH or provided through the `NASM` environment variable. The desktop launcher also recognizes an optional local `.tools/nasm-3.02/nasm.exe`.

The portable Windows executable is **`releases/Ayori.exe`**. The build copies it from Cargo's output and verifies the SHA-256 matches; `node scripts/prepare-portable.mjs` can prepare this copy from an existing build. WebView2 is a runtime prerequisite. Build a Linux AppImage on a Linux host using `npm run tauri -- build --bundles appimage`.

Generated executables belong in GitHub Releases, not the source repository. Dependencies, build output, private frames and local tools are ignored. Install dependencies again with `npm ci` after cleaning them. GitHub Actions builds and checks Windows and Linux; published validation records distinguish local results from checks that need other environments.

## Project layout

| Path                 | Contents                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| `src/`               | Svelte interface, WebGL renderer, offline viewer and frontend tests        |
| `src-tauri/`         | Rust backend, native configuration, icons and small licensed test fixtures |
| `scripts/`           | Build helpers, native verification and benchmarks                          |
| `docs/`              | Requirements, implementation decisions, branding and validation records    |
| `.github/workflows/` | Automated build and verification                                           |

## Contributing and license

Forks, improvements and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks and contribution guidance. Ayori is licensed under [MIT](LICENSE); third-party fixtures retain their own license notices.

- [Development scripts and native checks](scripts/README.md)
- [Brand artwork and icon generation](docs/BRANDING.md)
- [Current implementation status](docs/PROGRESS.md)
- [Approved requirements and execution plan](docs/requirements_review_and_execution_plan.md)
- [Original product requirements](docs/product_requirements_document_prd.md)
