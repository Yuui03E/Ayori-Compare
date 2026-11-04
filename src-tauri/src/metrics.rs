use crate::decoder;
use fast_ssim2::{PixelDescriptor, PixelSlice, Ssimulacra2Reference};
use image::{RgbImage, imageops::FilterType};
use serde::Serialize;
use std::{
    collections::HashMap,
    path::Path,
    sync::atomic::{AtomicU64, Ordering},
};
use tauri::Emitter;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Metric {
    pub slot: usize,
    pub score: Option<f64>,
    pub resampled: bool,
    pub error: Option<String>,
    pub epoch: u64,
    pub revision: u64,
}

pub fn compute(
    paths: &[Option<String>],
    slots: Option<&[usize]>,
    epoch: u64,
    revision: u64,
    current: &AtomicU64,
    latest: &AtomicU64,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    let Some(Some(reference_path)) = paths.first() else {
        return Err("Reference source 1 is missing in this scene.".into());
    };
    let reference = decoder::decode(Path::new(reference_path))?;
    let (rw, rh) = (reference.width, reference.height);
    let rgb = RgbImage::from_raw(rw, rh, reference.rgb8()).ok_or("Invalid reference.")?;
    drop(reference);
    let mut references = HashMap::new();
    for (slot, path) in paths.iter().enumerate().skip(1) {
        if current.load(Ordering::SeqCst) != epoch || latest.load(Ordering::SeqCst) != revision {
            return Ok(());
        }
        if slots.is_some_and(|selected| !selected.contains(&slot)) {
            continue;
        }
        let Some(path) = path else {
            continue;
        };
        let mut metric = Metric {
            slot,
            score: None,
            resampled: false,
            error: None,
            epoch,
            revision,
        };
        let result = (|| -> Result<f64, String> {
            let candidate = decoder::decode(Path::new(path))?;
            let (w, h) = (candidate.width, candidate.height);
            metric.resampled = (w, h) != (rw, rh);
            if !references.contains_key(&(w, h)) {
                let resized = if metric.resampled {
                    image::imageops::resize(&rgb, w, h, FilterType::CatmullRom)
                } else {
                    rgb.clone()
                };
                let slice = PixelSlice::new(
                    resized.as_raw(),
                    w,
                    h,
                    w as usize * 3,
                    PixelDescriptor::RGB8_SRGB,
                )
                .map_err(|e| e.to_string())?;
                let cached = Ssimulacra2Reference::new(&slice).map_err(|e| e.to_string())?;
                // Bound preprocessing memory even with eight distinct resolutions.
                if references.len() >= 2 {
                    references.clear();
                }
                references.insert((w, h), cached);
            }
            let data = candidate.rgb8();
            let slice = PixelSlice::new(&data, w, h, w as usize * 3, PixelDescriptor::RGB8_SRGB)
                .map_err(|e| e.to_string())?;
            references[&(w, h)]
                .compare(&slice)
                .map_err(|e| e.to_string())
        })();
        match result {
            Ok(score) if score.is_finite() => metric.score = Some(score),
            Ok(_) => metric.error = Some("Metric returned a non-finite value.".into()),
            Err(error) => metric.error = Some(error),
        }
        if current.load(Ordering::SeqCst) != epoch || latest.load(Ordering::SeqCst) != revision {
            return Ok(());
        }
        let _ = app.emit("metric-ready", metric);
    }
    Ok(())
}
