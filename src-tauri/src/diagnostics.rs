//! Opt-in IPC measurement without disk reads, decoding, or GPU uploads.
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub struct DiagnosticBuffer(Arc<Mutex<Arc<[u8]>>>);

#[tauri::command]
pub async fn benchmark_shared_state(
    window: tauri::WebviewWindow,
) -> Result<serde_json::Value, String> {
    #[cfg(windows)]
    return crate::transport::stats(window).await;
    #[cfg(not(windows))]
    {
        let _ = window;
        Ok(serde_json::json!({ "unsupported": true }))
    }
}

#[tauri::command]
pub async fn benchmark_prepare(state: tauri::State<'_, DiagnosticBuffer>) -> Result<usize, String> {
    let buffer = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let frame = crate::decoder::Frame {
            width: 2560,
            height: 1440,
            original_depth: 8,
            file_size: 0,
            pixels: crate::decoder::Pixels::U8([31, 63, 127, 255].repeat(2560 * 1440)),
        };
        let packet = frame.packet();
        let len = packet.len();
        *buffer.lock().map_err(|e| e.to_string())? = packet.into();
        Ok(len)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn benchmark_transfer(
    state: tauri::State<'_, DiagnosticBuffer>,
) -> Result<tauri::ipc::Response, String> {
    let buffer = state.0.clone();
    let packet = tauri::async_runtime::spawn_blocking(move || {
        let bytes = buffer.lock().map_err(|e| e.to_string())?;
        if bytes.is_empty() {
            return Err("Prepare the benchmark buffer first.".to_string());
        }
        // Response requires owned bytes. This copy and the worker dispatch are
        // intentionally included in the measured round trip.
        Ok(bytes.to_vec())
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(packet))
}

#[tauri::command]
pub async fn benchmark_shared_transfer(
    request: String,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, DiagnosticBuffer>,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        let packet = state.0.lock().map_err(|e| e.to_string())?.clone();
        if packet.is_empty() {
            return Err("Prepare the benchmark buffer first.".into());
        }
        crate::transport::send(window, packet, request, None).await
    }
    #[cfg(not(windows))]
    {
        let _ = (request, window, state);
        Err("Shared frames are unavailable on this platform.".into())
    }
}
