# Comparison notes

## Importing images

Open a single folder containing named comparison pairs, or select those images together. Names such as `src_01` / `final_01`, `src_01` / `filter_01`, `01_src` / `01_out`, and `frame_01(a)` / `frame_01(b)` form matched scenes automatically. Source/reference images come first for A; output/filter/encode images follow for B. `src(a)` / `out(b)` works for a single pair. Capitalization, common separators and zero padding do not affect pairing; episode and scene identifiers stay part of the match.

Images without a clear source/output naming pattern remain alternatives within one scene. Multiple folders represent different releases or encoding groups, with frames matched by filename or trailing frame number. Missing source frames remain visible as missing cells. Duplicate candidates are reported instead of choosing one arbitrarily. Single-folder imports report images without recognized source/output labels.

Use **+ → Add sources** or Alt-drop to add named images or another named-pair folder. Selecting the same folder again adds newly created named images and keeps existing source columns in order.

Ayori accepts extracted PNG, WebP, AVIF and JPEG images. Direct video decoding and disc extraction are outside its scope.

## Different resolutions and aspect ratios

Images fill a shared area using the largest width and height in the scene. For example, 720p and 1080p images both occupy a 1920×1080 area at 100% zoom. Different aspect ratios stretch to fit, so match framing and crop before judging quality.

Auto filtering uses nearest sampling at 100% and above, and smooth filtering below. Bilinear is available in **View options**. Display scaling is not bicubic and does not modify the original samples.

SSIMULACRA2 scores use a separate path: source 1 is resized to each candidate's dimensions using Catmull–Rom. Scores complement visual inspection; alignment, crop and scaling affect their interpretation.

## Precision and large collections

Pixel readout uses original decoded samples. If native high-depth display is unavailable, Ayori labels the reduced-precision preview. Effects calculated from that preview are not full-precision analysis.

Collections can contain 100+ images or sources. Ayori keeps up to eight selected or nearby images resident and loads others as you browse. Newly selected images may need time to load. Offline export size grows with the images included.

## Controls and sharing

- **F1** or **Ctrl+,** opens help, editable shortcuts and interface settings.
- **Ctrl+K** opens searchable A/B source selection.
- **Space** flickers between the current and previous primary source.
- **Double right click** zooms to 200% at the pointer; repeat to restore the previous zoom and pan. Configure the target in **Help → Interface**.
- **Right hold or drag**, or **Shift**, opens the dual loupe.
- **Alt+Home** returns Home while keeping the comparison ready to resume.
- **Q** quits, **Ctrl+M** minimizes and **F10** maximizes/restores. App shortcuts stay inactive while typing or using a dialog.

These are default bindings; hover help reflects saved custom assignments. **View options** contains filtering, effect strength and offline HTML export. Copy PNG captures the comparison canvas.

For measured performance, platform qualification and precision limits, see [release validation](RELEASE_VALIDATION.md).
