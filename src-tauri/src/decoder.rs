use image::ImageDecoder;
use std::{fs, io::Cursor, path::Path};

pub const MAX_PIXELS: u64 = 64 * 1024 * 1024;
pub const MAX_FILE_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Clone, Debug)]
pub enum Pixels {
    U8(Vec<u8>),
    U16(Vec<u16>),
}

#[derive(Clone, Debug)]
pub struct Frame {
    pub width: u32,
    pub height: u32,
    pub original_depth: u32,
    pub file_size: u32,
    pub pixels: Pixels,
}

impl Frame {
    pub fn depth(&self) -> u32 {
        match self.pixels {
            Pixels::U8(_) => 8,
            Pixels::U16(_) => 16,
        }
    }
    pub fn packet(&self) -> Vec<u8> {
        let len = self.width as usize * self.height as usize * 4 * (self.depth() as usize / 8);
        let mut out = Vec::with_capacity(32 + len);
        for field in [
            0x49525941,
            self.width,
            self.height,
            self.depth(),
            4,
            self.file_size,
            self.original_depth,
            0,
        ] {
            out.extend_from_slice(&field.to_le_bytes());
        }
        match &self.pixels {
            Pixels::U8(v) => out.extend_from_slice(v),
            Pixels::U16(v) => {
                for x in v {
                    out.extend_from_slice(&x.to_le_bytes());
                }
            }
        }
        out
    }
    pub fn rgb8(&self) -> Vec<u8> {
        match &self.pixels {
            Pixels::U8(v) => v
                .as_chunks::<4>()
                .0
                .iter()
                .flat_map(|p| p[..3].iter().copied())
                .collect(),
            Pixels::U16(v) => v
                .as_chunks::<4>()
                .0
                .iter()
                .flat_map(|p| p[..3].iter().map(|&c| ((c as u32 + 128) / 257) as u8))
                .collect(),
        }
    }
}

fn validate_dimensions(w: u32, h: u32) -> Result<(), String> {
    if w == 0 || h == 0 || w > 32768 || h > 32768 || u64::from(w) * u64::from(h) > MAX_PIXELS {
        return Err(
            "Image exceeds the supported 64-megapixel / 32768-pixel dimension limit.".into(),
        );
    }
    Ok(())
}

pub fn decode(path: &Path) -> Result<Frame, String> {
    if path
        .extension()
        .and_then(|s| s.to_str())
        .is_some_and(|s| s.eq_ignore_ascii_case("avif"))
    {
        return decode_avif_isolated(path);
    }
    let size = fs::metadata(path).map_err(|e| e.to_string())?.len();
    if size > MAX_FILE_BYTES {
        return Err("Image file exceeds the 512 MiB input limit.".into());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    decode_bytes(
        &bytes,
        path.extension().and_then(|s| s.to_str()).unwrap_or(""),
    )
}

// rav1d 1.1 has an upstream abort path for malformed payloads. Keep that failure
// in a hidden worker process, using the same executable to preserve portability.
fn decode_avif_isolated(path: &Path) -> Result<Frame, String> {
    let mut command =
        std::process::Command::new(std::env::current_exe().map_err(|e| e.to_string())?);
    command.arg("--decode-avif-worker").arg(path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let output = command.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("AVIF decoding failed. The file may be damaged or unsupported.".into());
    }
    unpack_packet(&output.stdout)
}

pub fn decode_avif_worker(path: &Path) -> Result<Frame, String> {
    if std::fs::metadata(path).map_err(|e| e.to_string())?.len() > MAX_FILE_BYTES {
        return Err("AVIF file exceeds the input limit.".into());
    }
    decode_bytes(&std::fs::read(path).map_err(|e| e.to_string())?, "avif")
}

fn unpack_packet(bytes: &[u8]) -> Result<Frame, String> {
    if bytes.len() < 32 {
        return Err("AVIF worker returned an incomplete frame.".into());
    }
    let field = |offset| u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
    let (width, height, depth) = (field(4), field(8), field(12));
    validate_dimensions(width, height)?;
    if field(0) != 0x49525941
        || field(16) != 4
        || ![8, 16].contains(&depth)
        || bytes.len() != 32 + width as usize * height as usize * 4 * (depth as usize / 8)
    {
        return Err("AVIF worker returned an invalid frame.".into());
    }
    let pixels = if depth == 8 {
        Pixels::U8(bytes[32..].to_vec())
    } else {
        Pixels::U16(
            bytes[32..]
                .as_chunks::<2>()
                .0
                .iter()
                .map(|p| u16::from_le_bytes([p[0], p[1]]))
                .collect(),
        )
    };
    Ok(Frame {
        width,
        height,
        original_depth: field(24),
        file_size: field(20),
        pixels,
    })
}

pub fn decode_bytes(bytes: &[u8], extension: &str) -> Result<Frame, String> {
    let size = u32::try_from(bytes.len()).map_err(|_| "Image size exceeds the packet format.")?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("Image file exceeds the input limit.".into());
    }
    let ext = extension.to_ascii_lowercase();
    let frame = if ext == "avif" {
        let parsed = avif_parse::read_avif(&mut Cursor::new(bytes)).map_err(|e| e.to_string())?;
        let metadata = parsed.primary_item_metadata().map_err(|e| e.to_string())?;
        validate_dimensions(
            metadata.max_frame_width.get(),
            metadata.max_frame_height.get(),
        )?;
        drop(parsed);
        let image = avif_decode::Decoder::from_avif(bytes)
            .and_then(|d| d.to_image())
            .map_err(|e| e.to_string())?;
        let (width, height, pixels) = match image {
            avif_decode::Image::Rgb8(img) => {
                let (v, w, h) = img.into_contiguous_buf();
                (
                    w,
                    h,
                    Pixels::U8(v.into_iter().flat_map(|p| [p.r, p.g, p.b, 255]).collect()),
                )
            }
            avif_decode::Image::Rgba8(img) => {
                let (v, w, h) = img.into_contiguous_buf();
                (
                    w,
                    h,
                    Pixels::U8(v.into_iter().flat_map(|p| [p.r, p.g, p.b, p.a]).collect()),
                )
            }
            avif_decode::Image::Rgb16(img) => {
                let (v, w, h) = img.into_contiguous_buf();
                (
                    w,
                    h,
                    Pixels::U16(v.into_iter().flat_map(|p| [p.r, p.g, p.b, 65535]).collect()),
                )
            }
            avif_decode::Image::Rgba16(img) => {
                let (v, w, h) = img.into_contiguous_buf();
                (
                    w,
                    h,
                    Pixels::U16(v.into_iter().flat_map(|p| [p.r, p.g, p.b, p.a]).collect()),
                )
            }
            avif_decode::Image::Gray8(img) => {
                let (v, w, h) = img.into_contiguous_buf();
                (
                    w,
                    h,
                    Pixels::U8(
                        v.into_iter()
                            .flat_map(|p| [p.value(), p.value(), p.value(), 255])
                            .collect(),
                    ),
                )
            }
            avif_decode::Image::Gray16(img) => {
                let (v, w, h) = img.into_contiguous_buf();
                (
                    w,
                    h,
                    Pixels::U16(
                        v.into_iter()
                            .flat_map(|p| [p.value(), p.value(), p.value(), 65535])
                            .collect(),
                    ),
                )
            }
        };
        Frame {
            width: width as u32,
            height: height as u32,
            original_depth: metadata.bit_depth.into(),
            file_size: size,
            pixels,
        }
    } else {
        let mut reader = image::ImageReader::new(Cursor::new(bytes))
            .with_guessed_format()
            .map_err(|e| e.to_string())?;
        if ext == "png" {
            reader.set_format(image::ImageFormat::Png);
        }
        let is_png = reader.format() == Some(image::ImageFormat::Png);
        let mut limits = image::Limits::default();
        limits.max_image_width = Some(32768);
        limits.max_image_height = Some(32768);
        limits.max_alloc = Some(MAX_PIXELS * 8);
        reader.limits(limits);
        let decoder = reader.into_decoder().map_err(|e| e.to_string())?;
        let (width, height) = decoder.dimensions();
        validate_dimensions(width, height)?;
        // Check the pixel budget before allocating the decoded image. PNG's
        // EXPAND transform retains 16-bit samples and expands palette/low depth.
        let image = image::DynamicImage::from_decoder(decoder).map_err(|e| e.to_string())?;
        let decoded_depth =
            u32::from(image.color().bits_per_pixel() / u16::from(image.color().channel_count()));
        let original_depth = if is_png {
            u32::from(*bytes.get(24).ok_or("Missing PNG bit depth.")?)
        } else {
            decoded_depth
        };
        let pixels = if decoded_depth > 8 {
            Pixels::U16(image.into_rgba16().into_raw())
        } else {
            Pixels::U8(image.into_rgba8().into_raw())
        };
        Frame {
            width,
            height,
            original_depth,
            file_size: size,
            pixels,
        }
    };
    validate_dimensions(frame.width, frame.height)?;
    let expected = frame.width as usize * frame.height as usize * 4;
    let actual = match &frame.pixels {
        Pixels::U8(v) => v.len(),
        Pixels::U16(v) => v.len(),
    };
    if actual != expected {
        return Err("Decoder returned an invalid RGBA sample count.".into());
    }
    Ok(frame)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ExtendedColorType, ImageEncoder, codecs::png::PngEncoder};

    fn packed_png(depth: png::BitDepth, color: png::ColorType, data: &[u8]) -> Vec<u8> {
        let mut bytes = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut bytes, 4, 1);
            encoder.set_depth(depth);
            encoder.set_color(color);
            if color == png::ColorType::Indexed {
                encoder.set_palette(vec![11, 22, 33, 44, 55, 66, 77, 88, 99, 100, 110, 120]);
                encoder.set_trns(vec![0, 64, 128, 255]);
            }
            encoder
                .write_header()
                .unwrap()
                .write_image_data(data)
                .unwrap();
        }
        bytes
    }

    #[test]
    fn packed_grayscale_preserves_source_depth_and_expands_exactly() {
        for (depth, packed, gray) in [
            (png::BitDepth::One, vec![0b0101_0000], vec![0, 255, 0, 255]),
            (png::BitDepth::Two, vec![0b0001_1011], vec![0, 85, 170, 255]),
            (png::BitDepth::Four, vec![0x05, 0xaf], vec![0, 85, 170, 255]),
        ] {
            let frame = decode_bytes(
                &packed_png(depth, png::ColorType::Grayscale, &packed),
                "png",
            )
            .unwrap();
            assert_eq!(frame.original_depth, depth as u32);
            match frame.pixels {
                Pixels::U8(values) => assert_eq!(
                    values,
                    gray.into_iter()
                        .flat_map(|v| [v, v, v, 255])
                        .collect::<Vec<_>>()
                ),
                _ => panic!("Wrong expanded depth"),
            }
        }
    }

    #[test]
    fn palette_transparency_expands_without_changing_colors() {
        let frame = decode_bytes(
            &packed_png(png::BitDepth::Two, png::ColorType::Indexed, &[0b0001_1011]),
            "png",
        )
        .unwrap();
        assert_eq!(frame.original_depth, 2);
        match frame.pixels {
            Pixels::U8(values) => assert_eq!(
                values,
                [
                    11, 22, 33, 0, 44, 55, 66, 64, 77, 88, 99, 128, 100, 110, 120, 255
                ]
            ),
            _ => panic!("Wrong palette depth"),
        }
    }

    #[test]
    fn sixteen_bit_rgb_and_grayscale_alpha_keep_low_bits() {
        for (color, samples, expected) in [
            (
                ExtendedColorType::Rgb16,
                vec![1u16, 258, 65534],
                vec![1u16, 258, 65534, 65535],
            ),
            (
                ExtendedColorType::La16,
                vec![12345u16, 54321],
                vec![12345u16, 12345, 12345, 54321],
            ),
        ] {
            let mut bytes = Vec::new();
            let raw: Vec<_> = samples.iter().flat_map(|v| v.to_ne_bytes()).collect();
            PngEncoder::new(&mut bytes)
                .write_image(&raw, 1, 1, color)
                .unwrap();
            let frame = decode_bytes(&bytes, "png").unwrap();
            assert_eq!(frame.original_depth, 16);
            match frame.pixels {
                Pixels::U16(values) => assert_eq!(values, expected),
                _ => panic!("Precision lost"),
            }
        }
    }

    #[test]
    fn png_crc_and_truncation_are_rejected() {
        let bytes = packed_png(
            png::BitDepth::Eight,
            png::ColorType::Grayscale,
            &[1, 2, 3, 4],
        );
        let idat = bytes.windows(4).position(|v| v == b"IDAT").unwrap();
        let len = u32::from_be_bytes(bytes[idat - 4..idat].try_into().unwrap()) as usize;
        let mut corrupt = bytes.clone();
        corrupt[idat + 4 + len] ^= 1;
        assert!(
            decode_bytes(&corrupt, "png").is_err(),
            "IDAT CRC must be checked"
        );
        assert!(decode_bytes(&bytes[..idat + 5], "png").is_err());
    }
    #[test]
    fn rgba16_preserves_all_bits_and_packet_order() {
        let values = [0u16, 257, 258, 65535, 12345, 65534, 7, 65535];
        let raw: Vec<u8> = values.iter().flat_map(|n| n.to_ne_bytes()).collect();
        let mut png = Vec::new();
        PngEncoder::new(&mut png)
            .write_image(&raw, 2, 1, ExtendedColorType::Rgba16)
            .unwrap();
        let frame = decode_bytes(&png, "png").unwrap();
        match &frame.pixels {
            Pixels::U16(v) => assert_eq!(v, &values),
            _ => panic!("precision was lost"),
        }
        let packet = frame.packet();
        assert_eq!(&packet[..4], b"AYRI");
        assert_eq!(
            &packet[32..],
            &values
                .iter()
                .flat_map(|n| n.to_le_bytes())
                .collect::<Vec<_>>()
        );
    }
    #[test]
    fn grayscale_alpha_becomes_rgba() {
        let mut png = Vec::new();
        PngEncoder::new(&mut png)
            .write_image(&[42, 128, 255, 0], 2, 1, ExtendedColorType::La8)
            .unwrap();
        match decode_bytes(&png, "png").unwrap().pixels {
            Pixels::U8(v) => assert_eq!(v, [42, 42, 42, 128, 255, 255, 255, 0]),
            _ => panic!(),
        }
    }
    #[test]
    fn corrupt_and_oversized_images_fail_cleanly() {
        assert!(decode_bytes(b"not png", "png").is_err());
        assert!(validate_dimensions(32768, 32768).is_err());
    }

    #[test]
    fn rgb_png_and_lossless_webp_expand_opaque_alpha() {
        let rgb = [11, 22, 33, 44, 55, 66];
        let mut png = Vec::new();
        PngEncoder::new(&mut png)
            .write_image(&rgb, 2, 1, ExtendedColorType::Rgb8)
            .unwrap();
        let mut webp = Vec::new();
        image::codecs::webp::WebPEncoder::new_lossless(&mut webp)
            .write_image(&rgb, 2, 1, ExtendedColorType::Rgb8)
            .unwrap();
        for (bytes, format) in [(&png, "png"), (&webp, "webp")] {
            match decode_bytes(bytes, format).unwrap().pixels {
                Pixels::U8(v) => assert_eq!(v, [11, 22, 33, 255, 44, 55, 66, 255]),
                _ => panic!("Unexpected depth"),
            }
        }
    }

    #[test]
    fn jpeg_decodes_as_eight_bit_rgba() {
        let mut jpeg = Vec::new();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 100)
            .encode(&[120, 120, 120].repeat(64), 8, 8, ExtendedColorType::Rgb8)
            .unwrap();
        let frame = decode_bytes(&jpeg, "jpeg").unwrap();
        assert_eq!((frame.width, frame.height, frame.original_depth), (8, 8, 8));
        match frame.pixels {
            Pixels::U8(v) => assert!(
                v.as_chunks::<4>()
                    .0
                    .iter()
                    .all(|p| p[3] == 255 && p[0].abs_diff(120) <= 1)
            ),
            _ => panic!(),
        }
    }
}
