//! Generate our own small RGB16 ramp for independently encoded AVIF fixtures.
use image::{ImageBuffer, Rgb};
fn main() {
    let image = ImageBuffer::from_fn(32, 16, |x, y| {
        Rgb([
            ((x * 2114) % 65536) as u16,
            ((y * 4369) % 65536) as u16,
            ((x * 997 + y * 1777) % 65536) as u16,
        ])
    });
    image.save("local-fixtures/precision-rgb16.png").unwrap();
}
