set -euo pipefail
cargo xwin build --release --target x86_64-pc-windows-msvc -p vp_global_cli -p vp_installer
