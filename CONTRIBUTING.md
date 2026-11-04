# Contributing to Ayori

Bug reports, fixes, comparison tools and interface improvements are welcome. Use GitHub issues to describe the problem or proposed behavior, and send a focused pull request with the relevant checks.

For bugs, include the operating system, display scaling, image formats and steps to reproduce. Use generated or redistributable examples; do not upload private frames or copyrighted source collections without permission.

## Set up

Follow the prerequisites and commands in [README.md](README.md). Install dependencies with `npm ci`, then use `npm run desktop` for the native development app. Keep `package-lock.json` and `src-tauri/Cargo.lock` checked in.

Before submitting:

```sh
npm run build
npm test
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-features --all-targets --locked -- -D warnings
```

Run the frontend build before direct Cargo commands: Rust embeds `dist/offline.js`. NASM must be on PATH or set through the `NASM` environment variable. The desktop launcher also recognizes an optional local `.tools/nasm-3.02/nasm.exe`.

## Correctness and scope

- Preserve original decoded precision for source readout, and label any reduced-precision preview.
- Represent missing frames explicitly. Keep file work, decoding and metrics off the UI thread, and reject stale results after navigation.
- Add meaningful tests for changed behavior. Visually verify UI changes in the native application where possible.
- Keep generated binaries, screenshots, exports, personal frame sets and downloaded tools outside Git. Use GitHub Releases for distributable executables.
- Consult [implementation decisions](docs/IMPLEMENTATION_DECISIONS.md), [validation evidence](docs/RELEASE_VALIDATION.md) and the [working agreement](AGENTS.md). Update [progress](docs/PROGRESS.md) when completing an implementation milestone.

Additional native checks and benchmarks are described in [scripts/README.md](scripts/README.md). Linux runtime qualification and physical mixed-DPI/240 Hz testing are still open; a successful build alone does not establish these results.

Ayori is available under the [MIT license](LICENSE). Third-party fixtures retain their adjacent license notices.
