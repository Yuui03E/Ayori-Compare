# Product Requirements Document (PRD): Ayori Compare
**Product Name:** Ayori Compare  
**App Identifier:** `com.ayori.compare`  
**Document Version:** 2.0.0 (Agent-Ready Specification)  
**Target Platforms:** Windows 10/11 x64 (Primary Target), Linux x64 AppImage (Secondary Target)  
**Core Tech Stack:** Tauri v2 (Rust 2024 / MSRV 1.89+) + Svelte 5 (Runes) + Tailwind CSS v4 + WebGL2 (`#version 300 es`)

---

## 1. Product Purpose & Problem Statement
**Ayori Compare** is a standalone, ultra-fast desktop visual comparison and pixel-inspection application engineered for anime and high-efficiency video encoders (`x265`, `SVT-AV1`, `x264`, VapourSynth filter developers).

### 1.1 Why Existing Tools Fail Anime Encoders
1. **NVIDIA ICAT:** Built for video game frame-rate benchmarking; forces bilinear texture filtering at high zoom levels (blurring ringing, haloing, and macro-block boundaries), lacks instant `1`–`9` hot-key texture swapping, and cannot export shareable comparison matrices.
2. **Browser / Electron Viewers (`slow.pics` web, Pear, etc.):** Rely on standard HTML `<img>` elements that re-decode compressed images on tab switches, consume $300\text{ MB}$ to $>1\text{ GB}$ of RAM on $1440\text{p}$/$2160\text{p}$ frame sets, apply inconsistent browser color management, and package $>150\text{ MB}$ Chromium binaries.

### 1.2 The Ayori Compare Solution
Ayori Compare combines the multi-scene, multi-source matrix ergonomics of `slow.pics` with a **zero-latency WebGL2 GPU viewport** and a **parallel SIMD Rust image pipeline**, shipping as a portable $< 10\text{ MB}$ executable.

---

## 2. Strict Non-Functional & Performance Requirements

| Metric | Target Requirement | Verification Mechanism |
|---|---|---|
| **Release Binary Size** | $< 10\text{ MB}$ standalone Windows `.exe` | Tauri v2 native `WebView2` + Cargo `lto = "fat"`, `strip = "symbols"` |
| **Source Switch Latency** | $< 0.5\text{ ms}$ ($0$ dropped frames at $240\text{ Hz}$) | Active scene sources pre-uploaded to `GL_TEXTURE0..GL_TEXTURE7` in VRAM |
| **Batch Decode Latency** | $< 35\text{ ms}$ for $4 \times 2560\times1440$ ($2\text{K}$) 8-bit PNGs | Rust `rayon` parallel iterator + `zune-png` SIMD decoding |
| **IPC Transfer Overhead** | $< 5\text{ ms}$ per $14.7\text{ MB}$ ($2\text{K}$ RGBA8) frame | Raw binary `tauri::ipc::Response` (`ArrayBuffer`) with 32-byte header |
| **Pixel Accuracy** | $1:1$ lossless 8-bit and 16-bit inspection | Hardware `gl.NEAREST` magnification + `EXT_texture_norm16` 16-bit pipeline |
| **Memory Ceiling** | Deterministic VRAM eviction on scene change | Explicit `gl.deleteTexture()` lifecycle when switching scenes |

---

## 3. Complete Functional Specifications

### 3.1 File Ingestion & Scene Matrix Engine
Ayori Compare organizes loaded images into a 2D matrix of **$M$ Scenes (Rows/Frames)** $\times$ **$N$ Sources (Columns/Encodes)**, where $2 \le N \le 8$.

1. **Multi-Folder Matrix Drop:**
   * When the user drops $2$ to $8$ directories onto the window, the Rust backend scans each directory (non-recursively) for supported image extensions: `.png`, `.webp`, `.avif`, `.jpg`, `.jpeg`.
   * **Frame Matching Algorithm:**
     * *Pass 1 (Exact Stem Match):* Match files across folders that share the exact lowercase filename stem (e.g., `00450.png` and `00450.webp` $\rightarrow$ Scene ID `"00450"`).
     * *Pass 2 (Trailing Integer Frame Regex):* If exact stems differ due to prefix naming (e.g., `Source_00450.png` vs `Encode_CRF16_00450.png`), extract the last contiguous digit group via regex `(\d+)(?:\.[^.]+)$` and normalize by parsing as `u64` (so `450` and `00450` match as frame `450`).
   * Unmatched frames that exist in only $1$ folder are excluded from the synchronized matrix and reported in a non-blocking toast notification.
2. **Single-Scene Multi-File Drop:**
   * Dropping $2$ to $8$ individual image files directly onto the viewport creates a single-scene matrix ($M = 1, N = \text{file count}$) sorted naturally by filename.
3. **Slot Append / Replace Drop:**
   * Holding `Alt` while dropping a file or folder appends it as a new Source column to the existing matrix rather than resetting the workspace.
4. **Live Disk Hot-Reload (`notify` Watcher):**
   * Rust watches all active file paths in the currently selected scene. When an external tool (such as VapourSynth `vspipe`, FFmpeg, or `mpv`) overwrites an image on disk, Rust debounces the file-write event by $150\text{ ms}$, re-decodes the updated file, and replaces the corresponding `WebGLTexture` in VRAM without resetting the user's current zoom, pan, or comparison mode.

---

### 3.2 WebGL2 Viewport & Resolution Normalization
1. **Resolution-Independent UV Alignment:**
   * Encoders frequently compare a $1920\times1080$ Blu-ray source against a $2560\times1440$ ($2\text{K}$) or $3840\times2160$ ($4\text{K}$) filtered upscale.
   * The viewport defines its **Base Canvas Resolution** $(W_{\text{base}}, H_{\text{base}})$ as the maximum width and height among all loaded sources in the active scene:
     $$W_{\text{base}} = \max_{i \in [0, N-1]} W_i, \quad H_{\text{base}} = \max_{i \in [0, N-1]} H_i$$
   * All sources are sampled in normalized UV space $(u, v) \in [0.0, 1.0]^2$, automatically aligning $1080\text{p}$ and $1440\text{p}$ frames corner-to-corner.
2. **True Physical Pixel Zoom (`devicePixelRatio` Aware):**
   * At $100\%$ zoom ($s_{\text{zoom}} = 1.0$), $1$ pixel of the Base Canvas Resolution maps to exactly $1$ physical monitor pixel on the user's display, regardless of Windows fractional DPI scaling ($125\%$, $150\%$, $200\%$).
3. **Interpolation Filter Control:**
   * When $s_{\text{zoom}} < 1.0$ (zoomed out / Fit-to-Screen): Default to `gl.LINEAR` with mipmap/box filtering to prevent aliasing shimmer.
   * When $s_{\text{zoom}} \ge 1.0$ (at or above $100\%$): Automatically lock all texture units to `gl.NEAREST` so every individual pixel boundary is razor-sharp. Users may manually override this via a HUD toggle (`NEAREST` vs `BILINEAR`).

---

### 3.3 The 5 Core GPU Inspection Modes
All inspection modes execute inside a single WebGL2 Fragment Shader (`compare.frag.glsl`):

1. **Mode 0 — Instant Swap & Flicker (`M`):**
   * Displays a single active source `u_activeSlotA` ($0 \dots 7$).
   * Pressing `1`–`8` switches `u_activeSlotA` in $<0.5\text{ ms}$ and records the previous slot in `u_prevSlot`.
   * Pressing `Space` swaps `u_activeSlotA` and `u_prevSlot` to create an instant temporal flicker for spotting micro-grain loss or line-art shift.
2. **Mode 1 — Hardware Curtain Slider (`S`):**
   * Splits the viewport between Source A (`u_activeSlotA`, left/top) and Source B (`u_activeSlotB`, right/bottom) along the live mouse cursor position $(u_{\text{mouse}}, v_{\text{mouse}})$.
   * Pressing `S` again toggles between a **Vertical Wipe**, **Horizontal Wipe**, and **4-Way Quadrant Crosshair** (comparing Slots $0, 1, 2, 3$ simultaneously in 4 quadrants around the cursor).
3. **Mode 2 — Synchronized Side-by-Side Split (`D`):**
   * Divides the viewport into two equal halves (Left: Source A, Right: Source B) that sample the exact same zoomed/panned UV region simultaneously, separated by a $2\text{ px}$ divider line.
4. **Mode 3 — Amplified Pixel Difference (`F`):**
   * Computes the absolute per-channel difference between Source A and Source B multiplied by a user-controlled gain uniform $G \in [1.0, 50.0]$:
     $$C_{\text{diff}}(u, v) = \text{clamp}\left(\left\vert C_A(u, v) - C_B(u, v) \right\vert \cdot G, \; 0.0, \; 1.0\right)$$
   * Includes a secondary toggle for **False-Color Heatmap Difference** (mapping Luma error magnitude $\Delta Y$ onto a perceptual Turbo/Inferno color ramp from black $\rightarrow$ blue $\rightarrow$ magenta $\rightarrow$ yellow $\rightarrow$ white).
5. **Mode 4 — Anime Banding & Plane Inspector (`B`):**
   * Cycles through four sub-modes designed to verify debanding (`neo_f3kdb`, `placebo.Deband`) and chroma filtering:
     * **Sub-mode 4.1 (Banding Contour Amplifier):** Extracts Rec.709 Luma $Y$ and applies a sawtooth frequency multiplier $\text{fract}(Y \cdot f_{\text{bands}})$ with $f_{\text{bands}} \in [8.0, 64.0]$, turning subtle $1\text{-bit}$ dark-sky gradients into high-contrast zebra contours.
     * **Sub-mode 4.2 (Shadow Gamma Boost):** Applies $C_{\text{out}} = C_{\text{in}}^{1/3.0} \cdot 2.5$ to expose compression artifacts and block noise hidden in near-black anime regions ($Y < 0.15$).
     * **Sub-mode 4.3 (Luma Only $Y$):** Renders grayscale Rec.709 luminance ($Y = 0.2126R + 0.7152G + 0.0722B$).
     * **Sub-mode 4.4 (Chroma Extract):** Isolates $C_b$ / $C_r$ deviations to spot chroma bleeding or 4:2:0 subsampling ringing around colored anime lines.

---

### 3.4 Synchronized Dual Loupe & Pixel Readout
1. **Floating Split-Circle Magnifier (Hold `Shift` or `Right-Click`):**
   * Renders a circular lens (radius $140\text{ px}$ in physical screen space) centered on the mouse cursor directly inside the fragment shader.
   * The lens magnifies the underlying UV coordinates by $8\times$ using strict nearest-neighbor sampling, displaying **Source A on the left half of the circle** and **Source B on the right half of the circle**, separated by a $1\text{ px}$ hairline.
2. **Texel Grid & Live Color Picker (`G`):**
   * When zoomed to $\ge 800\%$, draws a $1\text{ px}$ anti-aliased grid around each texel and displays a compact cursor tooltip showing exact pixel coordinates `(X, Y)`, 8-bit `RGB(r, g, b)`, 10-bit equivalent `(0..1023)`, and `HEX` values for both Source A and Source B.

---

## 4. UI/UX Architecture: "Full-Bleed Canvas + Floating Glass HUD"
Ayori Compare uses a custom frameless window (`decorations: false`) with a dark obsidian backdrop (`#09090b`). The WebGL2 `<canvas>` occupies $100\text{ vw} \times 100\text{ vh}$.

### 4.1 Auto-Hiding Frosted Glass HUD Islands
All controls reside in floating translucent islands (`background: rgba(12, 12, 16, 0.78)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(255, 255, 255, 0.09)`):
* **Top Window Drag Region & Window Controls:** A subtle $32\text{ px}$ top hit-zone allows dragging the frameless window, with minimize, maximize, and close buttons on the top-right.
* **Top-Center Island (Source Switcher Bar):**
  * Displays horizontal pills for each loaded source (`[1] JPBD Source`, `[2] Filtered .vpy`, `[3] x265 CRF 16`).
  * In Dual-Source modes (Curtain, Split, Difference), left-clicking or pressing `1`–`8` selects **Source A (Cyan badge)**, while `Alt + 1`–`8` or right-clicking a pill selects **Source B (Amber badge)**.
  * Displays live metadata below the active pill: `2560×1440 • 16-bit PNG • 18.4 MB • SSIM2: 91.42`.
* **Left Vertical Island (Inspection Mode Dock):**
  * 5 icon buttons for Modes $0..4$ plus sliders for **Diff Gain ($1\times\text{–}50\times$)** and **Banding Frequency ($8\times\text{–}64\times$)** that slide out smoothly when Mode 3 or Mode 4 is active.
* **Bottom-Center Island (Scene Matrix & Zoom Pill):**
  * **Scene Stepper:** `< Prev Scene [Frame 00450 (3 / 12)] Next Scene >` with an expandable thumbnail/frame-number drawer.
  * **Zoom Controls:** Preset buttons (`Fit`, `100%`, `200%`, `400%`, `800%`), filter lock pill (`NEAREST`), and **Export HTML / Copy PNG** action buttons.
* **Auto-Fade Behavior:** After $2500\text{ ms}$ of mouse inactivity (when the cursor is not hovering over a HUD island), all HUD islands transition to `opacity: 0; pointer-events: none` over $250\text{ ms}$ (`cubic-bezier(0.22, 1, 0.36, 1)`). Any mouse movement or keypress immediately restores `opacity: 1`. Pressing `H` locks the HUD hidden until `H` is pressed again.

---

## 5. Complete Keyboard & Mouse Shortcut Specification

| Input | Action |
|---|---|
| `1` – `8` | Set Primary Source (Source A) to slot $1\dots8$ |
| `Alt + 1` – `Alt + 8` | Set Secondary Comparison Source (Source B) to slot $1\dots8$ |
| `Space` | Instant flip-flop between Primary Source A and Previously Viewed Source |
| `ArrowLeft` / `ArrowRight` | Cycle Primary Source A backward / forward |
| `ArrowUp` / `ArrowDown` or `[` / `]` | Load Previous / Next Scene Frame in the matrix |
| `M` | Activate Mode 0: Single Instant Swap |
| `S` | Activate/Cycle Mode 1: Curtain Slider (Vertical $\rightarrow$ Horizontal $\rightarrow$ 4-Way Crosshair) |
| `D` | Activate Mode 2: Synchronized Side-by-Side Split |
| `F` | Activate/Cycle Mode 3: Amplified Pixel Difference (RGB Diff $\rightarrow$ Heatmap) |
| `B` | Activate/Cycle Mode 4: Anime Banding & Plane Inspector (Contour $\rightarrow$ Shadow Boost $\rightarrow$ Luma $\rightarrow$ Chroma) |
| `Z` / `0` | Toggle between $100\%$ ($1:1$ physical pixel zoom) and Fit-to-Window |
| `G` | Toggle Pixel Grid & Live RGB/10-bit Color Readout |
| `H` | Toggle Persistent HUD Hide Lock |
| `Shift` (Hold) or `Right-Click` (Hold) | Summon Synchronized Dual-Source $800\%$ Magnifier Loupe |
| `Mouse Wheel` (Canvas) | Cursor-centered zoom in / out ($1.25\times$ multiplicative steps) |
| `Left-Click Drag` / `Middle-Click Drag` | Pan viewport (also works in Curtain mode when holding `Middle-Click` or `Ctrl + Left-Click`) |
| `Ctrl + C` | Render current comparison canvas to system clipboard as lossless PNG |
| `Ctrl + E` | Export current matrix as a standalone, self-contained offline `.html` comparison file |