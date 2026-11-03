fn main() {
    println!("cargo:rerun-if-changed=../dist/offline.js");
    tauri_build::build()
}
