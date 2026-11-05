use crate::models::{ComparisonMatrix, Scene, Source};
use regex::Regex;
use std::{
    cmp::Ordering,
    collections::{BTreeMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::LazyLock,
};

static TRAILING_FRAME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(\d+)$").unwrap());

pub fn supported(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "png" | "webp" | "avif" | "jpg" | "jpeg"
    )
}

pub fn natural_cmp(a: &str, b: &str) -> Ordering {
    let a = a.to_lowercase();
    let b = b.to_lowercase();
    let (a, b) = (a.as_bytes(), b.as_bytes());
    let (mut i, mut j) = (0, 0);
    while i < a.len() && j < b.len() {
        if a[i].is_ascii_digit() && b[j].is_ascii_digit() {
            let (start_i, start_j) = (i, j);
            while i < a.len() && a[i].is_ascii_digit() {
                i += 1;
            }
            while j < b.len() && b[j].is_ascii_digit() {
                j += 1;
            }
            let aa = &a[start_i..i];
            let bb = &b[start_j..j];
            let aa = &aa[aa.iter().position(|&x| x != b'0').unwrap_or(aa.len())..];
            let bb = &bb[bb.iter().position(|&x| x != b'0').unwrap_or(bb.len())..];
            let order = aa.len().cmp(&bb.len()).then(aa.cmp(bb));
            if order != Ordering::Equal {
                return order;
            }
        } else {
            let order = a[i].cmp(&b[j]);
            if order != Ordering::Equal {
                return order;
            }
            i += 1;
            j += 1;
        }
    }
    a.len().cmp(&b.len()).then(a.cmp(b))
}

fn frame_number(stem: &str) -> Option<u64> {
    TRAILING_FRAME.captures(stem)?.get(1)?.as_str().parse().ok()
}

#[derive(Clone)]
struct Entry {
    path: String,
    stem: String,
    frame: Option<u64>,
    slot: usize,
}

pub fn build(
    paths: Vec<String>,
    previous: Option<ComparisonMatrix>,
) -> Result<ComparisonMatrix, String> {
    if previous
        .as_ref()
        .is_some_and(|m| m.sources.iter().any(|s| s.kind == "series"))
    {
        return crate::named_series::append(paths, previous.unwrap());
    }
    if previous.is_none() && paths.len() == 1 && Path::new(&paths[0]).is_dir() {
        return crate::named_series::from_folder(Path::new(&paths[0]));
    }
    let appending = previous.is_some();
    let mut origins: Vec<String> = previous
        .as_ref()
        .map(|m| m.sources.iter().map(|s| s.origin.clone()).collect())
        .unwrap_or_default();
    origins.extend(paths);
    if origins.len() < 2 {
        return Err("Choose at least two images or source folders to compare.".into());
    }
    let mut canonical = Vec::new();
    let mut unique = HashSet::new();
    for path in origins {
        let path = fs::canonicalize(&path).map_err(|e| format!("Cannot open {path}: {e}"))?;
        if !unique.insert(path.clone()) {
            return Err("The same source was selected more than once.".into());
        }
        canonical.push(path);
    }
    let folders = canonical.iter().all(|p| p.is_dir());
    let files = canonical.iter().all(|p| p.is_file() && supported(p));
    if !folders && !files {
        return Err("Choose only image files or only folders in one workspace. To append to a multi-scene workspace, drop a folder.".into());
    }
    if files && !appending {
        canonical.sort_by(|a, b| natural_cmp(&name(a), &name(b)));
        if let Some(matrix) = crate::named_series::from_files(&canonical) {
            return matrix;
        }
    }
    let sources = canonical
        .iter()
        .map(|p| Source {
            label: name(p),
            origin: p.to_string_lossy().into(),
            kind: if folders { "folder" } else { "file" }.into(),
            members: None,
        })
        .collect();
    if files {
        return Ok(ComparisonMatrix {
            sources,
            scenes: vec![Scene {
                id: "files".into(),
                label: "Single scene".into(),
                frames: canonical
                    .iter()
                    .map(|p| Some(p.to_string_lossy().into()))
                    .collect(),
            }],
            warnings: vec![],
        });
    }
    let mut entries = Vec::new();
    let mut warnings = Vec::new();
    for (slot, folder) in canonical.iter().enumerate() {
        let mut scanned = Vec::new();
        for item in fs::read_dir(folder).map_err(|e| e.to_string())? {
            let entry = item.map_err(|e| e.to_string())?;
            if entry.file_type().map_err(|e| e.to_string())?.is_file() && supported(&entry.path()) {
                scanned.push(entry.path());
            }
        }
        scanned.sort_by(|a, b| natural_cmp(&name(a), &name(b)));
        let mut stems: BTreeMap<String, Vec<PathBuf>> = BTreeMap::new();
        for path in scanned {
            stems
                .entry(
                    path.file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_lowercase(),
                )
                .or_default()
                .push(path);
        }
        for (stem, group) in stems {
            if group.len() > 1 {
                warnings.push(format!(
                    "{}: ambiguous stem '{stem}' has {} files; skipped.",
                    name(folder),
                    group.len()
                ));
                continue;
            }
            entries.push(Entry {
                path: group[0].to_string_lossy().into(),
                frame: frame_number(&stem),
                stem,
                slot,
            });
        }
    }
    match_entries(sources, entries, warnings)
}

fn name(path: &Path) -> String {
    path.file_name()
        .unwrap_or(path.as_os_str())
        .to_string_lossy()
        .into()
}

fn match_entries(
    sources: Vec<Source>,
    entries: Vec<Entry>,
    mut warnings: Vec<String>,
) -> Result<ComparisonMatrix, String> {
    let n = sources.len();
    let mut used = HashSet::new();
    let mut stems: BTreeMap<&str, Vec<usize>> = BTreeMap::new();
    for (i, e) in entries.iter().enumerate() {
        stems.entry(&e.stem).or_default().push(i);
    }
    let mut scenes: Vec<Scene> = Vec::new();
    let mut row_frames = Vec::new();
    for (stem, group) in stems {
        if group.len() < 2 {
            continue;
        }
        let mut cells = vec![None; n];
        for i in group {
            cells[entries[i].slot] = Some(entries[i].path.clone());
            used.insert(i);
        }
        row_frames.push(frame_number(stem));
        scenes.push(Scene {
            id: format!("stem:{stem}"),
            label: stem.to_string(),
            frames: cells,
        });
    }
    let mut numbers: BTreeMap<u64, Vec<usize>> = BTreeMap::new();
    for (i, e) in entries.iter().enumerate() {
        if !used.contains(&i)
            && let Some(frame) = e.frame
        {
            numbers.entry(frame).or_default().push(i);
        }
    }
    for (frame, group) in numbers {
        let rows: Vec<_> = row_frames
            .iter()
            .enumerate()
            .filter(|(_, f)| **f == Some(frame))
            .map(|(i, _)| i)
            .collect();
        if rows.len() > 1 {
            warnings.push(format!("Frame {frame}: several exact scenes share this number; unmatched files were not assigned."));
            continue;
        }
        let mut by_slot: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
        for i in group {
            by_slot.entry(entries[i].slot).or_default().push(i);
        }
        let mut cells = rows
            .first()
            .map(|&row| scenes[row].frames.clone())
            .unwrap_or_else(|| vec![None; n]);
        let mut selected = Vec::new();
        for (slot, indices) in by_slot {
            if indices.len() != 1 || cells[slot].is_some() {
                warnings.push(format!(
                    "{}: ambiguous frame {frame}; exact matches retained, remaining files skipped.",
                    sources[slot].label
                ));
                continue;
            }
            cells[slot] = Some(entries[indices[0]].path.clone());
            selected.push(indices[0]);
        }
        if cells.iter().flatten().count() < 2 {
            continue;
        }
        used.extend(selected);
        if let Some(&row) = rows.first() {
            scenes[row].frames = cells;
        } else {
            row_frames.push(Some(frame));
            scenes.push(Scene {
                id: format!("frame:{frame}"),
                label: format!("Frame {frame:05}"),
                frames: cells,
            });
        }
    }
    let unmatched = entries.len() - used.len();
    if unmatched > 0 {
        warnings.push(format!("{unmatched} unmatched or ambiguous image(s) excluded. Scenes need at least two sources."));
    }
    scenes.sort_by(|a, b| {
        let an = frame_number(&a.label);
        let bn = frame_number(&b.label);
        match (an, bn) {
            (Some(x), Some(y)) => x.cmp(&y).then(natural_cmp(&a.label, &b.label)),
            _ => natural_cmp(&a.label, &b.label),
        }
    });
    if scenes.is_empty() {
        return Err(format!(
            "No scenes shared by at least two folders. Match filenames or trailing frame numbers. {}",
            warnings.join(" ")
        ));
    }
    Ok(ComparisonMatrix {
        sources,
        scenes,
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn folders(names: &[&[&str]]) -> (tempfile::TempDir, Vec<String>) {
        let temp = tempfile::tempdir().unwrap();
        let mut paths = vec![];
        for (i, files) in names.iter().enumerate() {
            let folder = temp.path().join(i.to_string());
            fs::create_dir(&folder).unwrap();
            for f in *files {
                fs::write(folder.join(f), b"fixture").unwrap();
            }
            paths.push(folder.to_string_lossy().into());
        }
        (temp, paths)
    }
    #[test]
    fn sparse_numeric_and_exact_matches() {
        let (_tmp, paths) = folders(&[
            &["same.png", "source_00450.png", "only.png"],
            &["same.webp", "encode_450.png"],
            &["same.jpg"],
        ]);
        let m = build(paths, None).unwrap();
        assert_eq!(m.scenes.len(), 2);
        assert_eq!(
            m.scenes
                .iter()
                .find(|s| s.id == "frame:450")
                .unwrap()
                .frames
                .iter()
                .flatten()
                .count(),
            2
        );
        assert!(m.warnings.iter().any(|w| w.contains("1 unmatched")));
    }
    #[test]
    fn exact_matches_can_be_extended_by_unique_numeric_match() {
        let (_tmp, paths) = folders(&[&["foo_450.png"], &["foo_450.webp"], &["bar_00450.png"]]);
        let m = build(paths, None).unwrap();
        assert_eq!(m.scenes.len(), 1);
        assert_eq!(m.scenes[0].frames.iter().flatten().count(), 3);
    }
    #[test]
    fn ambiguous_numeric_candidates_are_not_arbitrarily_selected() {
        let (_tmp, paths) = folders(&[
            &["a1.png", "b1.png", "ok.png"],
            &["c1.png", "ok.png"],
            &["d1.png"],
        ]);
        let m = build(paths, None).unwrap();
        let row = m.scenes.iter().find(|s| s.id == "frame:1").unwrap();
        assert!(row.frames[0].is_none());
    }
    #[test]
    fn ambiguous_stems_and_nested_files_are_not_selected() {
        let (_tmp, paths) = folders(&[
            &["same.png", "same.webp", "ok.png"],
            &["same.png", "ok.png"],
        ]);
        let m = build(paths, None).unwrap();
        assert_eq!(m.scenes.len(), 1);
        assert!(m.warnings.iter().any(|w| w.contains("ambiguous stem")));
    }
    #[test]
    fn natural_sort_does_not_overflow() {
        assert!(natural_cmp("f2.png", "f10.png").is_lt());
        assert!(natural_cmp("f99999999999999999999999", "f100000000000000000000000").is_lt());
    }
    #[test]
    fn hundred_files_and_append_keep_every_naturally_sorted_source() {
        let temp = tempfile::tempdir().unwrap();
        let paths: Vec<String> = (1..=100)
            .rev()
            .map(|i| {
                let path = temp.path().join(format!("image{i}.png"));
                fs::write(&path, b"fixture").unwrap();
                path.to_string_lossy().into_owned()
            })
            .collect();
        let matrix = build(paths[..90].to_vec(), None).unwrap();
        let matrix = build(paths[90..].to_vec(), Some(matrix)).unwrap();
        assert_eq!(matrix.sources.len(), 100);
        assert_eq!(matrix.scenes[0].frames.iter().flatten().count(), 100);
        let sorted = build(paths, None).unwrap();
        assert_eq!(sorted.sources[0].label, "image1.png");
        assert_eq!(sorted.sources[99].label, "image100.png");
    }
    #[test]
    fn many_release_folders_retain_sparse_scene_cells() {
        let names: Vec<&[&str]> = (0..100)
            .map(|i| {
                if i == 99 {
                    &["shared.png"][..]
                } else {
                    &["shared.png", "other.png"][..]
                }
            })
            .collect();
        let (_temp, paths) = folders(&names);
        let matrix = build(paths, None).unwrap();
        assert_eq!(matrix.sources.len(), 100);
        assert_eq!(matrix.scenes.len(), 2);
        let other = matrix.scenes.iter().find(|s| s.label == "other").unwrap();
        assert_eq!(other.frames.len(), 100);
        assert!(other.frames[99].is_none());
    }
}
