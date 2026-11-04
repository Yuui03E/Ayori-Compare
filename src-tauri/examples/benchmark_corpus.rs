//! Creates ignored 4x1440p PNG benchmark corpora: deterministic noise and, when
//! four paths are supplied, resized copies of real images. Originals are untouched.
use image::{ImageBuffer, Rgba, imageops::FilterType};
use std::{fs, path::PathBuf};

fn main() {
    let root = PathBuf::from("local-fixtures/benchmark-corpus");
    fs::create_dir_all(&root).unwrap();
    for i in 0..4u32 {
        let mut seed = 0x1234abcd ^ (i * 0x01010101);
        let frame = ImageBuffer::from_fn(2560, 1440, |_, _| {
            let mut next = || {
                seed ^= seed << 13;
                seed ^= seed >> 17;
                seed ^= seed << 5;
                seed as u8
            };
            Rgba([next(), next(), next(), 255])
        });
        frame.save(root.join(format!("noise-{i}.png"))).unwrap();
    }
    let inputs: Vec<_> = std::env::args_os().skip(1).collect();
    assert!(
        inputs.is_empty() || inputs.len() == 4,
        "Supply zero or four image paths"
    );
    for (i, path) in inputs.iter().enumerate() {
        image::open(path)
            .unwrap()
            .resize_exact(2560, 1440, FilterType::CatmullRom)
            .into_rgba8()
            .save(root.join(format!("real-{i}.png")))
            .unwrap();
    }
    println!("Generated benchmark PNGs in {}", root.display());
}
