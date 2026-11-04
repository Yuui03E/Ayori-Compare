<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Ayori logo" width="72" height="72">
</p>

<h1 align="center">Ayori</h1>

<p align="center">Precise image comparison for encoders and detail-focused workflows.</p>

<p align="center"><strong>Windows · PNG · WebP · AVIF · JPEG · MIT</strong></p>

![Ayori's compact black interface comparing reference and quantized samples with a vertical curtain](docs/images/ayori-comparison.png)

<p align="center"><sub>The built-in sample: reference on the left, quantized on the right.</sub></p>

## Features

- **Compare your way.** Flicker, curtains, synchronized split views, difference maps, banding, luma and chroma inspection.
- **Inspect exact samples.** High-depth PNG/AVIF support, source pixel readout, a dual loupe and configurable double-right-click zoom.
- **Browse large collections.** Compare 100+ images or match scenes across release folders, with searchable A/B selection and explicit missing frames.
- **Share the result.** Copy a PNG or export a self-contained HTML comparison that works offline. Modified source files reload in place.
- **Make it yours.** Editable shortcuts, contextual help and a pure-black toolbar adjustable from 16–44px.

## Getting started

1. Open individual images to compare alternatives of one frame, or folders to match scenes by filename or frame number.
2. Choose sources **A** and **B**, then select a comparison mode. Use **+ → Add sources** to extend the collection.
3. Press **F1** for essential shortcuts and the comparison guide. Double right click to zoom in; repeat to restore your previous view.

Try **Explore a sample comparison** on the home screen without importing files.

Images with different resolutions fill a shared comparison area; different aspect ratios stretch to fit. Match framing before judging quality. Original samples remain unchanged, and reduced-precision previews are labeled. See [comparison notes](docs/COMPARISON.md) for scaling and score details.

## Build from source

Requires **Node.js 22.12+**, **Rust 1.98+** and **NASM 2.14+**. Windows also needs C++ Build Tools and WebView2. Follow the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform, and make NASM available on PATH or through the `NASM` environment variable.

```sh
npm ci
npm run desktop
```

Build the portable Windows app:

```sh
npm run desktop:build
```

Output: **`releases/Ayori.exe`**. WebView2 is required to run it.

Windows is the primary tested platform. Linux AppImage builds are available via `npm run tauri -- build --bundles appimage` on Linux; Linux runtime validation is pending.

## Contributing

Bug reports, improvements and forks are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for development checks and contribution guidelines.

Built with Tauri 2, Rust, Svelte 5 and WebGL2. See [validation results](docs/RELEASE_VALIDATION.md) and [development progress](docs/PROGRESS.md) for measured performance and current limitations.

## License

[MIT](LICENSE). Third-party test fixtures retain their accompanying license notices.
