# Master Architecture & Execution Roadmap: Ayori Compare

This document is the authoritative engineering blueprint for **Ayori Compare**. Every dependency version, binary protocol byte offset, WebGL2 texture format, and Tauri v2 capability is explicitly defined so an autonomous coding agent can implement the project with zero guesswork.

---

## 1. System Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                        FRONTEND: Svelte 5 + TypeScript + WebGL2                   |
|                                                                                   |
|  +----------------------------------+    +-------------------------------------+  |
|  | Reactive State (matrix.svelte.ts)|    | WebGL2 Engine (renderer.ts)         |  |
|  | - Singleton WorkspaceState class |    | - 8 Texture Slots (GL_TEXTURE0..7)  |  |
|  | - Active Scene & Slot A/B indices|    | - EXT_texture_norm16 (16-bit PNGs)  |  |
|  | - Debounced Tauri Drop Listener  |    | - Unified #version 300 es Shader    |  |
|  +-----------------+----------------+    +------------------+------------------+  |
+--------------------|----------------------------------------|---------------------+
                     | JSON IPC (Matrix Metadata)             | Raw Binary IPC
                     v                                        | (32-Byte Header + RGBA)
+-------------------------------------------------------------|---------------------+
|                        BACKEND: Tauri v2 (Rust 2024 Edition)|                     |
|                                                             v                     |
|  +----------------------------------+    +-------------------------------------+  |
|  | Matrix & Watcher (matrix.rs)     |    | Parallel SIMD Decoder (decoder.rs)  |  |
|  | - Multi-Folder Frame Stem Matcher|    | - zune-png 0.5 (SIMD RGBA8 / RGBA16)|  |
|  | - notify 8.0 File Hot-Reloader   |    | - image 0.25 fallback (WebP / AVIF) |  |
|  | - Offline HTML Bundle Generator  |    | - fast-ssim2 0.9 SSIMULACRA2 Engine |  |
|  +----------------------------------+    +-------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Exact Project File Tree

```
ayori-compare/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── svelte.config.js
├── index.html
├── src/
│   ├── main.ts
│   ├── app.css
│   ├── App.svelte
│   └── lib/
│       ├── types.ts                        # Shared TS interfaces mirroring Rust structs
│       ├── state/
│       │   └── workspace.svelte.ts         # Svelte 5 Runes singleton class
│       ├── webgl/
│       │   ├── renderer.ts                 # WebGL2 context, texture upload, pan/zoom math
│       │   └── shaders.ts                  # GLSL #version 300 es vertex & fragment sources
│       └── components/
│           ├── Titlebar.svelte             # Frameless window drag region & window controls
│           ├── TopSourceBar.svelte         # Floating source pills, A/B badges, telemetry
│           ├── ModeDock.svelte             # Left floating inspection toolbar & gain sliders
│           ├── BottomSceneBar.svelte       # Scene stepper, filmstrip drawer, zoom & export
│           ├── PixelReadout.svelte         # Cursor (X,Y) RGB / 10-bit / Hex tooltip
│           └── EmptyDropzone.svelte        # Animated onboarding drop target
└── src-tauri/
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json                    # Tauri v2 explicit permissions
    └── src/
        ├── main.rs                         # Windows subsystem attribute & entry point
        ├── lib.rs                          # Tauri builder, managed state, command registry
        ├── models.rs                       # Serializable Matrix, Scene, and Source structs
        ├── matrix.rs                       # Directory scanning & regex frame-number matching
        ├── decoder.rs                      # zune-png + image crate -> 32-byte header IPC payload
        ├── metrics.rs                      # fast-ssim2 Ssimulacra2Reference background scorer
        ├── watcher.rs                      # notify crate live file watcher
        └── exporter.rs                     # Self-contained single-file HTML comparison generator
```

---

## 3. Verified Configuration & Dependency Manifests

### 3.1 Rust Backend (`src-tauri/Cargo.toml`)
**CRITICAL AGENT RULE:** Always optimize `zune-png`, `zune-inflate`, and `fast-ssim2` in `dev` builds (`opt-level = 3`), otherwise debug PNG decoding will be $10\times$ slower than release builds.

```toml
[package]
name = "ayori-compare"
version = "1.0.0"
description = "Ultra-fast GPU anime & video encoding comparison tool"
authors = ["Ayori Project"]
edition = "2021"

[lib]
name = "ayori_compare_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-clipboard-manager = "2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
rayon = "1.10"
regex = "1.11"
notify = "8.0"
base64 = "0.22"
zune-core = "0.5"
zune-png = "0.5"
image = { version = "0.25", default-features = false, features = ["webp", "avif", "jpeg", "png"] }
fast-ssim2 = { version = "0.9", features = ["rayon"] }
thiserror = "2.0"

# Ensure SIMD image decoders & metrics run at full speed even during `cargo tauri dev`
[profile.dev.package.zune-png]
opt-level = 3
[profile.dev.package.zune-inflate]
opt-level = 3
[profile.dev.package.fast-ssim2]
opt-level = 3

# Sub-10MB Release Binary Optimization Profile
[profile.release]
panic = "abort"
codegen-units = 1
lto = "fat"
opt-level = 3
strip = "symbols"
```

### 3.2 Tauri v2 Configuration (`src-tauri/tauri.conf.json`)
**CRITICAL AGENT RULE:** Do NOT use Tauri v1 `allowlist` keys. Use Tauri v2 schema and `capabilities/default.json`.

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Ayori Compare",
  "version": "1.0.0",
  "identifier": "com.ayori.compare",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Ayori Compare",
        "width": 1440,
        "height": 900,
        "minWidth": 960,
        "minHeight": 600,
        "decorations": false,
        "transparent": false,
        "backgroundColor": "#09090b",
        "dragDropEnabled": true,
        "center": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis", "appimage"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.ico"
    ]
  }
}
```

### 3.3 Tauri v2 Capabilities (`src-tauri/capabilities/default.json`)
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for Ayori Compare main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:window:allow-start-dragging",
    "core:webview:default",
    "dialog:default",
    "clipboard-manager:allow-write-image",
    "clipboard-manager:allow-write-text"
  ]
}
```

---

## 4. Exact Binary IPC Protocol & 8-Bit / 16-Bit Texture Pipeline

### 4.1 The 32-Byte Aligned Binary Frame Header
When the frontend calls `invoke<ArrayBuffer>('load_frame_binary', { path })`, Rust returns a `tauri::ipc::Response` containing a single contiguous `Vec<u8>`.
* The first **32 bytes** form a fixed Little-Endian header (32-byte alignment guarantees zero-copy TypedArray instantiation in JavaScript via `new Uint8Array(buffer, 32)` or `new Uint16Array(buffer, 32)` without alignment exceptions):

| Byte Offset | Type | Field Name | Description |
|---|---|---|---|
| `0..4` | `u32` LE | `magic` | Always `0x49525941` (`"AYRI"` in ASCII) |
| `4..8` | `u32` LE | `width` | Image width in pixels |
| `8..12` | `u32` LE | `height` | Image height in pixels |
| `12..16` | `u32` LE | `bit_depth` | `8` (RGBA8) or `16` (RGBA16 native little-endian `u16`) |
| `16..20` | `u32` LE | `channels` | Always `4` (RGBA — Rust expands 3-channel RGB to 4-channel RGBA) |
| `20..24` | `u32` LE | `file_size_bytes` | Compressed file size on disk in bytes |
| `24..28` | `u32` LE | `original_bit_depth` | Original source bit depth before decoding (`8`, `10`, `12`, `16`) |
| `28..32` | `u32` LE | `reserved` | `0` (Reserved padding for 32-byte SIMD/TypedArray alignment) |
| `32..end` | `u8[]` | `pixel_data` | Raw tightly-packed RGBA pixels ($W \times H \times 4\text{ bytes}$ for 8-bit, or $W \times H \times 8\text{ bytes}$ for 16-bit) |

### 4.2 Rust `zune-png` Implementation Contract (`src-tauri/src/decoder.rs`)
Most anime frames exported from VapourSynth or FFmpeg are 3-channel RGB (`RGB24` or `RGB48`). Uploading 3-channel `gl.RGB` to WebGL2 triggers a slow CPU driver conversion on D3D11/ANGLE. Therefore, Rust **must** instruct `zune-png` to expand RGB to 4-channel RGBA during SIMD filtering:

```rust
use std::fs;
use std::path::Path;
use zune_core::bytestream::ZCursor;
use zune_core::options::DecoderOptions;
use zune_core::result::DecodingResult;
use zune_png::PngDecoder;

pub fn decode_image_to_ayri_packet(path: &Path) -> Result<Vec<u8>, String> {
    let raw_file = fs::read(path).map_err(|e| format!("Failed to read {:?}: {}", path, e))?;
    let file_size_bytes = raw_file.len() as u32;

    let ext = path.extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if ext == "png" {
        let options = DecoderOptions::default()
            .png_set_add_alpha_channel(true)
            .png_set_strip_to_8bit(false); // Preserve 16-bit precision for banding inspection

        let mut decoder = PngDecoder::new_with_options(ZCursor::new(&raw_file), options);
        let decoded = decoder.decode().map_err(|e| format!("PNG decode error: {:?}", e))?;
        let (width, height) = decoder.dimensions().ok_or("Missing PNG dimensions")?;
        let info = decoder.info().ok_or("Missing PNG info")?;
        let orig_depth = info.depth as u32;

        match decoded {
            DecodingResult::U8(pixels) => {
                Ok(pack_ayri_buffer(width as u32, height as u32, 8, orig_depth, file_size_bytes, &pixels))
            }
            DecodingResult::U16(pixels_u16) => {
                // Convert Vec<u16> to little-endian byte slice
                let byte_len = pixels_u16.len() * 2;
                let mut packet = Vec::with_capacity(32 + byte_len);
                write_ayri_header(&mut packet, width as u32, height as u32, 16, orig_depth, file_size_bytes);
                for &sample in &pixels_u16 {
                    packet.extend_from_slice(&sample.to_le_bytes());
                }
                Ok(packet)
            }
            _ => Err("Unsupported PNG decoding result format".into()),
        }
    } else {
        // Fallback to `image` crate for WebP, AVIF, JPEG
        let img = image::load_from_memory(&raw_file).map_err(|e| e.to_string())?;
        let rgba8 = img.to_rgba8();
        let (width, height) = rgba8.dimensions();
        Ok(pack_ayri_buffer(width, height, 8, 8, file_size_bytes, rgba8.as_raw()))
    }
}

fn write_ayri_header(
    buf: &mut Vec<u8>,
    width: u32,
    height: u32,
    bit_depth: u32,
    orig_depth: u32,
    file_size_bytes: u32,
) {
    buf.extend_from_slice(&0x49525941u32.to_le_bytes()); // "AYRI"
    buf.extend_from_slice(&width.to_le_bytes());
    buf.extend_from_slice(&height.to_le_bytes());
    buf.extend_from_slice(&bit_depth.to_le_bytes());
    buf.extend_from_slice(&4u32.to_le_bytes());          // 4 channels (RGBA)
    buf.extend_from_slice(&file_size_bytes.to_le_bytes());
    buf.extend_from_slice(&orig_depth.to_le_bytes());
    buf.extend_from_slice(&0u32.to_le_bytes());          // 32-byte alignment padding
}

fn pack_ayri_buffer(
    width: u32,
    height: u32,
    bit_depth: u32,
    orig_depth: u32,
    file_size_bytes: u32,
    pixels: &[u8],
) -> Vec<u8> {
    let mut packet = Vec::with_capacity(32 + pixels.len());
    write_ayri_header(&mut packet, width, height, bit_depth, orig_depth, file_size_bytes);
    packet.extend_from_slice(pixels);
    packet
}
```

### 4.3 WebGL2 8-Bit & 16-Bit Texture Upload Contract (`src/lib/webgl/renderer.ts`)
**CRITICAL AGENT RULE:** In WebGL2, uploading a 16-bit normalized texture (`Uint16Array`) to a standard `sampler2D` requires enabling the `EXT_texture_norm16` extension (`const extNorm16 = gl.getExtension('EXT_texture_norm16')`). If `EXT_texture_norm16` is present (supported on Windows WebView2 D3D11 and modern Linux Mesa), upload with `internalFormat = extNorm16.RGBA16_EXT`, `format = gl.RGBA`, `type = gl.UNSIGNED_SHORT`. If `extNorm16` is null on legacy hardware, downshift `Uint16Array` samples in JS via `u8[i] = u16[i] >> 8` and upload as `gl.RGBA8`. This guarantees that a single `sampler2D` uniform array works across all GPUs without shader recompilation.

```typescript
// Parsing the 32-byte AYRI binary packet and uploading to WebGL2 slot (0..7)
public uploadAyriBufferToSlot(slotIndex: number, buffer: ArrayBuffer): FrameMetadata {
  const view = new DataView(buffer, 0, 32);
  const magic = view.getUint32(0, true);
  if (magic !== 0x49525941) throw new Error("Invalid AYRI binary packet header");

  const width = view.getUint32(4, true);
  const height = view.getUint32(8, true);
  const bitDepth = view.getUint32(12, true);
  const fileSizeBytes = view.getUint32(20, true);
  const originalBitDepth = view.getUint32(24, true);

  const gl = this.gl;
  gl.activeTexture(gl.TEXTURE0 + slotIndex);
  if (!this.textures[slotIndex]) {
    this.textures[slotIndex] = gl.createTexture()!;
  }
  gl.bindTexture(gl.TEXTURE_2D, this.textures[slotIndex]);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  if (bitDepth === 16) {
    const u16Data = new Uint16Array(buffer, 32);
    if (this.extNorm16) {
      // Native 16-bit normalized GPU texture (0..65535 -> 0.0..1.0 in GLSL sampler2D)
      gl.texImage2D(
        gl.TEXTURE_2D, 0, this.extNorm16.RGBA16_EXT,
        width, height, 0, gl.RGBA, gl.UNSIGNED_SHORT, u16Data
      );
    } else {
      // Fallback for older GPUs without EXT_texture_norm16
      const u8Fallback = new Uint8Array(u16Data.length);
      for (let i = 0; i < u16Data.length; i++) u8Fallback[i] = u16Data[i] >> 8;
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA8,
        width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, u8Fallback
      );
    }
  } else {
    const u8Data = new Uint8Array(buffer, 32);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA8,
      width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, u8Data
    );
  }

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  this.updateTextureFilterMode(slotIndex);

  return { width, height, bitDepth: originalBitDepth, fileSizeBytes };
}
```

---

## 5. Exact WebGL2 Shader Implementation (`src/lib/webgl/shaders.ts`)

### 5.1 Coordinate Conventions & Cursor-Centered Zoom Math
* **Top-Left Origin Convention:** Screen coordinates $\vec{p}_{\text{screen}} = (x, y)$ are in physical canvas pixels (`clientX * devicePixelRatio`, `clientY * devicePixelRatio`) with $(0, 0)$ at the **top-left** corner of the canvas.
* **Image UV Mapping:** Given pan offset $\vec{t}_{\text{pan}} = (t_x, t_y)$ in physical pixels, zoom scale $s_{\text{zoom}}$, and base scene dimensions $\vec{R}_{\text{base}} = (W_{\text{base}}, H_{\text{base}})$:
  $$\vec{p}_{\text{uv}} = \frac{\vec{p}_{\text{screen}} - \vec{t}_{\text{pan}}}{s_{\text{zoom}} \cdot \vec{R}_{\text{base}}}$$
* **Cursor-Centered Zoom Invariant:** When zooming from $s_{\text{old}}$ to $s_{\text{new}}$ at cursor position $\vec{p}_{\text{cursor}}$:
  $$\vec{t}_{\text{new}} = \vec{p}_{\text{cursor}} - \left(\vec{p}_{\text{cursor}} - \vec{t}_{\text{old}}\right) \cdot \frac{s_{\text{new}}}{s_{\text{old}}}$$

### 5.2 Complete Fragment Shader (`compare.frag.glsl`)
**CRITICAL AGENT RULE:** In GLSL ES 3.00 (`#version 300 es`), indexing into a `sampler2D` array with a non-constant expression is undefined on some ANGLE drivers. Always use an explicit `switch(slot)` helper function to sample `u_tex0` through `u_tex7`.

```glsl
#version 300 es
precision highp float;

in vec2 v_screenPos; // Physical canvas pixel coordinates (0..u_canvasSize.x, 0..u_canvasSize.y)
out vec4 fragColor;

uniform sampler2D u_tex0;
uniform sampler2D u_tex1;
uniform sampler2D u_tex2;
uniform sampler2D u_tex3;
uniform sampler2D u_tex4;
uniform sampler2D u_tex5;
uniform sampler2D u_tex6;
uniform sampler2D u_tex7;

uniform vec2 u_canvasSize;    // Physical canvas size in pixels
uniform vec2 u_baseImageSize; // Max (width, height) across current scene sources
uniform vec2 u_pan;           // Pan offset in physical pixels
uniform float u_zoom;         // Physical pixel zoom factor (1.0 = 100%)
uniform vec2 u_mousePos;      // Cursor position in physical canvas pixels

uniform int u_slotA;          // Primary source index (0..7)
uniform int u_slotB;          // Secondary source index (0..7)
uniform int u_slotC;          // 4-way quadrant slot C (0..7)
uniform int u_slotD;          // 4-way quadrant slot D (0..7)

uniform int u_mode;           // 0=Single, 1=Curtain, 2=Split, 3=Diff, 4=Banding
uniform int u_subMode;        // Sub-variant within active mode
uniform float u_diffGain;     // 1.0 .. 50.0
uniform float u_bandFreq;     // 8.0 .. 64.0
uniform bool u_loupeActive;   // Shift / Right-click magnifier active
uniform bool u_showGrid;      // Show pixel grid when u_zoom >= 8.0

vec4 sampleSlot(int slot, vec2 uv) {
    switch (slot) {
        case 0: return texture(u_tex0, uv);
        case 1: return texture(u_tex1, uv);
        case 2: return texture(u_tex2, uv);
        case 3: return texture(u_tex3, uv);
        case 4: return texture(u_tex4, uv);
        case 5: return texture(u_tex5, uv);
        case 6: return texture(u_tex6, uv);
        case 7: return texture(u_tex7, uv);
        default: return texture(u_tex0, uv);
    }
}

// Perceptual Inferno-style heatmap for Luma Difference subMode
vec3 heatmapRamp(float t) {
    t = clamp(t, 0.0, 1.0);
    return clamp(vec3(
        1.5 * t - 0.1,
        sin(t * 3.14159265) * 1.1,
        sin(t * 6.2831853) * 0.6 + (1.0 - t) * 0.3
    ), 0.0, 1.0);
}

void main() {
    // 1. Synchronized Dual-Source Loupe Override (8x Magnification around cursor)
    if (u_loupeActive) {
        float dist = length(v_screenPos - u_mousePos);
        float radius = 140.0;
        if (dist <= radius) {
            if (dist >= radius - 2.0) {
                fragColor = vec4(1.0, 1.0, 1.0, 0.9);
                return;
            }
            vec2 loupeOffset = (v_screenPos - u_mousePos) / (u_zoom * 8.0 * u_baseImageSize);
            vec2 centerUv = (u_mousePos - u_pan) / (u_zoom * u_baseImageSize);
            vec2 loupeUv = (floor((centerUv + loupeOffset) * u_baseImageSize) + 0.5) / u_baseImageSize;
            if (abs(v_screenPos.x - u_mousePos.x) < 1.0) {
                fragColor = vec4(0.15, 0.85, 1.0, 1.0);
                return;
            }
            int slot = (v_screenPos.x < u_mousePos.x) ? u_slotA : u_slotB;
            fragColor = vec4(sampleSlot(slot, loupeUv).rgb, 1.0);
            return;
        }
    }

    // 2. Compute Image UV Coordinates
    vec2 uv = (v_screenPos - u_pan) / (u_zoom * u_baseImageSize);
    if (u_mode == 2) {
        // Side-by-Side Split: both halves sample centered around viewport
        float halfW = u_canvasSize.x * 0.5;
        if (abs(v_screenPos.x - halfW) < 1.0) {
            fragColor = vec4(0.25, 0.25, 0.3, 1.0);
            return;
        }
        vec2 localScreen = v_screenPos;
        if (v_screenPos.x >= halfW) {
            localScreen.x -= halfW;
        }
        uv = (localScreen - u_pan) / (u_zoom * u_baseImageSize);
    }

    // Checkerboard backdrop outside [0, 1] image bounds
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        vec2 checker = floor(v_screenPos / 16.0);
        float c = mod(checker.x + checker.y, 2.0) == 0.0 ? 0.045 : 0.065;
        fragColor = vec4(vec3(c), 1.0);
        return;
    }

    vec3 colorA = sampleSlot(u_slotA, uv).rgb;
    vec3 colorB = sampleSlot(u_slotB, uv).rgb;
    vec3 outColor = colorA;

    // 3. Mode Dispatch
    if (u_mode == 0) {
        outColor = colorA;
    } else if (u_mode == 1) {
        // Curtain Slider (subMode 0: Vertical, 1: Horizontal, 2: 4-Way Crosshair)
        if (u_subMode == 0) {
            if (abs(v_screenPos.x - u_mousePos.x) < 1.0) { fragColor = vec4(1.0, 1.0, 1.0, 0.85); return; }
            outColor = (v_screenPos.x < u_mousePos.x) ? colorA : colorB;
        } else if (u_subMode == 1) {
            if (abs(v_screenPos.y - u_mousePos.y) < 1.0) { fragColor = vec4(1.0, 1.0, 1.0, 0.85); return; }
            outColor = (v_screenPos.y < u_mousePos.y) ? colorA : colorB;
        } else {
            if (abs(v_screenPos.x - u_mousePos.x) < 1.0 || abs(v_screenPos.y - u_mousePos.y) < 1.0) {
                fragColor = vec4(1.0, 1.0, 1.0, 0.85);
                return;
            }
            if (v_screenPos.y < u_mousePos.y) {
                outColor = (v_screenPos.x < u_mousePos.x) ? colorA : colorB;
            } else {
                outColor = (v_screenPos.x < u_mousePos.x)
                    ? sampleSlot(u_slotC, uv).rgb
                    : sampleSlot(u_slotD, uv).rgb;
            }
        }
    } else if (u_mode == 2) {
        outColor = (v_screenPos.x < u_canvasSize.x * 0.5) ? colorA : colorB;
    } else if (u_mode == 3) {
        // Amplified Pixel Difference (subMode 0: RGB Diff, 1: Perceptual Luma Heatmap)
        vec3 diff = abs(colorA - colorB) * u_diffGain;
        if (u_subMode == 0) {
            outColor = clamp(diff, 0.0, 1.0);
        } else {
            float lumaErr = dot(diff, vec3(0.2126, 0.7152, 0.0722));
            outColor = heatmapRamp(lumaErr);
        }
    } else if (u_mode == 4) {
        // Anime Banding & Plane Inspector
        float luma = dot(colorA, vec3(0.2126, 0.7152, 0.0722));
        if (u_subMode == 0) {
            // Banding Sawtooth Contour Amplifier
            outColor = vec3(fract(luma * u_bandFreq));
        } else if (u_subMode == 1) {
            // Dark Shadow Gamma Boost
            outColor = clamp(pow(colorA, vec3(1.0 / 3.0)) * 2.5, 0.0, 1.0);
        } else if (u_subMode == 2) {
            // Rec.709 Luma Only
            outColor = vec3(luma);
        } else {
            // Chroma Deviation Extract
            float cb = (colorA.b - luma) / 1.8556 + 0.5;
            float cr = (colorA.r - luma) / 1.5748 + 0.5;
            outColor = vec3(cr, 0.5, cb);
        }
    }

    // 4. High-Zoom Texel Grid Overlay (800%+ zoom)
    if (u_showGrid && u_zoom >= 8.0) {
        vec2 texelPos = fract(uv * u_baseImageSize);
        vec2 edgeDist = min(texelPos, 1.0 - texelPos) * u_zoom;
        if (min(edgeDist.x, edgeDist.y) < 0.75) {
            outColor = mix(outColor, vec3(0.5, 0.5, 0.55), 0.35);
        }
    }

    fragColor = vec4(outColor, 1.0);
}
```

---

## 6. Perceptual Metric Integration (`src-tauri/src/metrics.rs`)
**CRITICAL AGENT RULE:** Use `fast-ssim2` (`0.9.0`) with `Ssimulacra2Reference` so the Reference Source (Slot 0) is precomputed once per scene, cutting comparison time against Slots $1..7$ by $50\%$. If a candidate source has a different resolution than Slot 0 (e.g., comparing $1080\text{p}$ BD vs $1440\text{p}$ upscale), resize the reference RGB buffer to match using Catmull-Rom bicubic interpolation before invoking `fast-ssim2`.

```rust
use fast_ssim2::{PixelDescriptor, PixelSlice, Ssimulacra2Reference};

pub fn compute_scene_ssim2_scores(
    ref_rgb8: &[u8],
    ref_w: u32,
    ref_h: u32,
    candidates: &[(&[u8], u32, u32)],
) -> Result<Vec<Option<f64>>, String> {
    let ref_slice = PixelSlice::new(
        ref_rgb8,
        ref_w,
        ref_h,
        (ref_w as usize) * 3,
        PixelDescriptor::RGB8_SRGB,
    ).map_err(|e| format!("Invalid reference slice: {:?}", e))?;

    let reference = Ssimulacra2Reference::new(ref_slice)
        .map_err(|e| format!("SSIM2 reference init failed: {:?}", e))?;

    let scores = candidates
        .iter()
        .map(|&(cand_rgb, w, h)| {
            if w != ref_w || h != ref_h {
                return None; // Resolution mismatch handled cleanly without panic
            }
            let slice = PixelSlice::new(
                cand_rgb,
                w,
                h,
                (w as usize) * 3,
                PixelDescriptor::RGB8_SRGB,
            ).ok()?;
            reference.compare(slice).ok()
        })
        .collect();

    Ok(scores)
}
```

---

## 7. Known Edge Cases & Mandatory Safeguards for the Coding Agent

1. **Tauri v2 Duplicate Drag-and-Drop Events (Windows WebView2 Bug):**
   * Calling `getCurrentWebview().onDragDropEvent(...)` on Windows can emit two identical `drop` events within $5\text{ ms}$.
   * **Mandatory Fix:** In `App.svelte`, guard the `event.payload.type === 'drop'` handler with a timestamp debounce (`if (performance.now() - lastDropTime < 250) return;`).
2. **Svelte 5 Runes Module Export Rule:**
   * Do not `export let stateVar = $state(...)` from `.svelte.ts` files and reassign it directly, as the Svelte 5 compiler prohibits exporting reassigned `$state` primitives.
   * **Mandatory Fix:** Encapsulate all application state inside a single class `export class AyoriWorkspace { ... }` in `src/lib/state/workspace.svelte.ts` and export a singleton instance `export const workspace = new AyoriWorkspace();`.
3. **VRAM Leak Prevention on Scene Changes:**
   * Never allocate new `WebGLTexture` objects per frame switch without reusing the fixed array `this.textures[0..7]`. Calling `gl.bindTexture(gl.TEXTURE_2D, this.textures[slot])` followed by `gl.texImage2D(...)` overwrites the existing GPU texture allocation cleanly without leaking VRAM.

---

## 8. Step-by-Step Execution Plan for Google Antigravity

### Phase 1: Project Scaffolding & Tauri v2 Window Setup
1. Initialize the Vite + Svelte 5 + TypeScript + Tailwind CSS project and `src-tauri` folder structure matching Section 2.
2. Populate `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `src-tauri/capabilities/default.json` verbatim from Section 3.
3. Build `Titlebar.svelte` using `@tauri-apps/api/window` (`getCurrentWindow().minimize()`, `toggleMaximize()`, `close()`, and `data-tauri-drag-region`) and verify the frameless dark window launches cleanly.

### Phase 2: WebGL2 Shader Engine & Interactive Viewport
1. Implement `src/lib/webgl/shaders.ts` and `src/lib/webgl/renderer.ts` with the 8-slot texture manager, `EXT_texture_norm16` detection, cursor-centered zoom math, and `requestAnimationFrame` render loop.
2. Implement procedural test textures on startup (so the viewport can be tested immediately before dropping files) and wire up all keyboard shortcuts (`1`–`8`, `Space`, `M`, `S`, `D`, `F`, `B`, `Z`, `G`, `H`, and `Shift` Dual Loupe).

### Phase 3: Parallel Rust Image Pipeline & Matrix Matcher
1. Implement `src-tauri/src/matrix.rs` to scan dropped directories/files, match frame stems via regex, and return the `ComparisonMatrix` JSON model.
2. Implement `src-tauri/src/decoder.rs` with the 32-byte `"AYRI"` binary header and expose `#[tauri::command] fn load_frame_binary(...) -> Result<tauri::ipc::Response, String>`.
3. Wire `getCurrentWebview().onDragDropEvent` (with the $250\text{ ms}$ debounce guard) in `App.svelte` to ingest dropped folders/files and stream all sources for the active scene into WebGL2 texture slots $0..7$.

### Phase 4: Floating Glass HUD, SSIMULACRA2 Metrics & Live Watcher
1. Build `TopSourceBar.svelte`, `ModeDock.svelte`, `BottomSceneBar.svelte`, and `PixelReadout.svelte` with auto-hiding frosted glass styling and smooth transitions.
2. Implement `src-tauri/src/metrics.rs` using `fast-ssim2` on a background thread and emit scores to the UI badges as they complete.
3. Implement `src-tauri/src/watcher.rs` (`notify` crate) to auto-reload modified disk frames in place when VapourSynth or FFmpeg overwrites an image.
4. Implement `src-tauri/src/exporter.rs` to generate a standalone single-file `.html` comparison report, and test `cargo tauri build` for Windows `.exe` and Linux `.AppImage`.