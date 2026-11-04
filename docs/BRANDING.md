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

## README trailer

The README embeds the complete 60-second trailer as a silent, looping **800×450 / 12 fps GIF**. GitHub removes `<video>` and autoplay attributes from README Markdown, so a visitor does not need to press Play for this preview. Browser and GitHub animation preferences can still pause it. The image and its caption link to the original **1920×1080 / 30 fps MP4 with stereo sound**.

Both files are hosted as assets of the [v0.1.0 release](https://github.com/Yuui03E/Ayori-Compare/releases/tag/v0.1.0); the application source tree contains no trailer project or video binaries. The original app screenshot remains available in a disclosure beneath the preview.

The separately maintained `Ayori_trailer` project contains its own logo, license, dependencies and generation scripts. Run `npm run readme` there to derive the GIF from the verified MP4. Its source imagery is the original Lighthouse at Blue Hour artwork, and its footage comes from the published Windows app. The GIF is a reduced-resolution promotional preview, not a precision comparison export.
