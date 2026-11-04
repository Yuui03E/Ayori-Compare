//! Compare the OS clipboard image to the PNG captured at the copy boundary.
fn main() {
    let path = std::env::args_os().nth(1).expect("Expected PNG path");
    let expected = image::open(path).unwrap().into_rgba8();
    let actual = arboard::Clipboard::new().unwrap().get_image().unwrap();
    assert_eq!(
        (actual.width, actual.height),
        (expected.width() as usize, expected.height() as usize)
    );
    assert_eq!(
        actual.bytes.as_ref(),
        expected.as_raw(),
        "Clipboard pixels changed"
    );
    println!(
        "Clipboard matches all {} RGBA pixels ({}x{}).",
        actual.width * actual.height,
        actual.width,
        actual.height
    );
}
