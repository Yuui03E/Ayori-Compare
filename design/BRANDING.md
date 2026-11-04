# Ayori identity — Facet

The user selected **A / Facet** from the logo studies on 2026-11-04. Preserve its three paths and proportions. The mark is an asymmetric A with a separated right leg and a darker lower facet.

- Master: `src/lib/assets/ayori.svg` — transparent, editable SVG used by the title bar, Home, browser favicon and offline viewer.
- Palette: pale mint `#AFE6D3`, warm white `#F0ECE2`, green `#60AE97`. Interface backgrounds remain pure black.
- Native icons: `src-tauri/icons/app-icon.svg` places the mark on a black rounded tile with a restrained green edge. PNG, ICO, ICNS and platform variants derive from it.
- Regenerate with `node scripts/generate-icons.mjs`. It reads the master, recreates the tile and runs the checked-in Tauri CLI dependency. Commit the generated native assets when changing the identity.
- The title bar retains its existing 16–44px sizing and font. Its existing minimal mode hides the decorative logo below 24px to keep space for controls. Home uses the mark in the existing central preview badge, without adding another panel or increasing vertical space.
- Offline HTML inlines the same vector, including its favicon, and requires no network access for branding.

The alternatives in `design/logo-concepts` remain historical studies. They are not used by the application.
