from pathlib import Path
import json
import os
import shutil
import subprocess

ROOT = Path.cwd()
HERE = ROOT / '.github/benchmark/migration-2987'
OUT = Path(os.environ['RUNNER_TEMP']) / 'pr-2987'
OUT.mkdir(exist_ok=True)
META = json.loads((HERE / 'metadata.json').read_text())
SOURCE = ROOT / META['source']
LIB = ROOT / 'crates/vp_migration/src/lib.rs'
original_source = SOURCE.read_text()
original_lib = LIB.read_text()
example = ROOT / 'crates/vp_migration/examples/pr2987.rs'
example.parent.mkdir(exist_ok=True)
assert not example.exists()
shutil.copyfile(HERE / 'driver.rs', example)

def instrument(source):
    counters = ['CALLS', 'RULES', 'PARSES', 'PARSED_BYTES', 'EDIT_RULES', 'REPLACEMENTS']
    header = 'use std::sync::atomic::{AtomicU64, Ordering};\n'
    for name in counters:
        header += f'static BENCH_{name}: AtomicU64 = AtomicU64::new(0);\n'
    header += 'pub(crate) fn ci_benchmark_stats() -> serde_json::Value { serde_json::json!({\n'
    for name in counters:
        header += f'"{name.lower()}": BENCH_{name}.load(Ordering::Relaxed),\n'
    header += '}) }\n'
    source = source.replace('    let mut current = content.to_string();',
                            '    BENCH_CALLS.fetch_add(1, Ordering::Relaxed);\n    let mut current = content.to_string();')
    source = source.replace('        // Collect all matches and their replacements',
                            '        BENCH_RULES.fetch_add(1, Ordering::Relaxed);\n        // Collect all matches and their replacements')
    assert source.count('rule.language.ast_grep(&current)') == 1
    source = source.replace('rule.language.ast_grep(&current)',
                            '{ BENCH_PARSES.fetch_add(1, Ordering::Relaxed); BENCH_PARSED_BYTES.fetch_add(current.len() as u64, Ordering::Relaxed); rule.language.ast_grep(&current) }')
    source = source.replace('        // Replace from back to front to maintain correct positions',
                            '        BENCH_EDIT_RULES.fetch_add(1, Ordering::Relaxed);\n        BENCH_REPLACEMENTS.fetch_add(replacements.len() as u64, Ordering::Relaxed);\n        // Replace from back to front to maintain correct positions')
    return header + source

try:
    for diagnostic in [False, True]:
        for variant in ['before', 'after']:
            source = (HERE / 'before.rs').read_text() if variant == 'before' else original_source
            SOURCE.write_text(instrument(source) if diagnostic else source)
            stats = 'ast_grep::ci_benchmark_stats()' if diagnostic else 'serde_json::Value::Null'
            LIB.write_text(original_lib + f'\npub fn ci_benchmark_stats() -> serde_json::Value {{ {stats} }}\n')
            name = variant + ('-diagnostic' if diagnostic else '')
            print(f'BUILD {name}', flush=True)
            with (OUT / f'build-{name}.log').open('w') as log:
                subprocess.run(['cargo', 'build', '--locked', '--release', '-p', 'vp_migration', '--example', 'pr2987'],
                               stdout=log, stderr=subprocess.STDOUT, check=True)
            shutil.copy2(ROOT / 'target/release/examples/pr2987', OUT / name)
finally:
    SOURCE.write_text(original_source)
    LIB.write_text(original_lib)
    example.unlink()
