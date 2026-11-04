# Development scripts

Run scripts from the repository root. Normal source checks and CI do not depend on private frames or downloaded fixture-generation tools.

| Purpose                  | Entry points                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop startup/build    | `desktop.mjs` builds the offline viewer first and starts the Tauri CLI.                                                                 |
| Standalone HTML bundle   | `build-offline.mjs` produces `dist/offline.js` for Rust to embed.                                                                       |
| Portable delivery        | `prepare-portable.mjs` copies the Windows release to `releases/Ayori.exe` and verifies its hash.                                        |
| Branding                 | `generate-icons.mjs` derives Windows/Linux icons from the approved SVG; other platform variants are discarded in a temporary directory. |
| Native correctness       | `smoke-native.mjs`, `verify-workflow.mjs`, `verify-transport.mjs`, `verify-scaling.mjs`, `verify-large.mjs`                             |
| Collections and UI       | `verify-collections.mjs`, `verify-release-ui.mjs`, `verify-appearance.mjs`, `verify-quick-zoom.mjs`, `verify-offline-zoom.mjs`          |
| Real-file release checks | `verify-release.mjs [source-folder ...]`, `verify-user-pairs.mjs`                                                                       |
| Measurements             | `benchmark-native.mjs`, `benchmark-ipc-detached.mjs`, `benchmark-shared.mjs`, `measure-memory.ps1`                                      |
| Fixture authoring        | `generate-avif-yuv.mjs [path-to-avifenc]`; tiny redistributable fixtures are already checked in.                                        |

## Native verification

The native scripts connect to WebView2's local debugging endpoint at `127.0.0.1:9223`. For a local development run, set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223` before launching the app. Opt-in native measurement commands require the Cargo `diagnostics` feature. Do not enable debugging for normal distribution.

Create the generated image corpus with:

```sh
npm run build
cargo run --manifest-path src-tauri/Cargo.toml --example fixtures
```

Then run `node scripts/smoke-native.mjs --fixtures` and `node scripts/verify-workflow.mjs` against the development app. The collection script creates its own 100-image corpus. Outputs go under ignored `local-fixtures/` and can be removed after use.

The appearance, quick-zoom and user-pair checks were written for a local two-source/four-scene, 1920×1080 WEBP corpus at `local-fixtures/user-comparison/{WEB-DL,Encode}`. Those private images are intentionally absent. Supply your own equivalent corpus when using those checks; `verify-release.mjs` also accepts explicit source folder paths. `verify-offline-zoom.mjs` consumes the HTML produced by `verify-quick-zoom.mjs`.

Keep native scripts sequential: they share one app window, selection and clipboard. See [release validation](../docs/RELEASE_VALIDATION.md) for test prerequisites, workload limits and the distinction between measured performance and product targets.
