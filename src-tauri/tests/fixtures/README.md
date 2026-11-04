`tiny.avif` is a 16×16, 8-bit 4:4:4 test image from `avif-decode` 3.0.0, `tests/data/tiny.avif` (https://github.com/kornelski/avif-decode). It is distributed under the adjacent BSD license. It is used to check valid decoding and isolation of the upstream malformed-payload abort.
# Generated high-depth AVIF ramps

`ramp10.avif` and `ramp12.avif` are generated from this project's own 32×16 RGB16 ramp (`cargo run --example precision_fixture`). They contain no third-party image content.

Created using libavif 1.4.2's `avifenc` (AOM encoder):

```text
avifenc --qcolor 100 --depth 10 --yuv 444 --cicp 1/13/0 --range full --speed 10 --jobs 2 precision-rgb16.png ramp10.avif
avifenc --qcolor 100 --depth 12 --yuv 444 --cicp 1/13/0 --range full --speed 10 --jobs 2 precision-rgb16.png ramp12.avif
```

The 16-bit input is first quantized to the encoded depth; encoding then retains those quantized samples losslessly. The identity matrix stores RGB as GBR planes. Tests check every encoded sample survives the worker packet by reversing avif-decode's documented-in-source bit-replication expansion to 16 bits. Expanded RGB can differ by one from rounded full-range scaling without losing an encoded bit. AVIF YUV conversions and HDR color management are separate from this test.

