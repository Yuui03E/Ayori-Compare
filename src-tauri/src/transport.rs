//! Windows shares a read-only mapping with WebView2. Other runtimes keep AYRI IPC.
//! COM objects stay on the window thread; only an independently owned mapping
//! handle crosses to the worker that copies pixels. JavaScript releases its view.

#[tauri::command]
pub async fn shared_frames_available(window: tauri::WebviewWindow) -> Result<bool, String> {
    #[cfg(windows)]
    return windows_transport::available(window).await;
    #[cfg(not(windows))]
    {
        let _ = window;
        Ok(false)
    }
}

#[cfg(all(windows, feature = "diagnostics"))]
pub use windows_transport::stats;
#[cfg(windows)]
pub use windows_transport::{reset, send};

#[tauri::command]
pub async fn release_shared_frame(
    window: tauri::WebviewWindow,
    request: String,
) -> Result<(), String> {
    #[cfg(windows)]
    return windows_transport::release(window, request).await;
    #[cfg(not(windows))]
    {
        let _ = (window, request);
        Ok(())
    }
}

#[cfg(windows)]
mod windows_transport {
    use std::{
        cell::RefCell,
        collections::HashMap,
        os::windows::io::{AsRawHandle, BorrowedHandle, OwnedHandle},
        sync::{
            Arc,
            atomic::{AtomicU64, Ordering},
        },
    };
    use tauri::{WebviewWindow, webview::PlatformWebview};
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY, ICoreWebView2_17, ICoreWebView2Environment12,
        ICoreWebView2SharedBuffer,
    };
    use windows::{
        Win32::{
            Foundation::HANDLE,
            System::Memory::{FILE_MAP_WRITE, MapViewOfFile, UnmapViewOfFile},
        },
        core::{HSTRING, Interface},
    };

    struct Buffer {
        inner: ICoreWebView2SharedBuffer,
        size: usize,
    }
    impl Drop for Buffer {
        fn drop(&mut self) {
            let _ = unsafe { self.inner.Close() };
        }
    }
    #[derive(Default)]
    struct Registry {
        pending: HashMap<u64, Buffer>,
        active: HashMap<String, Buffer>,
        // One idle allocation, at most 32 MiB. Never reuse a script-owned buffer.
        spare: Option<Buffer>,
    }
    thread_local! {
        // Accessed exclusively by with_webview callbacks on the UI thread.
        static BUFFERS: RefCell<HashMap<String, Registry>> = RefCell::default();
    }
    static NEXT_ID: AtomicU64 = AtomicU64::new(1);

    async fn on_webview<T: Send + 'static>(
        window: &WebviewWindow,
        action: impl FnOnce(PlatformWebview) -> Result<T, String> + Send + 'static,
    ) -> Result<T, String> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        window
            .with_webview(move |view| {
                let _ = tx.send(action(view));
            })
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    pub async fn available(window: WebviewWindow) -> Result<bool, String> {
        on_webview(&window, |view| unsafe {
            Ok(view
                .environment()
                .cast::<ICoreWebView2Environment12>()
                .is_ok()
                && view
                    .controller()
                    .CoreWebView2()
                    .and_then(|v| v.cast::<ICoreWebView2_17>())
                    .is_ok())
        })
        .await
    }

    pub fn reset(view: tauri::Webview) {
        let label = view.label().to_owned();
        let _ = view.with_webview(move |_| {
            BUFFERS.with(|b| b.borrow_mut().remove(&label));
        });
    }

    pub async fn release(window: WebviewWindow, request: String) -> Result<(), String> {
        let label = window.label().to_owned();
        on_webview(&window, move |_| {
            BUFFERS.with(|b| {
                if let Some(registry) = b.borrow_mut().get_mut(&label)
                    && let Some(buffer) = registry.active.remove(&request)
                    && buffer.size <= 32 * 1024 * 1024
                    && registry.spare.is_none()
                {
                    registry.spare = Some(buffer);
                }
            });
            Ok(())
        })
        .await
    }

    #[cfg(feature = "diagnostics")]
    pub async fn stats(window: WebviewWindow) -> Result<serde_json::Value, String> {
        let label = window.label().to_owned();
        on_webview(&window, move |_| {
            Ok(BUFFERS.with(|b| {
                let state = b.borrow();
                let registry = state.get(&label);
                serde_json::json!({
                    "pending": registry.map_or(0, |r| r.pending.len()),
                    "active": registry.map_or(0, |r| r.active.len()),
                    "spareBytes": registry.and_then(|r| r.spare.as_ref()).map_or(0, |b| b.size)
                })
            }))
        })
        .await
    }

    struct PendingBuffer {
        id: u64,
        window: WebviewWindow,
    }
    impl Drop for PendingBuffer {
        fn drop(&mut self) {
            let id = self.id;
            let label = self.window.label().to_owned();
            // Also runs on cancellation, stale work, allocation/copy/post errors.
            let _ = self.window.with_webview(move |_| {
                BUFFERS.with(|b| {
                    if let Some(registry) = b.borrow_mut().get_mut(&label) {
                        registry.pending.remove(&id);
                    }
                });
            });
        }
    }

    pub async fn send(
        window: WebviewWindow,
        packet: impl AsRef<[u8]> + Send + 'static,
        request: String,
        current: Option<(Arc<AtomicU64>, u64)>,
    ) -> Result<(), String> {
        let pending = PendingBuffer {
            id: NEXT_ID.fetch_add(1, Ordering::Relaxed),
            window,
        };
        let id = pending.id;
        let size = packet.as_ref().len();
        let label = pending.window.label().to_owned();
        let allocation_label = label.clone();
        let handle: OwnedHandle = on_webview(&pending.window, move |view| unsafe {
            let environment = view
                .environment()
                .cast::<ICoreWebView2Environment12>()
                .map_err(|e| e.to_string())?;
            let spare = BUFFERS.with(|b| {
                b.borrow_mut()
                    .entry(allocation_label.clone())
                    .or_default()
                    .spare
                    .take()
            });
            let buffer = match spare.filter(|b| b.size == size) {
                Some(buffer) => buffer,
                None => Buffer {
                    inner: environment
                        .CreateSharedBuffer(size as u64)
                        .map_err(|e| e.to_string())?,
                    size,
                },
            };
            let mut raw = HANDLE::default();
            buffer
                .inner
                .FileMappingHandle(&mut raw)
                .map_err(|e| e.to_string())?;
            // Duplicate ownership before leaving COM's thread. Closing the COM
            // buffer can never invalidate this worker's handle or mapping.
            let handle = BorrowedHandle::borrow_raw(raw.0)
                .try_clone_to_owned()
                .map_err(|e| e.to_string())?;
            BUFFERS.with(|b| {
                b.borrow_mut()
                    .entry(allocation_label)
                    .or_default()
                    .pending
                    .insert(id, buffer)
            });
            Ok(handle)
        })
        .await?;
        tauri::async_runtime::spawn_blocking(move || unsafe {
            let view = MapViewOfFile(HANDLE(handle.as_raw_handle()), FILE_MAP_WRITE, 0, 0, size);
            if view.Value.is_null() {
                return Err(windows::core::Error::from_thread().to_string());
            }
            // The new mapping has exactly `size` writable bytes and is not posted
            // to JavaScript until this sole writer finishes and unmaps it.
            std::ptr::copy_nonoverlapping(packet.as_ref().as_ptr(), view.Value.cast::<u8>(), size);
            UnmapViewOfFile(view).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())??;
        let metadata = HSTRING::from(serde_json::json!({ "ayori": request }).to_string());
        on_webview(&pending.window, move |view| unsafe {
            if current
                .as_ref()
                .is_some_and(|(value, epoch)| value.load(Ordering::SeqCst) != *epoch)
            {
                return Err("Scene changed.".into());
            }
            let buffer = BUFFERS
                .with(|b| {
                    b.borrow_mut()
                        .get_mut(&label)
                        .and_then(|r| r.pending.remove(&id))
                })
                .ok_or("Frame mapping is unavailable.")?;
            if BUFFERS.with(|b| {
                b.borrow()
                    .get(&label)
                    .is_some_and(|r| r.active.contains_key(&request))
            }) {
                return Err("Frame request already delivered.".into());
            }
            let result = view
                .controller()
                .CoreWebView2()
                .and_then(|v| v.cast::<ICoreWebView2_17>())
                .and_then(|v| {
                    v.PostSharedBufferToScript(
                        &buffer.inner,
                        COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY,
                        &metadata,
                    )
                });
            result.map_err(|e| e.to_string())?;
            BUFFERS.with(|b| {
                b.borrow_mut()
                    .entry(label)
                    .or_default()
                    .active
                    .insert(request, buffer)
            });
            Ok(())
        })
        .await
    }
}
