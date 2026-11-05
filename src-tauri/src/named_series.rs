//! Conservative filename-series detection for encoder comparison collections.
use crate::{
    matrix::{natural_cmp, supported},
    models::{ComparisonMatrix, Scene, Source},
};
use regex::Regex;
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::LazyLock,
};

static TOKENS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[\p{L}]+|[0-9]+").unwrap());

fn role(token: &str) -> Option<u8> {
    match token {
        "src" | "source" | "reference" | "ref" | "original" | "input" | "raw" | "a" => Some(0),
        "filter" | "filtered" | "final" | "out" | "output" | "encode" | "encoded" | "enc" | "b" => {
            Some(1)
        }
        _ => None,
    }
}

#[derive(Clone)]
struct Named {
    variant: String,
    rank: u8,
    scene: String,
}

struct Series {
    rank: u8,
    files: Vec<(String, String)>,
}

fn separator(c: char) -> bool {
    c.is_whitespace() || "_.-()[]{}".contains(c)
}

fn trim(value: &str) -> &str {
    value.trim_matches(separator)
}

fn identify(stem: &str) -> Option<Named> {
    let lower = stem.to_lowercase();
    let mut remaining = lower.as_str();
    // Explicit (a)/(b) or [a]/[b] markers also work on arbitrary scene names.
    let marker = ["(a)", "[a]", "(b)", "[b]"]
        .into_iter()
        .find(|s| remaining.ends_with(s));
    let marked_role = marker.map(|s| if s.contains('a') { 0 } else { 1 });
    if let Some(marker) = marker {
        remaining = trim(&remaining[..remaining.len() - marker.len()]);
    }
    let tokens: Vec<_> = TOKENS.find_iter(remaining).collect();
    let first = tokens.first();
    let last = tokens.last();
    let prefix = first.and_then(|t| {
        let rank = role(t.as_str())?;
        let before = &remaining[..t.start()];
        let after = &remaining[t.end()..];
        // Bare a1/b1 could be unrelated images; require a separator for A/B labels.
        let boundary = after.is_empty()
            || after.starts_with(separator)
            || (t.as_str().len() > 1 && after.starts_with(|c: char| c.is_ascii_digit()));
        (before.chars().all(separator) && boundary).then_some((t.as_str(), rank, trim(after)))
    });
    let suffix = last.and_then(|t| {
        let rank = role(t.as_str())?;
        let before = &remaining[..t.start()];
        let after = &remaining[t.end()..];
        (after.chars().all(separator) && (before.is_empty() || before.ends_with(separator)))
            .then_some((t.as_str(), rank, trim(before)))
    });
    let (variant, rank, scene) = if let Some((variant, rank, rest)) = prefix.or(suffix) {
        if marked_role.is_some_and(|marked| marked != rank) {
            return None;
        }
        (variant.to_string(), rank, rest)
    } else {
        let rank = marked_role?;
        (if rank == 0 { "a" } else { "b" }.into(), rank, remaining)
    };
    // Normalize separators and zero padding while preserving every identifying token.
    // Never pair by just the last number: episode1_01 and episode2_01 are different scenes.
    let scene = TOKENS
        .find_iter(scene)
        .map(|t| {
            let token = t.as_str();
            if token.bytes().all(|c| c.is_ascii_digit()) {
                let number = token.trim_start_matches('0');
                if number.is_empty() { "0" } else { number }
            } else {
                token
            }
        })
        .collect::<Vec<_>>()
        .join("_");
    Some(Named {
        variant,
        rank,
        scene,
    })
}

fn scan(folder: &Path) -> Result<Vec<PathBuf>, String> {
    let folder = fs::canonicalize(folder).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for entry in fs::read_dir(folder).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().map_err(|e| e.to_string())?.is_file() && supported(&entry.path()) {
            files.push(entry.path());
        }
    }
    files.sort_by(|a, b| natural_cmp(&a.to_string_lossy(), &b.to_string_lossy()));
    Ok(files)
}

pub fn from_folder(folder: &Path) -> Result<ComparisonMatrix, String> {
    build(scan(folder)?, false, &[])
}

pub fn from_files(files: &[PathBuf]) -> Option<Result<ComparisonMatrix, String>> {
    if !files.iter().all(|p| {
        p.file_stem()
            .is_some_and(|s| identify(&s.to_string_lossy()).is_some())
    }) {
        return None;
    }
    let variants: HashSet<_> = files
        .iter()
        .filter_map(|p| {
            Some((
                p.parent()?,
                identify(&p.file_stem()?.to_string_lossy())?.variant,
            ))
        })
        .collect();
    if variants.len() < 2 {
        return None;
    }
    Some(build(files.to_vec(), true, &[]))
}

pub fn append(paths: Vec<String>, previous: ComparisonMatrix) -> Result<ComparisonMatrix, String> {
    let mut files: Vec<_> = previous
        .sources
        .iter()
        .flat_map(|s| s.members.iter().flatten().map(PathBuf::from))
        .collect();
    let mut unique: HashSet<_> = files.iter().cloned().collect();
    let mut added_count = 0;
    for path in paths {
        let path = fs::canonicalize(&path).map_err(|e| e.to_string())?;
        let folder = path.is_dir();
        let added = if folder { scan(&path)? } else { vec![path] };
        for file in added {
            if !supported(&file) || !file.is_file() {
                return Err(
                    "Choose supported images or a folder of named comparison pairs.".into(),
                );
            }
            if !unique.insert(file.clone()) {
                if folder {
                    continue;
                }
                return Err("The same image was selected more than once.".into());
            }
            if file
                .file_stem()
                .and_then(|s| identify(&s.to_string_lossy()))
                .is_none()
            {
                if folder {
                    continue;
                }
                return Err(
                    "Added images need source/output names, such as src_01 and out_01.".into(),
                );
            }
            added_count += 1;
            files.push(file);
        }
    }
    if added_count == 0 {
        return Err("No new named comparison images were found.".into());
    }
    build(files, false, &previous.sources)
}

fn build(
    files: Vec<PathBuf>,
    strict: bool,
    previous: &[Source],
) -> Result<ComparisonMatrix, String> {
    let mut groups: BTreeMap<(String, String), Series> = BTreeMap::new();
    let mut skipped = 0;
    for path in files {
        let named = path
            .file_stem()
            .and_then(|s| identify(&s.to_string_lossy()));
        let Some(named) = named else {
            if strict {
                return Err(
                    "Added images need source/output names, such as src_01 and out_01.".into(),
                );
            }
            skipped += 1;
            continue;
        };
        let origin = path
            .parent()
            .ok_or("Image has no parent folder.")?
            .to_string_lossy()
            .into_owned();
        groups
            .entry((origin, named.variant))
            .or_insert_with(|| Series {
                rank: named.rank,
                files: vec![],
            })
            .files
            .push((named.scene, path.to_string_lossy().into_owned()));
    }
    if groups.len() < 2 {
        return Err("This folder needs at least two named image series, such as src_01 / final_01 or frame_01(a) / frame_01(b). For release folders, choose at least two folders.".into());
    }
    let mut groups: Vec<_> = groups.into_iter().collect();
    // Preserve existing columns on append; new columns follow them.
    groups.sort_by(|a, b| {
        let position = |key: &(String, String)| {
            previous
                .iter()
                .position(|s| {
                    s.origin == key.0
                        && s.members
                            .as_ref()
                            .and_then(|m| m.first())
                            .and_then(|p| Path::new(p).file_stem())
                            .and_then(|s| identify(&s.to_string_lossy()))
                            .is_some_and(|n| n.variant == key.1)
                })
                .unwrap_or(usize::MAX)
        };
        position(&a.0)
            .cmp(&position(&b.0))
            .then(a.1.rank.cmp(&b.1.rank))
            .then(natural_cmp(&a.0.1, &b.0.1))
            .then(natural_cmp(&a.0.0, &b.0.0))
    });
    let n = groups.len();
    let mut warnings = Vec::new();
    if skipped > 0 {
        warnings.push(format!(
            "{skipped} image(s) without source/output filename labels excluded."
        ));
    }
    let mut sources = Vec::new();
    let mut rows: BTreeMap<String, Vec<Vec<String>>> = BTreeMap::new();
    for (slot, ((origin, variant), series)) in groups.iter().enumerate() {
        let files = &series.files;
        let duplicate_label = groups.iter().filter(|g| g.0.1 == *variant).count() > 1;
        let label = if duplicate_label {
            format!(
                "{} · {variant}",
                Path::new(origin)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
            )
        } else if variant == "a" || variant == "b" {
            variant.to_uppercase()
        } else {
            variant.clone()
        };
        sources.push(Source {
            label,
            origin: origin.clone(),
            kind: "series".into(),
            members: Some(files.iter().map(|(_, p)| p.clone()).collect()),
        });
        for (scene, path) in files {
            rows.entry(scene.clone()).or_insert_with(|| vec![vec![]; n])[slot].push(path.clone());
        }
    }
    let mut scenes = Vec::new();
    let mut unmatched = 0;
    for (key, row) in rows {
        let label = if key.is_empty() {
            "Single scene".into()
        } else if let Ok(frame) = key.parse::<u64>() {
            format!("Frame {frame:05}")
        } else {
            key.clone()
        };
        let mut cells = Vec::new();
        for (slot, candidates) in row.iter().enumerate() {
            if candidates.len() > 1 {
                warnings.push(format!(
                    "{}: ambiguous {label} has {} images; left missing.",
                    sources[slot].label,
                    candidates.len()
                ));
            }
            cells.push((candidates.len() == 1).then(|| candidates[0].clone()));
        }
        let used = cells.iter().flatten().count();
        unmatched += row.iter().map(Vec::len).sum::<usize>() - if used >= 2 { used } else { 0 };
        if used >= 2 {
            scenes.push(Scene {
                id: format!("named:{key}"),
                label,
                frames: cells,
            });
        }
    }
    if unmatched > 0 {
        warnings.push(format!("{unmatched} unmatched or ambiguous image(s) excluded. Scenes need at least two sources."));
    }
    scenes.sort_by(|a, b| natural_cmp(&a.id, &b.id));
    if scenes.is_empty() {
        return Err(format!(
            "No unambiguous source/output pairs. Match the scene part of names, such as src_01 and final_01. {}",
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
    use crate::matrix;

    fn fixture(names: &[&str]) -> (tempfile::TempDir, Vec<String>) {
        let temp = tempfile::tempdir().unwrap();
        let paths = names
            .iter()
            .map(|name| {
                let path = temp.path().join(name);
                fs::write(&path, b"fixture").unwrap();
                path.to_string_lossy().into_owned()
            })
            .collect();
        (temp, paths)
    }

    #[test]
    fn comparison_folder_and_selected_files_form_four_ordered_pairs() {
        let (temp, paths) = fixture(&[
            "final_04.webp",
            "src_04.webp",
            "final_01.webp",
            "src_01.webp",
            "final_03.webp",
            "src_03.webp",
            "final_02.webp",
            "src_02.webp",
        ]);
        for input in [vec![temp.path().to_string_lossy().into_owned()], paths] {
            let matrix = matrix::build(input, None).unwrap();
            assert_eq!(
                matrix
                    .sources
                    .iter()
                    .map(|s| s.label.as_str())
                    .collect::<Vec<_>>(),
                ["src", "final"]
            );
            assert_eq!(matrix.scenes.len(), 4);
            assert!(matrix.warnings.is_empty());
            for (i, scene) in matrix.scenes.iter().enumerate() {
                assert_eq!(scene.label, format!("Frame {:05}", i + 1));
                assert!(
                    scene.frames[0]
                        .as_ref()
                        .unwrap()
                        .ends_with(&format!("src_{:02}.webp", i + 1))
                );
                assert!(
                    scene.frames[1]
                        .as_ref()
                        .unwrap()
                        .ends_with(&format!("final_{:02}.webp", i + 1))
                );
            }
        }
    }

    #[test]
    fn common_prefix_suffix_and_explicit_side_names_match() {
        for pair in [
            ["src(a).png", "out(b).png"],
            ["src_01.png", "filter_001.webp"],
            ["SOURCE (01).PNG", "FILTERED [001].webp"],
            ["01_src.png", "001_out.jpg"],
            ["frame_01(a).png", "frame_001(b).png"],
            ["a_01.png", "b_001.png"],
            ["src01.png", "out001.png"],
        ] {
            let (_temp, paths) = fixture(&pair);
            let matrix = matrix::build(paths, None).unwrap();
            assert_eq!(matrix.scenes.len(), 1, "{pair:?}");
            assert!(
                matrix.scenes[0].frames[0]
                    .as_ref()
                    .unwrap()
                    .ends_with(pair[0])
            );
            assert!(
                matrix.scenes[0].frames[1]
                    .as_ref()
                    .unwrap()
                    .ends_with(pair[1])
            );
        }
        assert!(identify("src(b)").is_none());
        assert!(identify("out(a)").is_none());
    }

    #[test]
    fn scene_identity_preserves_episode_numbers_and_natural_order() {
        let (_temp, paths) = fixture(&[
            "src_ep02_01.png",
            "out_ep2_001.png",
            "src_ep1_01.png",
            "out_ep01_1.png",
            "src_ep1_10.png",
            "out_ep1_010.png",
            "src_ep1_2.png",
            "out_ep1_02.png",
        ]);
        let matrix = matrix::build(paths, None).unwrap();
        assert_eq!(
            matrix
                .scenes
                .iter()
                .map(|s| s.id.as_str())
                .collect::<Vec<_>>(),
            [
                "named:ep_1_1",
                "named:ep_1_2",
                "named:ep_1_10",
                "named:ep_2_1"
            ]
        );
    }

    #[test]
    fn missing_and_ambiguous_variants_remain_explicit() {
        let (temp, _) = fixture(&[
            "src_01.png",
            "src_001.webp",
            "out_1.png",
            "filter_01.png",
            "src_2.png",
            "out_02.png",
            "src_3.png",
            "out_3.png",
            "unrelated.png",
        ]);
        fs::create_dir(temp.path().join("nested")).unwrap();
        fs::write(temp.path().join("nested/filter_2.png"), b"fixture").unwrap();
        let matrix = matrix::build(vec![temp.path().to_string_lossy().into_owned()], None).unwrap();
        assert_eq!(
            matrix
                .sources
                .iter()
                .map(|s| s.label.as_str())
                .collect::<Vec<_>>(),
            ["src", "filter", "out"]
        );
        assert_eq!(matrix.scenes.len(), 3);
        assert!(matrix.scenes[0].frames[0].is_none());
        assert!(matrix.scenes[1].frames[1].is_none());
        assert!(matrix.warnings.iter().any(|w| w.contains("ambiguous")));
        assert!(
            matrix
                .warnings
                .iter()
                .any(|w| w.contains("without source/output"))
        );
    }

    #[test]
    fn unknown_files_keep_single_scene_and_mismatched_named_frames_are_rejected() {
        let (_temp, paths) = fixture(&["a1.png", "b1.png", "image2.png"]);
        let matrix = matrix::build(paths, None).unwrap();
        assert_eq!(matrix.sources.len(), 3);
        assert_eq!(matrix.scenes[0].id, "files");
        let (_temp, paths) = fixture(&["src_01.png", "out_02.png"]);
        assert!(
            matrix::build(paths, None)
                .unwrap_err()
                .contains("No unambiguous")
        );
        let (_temp, paths) = fixture(&["src_01.png", "out_01.png", "holiday.png"]);
        assert_eq!(matrix::build(paths, None).unwrap().sources.len(), 3);
    }

    #[test]
    fn append_preserves_columns_extends_scenes_and_rescans_same_folder() {
        let (temp, paths) = fixture(&["src_1.png", "out_1.png", "src_2.png", "out_2.png"]);
        let matrix = matrix::build(paths[..2].to_vec(), None).unwrap();
        let matrix = matrix::build(paths[2..].to_vec(), Some(matrix)).unwrap();
        assert_eq!(matrix.scenes.len(), 2);
        fs::write(temp.path().join("filter_1.png"), b"fixture").unwrap();
        let matrix = matrix::build(
            vec![temp.path().to_string_lossy().into_owned()],
            Some(matrix),
        )
        .unwrap();
        assert_eq!(
            matrix
                .sources
                .iter()
                .map(|s| s.label.as_str())
                .collect::<Vec<_>>(),
            ["src", "out", "filter"]
        );
        assert!(matrix.scenes[1].frames[2].is_none());
        assert!(matrix::build(vec![paths[0].clone()], Some(matrix)).is_err());
    }

    #[test]
    fn duplicate_images_and_duplicate_scene_candidates_are_rejected() {
        let (_temp, paths) = fixture(&["src_01.png", "src_001.webp", "out_1.png"]);
        assert!(matrix::build(paths.clone(), None).is_err());
        assert!(matrix::build(vec![paths[0].clone(), paths[0].clone()], None).is_err());
    }
}
