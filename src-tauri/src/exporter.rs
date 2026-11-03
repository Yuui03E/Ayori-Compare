use crate::{decoder, models::ComparisonMatrix};
use base64::{Engine, engine::general_purpose::STANDARD};
use flate2::{Compression, write::ZlibEncoder};
use std::{collections::HashMap, io::{Write, BufWriter}, path::Path};

fn safe_json(value: &serde_json::Value) -> Result<String,String> {
    serde_json::to_string(value).map(|s| s.replace('<',"\\u003c").replace('>',"\\u003e").replace('&',"\\u0026")).map_err(|e|e.to_string())
}

pub fn export(matrix: &ComparisonMatrix, path: &Path) -> Result<(),String> {
    if path.extension().and_then(|s|s.to_str()).map(|s|s.eq_ignore_ascii_case("html"))!=Some(true){return Err("Choose an .html output file.".into());}
    let parent=path.parent().ok_or("Invalid output path.")?;
    let mut output=tempfile::NamedTempFile::new_in(parent).map_err(|e|e.to_string())?;
    let mut paths=Vec::new();let mut ids=HashMap::new();
    let scenes:Vec<_>=matrix.scenes.iter().map(|scene|{
        let frames:Vec<_>=scene.frames.iter().map(|path|path.as_ref().map(|p|*ids.entry(p.clone()).or_insert_with(||{let id=paths.len();paths.push(p.clone());id}))).collect();
        serde_json::json!({"label":scene.label,"frames":frames})
    }).collect();
    let sources:Vec<_>=matrix.sources.iter().map(|s|serde_json::json!({"label":s.label})).collect();
    let manifest=safe_json(&serde_json::json!({"sources":sources,"scenes":scenes}))?;
    {
        let mut writer=BufWriter::new(output.as_file_mut());
        writer.write_all(include_bytes!("offline-template.html")).map_err(|e|e.to_string())?;
        write!(writer,"<script id=\"manifest\" type=\"application/json\">{manifest}</script><script id=\"packets\" type=\"application/json\">[").map_err(|e|e.to_string())?;
        for (i,p) in paths.iter().enumerate(){
            let frame=decoder::decode(Path::new(p)).map_err(|e|format!("Cannot export {p}: {e}"))?;
            let mut compressor=ZlibEncoder::new(Vec::new(),Compression::fast());
            compressor.write_all(&frame.packet()).map_err(|e|e.to_string())?;
            let compressed=compressor.finish().map_err(|e|e.to_string())?;
            if i>0{writer.write_all(b",").map_err(|e|e.to_string())?;}
            write!(writer,"\"{}\"",STANDARD.encode(compressed)).map_err(|e|e.to_string())?;
        }
        writer.write_all(b"]</script><script>").map_err(|e|e.to_string())?;
        writer.write_all(include_bytes!("../../dist/offline.js")).map_err(|e|e.to_string())?;
        writer.write_all(b"</script></body></html>").map_err(|e|e.to_string())?;
        writer.flush().map_err(|e|e.to_string())?;
    }
    output.persist(path).map_err(|e|e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests{
    use super::*;
    #[test]fn embedded_labels_cannot_escape_json_script(){assert!(!safe_json(&serde_json::json!({"label":"</script><script>alert(1)</script>"})).unwrap().contains('<'));}
}
