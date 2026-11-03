use ayori_compare_lib::decoder;
use image::{ImageBuffer, Rgba, ImageEncoder};
use rayon::prelude::*;
use std::{fs, path::PathBuf, time::Instant};

fn main() {
    let root=PathBuf::from(std::env::args().nth(1).unwrap_or_else(||"local-fixtures".into()));
    let labels=["Reference","Grain","Quantized","High-depth"];
    let (w,h)=(2560,1440);
    for (slot,label) in labels.iter().enumerate(){
        let folder=root.join(label);fs::create_dir_all(&folder).unwrap();
        for scene in 1..=3 {
            if slot==3&&scene==2 {continue;}
            let image=ImageBuffer::from_fn(w,h,|x,y|{
                let base=((x*180/w+y*65/h+scene*3)%256) as u8;
                let noise=if slot==1 {((x.wrapping_mul(2654435761)^y.wrapping_mul(2246822519))%5) as u8}else{0};
                let q=if slot==2 {base/8*8}else{base.saturating_add(noise)};
                Rgba([q,q/2,255-q,255])
            });
            let path=folder.join(format!("{scene:05}.png"));
            if slot==3 {
                let pixels:Vec<u16>=image.as_raw().iter().enumerate().map(|(i,&v)|if i%4==3{65535}else{u16::from(v)*257+u16::from(v<255)}).collect();
                let bytes:Vec<u8>=pixels.iter().flat_map(|x|x.to_ne_bytes()).collect();
                image::codecs::png::PngEncoder::new(fs::File::create(path).unwrap()).write_image(&bytes,w,h,image::ExtendedColorType::Rgba16).unwrap();
            } else {image.save(path).unwrap();}
        }
    }
    let paths:Vec<_>=labels[..3].iter().map(|label|root.join(label).join("00001.png")).chain(std::iter::once(root.join("Reference").join("00002.png"))).collect();
    let pool=rayon::ThreadPoolBuilder::new().num_threads(4).build().unwrap();
    let mut samples=Vec::new();
    for _ in 0..12 {let start=Instant::now();pool.install(||paths.par_iter().for_each(|path|{std::hint::black_box(decoder::decode(path).unwrap());}));samples.push(start.elapsed().as_secs_f64()*1000.);}
    samples.sort_by(f64::total_cmp);
    println!("Generated fixture folders: {}",root.display());
    println!("Warm 4 × 2560×1440 PNG read + decode: median {:.2} ms; max {:.2} ms (12 iterations, 4 threads)",samples[6],samples[11]);
}
