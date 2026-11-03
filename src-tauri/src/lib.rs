pub mod decoder;
pub mod matrix;
pub mod models;
mod metrics;
mod watcher;
mod exporter;

use models::ComparisonMatrix;
use std::{path::Path, sync::{Arc, Mutex, atomic::{AtomicU64, Ordering}}};
use tauri::State;

struct Backend {
    matrix: Mutex<Option<ComparisonMatrix>>,
    active: Mutex<Vec<Option<String>>>,
    epoch: Arc<AtomicU64>,
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
    decode_slots: Arc<tokio::sync::Semaphore>,
    metric_slot: Arc<tokio::sync::Semaphore>,
}
impl Default for Backend {
    fn default() -> Self { Self { matrix: Mutex::new(None), active: Mutex::new(vec![]), epoch: Arc::new(AtomicU64::new(0)), watcher: Mutex::new(None), decode_slots: Arc::new(tokio::sync::Semaphore::new(4)), metric_slot: Arc::new(tokio::sync::Semaphore::new(1)) } }
}

#[tauri::command]
async fn import_sources(paths: Vec<String>, append: bool, state: State<'_, Backend>) -> Result<ComparisonMatrix, String> {
    let previous = if append { state.matrix.lock().map_err(|e| e.to_string())?.clone() } else { None };
    let matrix = tauri::async_runtime::spawn_blocking(move || matrix::build(paths, previous)).await.map_err(|e| e.to_string())??;
    *state.matrix.lock().map_err(|e| e.to_string())? = Some(matrix.clone());
    Ok(matrix)
}

#[derive(serde::Serialize)]
struct Activated { epoch: u64, warning: Option<String> }

#[tauri::command]
fn activate_scene(index: usize, app: tauri::AppHandle, state: State<'_, Backend>) -> Result<Activated, String> {
    let matrix = state.matrix.lock().map_err(|e| e.to_string())?;
    let scene = matrix.as_ref().and_then(|m| m.scenes.get(index)).ok_or("Scene is unavailable.")?;
    let paths = scene.frames.clone();
    let epoch = state.epoch.fetch_add(1, Ordering::SeqCst) + 1;
    *state.active.lock().map_err(|e| e.to_string())? = paths.clone();
    let result = watcher::watch(paths.into_iter().flatten().collect(), epoch, state.epoch.clone(), app);
    let warning = result.as_ref().err().cloned();
    *state.watcher.lock().map_err(|e| e.to_string())? = result.ok();
    Ok(Activated { epoch, warning })
}

#[tauri::command]
async fn load_frame_binary(path: String, epoch: u64, state: State<'_, Backend>) -> Result<tauri::ipc::Response, String> {
    if !state.active.lock().map_err(|e| e.to_string())?.iter().flatten().any(|p| p == &path) { return Err("Image is not part of the active scene.".into()); }
    let permit = state.decode_slots.clone().acquire_owned().await.map_err(|e| e.to_string())?;
    let current = state.epoch.clone();
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        if current.load(Ordering::SeqCst) != epoch { return Err("Scene changed.".to_string()); }
        let frame = decoder::decode(Path::new(&path))?;
        if current.load(Ordering::SeqCst) != epoch { return Err("Scene changed.".to_string()); }
        Ok(frame.packet())
    }).await.map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
async fn compute_metrics(epoch: u64, revision: u64, app: tauri::AppHandle, state: State<'_, Backend>) -> Result<(), String> {
    let paths = state.active.lock().map_err(|e| e.to_string())?.clone();
    let permit = state.metric_slot.clone().acquire_owned().await.map_err(|e| e.to_string())?;
    let current = state.epoch.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        if current.load(Ordering::SeqCst) != epoch { return Ok(()); }
        metrics::compute(&paths, epoch, revision, &current, &app)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn export_html(path: String, state: State<'_, Backend>) -> Result<(),String> {
    let matrix=state.matrix.lock().map_err(|e|e.to_string())?.clone().ok_or("No comparison to export.")?;
    tauri::async_runtime::spawn_blocking(move||exporter::export(&matrix,Path::new(&path))).await.map_err(|e|e.to_string())?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(Backend::default())
        .invoke_handler(tauri::generate_handler![import_sources, activate_scene, load_frame_binary, compute_metrics, export_html])
        .run(tauri::generate_context!())
        .expect("Unable to start Ayori Compare");
}
