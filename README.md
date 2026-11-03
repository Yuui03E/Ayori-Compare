# Ayori Compare

A Windows-first desktop image comparison tool for anime encoders. Built with Tauri 2, Rust, Svelte 5, and WebGL2.

- [Current implementation status and resume point](docs/PROGRESS.md)
- [Approved requirements and execution plan](docs/requirements_review_and_execution_plan.md)
- [Original product requirements](docs/product_requirements_document_prd.md)

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
