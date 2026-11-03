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
