#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<_> = std::env::args_os().collect();
    if args.get(1).is_some_and(|a| a == "--decode-avif-worker") {
        use std::io::Write;
        let result = args
            .get(2)
            .ok_or("Missing image path.".to_string())
            .and_then(|path| {
                ayori_compare_lib::decoder::decode_avif_worker(std::path::Path::new(path))
            });
        match result {
            Ok(frame) => {
                let _ = std::io::stdout().write_all(&frame.packet());
            }
            Err(error) => {
                let _ = writeln!(std::io::stderr(), "{error}");
                std::process::exit(1);
            }
        }
        return;
    }
    ayori_compare_lib::run();
}
