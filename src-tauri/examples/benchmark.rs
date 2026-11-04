//! Warm-cache stage timings. Run with exactly four PNG paths, or no arguments
//! for the generated 2560x1440 corpus from the fixtures example.
use ayori_compare_lib::decoder;
use rayon::prelude::*;
use serde_json::json;
use std::{fs, hint::black_box, path::PathBuf, time::Instant};

fn measure(mut operation: impl FnMut()) -> serde_json::Value {
    for _ in 0..5 {
        operation();
    }
    let mut samples = Vec::new();
    for _ in 0..50 {
        let start = Instant::now();
        operation();
        samples.push(start.elapsed().as_secs_f64() * 1000.);
    }
    samples.sort_by(f64::total_cmp);
    json!({"medianMs": (samples[24] + samples[25]) / 2., "p95Ms": samples[47],
        "maxMs": samples[49], "samples": 50, "warmups": 5})
}

fn main() {
    let mut paths: Vec<PathBuf> = std::env::args_os().skip(1).map(PathBuf::from).collect();
    if paths.is_empty() {
        paths = [
            "Reference/00001.png",
            "Grain/00001.png",
            "Quantized/00001.png",
            "Reference/00002.png",
        ]
        .map(|p| PathBuf::from("local-fixtures").join(p))
        .to_vec();
    }
    assert_eq!(paths.len(), 4, "Supply exactly four input files");
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(4)
        .build()
        .unwrap();
    let inputs: Vec<_> = paths.iter().map(|p| fs::read(p).unwrap()).collect();
    let frames: Vec<_> = paths.iter().map(|p| decoder::decode(p).unwrap()).collect();
    let corpus: Vec<_> = frames
        .iter()
        .zip(&inputs)
        .map(|(f, bytes)| {
            json!({
                "width":f.width,"height":f.height,"sourceDepth":f.original_depth,
                "payloadDepth":f.depth(),"fileBytes":bytes.len()
            })
        })
        .collect();
    let read_decode = measure(|| {
        pool.install(|| {
            paths.par_iter().for_each(|p| {
                black_box(decoder::decode(p).unwrap());
            })
        })
    });
    let decode_only = measure(|| {
        pool.install(|| {
            inputs.par_iter().for_each(|b| {
                black_box(decoder::decode_bytes(b, "png").unwrap());
            })
        })
    });
    let read_only = measure(|| {
        pool.install(|| {
            paths.par_iter().for_each(|p| {
                black_box(fs::read(p).unwrap());
            })
        })
    });
    let packet = measure(|| {
        black_box(frames[0].packet());
    });
    // Convenience API comparison includes cloning an already-RGBA image, unlike
    // the consuming conversion in the application path.
    let image_png = measure(|| {
        pool.install(|| {
            inputs.par_iter().for_each(|b| {
                black_box(
                    image::load_from_memory_with_format(b, image::ImageFormat::Png)
                        .unwrap()
                        .to_rgba8(),
                );
            })
        })
    });
    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "threads":4,"cache":"warm filesystem; resident compressed data for decodeOnly",
            "corpus":corpus,"readDecodeRgba":read_decode,"decodeOnlyRgba":decode_only,
        "readOnly":read_only,"oneFramePacket":packet,"imageConvenienceApiWithClone":image_png
        }))
        .unwrap()
    );
}
