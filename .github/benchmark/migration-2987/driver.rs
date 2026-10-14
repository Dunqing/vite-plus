use std::{io::Write, path::PathBuf, time::Instant};

fn main() {
    let root = PathBuf::from(std::env::args_os().nth(1).expect("fixture directory"));
    // Make file-cache conditions comparable. This is outside the measured phase.
    for path in vp_migration::find_ts_files(&root).unwrap().files {
        std::fs::read(path).unwrap();
    }
    let started = Instant::now();
    let result = vp_migration::rewrite_imports_in_directory(&root).unwrap();
    let seconds = started.elapsed().as_secs_f64();
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    let mut modified: Vec<_> = result
        .modified_files
        .iter()
        .map(|path| path.strip_prefix(&root).unwrap().to_string_lossy().into_owned())
        .collect();
    modified.sort();
    let mut warnings: Vec<_> = result
        .warnings
        .iter()
        .map(|(path, warning)| (path.strip_prefix(&root).unwrap(), warning))
        .collect();
    warnings.sort();
    let report = serde_json::json!({
        "seconds": seconds,
        "modified": modified,
        "unchanged": result.unchanged_files.len(),
        "warnings": warnings,
        "diagnostics": vp_migration::ci_benchmark_stats(),
    });
    writeln!(std::io::stdout().lock(), "{report}").unwrap();
}
