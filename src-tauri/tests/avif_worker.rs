use std::{fs, process::Command};

fn worker(path: &std::path::Path) -> std::process::Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_ayori-compare"));
    command.arg("--decode-avif-worker").arg(path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command.output().unwrap()
}

#[test]
fn valid_avif_produces_a_complete_rgba_packet() {
    let result =
        worker(&std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/tiny.avif"));
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert_eq!(&result.stdout[..4], b"AYRI");
    assert_eq!(
        u32::from_le_bytes(result.stdout[4..8].try_into().unwrap()),
        16
    );
    assert_eq!(result.stdout.len(), 32 + 16 * 16 * 4);
}

#[test]
fn malformed_avif_failure_is_contained_in_the_worker() {
    let tmp = tempfile::tempdir().unwrap();
    let path = tmp.path().join("corrupt.avif");
    let mut data = include_bytes!("fixtures/tiny.avif").to_vec();
    data[280] ^= 1;
    fs::write(&path, data).unwrap();
    let result = worker(&path);
    assert!(!result.status.success());
    // This assertion is reached even when rav1d aborts the worker process.
    assert!(tmp.path().exists());
}

#[test]
fn high_depth_identity_avif_retains_every_encoded_sample() {
    for depth in [10u32, 12] {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join(format!("tests/fixtures/ramp{depth}.avif"));
        let output = worker(&path);
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let bytes = output.stdout;
        let field = |i| u32::from_le_bytes(bytes[i..i + 4].try_into().unwrap());
        assert_eq!(
            (field(4), field(8), field(12), field(24)),
            (32, 16, 16, depth)
        );
        assert_eq!(bytes.len(), 32 + 32 * 16 * 8);
        let max = (1u32 << depth) - 1;
        for y in 0..16u32 {
            for x in 0..32u32 {
                let original = [
                    (x * 2114) % 65536,
                    (y * 4369) % 65536,
                    (x * 997 + y * 1777) % 65536,
                ];
                let offset = 32 + (y * 32 + x) as usize * 8;
                for channel in 0..3 {
                    let encoded = (original[channel] * max + 32767) / 65535;
                    // avif-decode expands RGB by bit replication. This is
                    // reversible and differs by at most one from rounded scaling.
                    let shift = 16 - depth;
                    let expected = ((encoded << shift) | (encoded >> (depth - shift))) as u16;
                    let actual = u16::from_le_bytes(
                        bytes[offset + channel * 2..offset + channel * 2 + 2]
                            .try_into()
                            .unwrap(),
                    );
                    assert_eq!(
                        actual, expected,
                        "depth {depth}, pixel {x},{y}, channel {channel}"
                    );
                    assert_eq!(u32::from(actual) >> shift, encoded);
                }
                assert_eq!(&bytes[offset + 6..offset + 8], &65535u16.to_le_bytes());
            }
        }
    }
}

#[test]
fn rec709_yuv_subsampling_range_and_depth_match_known_planes() {
    for depth in [8u32, 10, 12] {
        for format in [420, 422, 444] {
            for limited in [false, true] {
                let range = if limited { "limited" } else { "full" };
                let filename = format!("yuv{format}-{depth}-{range}.avif");
                let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("tests/fixtures")
                    .join(&filename);
                let output = worker(&path);
                assert!(
                    output.status.success(),
                    "{filename}: {}",
                    String::from_utf8_lossy(&output.stderr)
                );
                let bytes = output.stdout;
                let field = |i| u32::from_le_bytes(bytes[i..i + 4].try_into().unwrap());
                let payload = if depth == 8 { 8 } else { 16 };
                assert_eq!(
                    (field(4), field(8), field(12), field(24)),
                    (32, 16, payload, depth)
                );
                assert_eq!(bytes.len(), 32 + 32 * 16 * 4 * (payload / 8) as usize);
                let max = ((1u32 << depth) - 1) as f64;
                let scale = (1u32 << (depth - 8)) as f64;
                let output_max = if depth == 8 { 255. } else { 65535. };
                // Different conforming fixed-point YUV converters can round at
                // encoded depth before expansion. Allow two encoded RGB steps.
                let tolerance = 2. * output_max / max;
                for y in 0..16usize {
                    let y_code = if limited {
                        16. * scale + (y as f64 * 219. * scale / 15.).round()
                    } else {
                        (y as f64 * max / 15.).round()
                    };
                    let luma = if limited {
                        (y_code - 16. * scale) / (219. * scale)
                    } else {
                        y_code / max
                    };
                    for x in 0..32usize {
                        // Stay inside constant-chroma stripes so chroma-filter
                        // choice at a subsampled boundary cannot change the oracle.
                        if !(2..=5).contains(&(x % 8)) {
                            continue;
                        }
                        let block = x / 8;
                        let chroma_divisor = if limited { 224. * scale } else { max };
                        let cb = ([128., 96., 160., 128.][block] - 128.) * scale / chroma_divisor;
                        let cr = ([128., 128., 128., 160.][block] - 128.) * scale / chroma_divisor;
                        let expected = [
                            luma + 1.5748 * cr,
                            luma - 0.1873242729306488 * cb - 0.4681242729306488 * cr,
                            luma + 1.8556 * cb,
                            1.,
                        ];
                        for (channel, expected) in expected.iter().enumerate() {
                            let offset = 32 + ((y * 32 + x) * 4 + channel) * (payload / 8) as usize;
                            let sample = if payload == 8 {
                                u16::from(bytes[offset])
                            } else {
                                u16::from_le_bytes([bytes[offset], bytes[offset + 1]])
                            };
                            let expected = expected.clamp(0., 1.) * output_max;
                            assert!(
                                (f64::from(sample) - expected).abs() <= tolerance,
                                "{filename}: {x},{y} channel {channel}: {sample} vs {expected} (tolerance {tolerance})"
                            );
                        }
                    }
                }
            }
        }
    }
}
