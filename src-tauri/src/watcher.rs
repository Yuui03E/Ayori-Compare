use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::{collections::HashSet, path::PathBuf, sync::{Arc, atomic::{AtomicU64, Ordering}}};
use tauri::Emitter;

#[derive(Clone, Serialize)]
struct FrameChanged { epoch: u64, path: String }

pub fn watch(paths: Vec<String>, epoch: u64, current: Arc<AtomicU64>, app: tauri::AppHandle) -> Result<RecommendedWatcher, String> {
    let files: HashSet<PathBuf> = paths.iter().map(PathBuf::from).collect();
    let parents: HashSet<_> = files.iter().filter_map(|p| p.parent().map(|p| p.to_owned())).collect();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        if current.load(Ordering::SeqCst) != epoch { return; }
        if let Ok(event) = result {
            if !(event.kind.is_modify() || event.kind.is_create() || event.kind.is_remove()) { return; }
            for changed in event.paths { if files.contains(&changed) { let _ = app.emit("frame-changed", FrameChanged { epoch, path: changed.to_string_lossy().into() }); } }
        }
    }).map_err(|e| e.to_string())?;
    for parent in parents { watcher.watch(&parent, RecursiveMode::NonRecursive).map_err(|e| e.to_string())?; }
    Ok(watcher)
}
