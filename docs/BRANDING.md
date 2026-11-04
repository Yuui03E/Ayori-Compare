# Ayori identity — Facet

The user selected **A / Facet** from the logo studies on 2026-11-04. Preserve its three paths and proportions. The mark is an asymmetric A with a separated right leg and a darker lower facet.

- Master: `src/lib/assets/ayori.svg` — transparent, editable SVG used by the title bar, Home, browser favicon and offline viewer.
- Palette: pale mint `#AFE6D3`, warm white `#F0ECE2`, green `#60AE97`. Interface backgrounds remain pure black.
- Native icons: `src-tauri/icons/app-icon.svg` places the mark on a black rounded tile with a restrained green edge. The Windows ICO and Linux/Windows PNG sizes derive from it.
- Regenerate with `node scripts/generate-icons.mjs` after `npm ci`. It reads the master, recreates the tile and runs the pinned Tauri CLI dependency. Only the six PNG/ICO assets used for Windows/Linux are retained; other platform variants are generated in a temporary directory and discarded. Commit the generated native assets when changing the identity.
- The title bar retains its existing 16–44px sizing and font. Its existing minimal mode hides the decorative logo below 24px to keep space for controls. Home uses the mark in the existing central preview badge, without adding another panel or increasing vertical space.
- Offline HTML inlines the same vector, including its favicon, and requires no network access for branding.

Earlier logo studies are retained in Git history. The current source tree contains only the approved identity.

## Documentation screenshot

`docs/images/ayori-comparison.png` is a capture of the packaged Windows app using its original built-in sample artwork. It shows **Reference** versus **Quantized** in vertical curtain mode with the 32px toolbar. The window edge and empty lower margin are cropped; the toolbar and compared image are preserved. No private frames or third-party artwork are included.

To refresh it, open **Explore a sample comparison**, select A = Reference and B = Quantized, choose Curtain and center the divider. Temporarily disable automatic toolbar hiding for capture, then restore the previous preference. Keep documentation images small and check them at README display size.

## README artwork

`docs/images/readme-banner.svg` carries the black, mint and warm-white identity into the project page. Its overlapping A/B frames are brand artwork; the application screenshot below remains the native capture. The compact banner in the same folder is selected below 600px through a GitHub-compatible `<picture>` element. Both banners retain the master's exact three Facet paths.

`docs/images/download-windows.svg` is the mint download link artwork. All three SVGs are self-contained, use system fonts and contain no scripts, embedded raster data or external resources. Keep their palette aligned with the master and preserve readable text alternatives in the README. GitHub controls the surrounding page colors; the artwork retains its black background in either theme.
