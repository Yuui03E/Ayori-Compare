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
